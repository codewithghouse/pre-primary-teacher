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

export interface RosterChild {
  id: string;             // studentId
  enrollId: string;       // the enrollments doc id
  name: string;
  email?: string;
  rollNo: string | number;
  photoURL?: string;
  // Pre-primary-specific (read from /students doc when available; fall back to
  // enrollment-denormalized fields). These power the safety-critical bottom-sheet.
  allergies?: string[];
  medical?: string;
  bloodGroup?: string;
  diet?: string;
  comfortCue?: string;
  parentName?: string;
  parentPhone?: string;
  parentEmail?: string;
  ageMonths?: number;
  authorizedPickup?: { name: string; relation: string; photoURL?: string }[];
  // Photo-sharing consent. Missing/true => allowed; explicit false => denied.
  photoConsent?: boolean;
}

// Reads the roster for a given classId via the `enrollments` collection
// (Edullent's canonical class-roster source, NOT /students directly).
// Each enrollment is denormalized with studentName / studentEmail / rollNo;
// pre-primary-specific fields (allergies, medical, diet, comfortCue, pickup)
// live on the /students doc and are merged in via a second listener.
export function useClassRoster(classId: string | null | undefined) {
  const { teacherData } = useAuth();
  const [roster, setRoster] = useState<RosterChild[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!classId || !teacherData?.schoolId) {
      setLoading(false);
      return;
    }
    const schoolId = teacherData.schoolId;

    let enrollments: RosterChild[] = [];
    const studentMeta = new Map<string, Partial<RosterChild>>();

    const merge = () => {
      const merged = enrollments.map((c) => ({
        ...c,
        ...(studentMeta.get(c.id) || {}),
      }));
      merged.sort((a, b) =>
        String(a.rollNo).localeCompare(String(b.rollNo), undefined, {
          numeric: true,
        })
      );
      setRoster(merged);
      setLoading(false);
    };

    const unsubEnrollments = onSnapshot(
      query(
        collection(db, "enrollments"),
        where("schoolId", "==", schoolId),
        where("classId", "==", classId)
      ),
      (snap) => {
        enrollments = snap.docs.map((d) => {
          const data = d.data() as DocumentData;
          const sId = (data.studentId as string) || d.id;
          return {
            id: sId,
            enrollId: d.id,
            name: (data.studentName as string) || "Student",
            email: (data.studentEmail as string) || "",
            rollNo: (data.rollNo as string | number) || "—",
          };
        });
        merge();
      },
      (err) => console.error("[useClassRoster] enrollments:", err)
    );

    // Optional second listener: student-level metadata (allergies, medical).
    // /students docs are scoped to school via schoolId; we filter client-side
    // by the enrolled IDs to avoid an IN-query (Firestore caps IN at 30 items
    // and pre-primary classes are < 30, but the simpler path is read-all-in-
    // school and filter — same pattern teacher-dashboard uses).
    const unsubStudents = onSnapshot(
      query(collection(db, "students"), where("schoolId", "==", schoolId)),
      (snap) => {
        studentMeta.clear();
        snap.docs.forEach((d) => {
          const data = d.data() as DocumentData;
          studentMeta.set(d.id, {
            photoURL: data.photoURL as string | undefined,
            allergies: (data.allergies as string[]) || [],
            medical: data.medical as string | undefined,
            bloodGroup: data.bloodGroup as string | undefined,
            diet: data.diet as string | undefined,
            comfortCue: data.comfortCue as string | undefined,
            parentName: data.parentName as string | undefined,
            parentPhone: data.parentPhone as string | undefined,
            parentEmail: data.parentEmail as string | undefined,
            ageMonths: data.ageMonths as number | undefined,
            authorizedPickup: data.authorizedPickup as
              | RosterChild["authorizedPickup"]
              | undefined,
            photoConsent: data.photoConsent as boolean | undefined,
          });
        });
        merge();
      },
      (err) => {
        // Don't fail the page if /students reads are not permitted by rules.
        // Fall back to enrollment-only data.
        console.warn(
          "[useClassRoster] /students read failed; falling back to enrollment data:",
          err
        );
      }
    );

    return () => {
      unsubEnrollments();
      unsubStudents();
    };
  }, [classId, teacherData?.schoolId]);

  return { roster, loading };
}
