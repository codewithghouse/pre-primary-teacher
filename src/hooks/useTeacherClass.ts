import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";

export interface ClassDoc {
  id: string;
  schoolId?: string;
  name?: string;
  section?: string;
  classTeacherEmail?: string;
  classTeacherName?: string;
  teacherId?: string;
  teacherName?: string;
  [key: string]: unknown;
}

// Resolves the teacher's accessible classes by UNION of two sources:
//   (a) teaching_assignments where teacherId == tId  → modern canonical
//   (b) classes.teacherId == tId                     → legacy homeroom field
// Single-source previously missed freshly-onboarded teachers — same bug
// pattern documented in teacher-dashboard Attendance.tsx / MyClasses.tsx.
//
// V1 contract: returns the FIRST matching class (most pre-primary teachers
// homeroom one section). Multi-class support is Phase 3.
export function useTeacherClass() {
  const { teacherData } = useAuth();
  const [classes, setClasses] = useState<ClassDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teacherData?.id || !teacherData?.schoolId) {
      setLoading(false);
      return;
    }
    const tId = teacherData.id;
    const schoolId = teacherData.schoolId;

    let assignedIds = new Set<string>();
    let legacyOwnedIds = new Set<string>();
    let allClassDocs: ClassDoc[] = [];

    const recompute = () => {
      const allowed = new Set<string>([...assignedIds, ...legacyOwnedIds]);
      const cls =
        allowed.size === 0 ? [] : allClassDocs.filter((c) => allowed.has(c.id));
      setClasses(cls);
      setLoading(false);
    };

    const u1 = onSnapshot(
      query(
        collection(db, "teaching_assignments"),
        where("schoolId", "==", schoolId),
        where("teacherId", "==", tId)
      ),
      (snap) => {
        const active = snap.docs.filter((d) => {
          const s = (d.data() as DocumentData).status;
          return !s || (typeof s === "string" && s.toLowerCase() === "active");
        });
        assignedIds = new Set(
          active
            .map((d) => (d.data() as DocumentData).classId)
            .filter((x: unknown): x is string => typeof x === "string")
        );
        recompute();
      },
      (err) => console.error("[useTeacherClass] teaching_assignments:", err)
    );

    const u2 = onSnapshot(
      query(
        collection(db, "classes"),
        where("schoolId", "==", schoolId),
        where("teacherId", "==", tId)
      ),
      (snap) => {
        legacyOwnedIds = new Set(snap.docs.map((d) => d.id));
        recompute();
      },
      (err) => console.error("[useTeacherClass] classes.teacherId:", err)
    );

    const u3 = onSnapshot(
      query(collection(db, "classes"), where("schoolId", "==", schoolId)),
      (snap) => {
        allClassDocs = snap.docs.map(
          (d) => ({ ...(d.data() as DocumentData), id: d.id } as ClassDoc)
        );
        recompute();
      },
      (err) => console.error("[useTeacherClass] classes:", err)
    );

    return () => {
      u1();
      u2();
      u3();
    };
  }, [teacherData?.id, teacherData?.schoolId]);

  // First class for V1; multi-class switcher = Phase 3.
  const primaryClass = classes[0] || null;

  return { classes, primaryClass, loading };
}
