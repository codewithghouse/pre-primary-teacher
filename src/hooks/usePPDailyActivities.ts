import { useEffect, useState, useCallback } from "react";
import {
  doc,
  onSnapshot,
  serverTimestamp,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { auditedSet } from "@/lib/auditedWrites";
import { useAuth } from "@/lib/AuthContext";
import { todayISO, ppDailyDocId } from "@/lib/dates";

export type SlotStatus = "pending" | "in_progress" | "done" | "skipped";

export interface DailySlot {
  id: string;
  title: string;
  plannedStart: string;
  status: SlotStatus;
  note?: string;
  photoURLs?: string[];
  highlightedKids?: string[];
  skipReason?: string;
  completedAt?: string;
}

export interface PPDailyActivities {
  date: string;
  classId: string;
  schoolId: string;
  themeOfWeek?: string;
  slots: DailySlot[];
  reportStatus: "unpublished" | "preview" | "published" | "auto_published";
  reportHtml?: string;
  publishedAt?: string;
}

// Default day-template used when no doc exists yet for today.
// V2: read from `pp_daily_templates/{schoolId}` or `pp_daily_templates/{classId}`
// so principals can customise per-class.
const DEFAULT_TEMPLATE: DailySlot[] = [
  { id: "arrival", title: "Arrival & Circle Time", plannedStart: "9:00 AM", status: "pending" },
  { id: "free_play", title: "Free Play", plannedStart: "9:30 AM", status: "pending" },
  { id: "theme_1", title: "Theme Activity", plannedStart: "10:00 AM", status: "pending" },
  { id: "snack", title: "Snack", plannedStart: "10:45 AM", status: "pending" },
  { id: "outdoor", title: "Outdoor / Movement", plannedStart: "11:15 AM", status: "pending" },
  { id: "lunch", title: "Lunch", plannedStart: "12:00 PM", status: "pending" },
  { id: "nap", title: "Nap / Rest", plannedStart: "12:45 PM", status: "pending" },
  { id: "story", title: "Story Time", plannedStart: "2:30 PM", status: "pending" },
  { id: "closing", title: "Closing Circle", plannedStart: "3:15 PM", status: "pending" },
];

export function usePPDailyActivities(classId: string | null | undefined) {
  const { teacherData } = useAuth();
  const [data, setData] = useState<PPDailyActivities | null>(null);
  const [loading, setLoading] = useState(true);
  const today = todayISO();

  useEffect(() => {
    if (!classId || !teacherData?.schoolId) {
      setLoading(false);
      return;
    }
    const ref = doc(db, "pp_daily_activities", ppDailyDocId(today, classId));
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setData(snap.data() as PPDailyActivities);
        } else {
          // No doc yet → initialise in-memory with the default template.
          // First write will materialise it.
          setData({
            date: today,
            classId,
            schoolId: teacherData.schoolId!,
            slots: DEFAULT_TEMPLATE,
            reportStatus: "unpublished",
          });
        }
        setLoading(false);
      },
      (err) => {
        console.error("[usePPDailyActivities]", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [classId, teacherData?.schoolId, today]);

  // Upsert the whole doc — simpler than diff-based slot updates and avoids
  // race conditions with concurrent slot completions (rare but possible
  // when Didi + teacher both edit). Firestore's last-write-wins is fine
  // here; the writer is always the same class, and slot edits are append-
  // only in practice.
  const upsert = useCallback(
    async (next: Partial<PPDailyActivities>) => {
      if (!classId || !teacherData?.schoolId) throw new Error("Missing context");
      const ref = doc(
        db,
        "pp_daily_activities",
        ppDailyDocId(today, classId)
      );
      const payload: DocumentData = {
        date: today,
        classId,
        schoolId: teacherData.schoolId,
        teacherId: teacherData.id,
        teacherName: teacherData.name || "",
        slots: data?.slots || DEFAULT_TEMPLATE,
        reportStatus: data?.reportStatus || "unpublished",
        ...next,
        updatedAt: serverTimestamp(),
      };
      await auditedSet(ref, payload, { merge: true });
    },
    [classId, teacherData, today, data]
  );

  const updateSlot = useCallback(
    async (slotId: string, patch: Partial<DailySlot>) => {
      const current = data?.slots || DEFAULT_TEMPLATE;
      const next = current.map((s) => (s.id === slotId ? { ...s, ...patch } : s));
      await upsert({ slots: next });
    },
    [data, upsert]
  );

  const publishReport = useCallback(async () => {
    await upsert({
      reportStatus: "published",
      publishedAt: new Date().toISOString(),
    });
  }, [upsert]);

  return { data, loading, upsert, updateSlot, publishReport };
}
