import { useEffect, useState, useCallback } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { auditedSet } from "@/lib/auditedWrites";
import { useAuth } from "@/lib/AuthContext";
import { todayISO, attendanceDocId } from "@/lib/dates";

export type AttendanceStatus =
  | "present"
  | "absent"
  | "late"
  | "half-day"
  | "holiday"
  | "none";

export type MoodKey = "happy" | "ok" | "crying" | "sleepy" | "unwell";

export interface AttendanceRecord {
  studentId: string;
  status: AttendanceStatus;
  mood?: MoodKey;
  arrivalTime?: string;
  note?: string;
}

interface WriteArgs {
  studentId: string;
  studentName: string;
  studentEmail?: string;
  status: AttendanceStatus;
  mood?: MoodKey;
  note?: string;
}

// Subscribe to today's attendance for a class.
//
// Reads per-student attendance docs at id `studentId_classId_today`
// (matches teacher-dashboard MarkAttendance pattern), then exposes a
// `records` map keyed by studentId for fast lookup in the UI.
//
// Writes go through `auditedSet` so the `_lastModifiedBy/_lastModifiedAt`
// audit trail is preserved (no server-side trigger fills these in).
//
// Pre-primary additions:
//   - `mood` field (optional) — the separation-anxiety wedge feature.
//     Backward-compatible with K-12 attendance docs that don't set it.
//   - `arrivalTime` (optional) — ISO timestamp when present mark was set.
export function useTodayAttendance(classId: string | null | undefined) {
  const { teacherData } = useAuth();
  const [records, setRecords] = useState<Record<string, AttendanceRecord>>({});
  const [loading, setLoading] = useState(true);

  const today = todayISO();

  useEffect(() => {
    if (!classId || !teacherData?.schoolId) {
      setLoading(false);
      return;
    }
    const schoolId = teacherData.schoolId;

    const unsub = onSnapshot(
      query(
        collection(db, "attendance"),
        where("schoolId", "==", schoolId),
        where("classId", "==", classId),
        where("date", "==", today)
      ),
      (snap) => {
        const map: Record<string, AttendanceRecord> = {};
        snap.docs.forEach((d) => {
          const data = d.data() as DocumentData;
          const sid = data.studentId as string;
          if (!sid) return;
          map[sid] = {
            studentId: sid,
            status: (data.status as AttendanceStatus) || "none",
            mood: data.mood as MoodKey | undefined,
            arrivalTime: data.arrivalTime as string | undefined,
            note: data.note as string | undefined,
          };
        });
        setRecords(map);
        setLoading(false);
      },
      (err) => {
        console.error("[useTodayAttendance]", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [classId, teacherData?.schoolId, today]);

  const writeAttendance = useCallback(
    async (args: WriteArgs, className?: string) => {
      if (!classId || !teacherData?.schoolId || !teacherData?.id) {
        throw new Error("Missing class or teacher context");
      }
      const ref = doc(
        db,
        "attendance",
        attendanceDocId(args.studentId, classId, today)
      );
      await auditedSet(ref, {
        studentId: args.studentId,
        studentName: args.studentName,
        studentEmail: args.studentEmail || "",
        status: args.status,
        // Pre-primary extension fields — only set when supplied so K-12
        // attendance docs aren't bloated with undefined.
        ...(args.mood ? { mood: args.mood } : {}),
        ...(args.note ? { note: args.note } : {}),
        ...(args.status === "present"
          ? { arrivalTime: new Date().toISOString() }
          : {}),
        date: today,
        teacherId: teacherData.id,
        teacherName: teacherData.name || "",
        schoolId: teacherData.schoolId,
        branchId: teacherData.branchId || "",
        classId,
        className: className || teacherData.assignedClass || "",
        timestamp: serverTimestamp(),
      });
    },
    [classId, teacherData, today]
  );

  return { records, loading, writeAttendance };
}
