import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  limit as fbLimit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { auditedAdd, auditedUpdate } from "@/lib/auditedWrites";
import { useAuth } from "@/lib/AuthContext";

/* ═══════════════════════════════════════════════════════════════════════
   PRE-PRIMARY · MESSAGES HOOK (teacher side)
   1-on-1 threads between class teacher and parent, scoped per child.
   ──────────────────────────────────────────────────────────────────────
   • Thread doc id = studentId (deterministic — one thread per child).
   • Messages live in pp_message_threads/{threadId}/messages subcollection.
   • Reads:  class-scoped real-time subscription on threads.
            per-thread subscription on messages (asc by sentAt, capped).
   • Writes: sendMessage / markThreadRead / softDeleteMessage / reportMessage
            toggleMute / archiveThread / ensureThread (idempotent).
   ════════════════════════════════════════════════════════════════════════ */

export type SenderRole = "teacher" | "parent";

export interface MessageThread {
  id: string;
  schoolId: string;
  classId: string;
  className?: string;
  studentId: string;
  studentName: string;
  parentEmail: string;
  parentName?: string;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  lastMessage?: {
    text: string;
    senderRole: SenderRole;
    senderName: string;
    sentAt: string;
  };
  unreadParent?: number;
  unreadTeacher?: number;
  mutedTeacher?: boolean;
  mutedParent?: boolean;
  archived?: boolean;
  createdAt: string;
  updatedAt: string;
  reportFlagCount?: number;
}

export interface Message {
  id: string;
  schoolId: string;
  classId: string;
  threadId: string;
  studentId: string;
  senderUid: string;
  senderRole: SenderRole;
  senderName: string;
  text: string;
  sentAt: string;
  readByParent?: boolean;
  readByTeacher?: boolean;
  deleted?: boolean;
}

export const MESSAGE_MAX_CHARS = 320;
const MESSAGE_PAGE_SIZE = 100;

// Stable thread id from studentId — one thread per child across teacher
// rotations / co-teachers / siblings.
export const threadIdForStudent = (studentId: string) => studentId;

/* ─────────────── Teacher thread list (class-scoped) ─────────────── */

export function usePPMessageThreads(classId: string | null | undefined) {
  const { teacherData } = useAuth();
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!classId || !teacherData?.schoolId) {
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, "pp_message_threads"),
      where("schoolId", "==", teacherData.schoolId),
      where("classId", "==", classId),
      orderBy("updatedAt", "desc"),
      fbLimit(200)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setThreads(
          snap.docs.map(
            (d) => ({ ...(d.data() as DocumentData), id: d.id } as MessageThread)
          )
        );
        setLoading(false);
      },
      (err) => {
        console.error("[usePPMessageThreads]", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [classId, teacherData?.schoolId]);

  const totalUnread = useMemo(
    () =>
      threads
        .filter((t) => !t.archived)
        .reduce((s, t) => s + (t.unreadTeacher || 0), 0),
    [threads]
  );

  return { threads, loading, totalUnread };
}

/* ─────────────── Single-thread message subscription ─────────────── */

export function usePPThreadMessages(threadId: string | null | undefined) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [thread, setThread] = useState<MessageThread | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!threadId) {
      setLoading(false);
      return;
    }

    const threadRef = doc(db, "pp_message_threads", threadId);
    const unsubThread = onSnapshot(
      threadRef,
      (snap) => {
        if (snap.exists()) {
          setThread({
            ...(snap.data() as DocumentData),
            id: snap.id,
          } as MessageThread);
        } else {
          setThread(null);
        }
      },
      (err) => console.error("[usePPThreadMessages] thread", err)
    );

    const msgsRef = collection(db, "pp_message_threads", threadId, "messages");
    const q = query(msgsRef, orderBy("sentAt", "asc"), fbLimit(MESSAGE_PAGE_SIZE));
    const unsubMsgs = onSnapshot(
      q,
      (snap) => {
        setMessages(
          snap.docs.map(
            (d) =>
              ({
                ...(d.data() as DocumentData),
                id: d.id,
                threadId,
              } as Message)
          )
        );
        setLoading(false);
      },
      (err) => {
        console.error("[usePPThreadMessages] messages", err);
        setLoading(false);
      }
    );

    return () => {
      unsubThread();
      unsubMsgs();
    };
  }, [threadId]);

  return { messages, thread, loading };
}

/* ─────────────── Mutations ─────────────── */

export interface EnsureThreadArgs {
  studentId: string;
  studentName: string;
  parentEmail: string;
  parentName?: string;
  classId: string;
  className?: string;
}

// Idempotent: creates the thread doc if missing, returns its id. Safe to call
// every time the chat view opens — Firestore setDoc with merge wins on
// re-entry. The thread is keyed by studentId so two teachers viewing the same
// child see and write to the same thread.
export async function ensurePPThread(
  args: EnsureThreadArgs,
  teacher: { id: string; name: string; email: string; schoolId: string }
): Promise<string> {
  const threadId = threadIdForStudent(args.studentId);
  const ref = doc(db, "pp_message_threads", threadId);
  const snap = await getDoc(ref);
  const nowIso = new Date().toISOString();

  if (!snap.exists()) {
    const payload: DocumentData = {
      schoolId: teacher.schoolId,
      classId: args.classId,
      className: args.className || "",
      studentId: args.studentId,
      studentName: args.studentName,
      parentEmail: (args.parentEmail || "").toLowerCase(),
      parentName: args.parentName || "",
      teacherId: teacher.id,
      teacherName: teacher.name,
      teacherEmail: (teacher.email || "").toLowerCase(),
      unreadParent: 0,
      unreadTeacher: 0,
      mutedParent: false,
      mutedTeacher: false,
      archived: false,
      reportFlagCount: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
      _lastModifiedBy: auth.currentUser?.uid || teacher.id,
      _lastModifiedAt: serverTimestamp(),
    };
    await setDoc(ref, payload);
  } else {
    // Keep teacher attribution + class up to date when a teacher changes mid-year.
    const existing = snap.data() as DocumentData;
    const stale =
      existing.teacherEmail !== (teacher.email || "").toLowerCase() ||
      existing.classId !== args.classId;
    if (stale) {
      await updateDoc(ref, {
        teacherId: teacher.id,
        teacherName: teacher.name,
        teacherEmail: (teacher.email || "").toLowerCase(),
        classId: args.classId,
        className: args.className || existing.className || "",
        _lastModifiedBy: auth.currentUser?.uid || teacher.id,
        _lastModifiedAt: serverTimestamp(),
      });
    }
  }
  return threadId;
}

export interface SendMessageArgs {
  threadId: string;
  schoolId: string;
  classId: string;
  studentId: string;
  text: string;
  senderRole: SenderRole;
  senderName: string;
}

export async function sendPPMessage(args: SendMessageArgs) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not signed in");
  const text = args.text.trim();
  if (!text) throw new Error("Empty message");
  if (text.length > MESSAGE_MAX_CHARS) {
    throw new Error(`Message too long (${MESSAGE_MAX_CHARS} char max)`);
  }
  const nowIso = new Date().toISOString();

  const msgsRef = collection(
    db,
    "pp_message_threads",
    args.threadId,
    "messages"
  );
  await auditedAdd(msgsRef, {
    schoolId: args.schoolId,
    classId: args.classId,
    threadId: args.threadId,
    studentId: args.studentId,
    senderUid: uid,
    senderRole: args.senderRole,
    senderName: args.senderName,
    text,
    sentAt: nowIso,
    readByTeacher: args.senderRole === "teacher",
    readByParent: args.senderRole === "parent",
    deleted: false,
    _createdServerAt: serverTimestamp(),
  });

  const threadRef = doc(db, "pp_message_threads", args.threadId);
  const snap = await getDoc(threadRef);
  const existing = (snap.data() as DocumentData) || {};
  const nextUpdate: DocumentData = {
    lastMessage: {
      text,
      senderRole: args.senderRole,
      senderName: args.senderName,
      sentAt: nowIso,
    },
    updatedAt: nowIso,
  };
  if (args.senderRole === "teacher") {
    nextUpdate.unreadParent = (existing.unreadParent || 0) + 1;
    nextUpdate.unreadTeacher = 0;
  } else {
    nextUpdate.unreadTeacher = (existing.unreadTeacher || 0) + 1;
    nextUpdate.unreadParent = 0;
  }
  await auditedUpdate(threadRef, nextUpdate);
}

export async function markThreadReadForTeacher(threadId: string) {
  const threadRef = doc(db, "pp_message_threads", threadId);
  await auditedUpdate(threadRef, { unreadTeacher: 0 });
}

export async function markThreadReadForParent(threadId: string) {
  const threadRef = doc(db, "pp_message_threads", threadId);
  await auditedUpdate(threadRef, { unreadParent: 0 });
}

export async function softDeletePPMessage(
  threadId: string,
  messageId: string
) {
  const msgRef = doc(
    db,
    "pp_message_threads",
    threadId,
    "messages",
    messageId
  );
  await auditedUpdate(msgRef, { deleted: true, text: "" });
}

export async function reportPPMessage(args: {
  threadId: string;
  message: Message;
  reason: string;
  reportedByName: string;
  reportedByRole: SenderRole;
}) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not signed in");
  const nowIso = new Date().toISOString();

  // Append a report doc + bump thread's reportFlagCount so the principal's
  // oversight list sorts flagged threads to the top at a glance.
  const reportsRef = collection(db, "pp_message_reports");
  await auditedAdd(reportsRef, {
    schoolId: args.message.schoolId,
    classId: args.message.classId,
    threadId: args.threadId,
    studentId: args.message.studentId,
    messageId: args.message.id,
    messageText: args.message.text.slice(0, 4000),
    messageSenderRole: args.message.senderRole,
    messageSenderName: args.message.senderName,
    reportedBy: uid,
    reportedByName: args.reportedByName,
    reportedByRole: args.reportedByRole,
    reason: args.reason.trim().slice(0, 500),
    status: "pending",
    reportedAt: nowIso,
  });

  const threadRef = doc(db, "pp_message_threads", args.threadId);
  const snap = await getDoc(threadRef);
  const existing = (snap.data() as DocumentData) || {};
  await auditedUpdate(threadRef, {
    reportFlagCount: (existing.reportFlagCount || 0) + 1,
  });
}

export async function toggleMuteForTeacher(threadId: string, next: boolean) {
  const threadRef = doc(db, "pp_message_threads", threadId);
  await auditedUpdate(threadRef, { mutedTeacher: next });
}

export async function toggleMuteForParent(threadId: string, next: boolean) {
  const threadRef = doc(db, "pp_message_threads", threadId);
  await auditedUpdate(threadRef, { mutedParent: next });
}

export async function archivePPThread(threadId: string, next: boolean) {
  const threadRef = doc(db, "pp_message_threads", threadId);
  await auditedUpdate(threadRef, { archived: next });
}
