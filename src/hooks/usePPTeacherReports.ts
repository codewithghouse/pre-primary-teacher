/**
 * usePPTeacherReports — teacher-side archive of published daily reports.
 *
 * Mirrors the parent's useReportsArchive but queries by teacherData.schoolId
 * + primaryClass.id. Returns last N days of published (or auto-published)
 * pp_daily_activities docs so the teacher can browse what's been sent home.
 *
 * Used by Reports.tsx alongside usePPDailyActivities.publishReport for the
 * "generate & send today's report" action.
 */
import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  limit as fbLimit,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { DailySlot } from "./usePPDailyActivities";

export interface TeacherDailyReport {
  id: string;
  date: string;
  classId: string;
  schoolId: string;
  themeOfWeek?: string;
  slots: DailySlot[];
  slotsTotal: number;
  slotsDone: number;
  photosCount: number;
  reportStatus: "unpublished" | "preview" | "published" | "auto_published";
  reportHtml?: string;
  publishedAt?: string;
}

const PUBLISHED_STATUSES = ["published", "auto_published"];

export function usePPTeacherReports(
  classId: string | null | undefined,
  daysBack = 45
) {
  const [items, setItems] = useState<TeacherDailyReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!classId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const today = new Date();
    const lower = new Date(today);
    lower.setDate(lower.getDate() - daysBack);
    const lowerStr = lower.toLocaleDateString("en-CA");

    const q = query(
      collection(db, "pp_daily_activities"),
      where("classId", "==", classId),
      where("date", ">=", lowerStr),
      orderBy("date", "desc"),
      fbLimit(daysBack)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: TeacherDailyReport[] = [];
        snap.forEach((d) => {
          const data = d.data() as DocumentData;
          const reportStatus = (data.reportStatus as string) || "unpublished";
          if (!PUBLISHED_STATUSES.includes(reportStatus)) return;

          const slots = (data.slots as DailySlot[]) || [];
          const slotsDone = slots.filter((s) => s.status === "done").length;
          const photosCount = slots.reduce(
            (acc, s) => acc + (s.photoURLs?.length || 0),
            0
          );

          rows.push({
            id: d.id,
            date: (data.date as string) || "",
            classId: (data.classId as string) || "",
            schoolId: (data.schoolId as string) || "",
            themeOfWeek: data.themeOfWeek as string | undefined,
            slots,
            slotsTotal: slots.length,
            slotsDone,
            photosCount,
            reportStatus: reportStatus as TeacherDailyReport["reportStatus"],
            reportHtml: data.reportHtml as string | undefined,
            publishedAt: data.publishedAt as string | undefined,
          });
        });
        setItems(rows);
        setLoading(false);
      },
      (err) => {
        console.error("[usePPTeacherReports] subscription error:", err);
        setItems([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [classId, daysBack]);

  return { items, loading };
}
