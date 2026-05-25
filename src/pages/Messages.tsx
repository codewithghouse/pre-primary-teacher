import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Filter,
  Loader2,
  MessageCircle,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useTeacherClass } from "@/hooks/useTeacherClass";
import { useClassRoster, type RosterChild } from "@/hooks/useClassRoster";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useAuth } from "@/lib/AuthContext";
import { CartoonAvatar } from "@/components/CartoonAvatar";
import {
  usePPMessageThreads,
  ensurePPThread,
  threadIdForStudent,
  type MessageThread,
} from "@/hooks/usePPMessages";

/* ═══════════════════════════════════════════════════════════════════════
   PRE-PRIMARY TEACHER · MESSAGES (list view)
   Storybook-sherbet list of 1-on-1 threads with parents, scoped to the
   teacher's primary class. Tap a row → /messages/:threadId. New-thread
   composer surfaces children without an existing thread.
   ════════════════════════════════════════════════════════════════════════ */

const NAVY = "#1e3272";
const MINT = "#10B981";
const PEACH = "#FB923C";
const BLUSH = "#EC4899";
const SKY = "#0EA5E9";

const PILLOW =
  "0 1px 0 rgba(255,255,255,0.55) inset, 0 14px 32px -10px rgba(30,50,114,0.16), 0 4px 10px rgba(30,50,114,0.06)";

export default function Messages() {
  const navigate = useNavigate();
  const { teacherData } = useAuth();
  const { primaryClass, loading: classLoading } = useTeacherClass();
  const { roster, loading: rosterLoading } = useClassRoster(primaryClass?.id);
  const { threads, loading: tLoading, totalUnread } =
    usePPMessageThreads(primaryClass?.id);
  const isDesktop = useIsDesktop();

  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [composer, setComposer] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);

  const childrenWithoutThread: RosterChild[] = useMemo(() => {
    const have = new Set(threads.map((t) => t.studentId));
    return roster.filter((c) => !have.has(c.id));
  }, [roster, threads]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return threads.filter((t) => {
      if (!showArchived && t.archived) return false;
      if (q) {
        const hay = `${t.studentName} ${t.parentName || ""} ${
          t.lastMessage?.text || ""
        }`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [threads, search, showArchived]);

  const openThread = async (child: RosterChild) => {
    if (!primaryClass?.id || !teacherData) return;
    const parentEmail = (child.parentEmail || child.email || "").toLowerCase();
    if (!parentEmail) {
      toast.error(
        `No parent email on ${child.name.split(" ")[0]}'s record. Ask principal to add one in PreStudents.`
      );
      return;
    }
    setOpening(child.id);
    try {
      await ensurePPThread(
        {
          studentId: child.id,
          studentName: child.name,
          parentEmail,
          parentName: child.parentName,
          classId: primaryClass.id,
          className: primaryClass.name,
        },
        {
          id: teacherData.id,
          name: teacherData.name || teacherData.displayName || "Teacher",
          email: teacherData.email || "",
          schoolId: teacherData.schoolId || "",
        }
      );
      navigate(`/messages/${threadIdForStudent(child.id)}`);
    } catch (e) {
      console.error("[Messages] ensureThread:", e);
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Could not open chat: ${msg.slice(0, 140)}`);
    } finally {
      setOpening(null);
      setComposer(false);
    }
  };

  if (classLoading) return <CenteredLoader label="Resolving your class…" />;
  if (!primaryClass) {
    return (
      <div style={{ padding: "48px 16px", textAlign: "center" }}>
        <p style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>
          🌱 No class assigned
        </p>
      </div>
    );
  }

  return (
    <>
      <div
        className="animate-fade-in"
        style={{
          padding: isDesktop ? "24px 28px 80px" : "16px 16px 80px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          width: "100%",
        }}
      >
        {/* Hero */}
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 28,
            padding: isDesktop ? "22px 26px" : "18px 18px",
            background:
              "linear-gradient(135deg, #DCEEFF 0%, #F5FAFF 55%, #FFFFFF 100%)",
            boxShadow: PILLOW,
          }}
        >
          <DotScribbles color={SKY} dense />
          <div
            style={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              alignItems: "center",
              gap: 14,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                width: 52,
                height: 52,
                borderRadius: 18,
                background: `linear-gradient(135deg, ${SKY}, #0284C7)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26,
                boxShadow: `0 8px 18px ${SKY}55`,
                transform: "rotate(-8deg)",
                flexShrink: 0,
              }}
              aria-hidden
            >
              💬
            </span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: SKY,
                  opacity: 0.9,
                }}
              >
                Messages
              </p>
              <h1
                style={{
                  fontSize: isDesktop ? 26 : 21,
                  fontWeight: 800,
                  letterSpacing: "-0.6px",
                  color: NAVY,
                  marginTop: 2,
                }}
              >
                Parents{" "}
                <span
                  aria-hidden
                  style={{ display: "inline-block", transform: "rotate(6deg)" }}
                >
                  ✨
                </span>
              </h1>
              <p
                style={{
                  fontSize: isDesktop ? 13 : 12,
                  fontWeight: 500,
                  color: "#64748B",
                  marginTop: 4,
                }}
              >
                {primaryClass.name} · {threads.length} thread
                {threads.length === 1 ? "" : "s"}
                {totalUnread > 0 && (
                  <>
                    {" · "}
                    <span style={{ color: BLUSH, fontWeight: 800 }}>
                      {totalUnread} unread
                    </span>
                  </>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setComposer(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "12px 18px",
                borderRadius: 16,
                background: `linear-gradient(135deg, ${SKY}, #0284C7)`,
                color: "#fff",
                fontSize: 13,
                fontWeight: 800,
                border: "none",
                cursor: "pointer",
                boxShadow: `0 10px 24px -8px ${SKY}88`,
              }}
              className="active:scale-95 hover:-translate-y-0.5 transition"
            >
              <MessageCircle size={16} strokeWidth={2.6} />
              {isDesktop ? "Start chat" : "Start"}
            </button>
          </div>
        </div>

        {/* Search */}
        <div
          style={{
            position: "relative",
            borderRadius: 22,
            background: "#fff",
            boxShadow: PILLOW,
            padding: "4px 4px 4px 14px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Search size={16} color="#94A3B8" strokeWidth={2.4} />
          <input
            placeholder="Search parents or messages…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: 14,
              fontWeight: 600,
              color: "#0F172A",
              padding: "12px 8px",
              minWidth: 0,
            }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
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
                marginRight: 4,
              }}
            >
              <X size={14} color="#64748B" strokeWidth={2.4} />
            </button>
          )}
        </div>

        {/* Show archived toggle */}
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 700,
            color: "#64748B",
            padding: "8px 14px",
            borderRadius: 999,
            background: showArchived ? `${BLUSH}1f` : "transparent",
            border: `1px dashed ${showArchived ? BLUSH : "#CBD5E1"}`,
            width: "fit-content",
            transition: "all 160ms ease",
          }}
        >
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            style={{
              width: 14,
              height: 14,
              accentColor: BLUSH,
              cursor: "pointer",
            }}
          />
          {showArchived ? "✓ Showing archived" : "Show archived threads"}
        </label>

        {/* Loading state */}
        {tLoading && threads.length === 0 ? (
          <CenteredLoader label="Loading conversations…" />
        ) : filtered.length === 0 ? (
          <EmptyState
            search={search}
            onStart={() => setComposer(true)}
            childrenAvailable={childrenWithoutThread.length}
          />
        ) : (
          <ul
            style={{
              display: "grid",
              gridTemplateColumns: isDesktop ? "repeat(2, 1fr)" : "1fr",
              gap: 12,
              padding: 0,
              margin: 0,
              listStyle: "none",
            }}
          >
            {filtered.map((t) => (
              <li key={t.id}>
                <ThreadRow thread={t} />
              </li>
            ))}
          </ul>
        )}

        {/* Roster reminder for any children still without threads */}
        {!tLoading &&
          childrenWithoutThread.length > 0 &&
          threads.length > 0 && (
            <p
              style={{
                fontSize: 11,
                color: "#94A3B8",
                textAlign: "center",
                marginTop: 4,
              }}
            >
              {childrenWithoutThread.length} more parent
              {childrenWithoutThread.length === 1 ? "" : "s"} you haven't
              chatted with —{" "}
              <button
                type="button"
                onClick={() => setComposer(true)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: SKY,
                  fontWeight: 800,
                  cursor: "pointer",
                  textDecoration: "underline",
                  textDecorationStyle: "dotted",
                  textUnderlineOffset: 3,
                }}
              >
                start one
              </button>
            </p>
          )}
      </div>

      {/* Composer — picks a child without a thread */}
      {composer && (
        <ComposerDialog
          isDesktop={isDesktop}
          roster={childrenWithoutThread}
          rosterLoading={rosterLoading}
          onClose={() => !opening && setComposer(false)}
          onPick={openThread}
          opening={opening}
        />
      )}
    </>
  );
}

/* ─────────────── ThreadRow ─────────────── */

function ThreadRow({ thread }: { thread: MessageThread }) {
  const unread = thread.unreadTeacher || 0;
  const last = thread.lastMessage;
  const previewIsTeacher = last?.senderRole === "teacher";
  return (
    <Link
      to={`/messages/${thread.id}`}
      style={{
        position: "relative",
        overflow: "hidden",
        display: "flex",
        gap: 12,
        padding: 14,
        borderRadius: 22,
        background: unread > 0
          ? "linear-gradient(135deg, #DCEEFF 0%, #F5FAFF 100%)"
          : "#fff",
        boxShadow: PILLOW,
        textDecoration: "none",
        color: "inherit",
        transition: "transform 160ms ease",
      }}
      className="active:scale-[0.98] hover:-translate-y-0.5"
    >
      <DotScribbles color={unread > 0 ? SKY : NAVY} />
      <CartoonAvatar
        name={thread.studentName}
        size={48}
        ringColor={unread > 0 ? SKY : "#E2E8F0"}
        ringWidth={3}
      />
      <div style={{ flex: 1, minWidth: 0, position: "relative", zIndex: 1 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <p
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: NAVY,
              letterSpacing: "-0.2px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              flex: 1,
              minWidth: 0,
            }}
          >
            {thread.studentName}
          </p>
          {last?.sentAt && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "#94A3B8",
                flexShrink: 0,
              }}
            >
              {formatRelative(last.sentAt)}
            </span>
          )}
        </div>
        {thread.parentName && (
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#64748B",
              marginTop: 1,
            }}
          >
            with {thread.parentName.split(" ")[0]}
          </p>
        )}
        <p
          style={{
            fontSize: 12,
            color: unread > 0 ? "#0F172A" : "#64748B",
            fontWeight: unread > 0 ? 700 : 500,
            marginTop: 6,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {last ? (
            <>
              {previewIsTeacher && (
                <span style={{ color: SKY, fontWeight: 700 }}>You: </span>
              )}
              {last.text || "(empty)"}
            </>
          ) : (
            <span style={{ color: "#94A3B8", fontStyle: "italic" }}>
              No messages yet — say hi 👋
            </span>
          )}
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 8,
          }}
        >
          {unread > 0 && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 900,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "#fff",
                background: `linear-gradient(135deg, ${BLUSH}, #DB2777)`,
                padding: "3px 8px",
                borderRadius: 999,
                boxShadow: `0 3px 8px ${BLUSH}44`,
              }}
            >
              {unread > 99 ? "99+" : unread} new
            </span>
          )}
          {thread.mutedTeacher && (
            <span style={pillStyle("#94A3B8")}>🔕 Muted</span>
          )}
          {thread.archived && (
            <span style={pillStyle("#94A3B8")}>📦 Archived</span>
          )}
          {(thread.reportFlagCount || 0) > 0 && (
            <span style={pillStyle(PEACH)}>🚩 {thread.reportFlagCount}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

function pillStyle(color: string): React.CSSProperties {
  return {
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color,
    background: "#fff",
    padding: "3px 8px",
    borderRadius: 999,
    boxShadow: `inset 0 0 0 1px ${color}55`,
  };
}

function formatRelative(iso: string): string {
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 60_000) return "now";
    if (diff < 3_600_000) {
      const m = Math.floor(diff / 60_000);
      return `${m}m`;
    }
    if (diff < 86_400_000) return format(d, "h:mm a");
    if (diff < 7 * 86_400_000) return format(d, "EEE");
    return format(d, "d MMM");
  } catch {
    return "";
  }
}

/* ─────────────── Empty State ─────────────── */

function EmptyState({
  search,
  onStart,
  childrenAvailable,
}: {
  search: string;
  onStart: () => void;
  childrenAvailable: number;
}) {
  const filtering = !!search.trim();
  return (
    <div
      style={{
        textAlign: "center",
        padding: "36px 20px",
        borderRadius: 22,
        background: "#fff",
        boxShadow: PILLOW,
      }}
    >
      <p style={{ fontSize: 36, marginBottom: 8 }} aria-hidden>
        {filtering ? "🔍" : "💬"}
      </p>
      <p style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>
        {filtering ? "No matches" : "No conversations yet"}
      </p>
      <p
        style={{
          fontSize: 12,
          color: "#64748B",
          marginTop: 4,
          maxWidth: 320,
          margin: "4px auto 0",
          lineHeight: 1.55,
        }}
      >
        {filtering
          ? "Try clearing search or check archived threads."
          : childrenAvailable > 0
          ? "Tap the button above to start a chat with any parent in your class."
          : "Roster is empty — once children are enrolled, you can chat with their parents here."}
      </p>
      {!filtering && childrenAvailable > 0 && (
        <button
          type="button"
          onClick={onStart}
          style={{
            marginTop: 14,
            padding: "10px 18px",
            borderRadius: 14,
            background: `linear-gradient(135deg, ${SKY}, #0284C7)`,
            color: "#fff",
            fontSize: 12,
            fontWeight: 800,
            border: "none",
            cursor: "pointer",
            boxShadow: `0 8px 18px -6px ${SKY}66`,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
          className="active:scale-95 hover:-translate-y-0.5 transition"
        >
          <Sparkles size={14} strokeWidth={2.6} /> Start your first chat
        </button>
      )}
    </div>
  );
}

/* ─────────────── Composer (pick a child) ─────────────── */

function ComposerDialog({
  isDesktop,
  roster,
  rosterLoading,
  onClose,
  onPick,
  opening,
}: {
  isDesktop: boolean;
  roster: RosterChild[];
  rosterLoading: boolean;
  onClose: () => void;
  onPick: (child: RosterChild) => void;
  opening: string | null;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      onClick={onClose}
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
        animation: "fade-in 200ms ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: isDesktop ? 480 : 480,
          maxHeight: isDesktop ? "82vh" : "84vh",
          overflowY: "auto",
          background:
            "linear-gradient(180deg, #DCEEFF 0%, #FFFFFF 28%, #FFFFFF 100%)",
          borderRadius: isDesktop ? 28 : "28px 28px 0 0",
          boxShadow: "0 -20px 60px rgba(15,23,42,0.18)",
          animation: "slide-up 240ms cubic-bezier(.34,1.56,.64,1)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div
          style={{
            position: "sticky",
            top: 0,
            background:
              "linear-gradient(180deg, rgba(220,238,255,0.95) 0%, rgba(255,255,255,0.85) 100%)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            padding: isDesktop ? "16px 22px 14px" : "10px 18px 12px",
            zIndex: 10,
            borderRadius: isDesktop ? "28px 28px 0 0" : "28px 28px 0 0",
          }}
        >
          {!isDesktop && (
            <div
              style={{
                width: 48,
                height: 5,
                borderRadius: 999,
                background: "#E2E8F0",
                margin: "0 auto 12px",
              }}
            />
          )}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: SKY,
                  opacity: 0.85,
                }}
              >
                New chat
              </p>
              <p
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: NAVY,
                  marginTop: 2,
                  letterSpacing: "-0.4px",
                }}
              >
                Pick a child{" "}
                <span
                  aria-hidden
                  style={{
                    display: "inline-block",
                    transform: "rotate(-6deg)",
                  }}
                >
                  👶
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                width: 34,
                height: 34,
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
              <X size={16} color="#64748B" strokeWidth={2.4} />
            </button>
          </div>
        </div>

        <div
          style={{
            padding: isDesktop ? "12px 22px 22px" : "10px 18px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {rosterLoading ? (
            <CenteredLoader label="Loading roster…" />
          ) : roster.length === 0 ? (
            <p
              style={{
                fontSize: 12,
                color: "#64748B",
                textAlign: "center",
                padding: "20px 12px",
              }}
            >
              You've already started chats with every parent. Open an existing
              thread from the list to continue.
            </p>
          ) : (
            roster.map((c) => {
              const parentEmail = (c.parentEmail || c.email || "").trim();
              const missingEmail = !parentEmail;
              const isOpening = opening === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={!!opening}
                  onClick={() => onPick(c)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: 12,
                    borderRadius: 18,
                    background: missingEmail ? "#FFF7E5" : "#fff",
                    boxShadow: PILLOW,
                    border: "none",
                    cursor: opening ? "default" : "pointer",
                    textAlign: "left",
                    opacity: opening && !isOpening ? 0.5 : 1,
                    transition: "transform 140ms ease",
                  }}
                  className={!opening ? "active:scale-[0.98]" : ""}
                >
                  <CartoonAvatar name={c.name} size={42} ringColor="#E2E8F0" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: NAVY,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {c.name}
                    </p>
                    <p
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: missingEmail ? "#92400E" : "#64748B",
                        marginTop: 2,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {missingEmail
                        ? "⚠️ No parent email on file"
                        : c.parentName
                        ? `${c.parentName} · ${parentEmail}`
                        : parentEmail}
                    </p>
                  </div>
                  {isOpening && (
                    <Loader2 size={16} className="animate-spin" color={SKY} />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Shared ─────────────── */

function CenteredLoader({ label }: { label: string }) {
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
      <p style={{ fontSize: 12, fontWeight: 600 }}>{label}</p>
    </div>
  );
}

function DotScribbles({
  color,
  dense = false,
}: {
  color: string;
  dense?: boolean;
}) {
  return (
    <svg
      aria-hidden="true"
      width="100%"
      height="100%"
      style={{
        position: "absolute",
        inset: 0,
        opacity: dense ? 0.1 : 0.07,
        pointerEvents: "none",
      }}
    >
      <circle cx="14%" cy="24%" r="2.5" fill={color} />
      <circle cx="82%" cy="14%" r="1.8" fill={color} />
      <circle cx="68%" cy="62%" r="2" fill={color} />
      <circle cx="22%" cy="80%" r="1.6" fill={color} />
      <circle cx="48%" cy="32%" r="1.4" fill={color} />
      {dense && (
        <>
          <circle cx="90%" cy="80%" r="2.2" fill={color} />
          <circle cx="6%" cy="60%" r="1.4" fill={color} />
          <circle cx="55%" cy="88%" r="1.6" fill={color} />
        </>
      )}
    </svg>
  );
}

void MINT;
void Filter;
void formatDistanceToNow;
