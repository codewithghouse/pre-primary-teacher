import { useCallback, useEffect, useState } from "react";
import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";

export type DayMode = "half" | "full" | "extended";

export interface ClassSettings {
  classId: string;
  schoolId: string;
  themeOfWeek?: string;
  themeUpdatedAt?: string;
  diaperEnabled: boolean;
  napEnabled: boolean;
  mealsEnabled: boolean;
  photosEnabled: boolean;
  dayMode: DayMode;
  arrivalTime?: string;
  dismissalTime?: string;
  classAllergens: string[];
  updatedBy?: string;
  updatedByName?: string;
}

const defaults = (classId: string, schoolId: string): ClassSettings => ({
  classId,
  schoolId,
  themeOfWeek: "",
  diaperEnabled: true,
  napEnabled: true,
  mealsEnabled: true,
  photosEnabled: true,
  dayMode: "full",
  arrivalTime: "09:00",
  dismissalTime: "14:00",
  classAllergens: [],
});

/**
 * Reads + writes `pp_class_settings/{classId}`. Doc ID is the classId
 * itself so the per-class settings are deterministically addressable.
 */
export function usePPClassSettings(classId: string | null | undefined) {
  const { teacherData } = useAuth();
  const [settings, setSettings] = useState<ClassSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!classId || !teacherData?.schoolId) {
      setLoading(false);
      return;
    }
    const ref = doc(db, "pp_class_settings", classId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as DocumentData;
          setSettings({
            classId,
            schoolId: data.schoolId || teacherData.schoolId!,
            themeOfWeek: data.themeOfWeek,
            themeUpdatedAt: data.themeUpdatedAt,
            diaperEnabled: data.diaperEnabled !== false,
            napEnabled: data.napEnabled !== false,
            mealsEnabled: data.mealsEnabled !== false,
            photosEnabled: data.photosEnabled !== false,
            dayMode: (data.dayMode as DayMode) || "full",
            arrivalTime: data.arrivalTime,
            dismissalTime: data.dismissalTime,
            classAllergens: (data.classAllergens as string[]) || [],
            updatedBy: data.updatedBy,
            updatedByName: data.updatedByName,
          });
        } else {
          // No doc yet — return computed defaults; first save materialises it.
          setSettings(defaults(classId, teacherData.schoolId!));
        }
        setLoading(false);
      },
      (err) => {
        console.error("[usePPClassSettings] subscription:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [classId, teacherData?.schoolId]);

  const save = useCallback(
    async (next: Partial<ClassSettings>) => {
      if (!classId || !teacherData?.schoolId)
        throw new Error("Missing context");
      const ref = doc(db, "pp_class_settings", classId);
      const payload: DocumentData = {
        ...(settings || defaults(classId, teacherData.schoolId)),
        ...next,
        classId,
        schoolId: teacherData.schoolId,
        updatedBy: teacherData.id,
        updatedByName: teacherData.name || teacherData.email,
        updatedAt: serverTimestamp(),
      };
      if (next.themeOfWeek !== undefined) {
        payload.themeUpdatedAt = new Date().toISOString();
      }
      await setDoc(ref, payload, { merge: true });
    },
    [classId, teacherData, settings]
  );

  return { settings, loading, save };
}
