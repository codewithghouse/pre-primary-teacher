import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BellOff,
  Bell,
  Archive,
  ArchiveRestore,
  Flag,
  Loader2,
  MoreHorizontal,
  Send,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import { format, isSameDay } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { auth } from "@/lib/firebase";
import { CartoonAvatar } from "@/components/CartoonAvatar";
import {
  usePPThreadMessages,
  sendPPMessage,
  markThreadReadForTeacher,
  reportPPMessage,
  softDeletePPMessage,
  toggleMuteForTeacher,
  archivePPThread,
  MESSAGE_MAX_CHARS,
  type Message,
} from "@/hooks/usePPMessages";

/* ═══════════════════════════════════════════════════════════════════════
   PRE-PRIMARY TEACHER · MESSAGE THREAD (chat view)
   Cartoon-sherbet bubble chat. Teacher bubbles right-aligned (mint), parent
   bubbles left-aligned (sky). Composer pinned at bottom, 320 char cap.
   ════════════════════════════════════════════════════════════════════════ */

const NAVY = "#1e3272";
const MINT = "#10B981";
const SKY = "#0EA5E9";
const PEACH = "#FB923C";
const BLUSH = "#EC4899";
const RED = "#EF4444";

const PILLOW =
  "0 1px 0 rgba(255,255,255,0.55) inset, 0 14px 32px -10px rgba(30,50,114,0.16), 0 4px 10px rgba(30,50,114,0.06)";

// Soft-delete window (sender can soft-delete their own message within this).
const DELETE_WINDOW_MS = 60 * 60 * 1000;

export default function MessageThread() {
  return <MessageThreadInner role="teacher" />;
}

interface MessageThreadInnerProps {
  role: "teacher" | "parent";
}

// Exported for the parent app to reuse with role="parent" via a thin wrapper.
export function MessageThreadInner({ role }: MessageThreadInnerProps) {
  const { threadId } = useParams<{ threadId: string }>();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const { teacherData } = useAuth();
  const { messages, thread, loading } = usePPThreadMessages(threadId);

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [reportFor, setReportFor] = useState<Message | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Mark thread read whenever we land here or new messages arrive (teacher only).
  useEffect(() => {
    if (!threadId || !thread || role !== "teacher") return;
    if ((thread.unreadTeacher || 0) > 0) {
      markThreadReadForTeacher(threadId).catch((e) =>
        console.error("[MessageThread] markRead:", e)
      );
    }
  }, [threadId, thread?.unreadTeacher, role, thread]);

  // Auto-scroll to bottom on new messages.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const myName =
    role === "teacher"
      ? teacherData?.name || teacherData?.displayName || "Teacher"
      : "Parent";
  const myRoleColor = role === "teacher" ? MINT : SKY;
  const otherRoleColor = role === "teacher" ? SKY : MINT;

  const myMutedFlag = role === "teacher"
    ? thread?.mutedTeacher
    : thread?.mutedParent;

  const handleSend = async () => {
    if (!thread || !threadId) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    if (trimmed.length > MESSAGE_MAX_CHARS) {
      toast.error(`Keep it under ${MESSAGE_MAX_CHARS} characters`);
      return;
    }
    setSending(true);
    try {
      await sendPPMessage({
        threadId,
        schoolId: thread.schoolId,
        classId: thread.classId,
        studentId: thread.studentId,
        text: trimmed,
        senderRole: role,
        senderName: myName,
      });
      setText("");
      // Keep focus in the composer for rapid follow-ups.
      composerRef.current?.focus();
    } catch (e) {
      console.error("[MessageThread] send:", e);
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Couldn't send: ${msg.slice(0, 140)}`);
    } finally {
      setSending(false);
    }
  };

  const handleMute = async () => {
    if (!threadId) return;
    try {
      await toggleMuteForTeacher(threadId, !thread?.mutedTeacher);
      toast.success(thread?.mutedTeacher ? "Notifications on" : "Muted");
    } catch (e) {
      console.error("[MessageThread] mute:", e);
      toast.error("Could not update mute");
    }
  };

  const handleArchive = async () => {
    if (!threadId) return;
    try {
      await archivePPThread(threadId, !thread?.archived);
      toast.success(thread?.archived ? "Unarchived" : "Archived");
      if (!thread?.archived) {
        // After archiving go back to list so it disappears.
        navigate(role === "teacher" ? "/messages" : "/messages");
      }
    } catch (e) {
      console.error("[MessageThread] archive:", e);
      toast.error("Could not update archive");
    }
  };

  const handleSoftDelete = async (msg: Message) => {
    if (!threadId) return;
    if (msg.senderUid !== auth.currentUser?.uid) {
      toast.error("Only the sender can delete their own message");
      return;
    }
    const age = Date.now() - new Date(msg.sentAt).getTime();
    if (age > DELETE_WINDOW_MS) {
      toast.error("Too late — messages can only be deleted within 1 hour");
      return;
    }
    try {
      await softDeletePPMessage(threadId, msg.id);
      toast.success("Message deleted");
      setOpenMenu(null);
    } catch (e) {
      console.error("[MessageThread] delete:", e);
      toast.error("Could not delete");
    }
  };

  // Group messages by day for the date dividers.
  const groups = useMemo(() => groupByDay(messages), [messages]);

  if (loading && !thread) {
    return (
      <div
        style={{
          padding: "48px 16px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          color: "#64748B",
        }}
      >
        <Loader2 className="animate-spin" />
        <p style={{ fontSize: 12, fontWeight: 600 }}>Loading conversation…</p>
      </div>
    );
  }

  if (!thread) {
    return (
      <div style={{ padding: "48px 16px", textAlign: "center" }}>
        <p style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>
          💬 Conversation not found
        </p>
        <Link
          to="/messages"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginTop: 16,
            padding: "10px 18px",
            borderRadius: 14,
            background: NAVY,
            color: "#fff",
            fontSize: 12,
            fontWeight: 800,
            textDecoration: "none",
          }}
        >
          <ArrowLeft size={14} /> Back to messages
        </Link>
      </div>
    );
  }

  const headerSubtitle =
    role === "teacher"
      ? thread.parentName
        ? `with ${thread.parentName}`
        : thread.parentEmail
      : `with ${thread.teacherName || "Class teacher"}`;

  const composerHint =
    role === "teacher"
      ? "Reply to parent · text only · keep it kind"
      : "Reply to teacher · text only · keep it kind";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: isDesktop ? "calc(100vh - 24px)" : "calc(100dvh - 56px)",
        background:
          "linear-gradient(180deg, #EEF4FF 0%, #F8FBFF 40%, #FFFFFF 100%)",
      }}
    >
      {/* Sticky header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 5,
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          padding: isDesktop ? "16px 24px" : "12px 16px",
          borderBottom: "1px solid rgba(15,23,42,0.06)",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <button
          type="button"
          onClick={() => navigate("/messages")}
          aria-label="Back"
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            background: "#F1F5F9",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
          }}
          className="active:scale-95"
        >
          <ArrowLeft size={16} color={NAVY} strokeWidth={2.4} />
        </button>
        <CartoonAvatar
          name={thread.studentName}
          size={40}
          ringColor={otherRoleColor}
          ringWidth={3}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: NAVY,
              letterSpacing: "-0.2px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {thread.studentName}
          </p>
          <p
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: "#64748B",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {headerSubtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={handleMute}
          aria-label={myMutedFlag ? "Unmute" : "Mute"}
          style={iconButtonStyle()}
          className="active:scale-95"
        >
          {myMutedFlag ? (
            <BellOff size={16} color={PEACH} strokeWidth={2.2} />
          ) : (
            <Bell size={16} color={NAVY} strokeWidth={2.2} />
          )}
        </button>
        <button
          type="button"
          onClick={handleArchive}
          aria-label={thread.archived ? "Unarchive" : "Archive"}
          style={iconButtonStyle()}
          className="active:scale-95"
        >
          {thread.archived ? (
            <ArchiveRestore size={16} color={MINT} strokeWidth={2.2} />
          ) : (
            <Archive size={16} color={NAVY} strokeWidth={2.2} />
          )}
        </button>
      </div>

      {/* Trust strip */}
      <div
        style={{
          padding: isDesktop ? "10px 24px" : "8px 16px",
          fontSize: 10,
          fontWeight: 600,
          color: "#64748B",
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        <Shield size={11} color={SKY} strokeWidth={2.6} />
        Be kind. Messages are visible to principal if reported. Append-only
        audit log.
      </div>

      {/* Message list */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: isDesktop ? "12px 24px 20px" : "8px 14px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
        onClick={() => setOpenMenu(null)}
      >
        {messages.length === 0 ? (
          <EmptyChat
            otherName={
              role === "teacher"
                ? thread.parentName?.split(" ")[0] || "parent"
                : thread.teacherName?.split(" ")[0] || "teacher"
            }
            color={myRoleColor}
          />
        ) : (
          groups.map((g) => (
            <div
              key={g.key}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                marginTop: 12,
              }}
            >
              <DateDivider date={g.date} />
              {g.items.map((msg) => {
                const fromMe = msg.senderRole === role;
                const ageMs = Date.now() - new Date(msg.sentAt).getTime();
                const canDelete =
                  fromMe &&
                  msg.senderUid === auth.currentUser?.uid &&
                  ageMs < DELETE_WINDOW_MS &&
                  !msg.deleted;
                return (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    fromMe={fromMe}
                    color={fromMe ? myRoleColor : otherRoleColor}
                    isOpen={openMenu === msg.id}
                    onToggleMenu={(e) => {
                      e.stopPropagation();
                      setOpenMenu(openMenu === msg.id ? null : msg.id);
                    }}
                    canDelete={canDelete}
                    onReport={() => {
                      setReportFor(msg);
                      setOpenMenu(null);
                    }}
                    onSoftDelete={() => handleSoftDelete(msg)}
                  />
                );
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} aria-hidden />
      </div>

      {/* Composer */}
      <div
        style={{
          padding: isDesktop ? "12px 24px 20px" : "10px 14px 14px",
          paddingBottom: isDesktop ? 20 : "calc(14px + env(safe-area-inset-bottom))",
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          borderTop: "1px solid rgba(15,23,42,0.06)",
        }}
      >
        <p
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#94A3B8",
            marginBottom: 6,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{composerHint}</span>
          <span
            style={{
              color: text.length > MESSAGE_MAX_CHARS * 0.9 ? RED : "#94A3B8",
              fontWeight: 800,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {text.length}/{MESSAGE_MAX_CHARS}
          </span>
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 8,
            background: "#fff",
            borderRadius: 22,
            padding: "8px 8px 8px 14px",
            boxShadow: PILLOW,
          }}
        >
          <textarea
            ref={composerRef}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MESSAGE_MAX_CHARS))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a message…"
            rows={1}
            style={{
              flex: 1,
              minHeight: 32,
              maxHeight: 120,
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: 14,
              fontWeight: 500,
              color: "#0F172A",
              fontFamily: "inherit",
              lineHeight: 1.5,
              resize: "none",
              padding: "6px 0",
            }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !text.trim()}
            aria-label="Send"
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              background:
                sending || !text.trim()
                  ? "#CBD5E1"
                  : `linear-gradient(135deg, ${myRoleColor}, ${darken(myRoleColor)})`,
              color: "#fff",
              border: "none",
              cursor:
                sending || !text.trim() ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow:
                sending || !text.trim()
                  ? "none"
                  : `0 8px 18px -6px ${myRoleColor}88`,
            }}
            className="active:scale-95 hover:-translate-y-0.5 transition"
          >
            {sending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} strokeWidth={2.6} />
            )}
          </button>
        </div>
      </div>

      {reportFor && (
        <ReportDialog
          msg={reportFor}
          isDesktop={isDesktop}
          onClose={() => setReportFor(null)}
          onSubmit={async (reason) => {
            try {
              await reportPPMessage({
                threadId: threadId!,
                message: reportFor,
                reason,
                reportedByName: myName,
                reportedByRole: role,
              });
              toast.success("Reported to principal");
              setReportFor(null);
            } catch (e) {
              console.error("[MessageThread] report:", e);
              const m = e instanceof Error ? e.message : String(e);
              toast.error(`Could not report: ${m.slice(0, 140)}`);
            }
          }}
        />
      )}
    </div>
  );
}

/* ─────────────── Bubble ─────────────── */

function MessageBubble({
  msg,
  fromMe,
  color,
  isOpen,
  onToggleMenu,
  canDelete,
  onReport,
  onSoftDelete,
}: {
  msg: Message;
  fromMe: boolean;
  color: string;
  isOpen: boolean;
  onToggleMenu: (e: React.MouseEvent) => void;
  canDelete: boolean;
  onReport: () => void;
  onSoftDelete: () => void;
}) {
  const align = fromMe ? "flex-end" : "flex-start";
  const surface = fromMe
    ? `linear-gradient(135deg, ${color}1f 0%, ${color}0f 100%)`
    : "#fff";
  const textColor = "#0F172A";
  const meta = fromMe
    ? format(new Date(msg.sentAt), "h:mm a")
    : `${msg.senderName.split(" ")[0]} · ${format(new Date(msg.sentAt), "h:mm a")}`;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: align,
        gap: 2,
        maxWidth: "100%",
      }}
    >
      <div
        style={{
          position: "relative",
          maxWidth: "min(78%, 540px)",
          display: "flex",
          alignItems: "flex-start",
          gap: 6,
          flexDirection: fromMe ? "row-reverse" : "row",
        }}
      >
        <div
          style={{
            padding: "10px 14px",
            borderRadius: fromMe ? "20px 20px 6px 20px" : "20px 20px 20px 6px",
            background: surface,
            boxShadow: PILLOW,
            color: msg.deleted ? "#94A3B8" : textColor,
            fontStyle: msg.deleted ? "italic" : "normal",
            fontSize: 13,
            fontWeight: msg.deleted ? 500 : 500,
            lineHeight: 1.55,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            position: "relative",
            border: fromMe ? `1px solid ${color}33` : "1px solid #E2E8F0",
          }}
        >
          {msg.deleted ? "Message deleted" : msg.text}
        </div>
        {!msg.deleted && (
          <button
            type="button"
            onClick={onToggleMenu}
            aria-label="Message actions"
            style={{
              width: 24,
              height: 24,
              borderRadius: 999,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              opacity: 0.6,
              marginTop: 6,
            }}
            className="active:scale-90 hover:opacity-100"
          >
            <MoreHorizontal size={14} color="#64748B" strokeWidth={2.6} />
          </button>
        )}
        {isOpen && !msg.deleted && (
          <div
            style={{
              position: "absolute",
              top: 28,
              right: fromMe ? 24 : "auto",
              left: fromMe ? "auto" : 24,
              zIndex: 10,
              background: "#fff",
              borderRadius: 14,
              boxShadow:
                "0 10px 28px -8px rgba(15,23,42,0.24), inset 0 0 0 1px rgba(15,23,42,0.06)",
              minWidth: 160,
              padding: 6,
              animation: "fade-in 160ms ease-out",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onReport}
              style={menuButtonStyle()}
              className="hover:bg-slate-50 active:scale-[0.98]"
            >
              <Flag size={13} color={PEACH} strokeWidth={2.4} />
              <span style={{ color: PEACH }}>Report to principal</span>
            </button>
            {canDelete && (
              <button
                type="button"
                onClick={onSoftDelete}
                style={menuButtonStyle()}
                className="hover:bg-slate-50 active:scale-[0.98]"
              >
                <Trash2 size={13} color={RED} strokeWidth={2.4} />
                <span style={{ color: RED }}>Delete (within 1h)</span>
              </button>
            )}
          </div>
        )}
      </div>
      <p
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: "#94A3B8",
          padding: fromMe ? "0 8px 0 0" : "0 0 0 8px",
          alignSelf: align,
        }}
      >
        {meta}
      </p>
    </div>
  );
}

/* ─────────────── DateDivider ─────────────── */

function DateDivider({ date }: { date: Date }) {
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  let label = format(date, "EEEE, d MMM");
  if (isSameDay(date, today)) label = "Today";
  else if (isSameDay(date, yesterday)) label = "Yesterday";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        margin: "8px 0 4px",
      }}
    >
      <span
        style={{
          fontSize: 9,
          fontWeight: 900,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "#94A3B8",
          background: "#F1F5F9",
          padding: "4px 12px",
          borderRadius: 999,
        }}
      >
        {label}
      </span>
    </div>
  );
}

/* ─────────────── EmptyChat ─────────────── */

function EmptyChat({ otherName, color }: { otherName: string; color: string }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "40px 24px",
        margin: "auto 0",
      }}
    >
      <p style={{ fontSize: 48, marginBottom: 12 }} aria-hidden>
        👋
      </p>
      <p style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>
        Say hi to {otherName}
      </p>
      <p
        style={{
          fontSize: 12,
          color: "#64748B",
          marginTop: 6,
          maxWidth: 280,
          margin: "6px auto 0",
          lineHeight: 1.55,
        }}
      >
        First message kicks off the conversation. Be warm — this thread stays
        on the record.
      </p>
      <div
        style={{
          marginTop: 14,
          fontSize: 10,
          fontWeight: 700,
          color,
          opacity: 0.85,
        }}
      >
        Tip: try a quick day-update
      </div>
    </div>
  );
}

/* ─────────────── Report Dialog ─────────────── */

function ReportDialog({
  msg,
  isDesktop,
  onClose,
  onSubmit,
}: {
  msg: Message;
  isDesktop: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      onClick={() => !submitting && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(15,23,42,0.5)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex",
        alignItems: isDesktop ? "center" : "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 460,
          background:
            "linear-gradient(180deg, #FFE0CC 0%, #FFFFFF 28%, #FFFFFF 100%)",
          borderRadius: isDesktop ? 28 : "28px 28px 0 0",
          boxShadow: "0 -20px 60px rgba(15,23,42,0.18)",
          padding: isDesktop ? 22 : 18,
          paddingBottom: isDesktop ? 22 : "calc(18px + env(safe-area-inset-bottom))",
          animation: "slide-up 220ms cubic-bezier(.34,1.56,.64,1)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div>
            <p
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: PEACH,
              }}
            >
              Report message
            </p>
            <p
              style={{
                fontSize: 19,
                fontWeight: 800,
                color: NAVY,
                marginTop: 2,
              }}
            >
              Flag for principal{" "}
              <span aria-hidden style={{ transform: "rotate(-6deg)" }}>
                🚩
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            disabled={submitting}
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              background: "#F1F5F9",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <X size={14} color="#64748B" strokeWidth={2.4} />
          </button>
        </div>

        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 14,
            background: "#FFF7E5",
            boxShadow: "inset 0 0 0 1px rgba(245,158,11,0.18)",
            fontSize: 12,
            color: "#0F172A",
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          <p
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#92400E",
              marginBottom: 4,
            }}
          >
            From {msg.senderName.split(" ")[0]} ·{" "}
            {format(new Date(msg.sentAt), "d MMM · h:mm a")}
          </p>
          {msg.text}
        </div>

        <div style={{ marginTop: 14 }}>
          <label
            htmlFor="report-reason"
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: NAVY,
              opacity: 0.75,
              display: "block",
              marginBottom: 6,
            }}
          >
            ✍️ Why are you reporting? (optional)
          </label>
          <textarea
            id="report-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 500))}
            rows={3}
            placeholder="Anything the principal should know — tone, off-topic, urgent…"
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 14,
              background: "#fff",
              border: "none",
              fontSize: 13,
              fontWeight: 500,
              color: "#0F172A",
              outline: "none",
              resize: "none",
              boxShadow: PILLOW,
              fontFamily: "inherit",
              lineHeight: 1.55,
            }}
          />
        </div>

        <button
          type="button"
          disabled={submitting}
          onClick={async () => {
            setSubmitting(true);
            try {
              await onSubmit(reason);
            } finally {
              setSubmitting(false);
            }
          }}
          style={{
            marginTop: 16,
            width: "100%",
            padding: "14px 18px",
            borderRadius: 18,
            background: submitting
              ? "#CBD5E1"
              : `linear-gradient(135deg, ${PEACH}, #EA580C)`,
            color: "#fff",
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: "-0.1px",
            border: "none",
            cursor: submitting ? "default" : "pointer",
            boxShadow: submitting ? "none" : `0 12px 28px -8px ${PEACH}88`,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
          className="active:scale-95 hover:-translate-y-0.5 transition"
        >
          {submitting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Flag size={16} strokeWidth={2.4} />
          )}
          Submit report
        </button>
        <p
          style={{
            fontSize: 10,
            color: "#94A3B8",
            textAlign: "center",
            marginTop: 10,
            lineHeight: 1.55,
          }}
        >
          Principal sees the flagged message + this reason. The thread does not
          get blocked.
        </p>
      </div>
    </div>
  );
}

/* ─────────────── helpers ─────────────── */

function groupByDay(msgs: Message[]) {
  const out: { key: string; date: Date; items: Message[] }[] = [];
  for (const m of msgs) {
    const d = new Date(m.sentAt);
    const key = format(d, "yyyy-MM-dd");
    const head = out[out.length - 1];
    if (head && head.key === key) head.items.push(m);
    else out.push({ key, date: d, items: [m] });
  }
  return out;
}

function iconButtonStyle(): React.CSSProperties {
  return {
    width: 36,
    height: 36,
    borderRadius: 12,
    background: "#F1F5F9",
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
  };
}

function menuButtonStyle(): React.CSSProperties {
  return {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    borderRadius: 10,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
    textAlign: "left",
  };
}

// Tiny dark variant of a hex color for gradient ends. Same trick as Incidents.
function darken(hex: string): string {
  const map: Record<string, string> = {
    [MINT]: "#059669",
    [SKY]: "#0284C7",
    [PEACH]: "#EA580C",
    [BLUSH]: "#DB2777",
    [RED]: "#DC2626",
    [NAVY]: "#152456",
  };
  return map[hex] || hex;
}

void useMemo;
void BLUSH;
