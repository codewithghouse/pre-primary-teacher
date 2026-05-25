import { useCallback, useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  limit as fbLimit,
  type DocumentData,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { auditedAdd } from "@/lib/auditedWrites";
import { useAuth } from "@/lib/AuthContext";

export type IncidentType =
  | "injury"
  | "behaviour"
  | "medical"
  | "safety"
  | "other";

export type IncidentSeverity = "low" | "medium" | "high" | "critical";

export interface Incident {
  id: string;
  schoolId: string;
  classId: string;
  studentId: string;
  studentName: string;
  type: IncidentType;
  severity: IncidentSeverity;
  title: string;
  description: string;
  actionTaken?: string;
  parentNotified?: boolean;
  parentNotifiedAt?: string;
  witnessId?: string;
  witnessName?: string;
  photos?: string[];
  createdBy: string;
  createdByName: string;
  createdAt: string;
  date: string;
  handled: boolean;
  handledBy?: string;
  handledAt?: string;
}

export const INCIDENT_TYPE_LABEL: Record<IncidentType, string> = {
  injury: "Injury",
  behaviour: "Behaviour",
  medical: "Medical",
  safety: "Safety",
  other: "Other",
};

export const INCIDENT_TYPE_EMOJI: Record<IncidentType, string> = {
  injury: "🩹",
  behaviour: "⚠️",
  medical: "💊",
  safety: "🛡️",
  other: "📝",
};

export const SEVERITY_LABEL: Record<IncidentSeverity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const SEVERITY_COLOR: Record<
  IncidentSeverity,
  { bg: string; fg: string; bar: string }
> = {
  low: { bg: "rgba(16,185,129,0.14)", fg: "#047857", bar: "#10B981" },
  medium: { bg: "rgba(245,158,11,0.16)", fg: "#92400E", bar: "#F59E0B" },
  high: { bg: "rgba(249,115,22,0.16)", fg: "#9A3412", bar: "#F97316" },
  critical: { bg: "rgba(220,38,38,0.16)", fg: "#7F1D1D", bar: "#DC2626" },
};

export const ALL_INCIDENT_TYPES: IncidentType[] = [
  "injury",
  "behaviour",
  "medical",
  "safety",
  "other",
];

export const ALL_SEVERITIES: IncidentSeverity[] = [
  "low",
  "medium",
  "high",
  "critical",
];

// Class-scoped real-time subscription to pp_incidents. Same pattern as
// usePPBehaviorNotes — orderBy createdAt desc, limit 200.
//
// Writes:
//   • addIncident(args) — appends new incident with handled=false. Schema
//     matches the hardened firestore.rules `pp_incidents` create whitelist.
export function usePPIncidents(classId: string | null | undefined) {
  const { teacherData } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!classId || !teacherData?.schoolId) {
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, "pp_incidents"),
      where("schoolId", "==", teacherData.schoolId),
      where("classId", "==", classId),
      orderBy("createdAt", "desc"),
      fbLimit(200)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setIncidents(
          snap.docs.map(
            (d) => ({ ...(d.data() as DocumentData), id: d.id } as Incident)
          )
        );
        setLoading(false);
      },
      (err) => {
        console.error("[usePPIncidents]", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [classId, teacherData?.schoolId]);

  const addIncident = useCallback(
    async (args: {
      studentId: string;
      studentName: string;
      type: IncidentType;
      severity: IncidentSeverity;
      title: string;
      description: string;
      actionTaken?: string;
      parentNotified?: boolean;
      witnessId?: string;
      witnessName?: string;
    }) => {
      if (!classId || !teacherData?.schoolId)
        throw new Error("Missing class/school context");
      const ref = collection(db, "pp_incidents");
      const nowIso = new Date().toISOString();
      const payload: DocumentData = {
        schoolId: teacherData.schoolId,
        classId,
        studentId: args.studentId,
        studentName: args.studentName,
        type: args.type,
        severity: args.severity,
        title: args.title.trim(),
        description: args.description.trim(),
        actionTaken: args.actionTaken?.trim() || undefined,
        parentNotified: !!args.parentNotified,
        parentNotifiedAt: args.parentNotified ? nowIso : undefined,
        witnessId: args.witnessId || undefined,
        witnessName: args.witnessName?.trim() || undefined,
        createdBy: teacherData.id,
        createdByName: teacherData.name || "",
        createdAt: nowIso,
        date: nowIso.slice(0, 10),
        handled: false,
        _createdServerAt: serverTimestamp(),
      };
      await auditedAdd(ref, payload);
    },
    [classId, teacherData]
  );

  // Teacher-side "Mark resolved" — flips handled true + writes handledBy
  // (auth.uid) + handledAt (ISO). Rule allows this narrow whitelist for
  // staff so teachers can close incidents from their side. Cannot reopen.
  const resolveIncident = useCallback(async (incidentId: string) => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("Not signed in");
    await updateDoc(doc(db, "pp_incidents", incidentId), {
      handled: true,
      handledBy: uid,
      handledAt: new Date().toISOString(),
      _lastModifiedBy: uid,
      _lastModifiedAt: serverTimestamp(),
    });
  }, []);

  return { incidents, loading, addIncident, resolveIncident };
}
