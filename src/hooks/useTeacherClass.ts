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
    let allClassesByEmail: ClassDoc[] = [];

    // Three-flag loading discipline — don't drop the page out of `loading`
    // until every source has reported back at least once. Without this, the
    // first listener to fire (often u3 with all classes but no assignments
    // yet computed) flips loading=false and the page renders "No class
    // assigned" before u1 has had a chance to deliver the assignment.
    let u1Loaded = false;
    let u2Loaded = false;
    let u3Loaded = false;

    const teacherEmail = (
      (teacherData.email as string | undefined) || ""
    ).toLowerCase();

    const recompute = () => {
      // Email-based fallback: PreTeachers writes
      // `classes.classTeacherEmail` + `classes.teacherEmail` at invite time
      // but NOT `classes.teacherId` (teacher's Firestore doc ID doesn't
      // exist on the class doc — only the assignment carries it). If the
      // teaching_assignments doc is missing or its teacherId doesn't match
      // (e.g. teacher record was re-created and assignment is stale), the
      // email match still recovers the class so the dashboard isn't dead
      // in the water.
      const emailMatchIds = new Set(
        allClassesByEmail.map((c) => c.id)
      );
      const allowed = new Set<string>([
        ...assignedIds,
        ...legacyOwnedIds,
        ...emailMatchIds,
      ]);
      const cls =
        allowed.size === 0
          ? []
          : allClassDocs.filter((c) => allowed.has(c.id));
      setClasses(cls);
      if (u1Loaded && u2Loaded && u3Loaded) setLoading(false);
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
        u1Loaded = true;
        recompute();
      },
      (err) => {
        console.error("[useTeacherClass] teaching_assignments:", err);
        u1Loaded = true;
        recompute();
      }
    );

    const u2 = onSnapshot(
      query(
        collection(db, "classes"),
        where("schoolId", "==", schoolId),
        where("teacherId", "==", tId)
      ),
      (snap) => {
        legacyOwnedIds = new Set(snap.docs.map((d) => d.id));
        u2Loaded = true;
        recompute();
      },
      (err) => {
        console.error("[useTeacherClass] classes.teacherId:", err);
        u2Loaded = true;
        recompute();
      }
    );

    const u3 = onSnapshot(
      query(collection(db, "classes"), where("schoolId", "==", schoolId)),
      (snap) => {
        allClassDocs = snap.docs.map(
          (d) => ({ ...(d.data() as DocumentData), id: d.id } as ClassDoc)
        );
        // Filter classes whose recorded teacher email matches the signed-in
        // teacher (covers the PreTeachers invite path where the class doc
        // carries classTeacherEmail / teacherEmail but no teacherId).
        allClassesByEmail = teacherEmail
          ? allClassDocs.filter((c) => {
              const a = String(
                (c.classTeacherEmail as string | undefined) || ""
              ).toLowerCase();
              const b = String(
                (c.teacherEmail as string | undefined) || ""
              ).toLowerCase();
              return a === teacherEmail || b === teacherEmail;
            })
          : [];
        u3Loaded = true;
        recompute();
      },
      (err) => {
        console.error("[useTeacherClass] classes:", err);
        u3Loaded = true;
        recompute();
      }
    );

    return () => {
      u1();
      u2();
      u3();
    };
  }, [teacherData?.id, teacherData?.schoolId, teacherData?.email]);

  // First class for V1; multi-class switcher = Phase 3.
  const primaryClass = classes[0] || null;

  return { classes, primaryClass, loading };
}
