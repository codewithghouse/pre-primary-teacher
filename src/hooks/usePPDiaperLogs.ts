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
import { todayISO, ppDiaperDocId } from "@/lib/dates";

export type DiaperType = "wet" | "soiled" | "mixed" | "dry_check" | "washroom";

export interface DiaperEntry {
  id: string;
  studentId: string;
  studentName: string;
  type: DiaperType;
  time: string;
  note?: string;
  recordedAt: string;
  recordedBy: string;
}

export interface PPDiaperLog {
  date: string;
  classId: string;
  schoolId: string;
  teacherId?: string;
  teacherName?: string;
  entries: DiaperEntry[];
}

const newEntryId = () =>
  `de_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const nowHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
};

export function usePPDiaperLogs(classId: string | null | undefined) {
  const { teacherData } = useAuth();
  const [data, setData] = useState<PPDiaperLog | null>(null);
  const [loading, setLoading] = useState(true);
  const today = todayISO();

  useEffect(() => {
    if (!classId || !teacherData?.schoolId) {
      setLoading(false);
      return;
    }
    const ref = doc(db, "pp_diaper_logs", ppDiaperDocId(today, classId));
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setData(snap.data() as PPDiaperLog);
        } else {
          setData({
            date: today,
            classId,
            schoolId: teacherData.schoolId!,
            entries: [],
          });
        }
        setLoading(false);
      },
      (err) => {
        console.error("[usePPDiaperLogs]", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [classId, teacherData?.schoolId, today]);

  const upsert = useCallback(
    async (nextEntries: DiaperEntry[]) => {
      if (!classId || !teacherData?.schoolId)
        throw new Error("Missing context");
      const ref = doc(db, "pp_diaper_logs", ppDiaperDocId(today, classId));
      const payload: DocumentData = {
        date: today,
        classId,
        schoolId: teacherData.schoolId,
        teacherId: teacherData.id,
        teacherName: teacherData.name || "",
        entries: nextEntries,
        updatedAt: serverTimestamp(),
      };
      await auditedSet(ref, payload, { merge: true });
    },
    [classId, teacherData, today]
  );

  const addEntry = useCallback(
    async (args: {
      studentId: string;
      studentName: string;
      type: DiaperType;
      note?: string;
    }) => {
      const current = data?.entries || [];
      const entry: DiaperEntry = {
        id: newEntryId(),
        studentId: args.studentId,
        studentName: args.studentName,
        type: args.type,
        time: nowHHMM(),
        note: args.note?.trim() || undefined,
        recordedAt: new Date().toISOString(),
        recordedBy: teacherData?.id || "",
      };
      await upsert([...current, entry]);
      return entry;
    },
    [data, upsert, teacherData?.id]
  );

  const undoLast = useCallback(
    async (studentId: string) => {
      const current = data?.entries || [];
      const idx = [...current]
        .reverse()
        .findIndex((e) => e.studentId === studentId);
      if (idx === -1) return;
      const realIdx = current.length - 1 - idx;
      const next = current.filter((_, i) => i !== realIdx);
      await upsert(next);
    },
    [data, upsert]
  );

  return { data, loading, addEntry, undoLast, upsert };
}

export const DIAPER_TYPE_LABEL: Record<DiaperType, string> = {
  wet: "Wet",
  soiled: "Soiled",
  mixed: "Wet + Soiled",
  dry_check: "Dry Check",
  washroom: "Washroom",
};

export const DIAPER_TYPE_EMOJI: Record<DiaperType, string> = {
  wet: "💧",
  soiled: "💩",
  mixed: "💧💩",
  dry_check: "✓",
  washroom: "🚽",
};
