import { useEffect, useState } from "react";
import { doc, getDoc, type DocumentData } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";
import {
  attendanceDocId,
  isoDate,
  ppDiaperDocId,
  ppMealsNapsDocId,
} from "@/lib/dates";
import type {
  AttendanceStatus,
  MoodKey,
} from "./useTodayAttendance";
import type { DiaperEntry } from "./usePPDiaperLogs";
import type { MealEntry, NapEntry } from "./usePPMealsNaps";

export interface ChildAttendanceDay {
  date: string;
  status: AttendanceStatus | "none";
  mood?: MoodKey;
  arrivalTime?: string;
}

export interface ChildMealsNapsDay {
  date: string;
  meals: MealEntry[];
  naps: NapEntry[];
}

export interface ChildDiaperDay {
  date: string;
  entries: DiaperEntry[];
}

export interface ChildHistory {
  attendance: ChildAttendanceDay[];   // last 14 days, oldest → newest
  mealsNaps: ChildMealsNapsDay[];     // last 7 days, oldest → newest
  diaper: ChildDiaperDay[];           // last 7 days, oldest → newest
}

const lastNDays = (n: number): string[] => {
  const out: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push(isoDate(d));
  }
  return out;
};

// Direct-doc-ID fetcher — uses the deterministic doc IDs the daily
// collections write to (no composite indexes required). Far cheaper
// than range queries for a small lookback (14 reads + 7 + 7 = 28 docs).
//
// Refetches only when childId or classId changes. The hook intentionally
// does NOT subscribe — historical data doesn't change minute-to-minute,
// and re-rendering the 360 page on every today-doc write would be noisy.
export function useChildHistory(
  childId: string | null | undefined,
  classId: string | null | undefined
): { history: ChildHistory; loading: boolean } {
  const { teacherData } = useAuth();
  const [history, setHistory] = useState<ChildHistory>({
    attendance: [],
    mealsNaps: [],
    diaper: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!childId || !classId || !teacherData?.schoolId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const attendanceDates = lastNDays(14);
    const dailyDates = lastNDays(7);

    const attendancePromises = attendanceDates.map((date) =>
      getDoc(doc(db, "attendance", attendanceDocId(childId, classId, date)))
        .then((snap) => {
          if (!snap.exists()) return { date, status: "none" as const };
          const data = snap.data() as DocumentData;
          return {
            date,
            status: (data.status as AttendanceStatus) || ("none" as const),
            mood: data.mood as MoodKey | undefined,
            arrivalTime: data.arrivalTime as string | undefined,
          };
        })
        .catch(() => ({ date, status: "none" as const }))
    );

    const mealsNapsPromises = dailyDates.map((date) =>
      getDoc(doc(db, "pp_meals_naps", ppMealsNapsDocId(date, classId)))
        .then((snap) => {
          if (!snap.exists()) return { date, meals: [], naps: [] };
          const data = snap.data() as DocumentData;
          const meals: MealEntry[] = (data.meals || []).filter(
            (m: MealEntry) => m.studentId === childId
          );
          const naps: NapEntry[] = (data.naps || []).filter(
            (n: NapEntry) => n.studentId === childId
          );
          return { date, meals, naps };
        })
        .catch(() => ({ date, meals: [], naps: [] }))
    );

    const diaperPromises = dailyDates.map((date) =>
      getDoc(doc(db, "pp_diaper_logs", ppDiaperDocId(date, classId)))
        .then((snap) => {
          if (!snap.exists()) return { date, entries: [] };
          const data = snap.data() as DocumentData;
          const entries: DiaperEntry[] = (data.entries || []).filter(
            (e: DiaperEntry) => e.studentId === childId
          );
          return { date, entries };
        })
        .catch(() => ({ date, entries: [] }))
    );

    Promise.all([
      Promise.all(attendancePromises),
      Promise.all(mealsNapsPromises),
      Promise.all(diaperPromises),
    ]).then(([attendance, mealsNaps, diaper]) => {
      if (cancelled) return;
      setHistory({ attendance, mealsNaps, diaper });
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [childId, classId, teacherData?.schoolId]);

  return { history, loading };
}
