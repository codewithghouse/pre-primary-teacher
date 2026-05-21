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
import { todayISO, ppPickupDocId } from "@/lib/dates";

export type PickupStatus = "pending" | "verified" | "mismatch" | "late";

export interface PickupRecord {
  studentId: string;
  studentName: string;
  status: PickupStatus;
  plannedPickupPersonName?: string;
  plannedPickupPersonRelation?: string;
  actualPickupPersonName?: string;
  actualPickupPersonRelation?: string;
  verificationSelfieURL?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  mismatchReason?: string;
  latePickupMinutes?: number;
}

export interface PPPickups {
  date: string;
  classId: string;
  schoolId: string;
  records: Record<string, PickupRecord>;
}

export function usePPPickups(classId: string | null | undefined) {
  const { teacherData } = useAuth();
  const [data, setData] = useState<PPPickups | null>(null);
  const [loading, setLoading] = useState(true);
  const today = todayISO();

  useEffect(() => {
    if (!classId || !teacherData?.schoolId) {
      setLoading(false);
      return;
    }
    const ref = doc(db, "pp_pickups", ppPickupDocId(today, classId));
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setData(snap.data() as PPPickups);
        } else {
          setData({
            date: today,
            classId,
            schoolId: teacherData.schoolId!,
            records: {},
          });
        }
        setLoading(false);
      },
      (err) => {
        console.error("[usePPPickups]", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [classId, teacherData?.schoolId, today]);

  const verifyPickup = useCallback(
    async (record: PickupRecord) => {
      if (!classId || !teacherData?.schoolId) throw new Error("Missing context");
      const ref = doc(db, "pp_pickups", ppPickupDocId(today, classId));
      const nextRecords = { ...(data?.records || {}), [record.studentId]: record };
      const payload: DocumentData = {
        date: today,
        classId,
        schoolId: teacherData.schoolId,
        teacherId: teacherData.id,
        records: nextRecords,
        updatedAt: serverTimestamp(),
      };
      await auditedSet(ref, payload, { merge: true });
    },
    [classId, teacherData, today, data]
  );

  return { data, loading, verifyPickup };
}
