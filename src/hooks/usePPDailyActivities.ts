import { useEffect, useState, useCallback } from "react";
import {
  collection,
  doc,
  limit as fbLimit,
  onSnapshot,
  query,
  serverTimestamp,
  where,
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
    const schoolId = teacherData.schoolId;

    // Use a LIST query (rule: `allow list: if signedIn()`) instead of a
    // single-doc GET (rule: `allow get: if signedIn() && inSameSchool()`).
    //
    // Why: the GET rule's `inSameSchool()` predicate reads
    // `resource.data.schoolId` — which evaluates to null/false when the doc
    // doesn't exist. So a GET on a not-yet-created `pp_daily_activities/
    // {today_classId}` doc gets denied with "Missing or insufficient
    // permissions", which crashes onSnapshot before the empty-snapshot
    // branch can render the default template.
    //
    // LIST queries don't trigger the per-doc rule, so an empty result is
    // fine. The query targets the same deterministic doc anyway via
    // (classId == X AND date == today) — the existing composite index
    // (classId+date DESC) covers it without a new index.
    const q = query(
      collection(db, "pp_daily_activities"),
      where("classId", "==", classId),
      where("date", "==", today),
      fbLimit(1)
    );

    const fallbackTemplate = (): PPDailyActivities => ({
      date: today,
      classId,
      schoolId,
      slots: DEFAULT_TEMPLATE,
      reportStatus: "unpublished",
    });

    const unsub = onSnapshot(
      q,
      (snap) => {
        if (!snap.empty) {
          setData(snap.docs[0].data() as PPDailyActivities);
        } else {
          // No doc yet → initialise in-memory with the default template.
          // First write will materialise it via the CREATE rule (which
          // checks `request.resource.data` not `resource.data`, so it
          // succeeds even on first-time create).
          setData(fallbackTemplate());
        }
        setLoading(false);
      },
      (err) => {
        // Safety net: even if the LIST query errors (rules tightening
        // mid-flight, network blip, etc.), fall back to the default
        // template so the teacher can still see + log slots. Writes go
        // through the CREATE rule which doesn't depend on existing
        // resource state.
        console.error("[usePPDailyActivities]", err);
        setData(fallbackTemplate());
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
