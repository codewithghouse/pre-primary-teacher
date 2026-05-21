import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, Smile, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTeacherClass } from "@/hooks/useTeacherClass";
import { useClassRoster, type RosterChild } from "@/hooks/useClassRoster";
import {
  useTodayAttendance,
  type MoodKey,
  type AttendanceStatus,
} from "@/hooks/useTodayAttendance";
import { useAuth } from "@/lib/AuthContext";

const MOODS = [
  { key: "happy", emoji: "😊", label: "Happy", color: "bg-mood-happy" },
  { key: "ok", emoji: "😐", label: "OK", color: "bg-mood-ok" },
  { key: "crying", emoji: "😢", label: "Crying", color: "bg-mood-crying" },
  { key: "sleepy", emoji: "😴", label: "Sleepy", color: "bg-mood-sleepy" },
  { key: "unwell", emoji: "🤒", label: "Unwell", color: "bg-mood-unwell" },
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

  const loading = classLoading || rosterLoading || attLoading;

  // S2 class-teacher gate (mirrors teacher-dashboard MarkAttendance).
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
      // Already marked — just open mood sheet to update mood
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
    const pending = roster.filter((c) => {
      const status = records[c.id]?.status || "none";
      return status === "none";
    });
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
      toast.error(`${pending.length - failed}/${pending.length} saved. ${failed} failed.`, {
        id: "bulk",
      });
    }
  };

  if (loading && roster.length === 0) {
    return (
      <div className="px-4 py-12 flex flex-col items-center text-muted-foreground gap-3">
        <Loader2 className="w-6 h-6 animate-spin" />
        <p className="text-xs">Loading class…</p>
      </div>
    );
  }

  if (!primaryClass) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-sm font-bold text-edu-navy">No class assigned</p>
        <p className="text-xs text-muted-foreground mt-1">
          Ask your principal to assign you to a Playgroup / Nursery / LKG / UKG class.
        </p>
      </div>
    );
  }

  const stats = roster.reduce(
    (acc, c) => {
      const status = (records[c.id]?.status || "none") as AttendanceStatus;
      if (status === "present" || status === "late" || status === "half-day") acc.present++;
      else if (status === "absent") acc.absent++;
      else acc.pending++;
      return acc;
    },
    { present: 0, absent: 0, pending: 0 }
  );

  const sheetChild = moodSheetFor ? roster.find((c) => c.id === moodSheetFor) : null;
  const sheetMood = sheetChild ? records[sheetChild.id]?.mood : undefined;

  return (
    <div className="px-4 py-4 space-y-4 animate-fade-in">
      <div>
        <h1 className="text-xl font-black text-edu-navy">Attendance & Mood</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {primaryClass.name} · Tap to mark + capture arrival mood. Long-press for absent.
        </p>
      </div>

      {showGate && (
        <Card className="bg-edu-light-yellow border-edu-yellow">
          <CardContent className="p-3 text-xs text-foreground">
            <strong>Read-only:</strong> Only{" "}
            <strong>{primaryClass.classTeacherName || "the class teacher"}</strong> can mark daily attendance for this class.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Counter label="Present" value={stats.present} color="text-edu-green" />
        <Counter label="Absent" value={stats.absent} color="text-edu-red" />
        <Counter label="Pending" value={stats.pending} color="text-muted-foreground" />
      </div>

      {!showGate && stats.pending > 0 && (
        <Button onClick={bulkMarkRemaining} variant="secondary" size="sm" className="w-full">
          <Smile className="w-4 h-4" />
          Mark remaining {stats.pending} as Happy 😊
        </Button>
      )}

      {roster.length === 0 && !rosterLoading && (
        <div className="text-center py-8">
          <p className="text-sm font-bold text-edu-navy">No students enrolled</p>
          <p className="text-xs text-muted-foreground mt-1">
            Ask your principal to add students to {primaryClass.name}.
          </p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
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
            />
          );
        })}
      </div>

      {/* Mood bottom-sheet */}
      {sheetChild && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end animate-fade-in"
          onClick={() => setMoodSheetFor(null)}
        >
          <div
            className="w-full max-w-md mx-auto bg-white rounded-t-3xl p-5 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-border rounded-full mx-auto mb-4" />
            <div className="text-center mb-5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold">
                How did {sheetChild.name.split(" ")[0]} arrive?
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                This helps the parent feel at ease.
              </p>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {MOODS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => pickMood(m.key as MoodKey)}
                  className={cn(
                    "aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 active:scale-95 transition-all",
                    sheetMood === m.key
                      ? `${m.color} text-white shadow-md ring-2 ring-offset-2 ring-edu-navy`
                      : "bg-secondary hover:bg-secondary/80"
                  )}
                >
                  <span className="text-2xl">{m.emoji}</span>
                  <span className="text-[10px] font-bold">{m.label}</span>
                </button>
              ))}
            </div>
            <Button
              variant="ghost"
              className="w-full mt-4"
              onClick={() => setMoodSheetFor(null)}
            >
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Counter({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-3 text-center">
        <p className={cn("text-2xl font-black leading-none", color)}>{value}</p>
        <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mt-1">
          {label}
        </p>
      </CardContent>
    </Card>
  );
}

function ChildCard({
  child,
  status,
  mood,
  busy,
  onTap,
  onLongPress,
}: {
  child: RosterChild;
  status: AttendanceStatus;
  mood?: MoodKey;
  busy: boolean;
  onTap: () => void;
  onLongPress: () => void;
}) {
  const handlers = useLongPress(onLongPress, onTap, 500);
  const moodEmoji = MOODS.find((m) => m.key === mood)?.emoji;
  const isPresent = status === "present" || status === "late" || status === "half-day";

  return (
    <button
      type="button"
      {...handlers}
      disabled={busy}
      className={cn(
        "relative aspect-[3/4] rounded-2xl border-2 flex flex-col items-center justify-end overflow-hidden p-2 active:scale-95 transition-all",
        isPresent && "border-edu-green bg-edu-light-green/30",
        status === "absent" && "border-edu-red bg-edu-light-red/30 opacity-60",
        status === "none" && "border-border bg-white",
        busy && "opacity-50"
      )}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={cn(
            "w-14 h-14 rounded-full flex items-center justify-center text-xl font-black text-white",
            isPresent && "bg-edu-green",
            status === "absent" && "bg-edu-red",
            status === "none" && "bg-edu-navy/60"
          )}
        >
          {child.name
            .split(" ")
            .map((s) => s[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()}
        </div>
      </div>

      {isPresent && (
        <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-edu-green flex items-center justify-center text-white shadow">
          <Check className="w-3.5 h-3.5" />
        </div>
      )}
      {moodEmoji && (
        <div className="absolute top-1.5 left-1.5 text-lg">{moodEmoji}</div>
      )}
      {busy && (
        <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-edu-navy" />
        </div>
      )}

      <p className="relative text-[11px] font-bold text-foreground leading-tight truncate w-full text-center bg-white/85 rounded px-1 py-0.5">
        {child.name.split(" ")[0]}
      </p>
    </button>
  );
}

function useLongPress(onLong: () => void, onTap: () => void, ms = 500) {
  let timer: number | null = null;
  let triggered = false;

  const start = () => {
    triggered = false;
    timer = window.setTimeout(() => {
      triggered = true;
      onLong();
    }, ms);
  };
  const clear = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!triggered) onTap();
  };
  const cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
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
