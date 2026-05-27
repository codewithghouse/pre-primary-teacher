/**
 * Results.tsx (pre-primary-teacher-dashboard) — principal-uploaded report cards.
 *
 * PP teacher sees `pp_principal_results` scoped to their primary class
 * (resolved via the existing useTeacherClass hook). Per result row:
 * class-wide PDF + collapsible per-student PDF list. Read-only.
 *
 * Distinct from /reports (which serves the auto-generated daily report
 * archive). This page is for principal-authored term/quarterly reports.
 */
import { useEffect, useState } from "react";
import {
  FileText, Download, Calendar as CalendarIcon, Loader2, Users, ChevronRight,
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where, orderBy, type DocumentData } from "firebase/firestore";
import { useTeacherClass } from "@/hooks/useTeacherClass";
import { useAuth } from "@/lib/AuthContext";
import { format } from "date-fns";

interface StudentResult {
  studentId: string;
  studentName: string;
  rollNumber?: string;
  pdfUrl: string;
  pdfName: string;
  pdfSize: number;
}

interface ResultDoc extends DocumentData {
  id: string;
  schoolId: string;
  classId: string;
  className: string;
  section?: string;
  examName: string;
  examType: string;
  academicYear: string;
  term: string;
  examDate?: string;
  classPdfUrl?: string;
  classPdfName?: string;
  classPdfSize?: number;
  studentResults: StudentResult[];
  notes?: string;
  publishedAt?: any;
  status: "draft" | "published";
}

export default function Results() {
  const { teacherData } = useAuth();
  const { primaryClass, loading: classLoading } = useTeacherClass();
  const schoolId  = teacherData?.schoolId;
  const classId   = primaryClass?.id;

  const [results, setResults] = useState<ResultDoc[]>([]);
  const [loaded, setLoaded]   = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId || !classId) { setLoaded(true); return; }
    const q = query(
      collection(db, "pp_principal_results"),
      where("schoolId", "==", schoolId),
      orderBy("publishedAt", "desc"),
    );
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as ResultDoc))
        .filter(r => r.status === "published" && r.classId === classId);
      setResults(docs);
      setLoaded(true);
    }, err => {
      console.warn("[pp teacher results] subscription error:", err);
      setLoaded(true);
    });
    return () => unsub();
  }, [schoolId, classId]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1100px] mx-auto space-y-5">
      <header className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-pink-200 to-blue-200 text-[#1e294b] flex items-center justify-center shadow-sm">
          <FileText className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#1e294b] tracking-tight">Term Reports 📝</h1>
          <p className="text-xs text-slate-500 font-medium">
            Report cards published by the principal for {primaryClass?.name || "your class"}.
          </p>
        </div>
      </header>

      {classLoading || !loaded ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-[#1e3a8a]" /></div>
      ) : !classId ? (
        <div className="bg-white rounded-[28px] border border-slate-100 p-12 text-center shadow-sm">
          <Users className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-500">No class assigned yet.</p>
        </div>
      ) : results.length === 0 ? (
        <div className="bg-white rounded-[28px] border border-slate-100 p-12 text-center shadow-sm">
          <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-500 mb-1">No reports published yet</p>
          <p className="text-xs text-slate-400">When the principal publishes term reports, they will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {results.map(r => {
            const open = expandedId === r.id;
            return (
              <article key={r.id} className="bg-white rounded-[28px] border border-slate-100 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base sm:text-lg font-bold text-[#1e294b] mb-1">{r.examName}</h2>
                    <p className="text-xs text-slate-500 font-medium">
                      {r.className}{r.section ? ` · ${r.section}` : ""} · {r.academicYear}
                    </p>
                  </div>
                  {r.publishedAt?.toDate && (
                    <span className="shrink-0 inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                      <CalendarIcon className="w-3 h-3" /> {format(r.publishedAt.toDate(), "MMM d")}
                    </span>
                  )}
                </div>

                {r.notes && (
                  <p className="text-xs text-slate-700 bg-gradient-to-br from-blue-50 to-pink-50 rounded-xl px-3 py-2 mb-3">📌 {r.notes}</p>
                )}

                <div className="flex flex-wrap items-center gap-2 mb-1">
                  {r.classPdfUrl && (
                    <a href={r.classPdfUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#1e3a8a] text-xs font-bold transition-colors">
                      <Download className="w-3.5 h-3.5" /> Class summary
                    </a>
                  )}
                  <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-pink-50 text-pink-700 text-xs font-bold">
                    <Users className="w-3.5 h-3.5" /> {r.studentResults?.length || 0} children
                  </span>
                </div>

                {r.studentResults && r.studentResults.length > 0 && (
                  <>
                    <button
                      onClick={() => setExpandedId(open ? null : r.id)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-[#1e3a8a] transition-colors mt-2"
                    >
                      <ChevronRight className={`w-3 h-3 transition-transform ${open ? "rotate-90" : ""}`} />
                      {open ? "Hide" : "View"} per-child PDFs
                    </button>
                    {open && (
                      <div className="mt-3 max-h-80 overflow-y-auto space-y-1 pr-1 border-t border-slate-100 pt-3">
                        {r.studentResults.map(sr => (
                          <a key={sr.studentId} href={sr.pdfUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors">
                            <span className="text-xs font-medium text-slate-700 truncate">
                              {sr.rollNumber ? <span className="font-bold text-slate-400 mr-1">#{sr.rollNumber}</span> : null}
                              {sr.studentName}
                            </span>
                            <Download className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          </a>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
