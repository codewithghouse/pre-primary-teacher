import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Sparkles, AlertTriangle, X, CalendarOff, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import { useTeacherClass } from "@/hooks/useTeacherClass";
import { useClassRoster, type RosterChild } from "@/hooks/useClassRoster";
import {
  useTodayAttendance,
  type MoodKey,
  type AttendanceStatus,
} from "@/hooks/useTodayAttendance";
import { useAuth } from "@/lib/AuthContext";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { CartoonAvatar } from "@/components/CartoonAvatar";
import { subscribeSchoolHolidays, type SchoolHoliday } from "@/lib/schoolHolidays";
import { todayISO } from "@/lib/dates";

/* ═══════════════════════════════════════════════════════════════════════
   PRE-PRIMARY TEACHER · ATTENDANCE & MOOD
   Storybook-sherbet attendance grid. Tap = present + open mood sheet.
   Long-press = absent. Cartoon avatars, sticker checkmarks, pillow cards.
   ════════════════════════════════════════════════════════════════════════ */

const NAVY = "#1e3272";
const MINT = "#10B981";
const PEACH = "#FB923C";
const BLUSH = "#EC4899";
const SKY = "#0EA5E9";
const LAV = "#A78BFA";
const BUTTER = "#F59E0B";
const RED = "#EF4444";

const PILLOW =
  "0 1px 0 rgba(255,255,255,0.55) inset, 0 14px 32px -10px rgba(30,50,114,0.16), 0 4px 10px rgba(30,50,114,0.06)";

const MOODS = [
  { key: "happy", emoji: "😊", label: "Happy", tone: MINT },
  { key: "ok", emoji: "😐", label: "OK", tone: SKY },
  { key: "crying", emoji: "😢", label: "Crying", tone: BUTTER },
  { key: "sleepy", emoji: "😴", label: "Sleepy", tone: LAV },
  { key: "unwell", emoji: "🤒", label: "Unwell", tone: RED },
] as const;

export default function Attendance() {
  const { teacherData } = useAuth();
  const { primaryClass, loading: classLoading } = useTeacherClass();
  const { roster, loading: rosterLoading } = useClassRoster(primaryClass?.id);
  const { records, loading: attLoading, writeAttendance } = useTodayAttendance(
    primaryClass?.id
  );
  const [moodSheetFor, setMoodSheetFor] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const isDesktop = useIsDesktop();

  // ── School-holiday subscription ───────────────────────────────────────
  // Read principal-declared holidays + own previously-saved class holiday.
  // When today is one, show a celebratory banner and short-circuit roll
  // call. Mirrors the K-12 teacher dashboard pattern.
  const [schoolHolidays, setSchoolHolidays] = useState<SchoolHoliday[]>([]);
  useEffect(() => {
    if (!teacherData?.schoolId) return;
    const unsub = subscribeSchoolHolidays(
      teacherData.schoolId,
      setSchoolHolidays,
      (err) => console.error("[pre-Attendance] school_holidays:", err),
    );
    return () => unsub();
  }, [teacherData?.schoolId]);
  const todayKey = todayISO();
  const todaySchoolHoliday = useMemo(
    () => schoolHolidays.find((h) => h.date === todayKey) || null,
    [schoolHolidays, todayKey],
  );
  // If this class already has its day marked as holiday via the button
  // below, treat the day as a class holiday even when the principal
  // hasn't declared a school-wide one.
  const classDayIsHoliday = useMemo(() => {
    if (todaySchoolHoliday) return true;
    const rec = roster.find((c) => records[c.id]?.status === "holiday");
    return !!rec;
  }, [todaySchoolHoliday, roster, records]);

  // Holiday confirm modal + reason
  const [holidayOpen, setHolidayOpen] = useState(false);
  const [holidayReason, setHolidayReason] = useState("");
  const [holidaySaving, setHolidaySaving] = useState(false);

  const loading = classLoading || rosterLoading || attLoading;

  const classTeacherEmail = (primaryClass?.classTeacherEmail || "").toLowerCase();
  const myEmailLower = (teacherData?.email || "").toLowerCase();
  const classHasDesignation = classTeacherEmail.length > 0;
  const isClassTeacher =
    !classHasDesignation ||
    (myEmailLower.length > 0 && myEmailLower === classTeacherEmail);
  const showGate = classHasDesignation && !isClassTeacher;

  const setBusy = (id: string, on: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const markAndOpenMood = async (child: RosterChild) => {
    if (showGate) {
      toast.error(
        primaryClass?.classTeacherName
          ? `Only ${primaryClass.classTeacherName} (class teacher) can mark attendance.`
          : "Only the class teacher can mark attendance."
      );
      return;
    }
    const current = records[child.id]?.status;
    if (current === "absent" || current === "present" || current === "late") {
      setMoodSheetFor(child.id);
      return;
    }
    setBusy(child.id, true);
    try {
      await writeAttendance(
        {
          studentId: child.id,
          studentName: child.name,
          studentEmail: child.email,
          status: "present",
        },
        primaryClass?.name
      );
      setMoodSheetFor(child.id);
    } catch (err) {
      console.error("[Attendance] write failed:", err);
      toast.error("Could not save. Try again.");
    } finally {
      setBusy(child.id, false);
    }
  };

  // ── Holiday flow — declares the whole day off for the class ────────────
  // Writes one attendance doc per child with status:"holiday" + the
  // reason note. All attendance % readers across the 4 dashboards
  // short-circuit on this status, matching K-12 teacher behaviour.
  const saveHoliday = async () => {
    if (showGate) {
      toast.error(
        primaryClass?.classTeacherName
          ? `Only ${primaryClass.classTeacherName} (class teacher) can mark a class holiday.`
          : "Only the class teacher can mark a class holiday.",
      );
      return;
    }
    if (!roster.length) {
      toast.error("No children in this class yet.");
      return;
    }
    setHolidaySaving(true);
    try {
      const reason = holidayReason.trim() || todaySchoolHoliday?.reason || "School holiday";
      await Promise.all(
        roster.map((c) =>
          writeAttendance(
            {
              studentId: c.id,
              studentName: c.name,
              studentEmail: c.email,
              status: "holiday",
              note: reason,
            },
            primaryClass?.name,
          ),
        ),
      );
      toast.success(`Day marked as holiday · ${roster.length} children excluded from attendance %`);
      setHolidayOpen(false);
      setHolidayReason("");
    } catch (err) {
      console.error("[Attendance] holiday save failed:", err);
      toast.error("Could not mark holiday. Try again.");
    } finally {
      setHolidaySaving(false);
    }
  };

  const longPressAbsent = async (child: RosterChild) => {
    if (showGate) return;
    setBusy(child.id, true);
    try {
      await writeAttendance(
        {
          studentId: child.id,
          studentName: child.name,
          studentEmail: child.email,
          status: "absent",
        },
        primaryClass?.name
      );
      toast.success(`${child.name.split(" ")[0]} marked absent`);
    } catch (err) {
      console.error("[Attendance] absent write failed:", err);
      toast.error("Could not save. Try again.");
    } finally {
      setBusy(child.id, false);
    }
  };

  const pickMood = async (mood: MoodKey) => {
    if (!moodSheetFor) return;
    const child = roster.find((c) => c.id === moodSheetFor);
    if (!child) return;
    setBusy(child.id, true);
    try {
      await writeAttendance(
        {
          studentId: child.id,
          studentName: child.name,
          studentEmail: child.email,
          status: "present",
          mood,
        },
        primaryClass?.name
      );
      setMoodSheetFor(null);
      toast.success("Mood recorded");
    } catch (err) {
      console.error("[Attendance] mood write failed:", err);
      toast.error("Could not save mood. Try again.");
    } finally {
      setBusy(child.id, false);
    }
  };

  const bulkMarkRemaining = async () => {
    if (showGate) return;
    const pending = roster.filter(
      (c) => (records[c.id]?.status || "none") === "none"
    );
    if (!pending.length) return;
    toast.loading(`Marking ${pending.length} remaining…`, { id: "bulk" });
    const results = await Promise.allSettled(
      pending.map((c) =>
        writeAttendance(
          {
            studentId: c.id,
            studentName: c.name,
            studentEmail: c.email,
            status: "present",
            mood: "happy",
          },
          primaryClass?.name
        )
      )
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed === 0) {
      toast.success(`${pending.length} marked happy 😊`, { id: "bulk" });
    } else {
      toast.error(
        `${pending.length - failed}/${pending.length} saved. ${failed} failed.`,
        { id: "bulk" }
      );
    }
  };

  if (loading && roster.length === 0) {
    return (
      <div
        style={{
          padding: "48px 16px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          color: "#64748B",
        }}
      >
        <Loader2 className="animate-spin" />
        <p style={{ fontSize: 12, fontWeight: 600 }}>Loading class…</p>
      </div>
    );
  }

  if (!primaryClass) {
    return (
      <div style={{ padding: "48px 16px", textAlign: "center" }}>
        <p style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>
          🌱 No class assigned
        </p>
        <p style={{ fontSize: 12, color: "#64748B", marginTop: 6 }}>
          Ask your principal to assign you to a Playgroup / Nursery / LKG / UKG
          class.
        </p>
      </div>
    );
  }

  const stats = roster.reduce(
    (acc, c) => {
      const status = (records[c.id]?.status || "none") as AttendanceStatus;
      if (status === "present" || status === "late" || status === "half-day")
        acc.present++;
      else if (status === "absent") acc.absent++;
      else acc.pending++;
      return acc;
    },
    { present: 0, absent: 0, pending: 0 }
  );

  const sheetChild = moodSheetFor ? roster.find((c) => c.id === moodSheetFor) : null;
  const sheetMood = sheetChild ? records[sheetChild.id]?.mood : undefined;

  const gridCols = isDesktop ? "repeat(6, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))";

  return (
    <div
      className="animate-fade-in"
      style={{
        padding: isDesktop ? "24px 28px 80px" : "16px 16px 80px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        width: "100%",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: isDesktop ? "center" : "flex-start",
          justifyContent: "space-between",
          gap: 12,
          flexDirection: isDesktop ? "row" : "column",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: isDesktop ? 26 : 20,
              fontWeight: 800,
              letterSpacing: "-0.6px",
              color: NAVY,
            }}
          >
            Attendance & Mood{" "}
            <span
              aria-hidden
              style={{ display: "inline-block", transform: "rotate(-6deg)" }}
            >
              🌤️
            </span>
          </h1>
          <p
            style={{
              fontSize: isDesktop ? 13 : 12,
              fontWeight: 500,
              color: "#64748B",
              marginTop: 2,
            }}
          >
            {primaryClass.name} · Tap to mark + capture arrival mood. Long-press
            for absent.
          </p>
        </div>

        <div style={{
          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
          justifyContent: isDesktop ? "flex-end" : "flex-start",
        }}>
          {isDesktop && !showGate && stats.pending > 0 && (
            <BulkButton onClick={bulkMarkRemaining} count={stats.pending} />
          )}
          {!showGate && !classDayIsHoliday && (
            <button
              type="button"
              onClick={() => setHolidayOpen(true)}
              disabled={!roster.length}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "10px 14px", borderRadius: 16,
                background: "#fff",
                border: `1px solid ${PEACH}55`,
                fontSize: 12, fontWeight: 800, color: "#9A3412",
                letterSpacing: "-0.1px",
                cursor: roster.length ? "pointer" : "default",
                opacity: roster.length ? 1 : 0.5,
                boxShadow: PILLOW,
              }}
              title="Mark whole class day as holiday"
            >
              <CalendarOff size={14} strokeWidth={2.5} />
              Mark Day as Holiday
            </button>
          )}
        </div>
      </header>

      {/* School-holiday banner — principal-declared OR locally-marked.
          When visible, the roster underneath is still tappable so
          a teacher can correct mistakes, but the banner makes the
          state unmistakable. */}
      {classDayIsHoliday && (
        <div
          style={{
            position: "relative", overflow: "hidden",
            borderRadius: 22,
            padding: "14px 18px",
            background: `linear-gradient(135deg, ${PEACH}1a, ${BLUSH}14)`,
            border: `1px solid ${PEACH}55`,
            boxShadow: PILLOW,
            display: "flex",
            gap: 12,
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: 44, height: 44, borderRadius: 14,
              background: `linear-gradient(135deg, ${PEACH}, ${BLUSH})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", flexShrink: 0,
              transform: "rotate(-6deg)",
              boxShadow: `0 6px 14px ${PEACH}55`,
            }}
            aria-hidden
          >
            <PartyPopper size={22} strokeWidth={2.4} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "#9A3412" }}>
              {todaySchoolHoliday ? "School Holiday" : "Class Holiday"}
            </p>
            <p style={{ fontSize: 15, fontWeight: 800, color: NAVY, marginTop: 2, letterSpacing: "-0.2px" }}>
              {todaySchoolHoliday?.reason || holidayReason || "Today is off — no attendance needed."}
            </p>
            <p style={{ fontSize: 11, fontWeight: 500, color: "#64748B", marginTop: 3 }}>
              All children are excluded from today's attendance %.
            </p>
          </div>
        </div>
      )}

      {/* Holiday confirm modal */}
      {holidayOpen && (
        <div
          onClick={() => !holidaySaving && setHolidayOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 60,
            background: "rgba(15,23,42,0.45)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 420,
              background: "#fff",
              borderRadius: 24,
              padding: 22,
              boxShadow: "0 24px 60px rgba(15,23,42,0.20)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 13,
                background: `linear-gradient(135deg, ${PEACH}, ${BLUSH})`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", flexShrink: 0, boxShadow: `0 4px 10px ${PEACH}55`,
              }}>
                <CalendarOff size={18} strokeWidth={2.4} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: 16, fontWeight: 800, color: NAVY, letterSpacing: "-0.3px" }}>
                  Mark today as a holiday?
                </p>
                <p style={{ fontSize: 11, fontWeight: 500, color: "#64748B", marginTop: 2 }}>
                  {roster.length} child{roster.length === 1 ? "" : "ren"} in {primaryClass.name} will be excluded from today's attendance %.
                </p>
              </div>
            </div>
            <label style={{ display: "block", marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Reason (optional)
              </span>
              <input
                type="text"
                value={holidayReason}
                onChange={(e) => setHolidayReason(e.target.value)}
                placeholder="e.g. Republic Day, Founder's Day, snow"
                disabled={holidaySaving}
                style={{
                  marginTop: 6, width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #E2E8F0",
                  fontSize: 13, fontWeight: 600, color: NAVY,
                  outline: "none", fontFamily: "inherit",
                  background: holidaySaving ? "#F1F5F9" : "#fff",
                }}
              />
            </label>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => setHolidayOpen(false)}
                disabled={holidaySaving}
                style={{
                  flex: 1, padding: "11px 14px", borderRadius: 14,
                  background: "#F1F5F9",
                  fontSize: 13, fontWeight: 800, color: "#475569",
                  border: "none",
                  cursor: holidaySaving ? "default" : "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveHoliday}
                disabled={holidaySaving}
                style={{
                  flex: 1, padding: "11px 14px", borderRadius: 14,
                  background: `linear-gradient(135deg, ${PEACH}, ${BLUSH})`,
                  fontSize: 13, fontWeight: 800, color: "#fff",
                  border: "none",
                  cursor: holidaySaving ? "default" : "pointer",
                  boxShadow: `0 6px 14px ${PEACH}55`,
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
                }}
              >
                {holidaySaving ? <Loader2 size={14} className="animate-spin"/> : <CalendarOff size={14} strokeWidth={2.5}/>}
                {holidaySaving ? "Saving…" : "Confirm Holiday"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showGate && (
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 22,
            padding: "12px 16px",
            background: `linear-gradient(135deg, ${BUTTER}1f, ${PEACH}10)`,
            border: `1px solid ${BUTTER}55`,
            boxShadow: PILLOW,
            display: "flex",
            gap: 10,
            alignItems: "center",
          }}
        >
          <span
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              background: `linear-gradient(135deg, ${BUTTER}, ${PEACH})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              boxShadow: `0 6px 14px ${BUTTER}55`,
              flexShrink: 0,
              transform: "rotate(-6deg)",
            }}
          >
            <AlertTriangle size={18} strokeWidth={2.4} />
          </span>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>
            <strong>Read-only:</strong> Only{" "}
            <strong>
              {primaryClass.classTeacherName || "the class teacher"}
            </strong>{" "}
            can mark daily attendance for this class.
          </p>
        </div>
      )}

      {/* Counter strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 10,
        }}
      >
        <CounterCard
          label="Present"
          value={stats.present}
          emoji="🌤️"
          tone={MINT}
          surface="linear-gradient(135deg, #C9F5DE 0%, #F0FBF5 100%)"
        />
        <CounterCard
          label="Absent"
          value={stats.absent}
          emoji="📭"
          tone={RED}
          surface="linear-gradient(135deg, #FFD6D6 0%, #FFF1F1 100%)"
        />
        <CounterCard
          label="Pending"
          value={stats.pending}
          emoji="⏳"
          tone={NAVY}
          surface="linear-gradient(135deg, #E1ECFF 0%, #F7FAFF 100%)"
        />
      </div>

      {!isDesktop && !showGate && stats.pending > 0 && (
        <BulkButton onClick={bulkMarkRemaining} count={stats.pending} fullWidth />
      )}

      {roster.length === 0 && !rosterLoading && (
        <div
          style={{
            textAlign: "center",
            padding: "32px 16px",
            borderRadius: 22,
            background: "#fff",
            boxShadow: PILLOW,
          }}
        >
          <p style={{ fontSize: 28, marginBottom: 6 }}>🌱</p>
          <p style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>
            No students enrolled
          </p>
          <p style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>
            Ask your principal to add students to {primaryClass.name}.
          </p>
        </div>
      )}

      {/* Roster grid */}
      <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 12 }}>
        {roster.map((c) => {
          const rec = records[c.id];
          return (
            <ChildCard
              key={c.id}
              child={c}
              status={(rec?.status || "none") as AttendanceStatus}
              mood={rec?.mood}
              busy={busyIds.has(c.id)}
              onTap={() => markAndOpenMood(c)}
              onLongPress={() => longPressAbsent(c)}
              onMarkAbsent={() => longPressAbsent(c)}
            />
          );
        })}
      </div>

      {/* Mood bottom-sheet */}
      {sheetChild && (
        <div
          onClick={() => setMoodSheetFor(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            background: "rgba(15,23,42,0.42)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            display: "flex",
            alignItems: isDesktop ? "center" : "flex-end",
            justifyContent: "center",
            animation: "fade-in 200ms ease-out",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 460,
              background: "#fff",
              borderRadius: isDesktop ? 28 : "28px 28px 0 0",
              padding: 22,
              boxShadow: "0 -20px 60px rgba(15,23,42,0.18)",
              animation: "slide-up 240ms cubic-bezier(.34,1.56,.64,1)",
              position: "relative",
              overflow: "hidden",
              margin: isDesktop ? "0 16px" : 0,
            }}
          >
            <DotScribbles color={BLUSH} dense />

            {!isDesktop && (
              <div
                style={{
                  width: 48,
                  height: 5,
                  borderRadius: 999,
                  background: "#E2E8F0",
                  margin: "0 auto 14px",
                }}
              />
            )}

            <div style={{ textAlign: "center", marginBottom: 18, position: "relative", zIndex: 1 }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                <CartoonAvatar
                  name={sheetChild.name}
                  size={68}
                  ringColor={MINT}
                  ringWidth={4}
                />
              </div>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: BLUSH,
                }}
              >
                Arrival mood
              </p>
              <p
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  letterSpacing: "-0.3px",
                  color: NAVY,
                  marginTop: 4,
                }}
              >
                How did {sheetChild.name.split(" ")[0]} arrive?{" "}
                <span
                  aria-hidden
                  style={{ display: "inline-block", transform: "rotate(-8deg)" }}
                >
                  💗
                </span>
              </p>
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: "#94A3B8",
                  marginTop: 4,
                }}
              >
                This helps the parent feel at ease.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                gap: 8,
                position: "relative",
                zIndex: 1,
              }}
            >
              {MOODS.map((m) => {
                const selected = sheetMood === m.key;
                return (
                  <button
                    key={m.key}
                    onClick={() => pickMood(m.key as MoodKey)}
                    type="button"
                    style={{
                      aspectRatio: "1 / 1",
                      borderRadius: 18,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      background: selected
                        ? `linear-gradient(135deg, ${m.tone}, ${m.tone}cc)`
                        : "#F1F5F9",
                      color: selected ? "#fff" : "#334155",
                      boxShadow: selected
                        ? `0 6px 16px ${m.tone}55`
                        : "inset 0 0 0 1px #E2E8F0",
                      transition: "transform 140ms ease",
                      cursor: "pointer",
                    }}
                    className="active:scale-90 hover:-translate-y-0.5"
                  >
                    <span style={{ fontSize: 26, lineHeight: 1 }}>{m.emoji}</span>
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.04em" }}>
                      {m.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Mark Absent in-sheet escape — for teachers who tapped the
                card by mistake. Flips the just-written present record to
                absent and closes the sheet. Visible only when this isn't
                already an absent student (sheet only opens for non-absent
                anyway, so always rendered here). */}
            <div
              style={{
                marginTop: 14,
                display: "flex",
                gap: 10,
                alignItems: "center",
                position: "relative",
                zIndex: 1,
              }}
            >
              <button
                type="button"
                onClick={async () => {
                  await longPressAbsent(sheetChild);
                  setMoodSheetFor(null);
                }}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: 14,
                  background: "#FFF1F1",
                  border: `1px solid ${RED}33`,
                  fontSize: 13,
                  fontWeight: 800,
                  color: RED,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  letterSpacing: "-0.1px",
                }}
              >
                <X size={14} strokeWidth={3} />
                Mark as Absent
              </button>
              <button
                type="button"
                onClick={() => setMoodSheetFor(null)}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: 14,
                  background: "transparent",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#475569",
                  cursor: "pointer",
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ building blocks ═══════════════════════ */

function CounterCard({
  label,
  value,
  emoji,
  tone,
  surface,
}: {
  label: string;
  value: number;
  emoji: string;
  tone: string;
  surface: string;
}) {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 22,
        padding: "14px 14px 12px",
        background: surface,
        boxShadow: PILLOW,
      }}
    >
      <DotScribbles color={tone} />
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          position: "relative",
          zIndex: 1,
        }}
      >
        <span
          style={{
            fontSize: 32,
            fontWeight: 900,
            letterSpacing: "-1.2px",
            color: tone,
            lineHeight: 1,
          }}
        >
          {value}
        </span>
        <span
          style={{
            fontSize: 22,
            lineHeight: 1,
            transform: "rotate(8deg)",
            filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.08))",
          }}
          aria-hidden
        >
          {emoji}
        </span>
      </div>
      <p
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: tone,
          opacity: 0.75,
          marginTop: 6,
          position: "relative",
          zIndex: 1,
        }}
      >
        {label}
      </p>
    </div>
  );
}

function BulkButton({
  onClick,
  count,
  fullWidth = false,
}: {
  onClick: () => void;
  count: number;
  fullWidth?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: fullWidth ? "100%" : undefined,
        padding: "12px 18px",
        borderRadius: 18,
        background: `linear-gradient(135deg, ${MINT}, #059669)`,
        color: "#fff",
        fontSize: 13,
        fontWeight: 800,
        letterSpacing: "-0.1px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        boxShadow: `0 10px 24px -8px ${MINT}88`,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
      className="active:scale-95 hover:-translate-y-0.5 transition"
    >
      <Sparkles size={16} strokeWidth={2.6} />
      Mark remaining {count} as Happy 😊
    </button>
  );
}

function ChildCard({
  child,
  status,
  mood,
  busy,
  onTap,
  onLongPress,
  onMarkAbsent,
}: {
  child: RosterChild;
  status: AttendanceStatus;
  mood?: MoodKey;
  busy: boolean;
  onTap: () => void;
  onLongPress: () => void;
  onMarkAbsent: () => void;
}) {
  const handlers = useLongPress(onLongPress, onTap, 500);
  const moodEmoji = MOODS.find((m) => m.key === mood)?.emoji;
  const isPresent =
    status === "present" || status === "late" || status === "half-day";
  const isAbsent = status === "absent";

  const surface = isPresent
    ? "linear-gradient(135deg, #C9F5DE 0%, #F0FBF5 100%)"
    : isAbsent
    ? "linear-gradient(135deg, #FFD6D6 0%, #FFF1F1 100%)"
    : "linear-gradient(135deg, #F8FAFC 0%, #FFFFFF 100%)";

  const ring = isPresent ? MINT : isAbsent ? RED : "#CBD5E1";
  const scribble = isPresent ? MINT : isAbsent ? RED : NAVY;

  return (
    <button
      type="button"
      {...handlers}
      disabled={busy}
      style={{
        position: "relative",
        overflow: "hidden",
        aspectRatio: "3 / 4",
        borderRadius: 22,
        background: surface,
        boxShadow: PILLOW,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-end",
        padding: "12px 8px 10px",
        border: "none",
        cursor: busy ? "default" : "pointer",
        opacity: busy ? 0.6 : 1,
        transition: "transform 140ms ease",
      }}
      className="active:scale-95"
    >
      <DotScribbles color={scribble} />

      {/* Mark Absent button — explicit affordance so teachers don't have
          to discover the long-press gesture. Shown in BOTH the "none"
          decision state AND the "present" state, so a teacher can
          correct an accidental tap-to-present without long-pressing.
          Hidden only when the student is already absent (redundant).
          stopPropagation prevents the parent button's tap-to-present
          from firing. */}
      {status !== "absent" && (
        <span
          role="button"
          tabIndex={0}
          aria-label={`Mark ${child.name.split(" ")[0]} absent`}
          onClick={(e) => { e.stopPropagation(); if (!busy) onMarkAbsent(); }}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              if (!busy) onMarkAbsent();
            }
          }}
          style={{
            position: "absolute",
            top: 6,
            left: 6,
            width: 28,
            height: 28,
            borderRadius: 999,
            background: "#fff",
            color: RED,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 3px 8px rgba(239,68,68,0.25), 0 0 0 1px ${RED}33 inset`,
            cursor: busy ? "default" : "pointer",
            zIndex: 3,
            transform: "rotate(-6deg)",
            transition: "transform 120ms ease",
            touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
          }}
          title="Mark absent"
        >
          <X size={15} strokeWidth={3} />
        </span>
      )}

      {/* Avatar — centered, with status ring */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "44%",
          transform: "translateY(-50%)",
          display: "flex",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <CartoonAvatar
          name={child.name}
          size={64}
          ringColor={ring}
          ringWidth={3}
        />
      </div>

      {/* Present checkmark sticker top-right */}
      {isPresent && (
        <div
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 24,
            height: 24,
            borderRadius: 999,
            background: MINT,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 4px 10px ${MINT}55`,
            transform: "rotate(8deg)",
          }}
          aria-hidden
        >
          <Check size={14} strokeWidth={3} />
        </div>
      )}

      {/* Absent X sticker top-right */}
      {isAbsent && (
        <div
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            padding: "2px 8px",
            borderRadius: 999,
            background: RED,
            color: "#fff",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.08em",
            transform: "rotate(8deg)",
            boxShadow: `0 4px 10px ${RED}55`,
          }}
          aria-hidden
        >
          OFF
        </div>
      )}

      {/* Mood emoji — moved from top-left to bottom-LEFT so it no longer
          collides with the Mark Absent button that lives top-left when
          status !== "absent". Floats above the name pill. */}
      {moodEmoji && (
        <div
          style={{
            position: "absolute",
            bottom: 38,
            left: 8,
            fontSize: 22,
            transform: "rotate(-8deg)",
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.10))",
            pointerEvents: "none",
            zIndex: 2,
          }}
          aria-hidden
        >
          {moodEmoji}
        </div>
      )}

      {/* Busy overlay */}
      {busy && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(255,255,255,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Loader2 className="animate-spin" color={NAVY} />
        </div>
      )}

      {/* Name pill bottom */}
      <p
        style={{
          position: "relative",
          zIndex: 1,
          fontSize: 11,
          fontWeight: 800,
          color: "#0F172A",
          background: "rgba(255,255,255,0.88)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          padding: "3px 8px",
          borderRadius: 999,
          maxWidth: "100%",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {child.name.split(" ")[0]}
      </p>
    </button>
  );
}

function DotScribbles({
  color,
  dense = false,
}: {
  color: string;
  dense?: boolean;
}) {
  return (
    <svg
      aria-hidden="true"
      width="100%"
      height="100%"
      style={{
        position: "absolute",
        inset: 0,
        opacity: dense ? 0.1 : 0.07,
        pointerEvents: "none",
      }}
    >
      <circle cx="14%" cy="24%" r="2.5" fill={color} />
      <circle cx="82%" cy="14%" r="1.8" fill={color} />
      <circle cx="68%" cy="62%" r="2" fill={color} />
      <circle cx="22%" cy="80%" r="1.6" fill={color} />
      <circle cx="48%" cy="32%" r="1.4" fill={color} />
      {dense && (
        <>
          <circle cx="90%" cy="80%" r="2.2" fill={color} />
          <circle cx="6%" cy="60%" r="1.4" fill={color} />
          <circle cx="55%" cy="88%" r="1.6" fill={color} />
        </>
      )}
    </svg>
  );
}

function useLongPress(onLong: () => void, onTap: () => void, ms = 500) {
  // Previous version held `timer` and `triggered` in plain `let` vars at the
  // top of the hook body — those reset on every render, so any state change
  // during a press (busy flip, parent re-render) wiped the in-progress
  // timer + the "did we long-press?" flag. Result: long-press was
  // unreliable on real devices, which is why the founder thought there
  // was no way to mark a student absent. useRef survives re-renders.
  const timerRef     = useRef<number | null>(null);
  const triggeredRef = useRef(false);

  const start = () => {
    triggeredRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      triggeredRef.current = true;
      onLong();
    }, ms);
  };
  const clear = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!triggeredRef.current) onTap();
  };
  const cancel = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  return {
    onMouseDown: start,
    onMouseUp: clear,
    onMouseLeave: cancel,
    onTouchStart: start,
    onTouchEnd: clear,
    onTouchCancel: cancel,
  };
}
