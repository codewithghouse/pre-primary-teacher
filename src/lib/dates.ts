// Date helpers — match teacher-dashboard's "en-CA" pattern which gives
// YYYY-MM-DD without timezone surprises. All Firestore date strings in
// this project use this format.

export function todayISO(): string {
  return new Date().toLocaleDateString("en-CA");
}

export function isoDate(d: Date): string {
  return d.toLocaleDateString("en-CA");
}

// Build the deterministic attendance doc ID — matches teacher-dashboard
// MarkAttendance.tsx pattern: `${studentId}_${classId}_${date}`.
export function attendanceDocId(
  studentId: string,
  classId: string,
  date: string
): string {
  return `${studentId}_${classId}_${date}`;
}

// Pre-primary daily activities doc ID: per-class-per-day.
// Convention: `${date}_${classId}` — date-first sorts chronologically in console.
export function ppDailyDocId(date: string, classId: string): string {
  return `${date}_${classId}`;
}

export function ppPickupDocId(date: string, classId: string): string {
  return `${date}_${classId}`;
}
