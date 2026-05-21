import { useEffect, useState, useCallback } from "react";
import {
  collection,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  orderBy,
  limit as fbLimit,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { auditedAdd } from "@/lib/auditedWrites";
import { useAuth } from "@/lib/AuthContext";

export type BehaviorTier = "teacher_only" | "principal" | "parent";
export type BehaviorType = "positive" | "neutral" | "concern";

export interface BehaviorNote {
  id: string;
  schoolId: string;
  classId: string;
  studentId: string;
  studentName: string;
  content: string;
  tier: BehaviorTier;
  type: BehaviorType;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  date: string;
}

export const BEHAVIOR_TIER_LABEL: Record<BehaviorTier, string> = {
  teacher_only: "Teacher only",
  principal: "Principal + Teacher",
  parent: "Visible to parent",
};

export const BEHAVIOR_TYPE_LABEL: Record<BehaviorType, string> = {
  positive: "Positive",
  neutral: "Neutral",
  concern: "Concern",
};

export const BEHAVIOR_TYPE_COLOR: Record<BehaviorType, string> = {
  positive: "bg-edu-light-green text-edu-green border-edu-green/30",
  neutral: "bg-secondary text-foreground border-border",
  concern: "bg-edu-light-red text-edu-red border-edu-red/30",
};

export function usePPBehaviorNotes(classId: string | null | undefined) {
  const { teacherData } = useAuth();
  const [notes, setNotes] = useState<BehaviorNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!classId || !teacherData?.schoolId) {
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, "pp_behavior_notes"),
      where("schoolId", "==", teacherData.schoolId),
      where("classId", "==", classId),
      orderBy("createdAt", "desc"),
      fbLimit(200)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setNotes(
          snap.docs.map(
            (d) => ({ ...(d.data() as DocumentData), id: d.id } as BehaviorNote)
          )
        );
        setLoading(false);
      },
      (err) => {
        console.error("[usePPBehaviorNotes]", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [classId, teacherData?.schoolId]);

  const addNote = useCallback(
    async (args: {
      studentId: string;
      studentName: string;
      content: string;
      tier: BehaviorTier;
      type: BehaviorType;
    }) => {
      if (!classId || !teacherData?.schoolId)
        throw new Error("Missing context");
      const ref = collection(db, "pp_behavior_notes");
      const nowIso = new Date().toISOString();
      const payload: DocumentData = {
        schoolId: teacherData.schoolId,
        classId,
        studentId: args.studentId,
        studentName: args.studentName,
        content: args.content.trim(),
        tier: args.tier,
        type: args.type,
        createdBy: teacherData.id,
        createdByName: teacherData.name || "",
        createdAt: nowIso,
        date: nowIso.slice(0, 10),
        _createdServerAt: serverTimestamp(),
      };
      await auditedAdd(ref, payload);
    },
    [classId, teacherData]
  );

  return { notes, loading, addNote };
}
