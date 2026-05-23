import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Phone,
  MessageCircle,
  Mail,
  ShieldAlert,
  Heart,
  Loader2,
  Utensils,
  Moon,
  Droplet,
  Camera,
  Sticker,
  Sprout,
  Users,
  CalendarDays,
  Activity,
  GraduationCap,
} from "lucide-react";
import { ThemedCard, KpiCard } from "@/components/ThemedCard";
import { cn } from "@/lib/utils";
import { useTeacherClass } from "@/hooks/useTeacherClass";
import { useClassRoster } from "@/hooks/useClassRoster";
import { useTodayAttendance, type MoodKey } from "@/hooks/useTodayAttendance";
import {
  usePPMealsNaps,
  MEAL_TYPE_LABEL,
  PORTION_LABEL,
} from "@/hooks/usePPMealsNaps";
import {
  usePPDiaperLogs,
  DIAPER_TYPE_EMOJI,
} from "@/hooks/usePPDiaperLogs";
import {
  usePPBehaviorNotes,
  BEHAVIOR_TYPE_COLOR,
  BEHAVIOR_TYPE_LABEL,
  type BehaviorNote,
} from "@/hooks/usePPBehaviorNotes";
import {
  usePPMilestones,
  ALL_DOMAINS,
  ALL_LEVELS,
  DOMAIN_COLOR,
  DOMAIN_EMOJI,
  DOMAIN_LABEL,
  LEVEL_COLOR,
  LEVEL_LABEL,
  type Domain,
  type Milestone,
  type RubricLevel,
} from "@/hooks/usePPMilestones";
import { usePPPhotos } from "@/hooks/usePPPhotos";
import { useChildHistory, type ChildAttendanceDay } from "@/hooks/useChildHistory";
import { useIsDesktop } from "@/hooks/useIsDesktop";

// ─────────────────────────────────────────────────────────────
// Constants (vibe palette + helpers)
// ─────────────────────────────────────────────────────────────

const INK = "#1e3272";
const INK2 = "#5070B0";
const INK3 = "#99AACC";

const MOOD_EMOJI: Record<MoodKey, string> = {
  happy: "😊",
  ok: "🙂",
  sleepy: "😴",
  crying: "😢",
  unwell: "🤒",
};

const MOOD_LABEL: Record<MoodKey, string> = {
  happy: "Happy",
  ok: "Okay",
  sleepy: "Sleepy",
  crying: "Crying",
  unwell: "Unwell",
};

const STATUS_PILL: Record<string, { label: string; bg: string; fg: string }> = {
  present: { label: "Present", bg: "rgba(16,185,129,0.14)", fg: "#047857" },
  absent: { label: "Absent", bg: "rgba(239,68,68,0.14)", fg: "#B91C1C" },
  late: { label: "Late", bg: "rgba(245,158,11,0.16)", fg: "#92400E" },
  "half-day": { label: "Half day", bg: "rgba(0,85,255,0.12)", fg: "#1e40af" },
  holiday: { label: "Holiday", bg: "rgba(123,63,244,0.12)", fg: "#5b21b6" },
  none: { label: "Not marked", bg: "rgba(153,170,204,0.18)", fg: "#5070B0" },
};

const LEVEL_SCORE: Record<RubricLevel, number> = {
  beginning: 1,
  developing: 2,
  achieving: 3,
  excelling: 4,
};

const cleanPhone = (raw?: string): string => {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
};

const shortDate = (isoDay: string): { dd: string; ddd: string } => {
  const d = new Date(`${isoDay}T00:00:00`);
  return {
    dd: String(d.getDate()),
    ddd: d.toLocaleDateString("en-IN", { weekday: "short" }),
  };
};

const initials = (name: string): string =>
  name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

export default function ChildProfile360() {
  const { childId = "" } = useParams<{ childId: string }>();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();

  const { primaryClass, loading: classLoading } = useTeacherClass();
  const classId = primaryClass?.id;
  const { roster, loading: rosterLoading } = useClassRoster(classId);
  const { records: attendanceToday } = useTodayAttendance(classId);
  const { data: mealsNapsToday } = usePPMealsNaps(classId);
  const { data: diaperToday } = usePPDiaperLogs(classId);
  const { notes: allNotes } = usePPBehaviorNotes(classId);
  const { milestones: allMilestones } = usePPMilestones(classId);
  const { photos: photosToday } = usePPPhotos(classId);
  const { history } = useChildHistory(childId, classId);

  const child = useMemo(
    () => roster.find((c) => c.id === childId) || null,
    [roster, childId]
  );

  const childNotes = useMemo(
    () => allNotes.filter((n) => n.studentId === childId),
    [allNotes, childId]
  );
  const childMilestones = useMemo(
    () => allMilestones.filter((m) => m.studentId === childId),
    [allMilestones, childId]
  );
  const childPhotosToday = useMemo(
    () => photosToday.filter((p) => p.taggedStudentIds.includes(childId)),
    [photosToday, childId]
  );

  const todayMeals = useMemo(
    () => (mealsNapsToday?.meals || []).filter((m) => m.studentId === childId),
    [mealsNapsToday, childId]
  );
  const todayNaps = useMemo(
    () => (mealsNapsToday?.naps || []).filter((n) => n.studentId === childId),
    [mealsNapsToday, childId]
  );
  const todayDiaper = useMemo(
    () => (diaperToday?.entries || []).filter((e) => e.studentId === childId),
    [diaperToday, childId]
  );

  const todayAttendance = childId ? attendanceToday[childId] : undefined;
  const attendancePct = useMemo(() => {
    const marked = history.attendance.filter((d) => d.status !== "none");
    if (marked.length === 0) return null;
    const present = marked.filter(
      (d) => d.status === "present" || d.status === "late"
    ).length;
    return Math.round((present / marked.length) * 100);
  }, [history.attendance]);

  // ─── Empty / loading states ──────────────────────────────
  if (classLoading || rosterLoading) {
    return (
      <ScaffoldFrame>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "60vh",
            gap: 10,
          }}
        >
          <Loader2 className="animate-spin" size={20} color={INK} />
          <span style={{ fontSize: 13, color: INK3 }}>
            Loading child profile…
          </span>
        </div>
      </ScaffoldFrame>
    );
  }

  if (!primaryClass) {
    return (
      <ScaffoldFrame>
        <div style={{ padding: 64, textAlign: "center" }}>
          <p style={{ fontSize: 16, fontWeight: 600, color: INK }}>
            No class assigned
          </p>
          <p style={{ fontSize: 12, color: INK3, marginTop: 4 }}>
            Contact your principal to be added to a class.
          </p>
        </div>
      </ScaffoldFrame>
    );
  }

  if (!child) {
    return (
      <ScaffoldFrame>
        <div style={{ padding: 64, textAlign: "center" }}>
          <p style={{ fontSize: 16, fontWeight: 600, color: INK }}>
            Child not found in your class
          </p>
          <p style={{ fontSize: 12, color: INK3, marginTop: 6 }}>
            They may belong to a different class or have been archived.
          </p>
          <button
            type="button"
            onClick={() => navigate("/roster")}
            style={{
              marginTop: 14,
              padding: "8px 20px",
              borderRadius: 10,
              border: "1px solid rgba(30,50,114,0.10)",
              background: "#fff",
              color: INK,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ← Back to roster
          </button>
        </div>
      </ScaffoldFrame>
    );
  }

  const ageStr =
    child.ageMonths != null
      ? `${Math.floor(child.ageMonths / 12)}y ${child.ageMonths % 12}m`
      : null;

  // ─── Reusable sub-renderers ──────────────────────────────

  const IdentityPanel = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: isDesktop ? 16 : 4,
      }}
    >
      <div
        style={{
          width: isDesktop ? 140 : 112,
          height: isDesktop ? 140 : 112,
          borderRadius: "50%",
          border: `${isDesktop ? 4 : 3}px solid ${INK}`,
          background: "rgba(0,85,255,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 14,
          boxShadow: "0 10px 30px rgba(30,50,114,0.18)",
          overflow: "hidden",
        }}
      >
        {child.photoURL ? (
          <img
            src={child.photoURL}
            alt={child.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span
            style={{
              fontSize: isDesktop ? 42 : 34,
              fontWeight: 800,
              color: INK,
            }}
          >
            {initials(child.name)}
          </span>
        )}
      </div>
      <h2
        style={{
          fontSize: isDesktop ? 22 : 19,
          fontWeight: 800,
          color: INK,
          textAlign: "center",
          margin: 0,
        }}
      >
        {child.name}
      </h2>
      <p style={{ fontSize: 12, color: INK2, marginTop: 4 }}>
        {primaryClass.name}
        {ageStr ? ` · ${ageStr}` : ""}
      </p>
      <p style={{ fontSize: 11, color: INK3, marginTop: 2 }}>
        Roll {child.rollNo}
        {child.diet ? ` · ${child.diet}` : ""}
      </p>
      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap", justifyContent: "center" }}>
        <StatusPill status={todayAttendance?.status || "none"} />
        {todayAttendance?.mood && <MoodPill mood={todayAttendance.mood} />}
        {todayAttendance?.arrivalTime && (
          <span style={{ fontSize: 10, color: INK3, alignSelf: "center" }}>
            Arrived{" "}
            {new Date(todayAttendance.arrivalTime).toLocaleTimeString(
              "en-IN",
              { hour: "2-digit", minute: "2-digit" }
            )}
          </span>
        )}
      </div>
    </div>
  );

  const hasSafety =
    (child.allergies && child.allergies.length > 0) ||
    !!child.medical ||
    !!child.bloodGroup;

  const SafetyCard = hasSafety && (
    <ThemedCard
      title="Safety alerts"
      theme="orange"
      icon={ShieldAlert}
      watermark={ShieldAlert}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {child.allergies && child.allergies.length > 0 && (
          <p style={{ fontSize: 12, color: INK, margin: 0 }}>
            <span style={{ fontWeight: 700 }}>Allergies:</span>{" "}
            {child.allergies.join(", ")}
          </p>
        )}
        {child.medical && (
          <p style={{ fontSize: 12, color: INK, margin: 0 }}>
            <span style={{ fontWeight: 700 }}>Medical:</span> {child.medical}
          </p>
        )}
        {child.bloodGroup && (
          <p style={{ fontSize: 12, color: INK, margin: 0 }}>
            <span style={{ fontWeight: 700 }}>Blood group:</span>{" "}
            {child.bloodGroup}
          </p>
        )}
      </div>
    </ThemedCard>
  );

  const ParentCard = (
    <ThemedCard title="Parent contact" theme="navy" icon={Phone} watermark={Phone}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: INK, margin: 0 }}>
            {child.parentName || "Parent"}
          </p>
          <p
            style={{
              fontSize: 11,
              color: INK3,
              margin: 0,
              wordBreak: "break-all",
            }}
          >
            {child.parentEmail || child.email || "—"}
          </p>
          {child.parentPhone && (
            <p style={{ fontSize: 11, color: INK3, margin: 0 }}>
              {child.parentPhone}
            </p>
          )}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
          {child.parentPhone && (
            <>
              <ActionChip
                href={`tel:${cleanPhone(child.parentPhone).replace("+", "")}`}
                icon={<Phone size={12} />}
                label="Call"
                color="#0055FF"
              />
              <ActionChip
                href={`https://wa.me/${cleanPhone(child.parentPhone).replace(
                  "+",
                  ""
                )}`}
                external
                icon={<MessageCircle size={12} />}
                label="WhatsApp"
                color="#10B981"
              />
            </>
          )}
          {(child.parentEmail || child.email) && (
            <ActionChip
              href={`mailto:${child.parentEmail || child.email}`}
              icon={<Mail size={12} />}
              label="Email"
              color="#1e3272"
            />
          )}
        </div>
      </div>
    </ThemedCard>
  );

  const PickupCard =
    child.authorizedPickup && child.authorizedPickup.length > 0 && (
      <ThemedCard
        title="Authorized pickup"
        theme="blue"
        icon={Users}
        watermark={Users}
      >
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {child.authorizedPickup.map((p) => (
            <li
              key={p.name}
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              {p.photoURL ? (
                <img
                  src={p.photoURL}
                  alt={p.name}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "rgba(30,50,114,0.10)",
                    color: INK,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {initials(p.name)}
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: INK, margin: 0 }}>
                  {p.name}
                </p>
                <p style={{ fontSize: 10, color: INK3, margin: 0 }}>
                  {p.relation}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </ThemedCard>
    );

  const ComfortCard = child.comfortCue && (
    <ThemedCard
      title="Comfort cue"
      theme="pink"
      icon={Heart}
      watermark={Heart}
    >
      <p
        style={{
          fontSize: 13,
          color: INK,
          margin: 0,
          fontStyle: "italic",
          lineHeight: 1.5,
        }}
      >
        “{child.comfortCue}”
      </p>
    </ThemedCard>
  );

  // ─── KPI strip (4 bright stat cards) ─────────────────────
  const lastMeal = todayMeals[todayMeals.length - 1];
  const lastNap = todayNaps[todayNaps.length - 1];
  const lastDiaper = todayDiaper[todayDiaper.length - 1];

  const KpiStrip = (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isDesktop ? "repeat(4, 1fr)" : "repeat(2, 1fr)",
        gap: isDesktop ? 14 : 10,
      }}
    >
      <KpiCard
        theme="orange"
        label="Meals"
        value={todayMeals.length}
        hint={
          lastMeal
            ? `Last: ${MEAL_TYPE_LABEL[lastMeal.mealType]} (${PORTION_LABEL[lastMeal.portion]})`
            : "Nothing logged"
        }
        icon={Utensils}
        watermark={Utensils}
      />
      <KpiCard
        theme="blue"
        label="Nap"
        value={todayNaps.length}
        hint={
          lastNap
            ? lastNap.endTime
              ? `${lastNap.durationMin ?? "-"} min`
              : `Ongoing · ${lastNap.startTime}`
            : "Not yet"
        }
        icon={Moon}
        watermark={Moon}
      />
      <KpiCard
        theme="green"
        label="Care"
        value={todayDiaper.length}
        hint={
          lastDiaper
            ? `${DIAPER_TYPE_EMOJI[lastDiaper.type]} ${lastDiaper.time}`
            : "Nothing logged"
        }
        icon={Droplet}
        watermark={Droplet}
      />
      <KpiCard
        theme="pink"
        label="Photos"
        value={childPhotosToday.length}
        hint={childPhotosToday.length > 0 ? "tagged today" : "None yet"}
        icon={Camera}
        watermark={Camera}
      />
    </div>
  );

  // ─── Section bodies ──────────────────────────────────────

  const AttendanceBody = (
    <>
      <div
        style={{
          display: "flex",
          gap: 6,
          overflowX: "auto",
          paddingBottom: 4,
          marginBottom: 8,
        }}
      >
        {history.attendance.map((d) => (
          <AttendancePill key={d.date} day={d} />
        ))}
      </div>
      <AttendanceSummary
        days={history.attendance}
        pct={attendancePct}
      />
    </>
  );

  const GrowthBody = (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {ALL_DOMAINS.map((dom) => (
        <DomainProgress
          key={dom}
          domain={dom}
          milestones={childMilestones}
        />
      ))}
    </div>
  );

  const NotesBody =
    childNotes.length === 0 ? (
      <EmptyHint
        icon={<Sticker size={18} />}
        text="No notes recorded for this child yet."
      />
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {childNotes.slice(0, 5).map((n) => (
          <NoteCard key={n.id} note={n} />
        ))}
        {childNotes.length > 5 && (
          <Link
            to="/behavior"
            style={{
              fontSize: 11,
              color: "#0055FF",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            View all {childNotes.length} notes →
          </Link>
        )}
      </div>
    );

  const MilestonesBody =
    childMilestones.length === 0 ? (
      <EmptyHint
        icon={<Sprout size={18} />}
        text="No milestone observations yet."
      />
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {childMilestones.slice(0, 5).map((m) => (
          <MilestoneCard key={m.id} milestone={m} />
        ))}
        {childMilestones.length > 5 && (
          <Link
            to="/milestones"
            style={{
              fontSize: 11,
              color: "#0055FF",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            View all {childMilestones.length} milestones →
          </Link>
        )}
      </div>
    );

  const PhotosBody =
    childPhotosToday.length === 0 ? (
      <EmptyHint
        icon={<Camera size={18} />}
        text="No photos tagged with this child today."
      />
    ) : (
      <>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isDesktop ? "repeat(6, 1fr)" : "repeat(3, 1fr)",
            gap: 8,
          }}
        >
          {childPhotosToday.slice(0, isDesktop ? 12 : 6).map((p) => (
            <img
              key={p.id}
              src={p.storageUrl}
              alt={p.caption || child.name}
              loading="lazy"
              style={{
                aspectRatio: "1 / 1",
                width: "100%",
                objectFit: "cover",
                borderRadius: 10,
                border: "0.5px solid rgba(30,50,114,0.10)",
              }}
            />
          ))}
        </div>
        <Link
          to="/photos"
          style={{
            fontSize: 11,
            color: "#0055FF",
            fontWeight: 600,
            textDecoration: "none",
            marginTop: 8,
            display: "inline-block",
          }}
        >
          Open Photo Studio →
        </Link>
      </>
    );

  // ─── Layout ──────────────────────────────────────────────

  return (
    <ScaffoldFrame>
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: isDesktop ? 22 : 14,
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: isDesktop ? "8px 16px" : "7px 12px",
            borderRadius: 10,
            border: "1px solid rgba(30,50,114,0.12)",
            background: "#fff",
            color: INK2,
            fontSize: isDesktop ? 13 : 11,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <ArrowLeft size={isDesktop ? 14 : 13} />
          {isDesktop ? "BACK TO ROSTER" : "BACK"}
        </button>
      </div>

      {/* Hero — 3-col on desktop (left stack | photo center | right stack), single column on mobile (photo first) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isDesktop ? "1fr 280px 1fr" : "1fr",
          gap: isDesktop ? 20 : 14,
          marginBottom: isDesktop ? 22 : 16,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: isDesktop ? 14 : 12,
            order: isDesktop ? 0 : 2,
          }}
        >
          {SafetyCard}
          {ComfortCard}
          {!hasSafety && !child.comfortCue && (
            <ThemedCard
              title="Wellbeing"
              theme="green"
              icon={Heart}
              watermark={Heart}
            >
              <p style={{ fontSize: 12, color: INK2, margin: 0 }}>
                No safety alerts on file — ask the parent to add any allergies,
                medical notes or a comfort cue from the Parent app.
              </p>
            </ThemedCard>
          )}
        </div>

        <div style={{ order: isDesktop ? 0 : 1 }}>{IdentityPanel}</div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: isDesktop ? 14 : 12,
            order: isDesktop ? 0 : 3,
          }}
        >
          {ParentCard}
          {PickupCard}
        </div>
      </div>

      {/* KPI strip — 4 bright stat cards */}
      <div style={{ marginBottom: isDesktop ? 22 : 16 }}>{KpiStrip}</div>

      {/* Attendance + Growth (2-col) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isDesktop ? "1fr 1fr" : "1fr",
          gap: isDesktop ? 20 : 14,
          marginBottom: isDesktop ? 22 : 16,
        }}
      >
        <ThemedCard
          title="Attendance · last 14 days"
          theme="navy"
          icon={CalendarDays}
          watermark={Activity}
          action={
            attendancePct !== null ? (
              <span style={{ fontSize: 11, fontWeight: 700, color: INK }}>
                {attendancePct}%
              </span>
            ) : null
          }
        >
          {AttendanceBody}
        </ThemedCard>
        <ThemedCard
          title="Growth · NEP 2020 domains"
          theme="green"
          icon={Sprout}
          watermark={Sprout}
          action={
            <span style={{ fontSize: 11, fontWeight: 600, color: INK2 }}>
              {childMilestones.length} obs.
            </span>
          }
        >
          {GrowthBody}
        </ThemedCard>
      </div>

      {/* Notes + Milestones (2-col) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isDesktop ? "1fr 1fr" : "1fr",
          gap: isDesktop ? 20 : 14,
          marginBottom: isDesktop ? 22 : 16,
        }}
      >
        <ThemedCard
          title={`Recent notes · ${childNotes.length}`}
          theme="pink"
          icon={Sticker}
          watermark={Sticker}
        >
          {NotesBody}
        </ThemedCard>
        <ThemedCard
          title={`Recent milestones · ${childMilestones.length}`}
          theme="green"
          icon={GraduationCap}
          watermark={Sprout}
        >
          {MilestonesBody}
        </ThemedCard>
      </div>

      {/* Photos — full width */}
      <div style={{ marginBottom: isDesktop ? 22 : 16 }}>
        <ThemedCard
          title={`Today's photos · ${childPhotosToday.length}`}
          theme="blue"
          icon={Camera}
          watermark={Camera}
        >
          {PhotosBody}
        </ThemedCard>
      </div>
    </ScaffoldFrame>
  );
}

// ─────────────────────────────────────────────────────────────
// Layout / atoms
// ─────────────────────────────────────────────────────────────

function ScaffoldFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#EEF4FF",
        padding: "20px 24px 80px",
        fontFamily:
          "'Inter','Plus Jakarta Sans',-apple-system,sans-serif",
      }}
      className="max-w-[1280px] mx-auto"
    >
      {children}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const meta = STATUS_PILL[status] || STATUS_PILL.none;
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        padding: "4px 10px",
        borderRadius: 999,
        background: meta.bg,
        color: meta.fg,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    >
      {meta.label}
    </span>
  );
}

function MoodPill({ mood }: { mood: MoodKey }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        padding: "4px 10px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.65)",
        color: INK,
        border: "0.5px solid rgba(30,50,114,0.12)",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      <span style={{ fontSize: 13, lineHeight: 1 }}>{MOOD_EMOJI[mood]}</span>
      {MOOD_LABEL[mood]}
    </span>
  );
}

function ActionChip({
  href,
  icon,
  label,
  color,
  external,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  color: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "5px 10px",
        borderRadius: 999,
        background: color,
        color: "#fff",
        fontSize: 11,
        fontWeight: 700,
        textDecoration: "none",
      }}
    >
      {icon}
      {label}
    </a>
  );
}

function AttendancePill({ day }: { day: ChildAttendanceDay }) {
  const { dd, ddd } = shortDate(day.date);
  const meta = STATUS_PILL[day.status] || STATUS_PILL.none;
  const isMarked = day.status !== "none";
  return (
    <div
      title={`${day.date} · ${meta.label}`}
      style={{
        flexShrink: 0,
        minWidth: 36,
        height: 50,
        borderRadius: 10,
        border: isMarked
          ? `0.5px solid ${meta.fg}33`
          : "1px dashed rgba(153,170,204,0.45)",
        background: isMarked ? meta.bg : "rgba(255,255,255,0.6)",
        color: isMarked ? meta.fg : INK3,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 10,
      }}
    >
      <span style={{ fontWeight: 800 }}>{dd}</span>
      <span style={{ opacity: 0.7 }}>{ddd}</span>
    </div>
  );
}

function AttendanceSummary({
  days,
  pct,
}: {
  days: ChildAttendanceDay[];
  pct: number | null;
}) {
  const counts = days.reduce(
    (acc, d) => {
      if (d.status === "present") acc.present += 1;
      else if (d.status === "absent") acc.absent += 1;
      else if (d.status === "late") acc.late += 1;
      return acc;
    },
    { present: 0, absent: 0, late: 0 }
  );
  if (pct === null) {
    return (
      <p style={{ fontSize: 11, color: INK3, margin: 0 }}>
        No attendance recorded in the last 14 days.
      </p>
    );
  }
  return (
    <p style={{ fontSize: 11, color: INK2, margin: 0 }}>
      <span style={{ color: "#047857", fontWeight: 700 }}>
        {counts.present}P
      </span>{" "}
      ·{" "}
      <span style={{ color: "#B91C1C", fontWeight: 700 }}>
        {counts.absent}A
      </span>{" "}
      ·{" "}
      <span style={{ color: "#92400E", fontWeight: 700 }}>
        {counts.late}L
      </span>{" "}
      ·{" "}
      <span style={{ color: INK, fontWeight: 800 }}>{pct}%</span> attendance
    </p>
  );
}

function DomainProgress({
  domain,
  milestones,
}: {
  domain: Domain;
  milestones: Milestone[];
}) {
  const domainMs = milestones.filter((m) => m.domain === domain);
  const highest = domainMs.reduce<RubricLevel | null>((acc, m) => {
    if (!acc) return m.level;
    return LEVEL_SCORE[m.level] > LEVEL_SCORE[acc] ? m.level : acc;
  }, null);
  const reachedIdx = highest ? LEVEL_SCORE[highest] : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span
        className={cn(
          "shrink-0 rounded-full flex items-center justify-center border",
          DOMAIN_COLOR[domain]
        )}
        style={{ width: 32, height: 32, fontSize: 14 }}
      >
        {DOMAIN_EMOJI[domain]}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 4,
          }}
        >
          <p style={{ fontSize: 11, fontWeight: 700, color: INK, margin: 0 }}>
            {DOMAIN_LABEL[domain]}
          </p>
          <p style={{ fontSize: 10, color: INK3, margin: 0 }}>
            {domainMs.length} obs.
            {highest && (
              <>
                {" · "}
                <span className={cn("font-bold", LEVEL_COLOR[highest])}>
                  {LEVEL_LABEL[highest]}
                </span>
              </>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {ALL_LEVELS.map((lvl, i) => {
            const filled = i < reachedIdx;
            return (
              <div
                key={lvl}
                style={{
                  height: 6,
                  flex: 1,
                  borderRadius: 999,
                  background: filled ? INK : "rgba(30,50,114,0.12)",
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function NoteCard({ note }: { note: BehaviorNote }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.7)",
        border: "0.5px solid rgba(30,50,114,0.08)",
        borderRadius: 12,
        padding: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <span
          className={cn(
            "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border",
            BEHAVIOR_TYPE_COLOR[note.type]
          )}
        >
          {BEHAVIOR_TYPE_LABEL[note.type]}
        </span>
        <span style={{ fontSize: 10, color: INK3 }}>
          {new Date(note.createdAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
          })}
        </span>
      </div>
      <p
        style={{
          fontSize: 12,
          color: INK,
          lineHeight: 1.5,
          margin: 0,
        }}
      >
        {note.content}
      </p>
      <p style={{ fontSize: 10, color: INK3, marginTop: 6, margin: "6px 0 0" }}>
        — {note.createdByName}
      </p>
    </div>
  );
}

function MilestoneCard({ milestone }: { milestone: Milestone }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.7)",
        border: "0.5px solid rgba(30,50,114,0.08)",
        borderRadius: 12,
        padding: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <span
          className={cn(
            "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border inline-flex items-center gap-1",
            DOMAIN_COLOR[milestone.domain]
          )}
        >
          {DOMAIN_EMOJI[milestone.domain]} {DOMAIN_LABEL[milestone.domain]}
        </span>
        <span
          className={cn(
            "text-[10px] font-bold",
            LEVEL_COLOR[milestone.level]
          )}
        >
          {LEVEL_LABEL[milestone.level]}
        </span>
      </div>
      <p style={{ fontSize: 12, color: INK, lineHeight: 1.5, margin: 0 }}>
        {milestone.observation}
      </p>
      {milestone.evidence && (
        <p
          style={{
            fontSize: 10,
            color: INK3,
            margin: "4px 0 0",
            fontStyle: "italic",
          }}
        >
          Evidence: {milestone.evidence}
        </p>
      )}
      <p style={{ fontSize: 10, color: INK3, margin: "6px 0 0" }}>
        {new Date(milestone.recordedAt).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
        })}
        {milestone.term ? ` · ${milestone.term}` : ""}
      </p>
    </div>
  );
}

function EmptyHint({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px 12px",
        color: INK3,
        gap: 6,
      }}
    >
      {icon}
      <p style={{ fontSize: 12, margin: 0, textAlign: "center" }}>{text}</p>
    </div>
  );
}
