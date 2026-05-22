import { useEffect, useState, useCallback } from "react";
import {
  doc,
  getDocFromServer,
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
        // Surface the FULL Firestore metadata on every snapshot so we can
        // tell whether the local cache has pending writes that the server
        // hasn't acknowledged yet. If hasPendingWrites=true on a snap that
        // suddenly drops back to fewer entries, the server has rolled back
        // our write (typically a rules rejection).
        const d = snap.exists() ? (snap.data() as PPDiaperLog) : null;
        console.log("[usePPDiaperLogs] snapshot", {
          exists: snap.exists(),
          hasPendingWrites: snap.metadata.hasPendingWrites,
          fromCache: snap.metadata.fromCache,
          entries: d?.entries?.length ?? 0,
          docSchoolId: d?.schoolId,
        });
        if (d) {
          setData(d);
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
        console.error("[usePPDiaperLogs] listener error:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [classId, teacherData?.schoolId, today]);

  const upsert = useCallback(
    async (nextEntries: DiaperEntry[]) => {
      if (!classId || !teacherData?.schoolId)
        throw new Error("Missing context");
      const docId = ppDiaperDocId(today, classId);
      const ref = doc(db, "pp_diaper_logs", docId);
      const payload: DocumentData = {
        date: today,
        classId,
        schoolId: teacherData.schoolId,
        teacherId: teacherData.id,
        teacherName: teacherData.name || "",
        entries: nextEntries,
        updatedAt: serverTimestamp(),
      };
      console.log("[usePPDiaperLogs] writing", {
        docPath: `pp_diaper_logs/${docId}`,
        schoolId: teacherData.schoolId,
        classId,
        entryCount: nextEntries.length,
        sampleStudentIds: nextEntries.slice(-3).map((e) => e.studentId),
      });
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
      if (!classId || !teacherData?.schoolId)
        throw new Error("Missing class/school context");
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

      // Server verification — with offline persistence on, setDoc resolves
      // on local commit and silently rolls back on server rejection
      // (typically a Firestore rules failure). Force a server read so
      // we surface the rejection as a real thrown error the page can toast.
      try {
        const verifyRef = doc(
          db,
          "pp_diaper_logs",
          ppDiaperDocId(today, classId)
        );
        const verify = await getDocFromServer(verifyRef);
        if (!verify.exists()) {
          throw new Error(
            "Server did not persist the diaper log. Most likely cause: Firestore rules rejected the write because your teacher schoolId doesn't match your auth claim. Check DevTools console for the snapshot log."
          );
        }
        const verifyEntries =
          (verify.data().entries as DiaperEntry[] | undefined) || [];
        if (!verifyEntries.some((e) => e.id === entry.id)) {
          throw new Error(
            "Server rolled back the entry — likely Firestore rules rejection. Check DevTools console: look for hasPendingWrites=true on snapshot then dropping back to fewer entries."
          );
        }
      } catch (verifyErr) {
        // Re-throw with our message if it's the well-known not-found, else
        // surface the original Firestore error code.
        if (verifyErr instanceof Error && verifyErr.message.includes("Server")) {
          throw verifyErr;
        }
        throw new Error(
          `Write verification failed: ${
            verifyErr instanceof Error ? verifyErr.message : String(verifyErr)
          }`
        );
      }

      return entry;
    },
    [data, upsert, teacherData?.id, teacherData?.schoolId, classId, today]
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
