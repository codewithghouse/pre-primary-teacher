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
import { todayISO, ppMealsNapsDocId } from "@/lib/dates";

export type MealType = "breakfast" | "snack" | "lunch" | "tea_snack";
export type Portion = "none" | "some" | "most" | "all";

export interface MealEntry {
  id: string;
  studentId: string;
  studentName: string;
  mealType: MealType;
  portion: Portion;
  time: string;
  allergensFlagged?: string[];
  note?: string;
  recordedAt: string;
  recordedBy: string;
}

export interface NapEntry {
  id: string;
  studentId: string;
  studentName: string;
  startTime: string;
  endTime?: string;
  durationMin?: number;
  note?: string;
  recordedAt: string;
  recordedBy: string;
}

export interface PPMealsNaps {
  date: string;
  classId: string;
  schoolId: string;
  teacherId?: string;
  teacherName?: string;
  meals: MealEntry[];
  naps: NapEntry[];
}

const newId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const nowHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
};

export const MEAL_TYPE_LABEL: Record<MealType, string> = {
  breakfast: "Breakfast",
  snack: "Snack",
  lunch: "Lunch",
  tea_snack: "Tea Snack",
};

export const MEAL_TYPE_EMOJI: Record<MealType, string> = {
  breakfast: "🥣",
  snack: "🍎",
  lunch: "🍱",
  tea_snack: "🍪",
};

export const PORTION_LABEL: Record<Portion, string> = {
  none: "Refused",
  some: "Some",
  most: "Most",
  all: "All",
};

export const PORTION_PERCENT: Record<Portion, number> = {
  none: 0,
  some: 33,
  most: 66,
  all: 100,
};

export function usePPMealsNaps(classId: string | null | undefined) {
  const { teacherData } = useAuth();
  const [data, setData] = useState<PPMealsNaps | null>(null);
  const [loading, setLoading] = useState(true);
  const today = todayISO();

  useEffect(() => {
    if (!classId || !teacherData?.schoolId) {
      setLoading(false);
      return;
    }
    const ref = doc(db, "pp_meals_naps", ppMealsNapsDocId(today, classId));
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const d = snap.exists() ? (snap.data() as PPMealsNaps) : null;
        console.log("[usePPMealsNaps] snapshot", {
          exists: snap.exists(),
          hasPendingWrites: snap.metadata.hasPendingWrites,
          fromCache: snap.metadata.fromCache,
          meals: d?.meals?.length ?? 0,
          naps: d?.naps?.length ?? 0,
          docSchoolId: d?.schoolId,
        });
        if (d) {
          setData(d);
        } else {
          setData({
            date: today,
            classId,
            schoolId: teacherData.schoolId!,
            meals: [],
            naps: [],
          });
        }
        setLoading(false);
      },
      (err) => {
        console.error("[usePPMealsNaps] listener error:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [classId, teacherData?.schoolId, today]);

  const upsert = useCallback(
    async (next: Partial<PPMealsNaps>) => {
      if (!classId || !teacherData?.schoolId)
        throw new Error("Missing context");
      const docId = ppMealsNapsDocId(today, classId);
      const ref = doc(db, "pp_meals_naps", docId);
      const payload: DocumentData = {
        date: today,
        classId,
        schoolId: teacherData.schoolId,
        teacherId: teacherData.id,
        teacherName: teacherData.name || "",
        meals: data?.meals || [],
        naps: data?.naps || [],
        ...next,
        updatedAt: serverTimestamp(),
      };
      console.log("[usePPMealsNaps] writing", {
        docPath: `pp_meals_naps/${docId}`,
        schoolId: teacherData.schoolId,
        classId,
        mealsCount: (payload.meals as MealEntry[]).length,
        napsCount: (payload.naps as NapEntry[]).length,
      });
      await auditedSet(ref, payload, { merge: true });
    },
    [classId, teacherData, today, data]
  );

  const verifyServer = useCallback(
    async (
      check: (data: PPMealsNaps | undefined) => string | null
    ): Promise<void> => {
      if (!classId) return;
      const ref = doc(db, "pp_meals_naps", ppMealsNapsDocId(today, classId));
      const snap = await getDocFromServer(ref);
      const d = snap.exists() ? (snap.data() as PPMealsNaps) : undefined;
      const failureReason = check(d);
      if (failureReason) {
        throw new Error(
          `${failureReason} Most likely cause: Firestore rules rejected the write. Check DevTools console.`
        );
      }
    },
    [classId, today]
  );

  const addMeal = useCallback(
    async (args: {
      studentId: string;
      studentName: string;
      mealType: MealType;
      portion: Portion;
      allergensFlagged?: string[];
      note?: string;
    }) => {
      const meals = data?.meals || [];
      const entry: MealEntry = {
        id: newId("m"),
        studentId: args.studentId,
        studentName: args.studentName,
        mealType: args.mealType,
        portion: args.portion,
        time: nowHHMM(),
        allergensFlagged: args.allergensFlagged,
        note: args.note?.trim() || undefined,
        recordedAt: new Date().toISOString(),
        recordedBy: teacherData?.id || "",
      };
      await upsert({ meals: [...meals, entry] });
      await verifyServer((d) =>
        d?.meals?.some((m) => m.id === entry.id)
          ? null
          : "Server did not persist the meal entry."
      );
      return entry;
    },
    [data, upsert, teacherData?.id, verifyServer]
  );

  const startNap = useCallback(
    async (args: { studentId: string; studentName: string }) => {
      const naps = data?.naps || [];
      const entry: NapEntry = {
        id: newId("n"),
        studentId: args.studentId,
        studentName: args.studentName,
        startTime: nowHHMM(),
        recordedAt: new Date().toISOString(),
        recordedBy: teacherData?.id || "",
      };
      await upsert({ naps: [...naps, entry] });
      await verifyServer((d) =>
        d?.naps?.some((n) => n.id === entry.id)
          ? null
          : "Server did not persist the nap start."
      );
      return entry;
    },
    [data, upsert, teacherData?.id, verifyServer]
  );

  const endNap = useCallback(
    async (napId: string) => {
      const naps = data?.naps || [];
      const next = naps.map((n) => {
        if (n.id !== napId || n.endTime) return n;
        const end = nowHHMM();
        const [sh, sm] = n.startTime.split(":").map(Number);
        const [eh, em] = end.split(":").map(Number);
        const dur = Math.max(0, eh * 60 + em - (sh * 60 + sm));
        return { ...n, endTime: end, durationMin: dur };
      });
      await upsert({ naps: next });
      await verifyServer((d) => {
        const n = d?.naps?.find((x) => x.id === napId);
        return n?.endTime ? null : "Server did not persist the nap end.";
      });
    },
    [data, upsert, verifyServer]
  );

  const undoLastMeal = useCallback(
    async (studentId: string) => {
      const meals = data?.meals || [];
      const idx = [...meals]
        .reverse()
        .findIndex((m) => m.studentId === studentId);
      if (idx === -1) return;
      const realIdx = meals.length - 1 - idx;
      await upsert({ meals: meals.filter((_, i) => i !== realIdx) });
    },
    [data, upsert]
  );

  return {
    data,
    loading,
    addMeal,
    startNap,
    endNap,
    undoLastMeal,
    upsert,
  };
}
