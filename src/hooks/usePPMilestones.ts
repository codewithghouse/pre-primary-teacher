import { useEffect, useState, useCallback } from "react";
import {
  collection,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  orderBy,
  limit as fbLimit,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { auditedAdd } from "@/lib/auditedWrites";
import { useAuth } from "@/lib/AuthContext";

export type Domain =
  | "physical"
  | "cognitive"
  | "language"
  | "socio_emotional"
  | "creative";

export type RubricLevel = "beginning" | "developing" | "achieving" | "excelling";

export interface Milestone {
  id: string;
  schoolId: string;
  classId: string;
  studentId: string;
  studentName: string;
  domain: Domain;
  level: RubricLevel;
  observation: string;
  evidence?: string;
  term?: string;
  recordedBy: string;
  recordedByName: string;
  recordedAt: string;
  date: string;
}

export const DOMAIN_LABEL: Record<Domain, string> = {
  physical: "Physical",
  cognitive: "Cognitive",
  language: "Language",
  socio_emotional: "Socio-Emotional",
  creative: "Creative",
};

export const DOMAIN_EMOJI: Record<Domain, string> = {
  physical: "🏃",
  cognitive: "🧩",
  language: "🗣️",
  socio_emotional: "🤝",
  creative: "🎨",
};

export const DOMAIN_COLOR: Record<Domain, string> = {
  physical: "bg-edu-light-orange text-edu-orange border-edu-orange/30",
  cognitive: "bg-edu-light-blue text-edu-blue border-edu-blue/30",
  language: "bg-edu-light-green text-edu-green border-edu-green/30",
  socio_emotional: "bg-edu-light-yellow text-edu-yellow border-edu-yellow/40",
  creative: "bg-edu-pink/20 text-edu-pink border-edu-pink/30",
};

export const LEVEL_LABEL: Record<RubricLevel, string> = {
  beginning: "Beginning",
  developing: "Developing",
  achieving: "Achieving",
  excelling: "Excelling",
};

export const LEVEL_COLOR: Record<RubricLevel, string> = {
  beginning: "text-edu-red",
  developing: "text-edu-yellow",
  achieving: "text-edu-green",
  excelling: "text-edu-blue",
};

const currentTerm = (): string => {
  const d = new Date();
  const m = d.getMonth() + 1;
  const y = d.getFullYear();
  if (m <= 3) return `Term 3 ${y - 1}-${String(y).slice(2)}`;
  if (m <= 6) return `Term 1 ${y}-${String(y + 1).slice(2)}`;
  if (m <= 9) return `Term 2 ${y}-${String(y + 1).slice(2)}`;
  return `Term 3 ${y}-${String(y + 1).slice(2)}`;
};

export function usePPMilestones(classId: string | null | undefined) {
  const { teacherData } = useAuth();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!classId || !teacherData?.schoolId) {
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, "pp_milestones"),
      where("schoolId", "==", teacherData.schoolId),
      where("classId", "==", classId),
      orderBy("recordedAt", "desc"),
      fbLimit(300)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setMilestones(
          snap.docs.map(
            (d) => ({ ...(d.data() as DocumentData), id: d.id } as Milestone)
          )
        );
        setLoading(false);
      },
      (err) => {
        console.error("[usePPMilestones]", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [classId, teacherData?.schoolId]);

  const addMilestone = useCallback(
    async (args: {
      studentId: string;
      studentName: string;
      domain: Domain;
      level: RubricLevel;
      observation: string;
      evidence?: string;
    }) => {
      if (!classId || !teacherData?.schoolId)
        throw new Error("Missing context");
      const ref = collection(db, "pp_milestones");
      const nowIso = new Date().toISOString();
      const payload: DocumentData = {
        schoolId: teacherData.schoolId,
        classId,
        studentId: args.studentId,
        studentName: args.studentName,
        domain: args.domain,
        level: args.level,
        observation: args.observation.trim(),
        evidence: args.evidence?.trim() || undefined,
        term: currentTerm(),
        recordedBy: teacherData.id,
        recordedByName: teacherData.name || "",
        recordedAt: nowIso,
        date: nowIso.slice(0, 10),
        _createdServerAt: serverTimestamp(),
      };
      await auditedAdd(ref, payload);
    },
    [classId, teacherData]
  );

  return { milestones, loading, addMilestone };
}

export const ALL_DOMAINS: Domain[] = [
  "physical",
  "cognitive",
  "language",
  "socio_emotional",
  "creative",
];

export const ALL_LEVELS: RubricLevel[] = [
  "beginning",
  "developing",
  "achieving",
  "excelling",
];
