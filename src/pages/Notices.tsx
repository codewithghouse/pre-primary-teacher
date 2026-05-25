/**
 * Notices.tsx — Pre-primary teacher's class-scoped notices composer.
 * Cartoonified 2026-05-25. Writes to pp_announcements with audience='class'
 * + classId forced. Teacher sees school/stage/own-class notices but can
 * only edit/delete/pin notices they posted (createdBy === teacherData.id).
 */
import { useEffect, useMemo, useState } from "react";
import {
  Megaphone,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Pin,
  PinOff,
  Users,
  Search,
  X,
  Calendar as CalendarIcon,
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
} from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { useTeacherClass } from "@/hooks/useTeacherClass";
import { useIsDesktop } from "@/hooks/useIsDesktop";

/* ═══════════════════════════════════════════════════════════════════════
   PRE-PRIMARY TEACHER · CLASS NOTICES
   Storybook-sherbet noticeboard. Sherbet surface per type, audience pill,
   pin sticker, principal vs mine vs school-wide visual differentiation.
   ════════════════════════════════════════════════════════════════════════ */

const NAVY = "#1e3272";
const MINT = "#10B981";
const PEACH = "#FB923C";
const BLUSH = "#EC4899";
const SKY = "#0EA5E9";
const LAV = "#A78BFA";
const BUTTER = "#F59E0B";
const RED = "#EF4444";

const PILLOW =
  "0 1px 0 rgba(255,255,255,0.55) inset, 0 14px 32px -10px rgba(30,50,114,0.16), 0 4px 10px rgba(30,50,114,0.06)";

const TYPES = [
  { key: "info", label: "Notice", emoji: "📣" },
  { key: "event", label: "Event", emoji: "🎉" },
  { key: "alert", label: "Important", emoji: "⚠️" },
  { key: "celebration", label: "Celebration", emoji: "🎊" },
  { key: "reminder", label: "Reminder", emoji: "🔔" },
] as const;

type NoticeType = (typeof TYPES)[number]["key"];
type Audience = "school" | "stage" | "class";

const TYPE_TONE: Record<
  NoticeType,
  { tone: string; surface: string }
> = {
  info: {
    tone: SKY,
    surface: "linear-gradient(135deg, #DCEEFF 0%, #F5FAFF 100%)",
  },
  event: {
    tone: BLUSH,
    surface: "linear-gradient(135deg, #FFE0EC 0%, #FFF4F8 100%)",
  },
  alert: {
    tone: RED,
    surface: "linear-gradient(135deg, #FFD6D6 0%, #FFF1F1 100%)",
  },
  celebration: {
    tone: BUTTER,
    surface: "linear-gradient(135deg, #FFEBC8 0%, #FFF7E5 100%)",
  },
  reminder: {
    tone: PEACH,
    surface: "linear-gradient(135deg, #FFE0CC 0%, #FFF5EC 100%)",
  },
};

const AUDIENCE_META: Record<Audience, { tone: string; label: string; emoji: string }> = {
  school: { tone: BLUSH, label: "School-wide", emoji: "🏫" },
  stage: { tone: MINT, label: "All Pre-Primary", emoji: "🌱" },
  class: { tone: SKY, label: "Your class", emoji: "👶" },
};

interface NoticeRow {
  id: string;
  schoolId: string;
  audience: Audience;
  classId?: string;
  className?: string;
  title: string;
  body: string;
  type: NoticeType;
  pinned?: boolean;
  publishedAt?: string;
  expiresAt?: string;
  createdBy?: string;
  createdByName?: string;
  createdByRole?: "principal" | "teacher" | "owner";
}

interface FormState {
  title: string;
  body: string;
  type: NoticeType;
  pinned: boolean;
  expiresAt: string;
}

const emptyForm = (): FormState => ({
  title: "",
  body: "",
  type: "info",
  pinned: false,
  expiresAt: "",
});

export default function Notices() {
  const { teacherData } = useAuth();
  const { primaryClass, loading: classLoading } = useTeacherClass();
  const isDesktop = useIsDesktop();

  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  const schoolId = teacherData?.schoolId;
  const classId = primaryClass?.id;
  const myUid = teacherData?.id;

  useEffect(() => {
    if (!schoolId) {
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, "pp_announcements"),
      where("schoolId", "==", schoolId),
      orderBy("publishedAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: NoticeRow[] = [];
        snap.forEach((d) => {
          const data = d.data() as DocumentData;
          const audience = (data.audience as Audience) || "school";
          if (audience === "class" && data.classId !== classId) return;
          rows.push({
            id: d.id,
            schoolId: data.schoolId,
            audience,
            classId: data.classId,
            className: data.className,
            title: data.title || "",
            body: data.body || "",
            type: (data.type as NoticeType) || "info",
            pinned: Boolean(data.pinned),
            publishedAt:
              data.publishedAt instanceof Timestamp
                ? data.publishedAt.toDate().toISOString()
                : data.publishedAt,
            expiresAt:
              data.expiresAt instanceof Timestamp
                ? data.expiresAt.toDate().toISOString()
                : data.expiresAt,
            createdBy: data.createdBy,
            createdByName: data.createdByName,
            createdByRole: data.createdByRole,
          });
        });
        rows.sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return (b.publishedAt || "").localeCompare(a.publishedAt || "");
        });
        setNotices(rows);
        setLoading(false);
      },
      (err) => {
        console.error("[Notices] subscription:", err);
        toast.error(
          `Could not load notices: ${err instanceof Error ? err.message : err}`
        );
        setLoading(false);
      }
    );
    return () => unsub();
  }, [schoolId, classId]);

  useEffect(() => {
    if (!dialogOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [dialogOpen]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notices;
    return notices.filter(
      (n) =>
        n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)
    );
  }, [notices, search]);

  const stats = useMemo(() => {
    const now = Date.now();
    return {
      total: notices.length,
      mine: notices.filter((n) => n.createdBy === myUid).length,
      pinned: notices.filter((n) => n.pinned).length,
      active: notices.filter(
        (n) => !n.expiresAt || new Date(n.expiresAt).getTime() > now
      ).length,
    };
  }, [notices, myUid]);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (n: NoticeRow) => {
    if (n.createdBy !== myUid) {
      toast.error("You can only edit notices you posted");
      return;
    }
    setEditingId(n.id);
    setForm({
      title: n.title,
      body: n.body,
      type: n.type,
      pinned: !!n.pinned,
      expiresAt: n.expiresAt ? n.expiresAt.slice(0, 16) : "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!schoolId || !classId || !teacherData?.id) {
      toast.error("Missing class context");
      return;
    }
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (form.body.trim().length < 5) {
      toast.error("Body too short");
      return;
    }
    setSaving(true);
    try {
      const payload: DocumentData = {
        schoolId,
        audience: "class" as const,
        classId,
        className: primaryClass?.name,
        title: form.title.trim(),
        body: form.body.trim(),
        type: form.type,
        pinned: form.pinned,
        expiresAt: form.expiresAt
          ? Timestamp.fromDate(new Date(form.expiresAt))
          : undefined,
        createdBy: teacherData.id,
        createdByName: teacherData.name || teacherData.email || "Teacher",
        createdByRole: "teacher" as const,
      };
      if (editingId) {
        await updateDoc(doc(db, "pp_announcements", editingId), {
          ...payload,
          updatedAt: serverTimestamp(),
        });
        toast.success("Notice updated");
      } else {
        await addDoc(collection(db, "pp_announcements"), {
          ...payload,
          publishedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        });
        toast.success(
          `Posted to ${primaryClass?.name} parents — they'll see it live ✓`
        );
      }
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm());
    } catch (err) {
      console.error("[Notices] save:", err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Could not save notice: ${msg.slice(0, 200)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePin = async (n: NoticeRow) => {
    if (n.createdBy !== myUid) {
      toast.error("You can only pin notices you posted");
      return;
    }
    try {
      await updateDoc(doc(db, "pp_announcements", n.id), {
        pinned: !n.pinned,
        updatedAt: serverTimestamp(),
      });
      toast.success(n.pinned ? "Unpinned" : "Pinned");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Could not update: ${msg.slice(0, 120)}`);
    }
  };

  const handleDelete = async (n: NoticeRow) => {
    if (n.createdBy !== myUid) {
      toast.error(
        "Only the principal can delete notices not posted by you. Ask them."
      );
      return;
    }
    if (!window.confirm(`Delete "${n.title}"? Parents stop seeing it immediately.`))
      return;
    try {
      await deleteDoc(doc(db, "pp_announcements", n.id));
      toast.success("Notice deleted");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Could not delete: ${msg.slice(0, 120)}`);
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

  const cardCols = isDesktop ? "repeat(2, minmax(0, 1fr))" : "1fr";

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
              📣
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
                Class noticeboard
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
                Class Notices{" "}
                <span
                  aria-hidden
                  style={{ display: "inline-block", transform: "rotate(6deg)" }}
                >
                  📢
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
                {primaryClass.name} · {format(new Date(), "EEEE, d MMM")}
              </p>
            </div>
            <button
              type="button"
              onClick={openNew}
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
              <Plus size={16} strokeWidth={2.6} />
              {isDesktop ? "New Notice" : "New"}
            </button>
          </div>
        </div>

        {/* 4-stat strip */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 10,
          }}
        >
          <CounterCard
            label="Total seen"
            value={stats.total}
            emoji="📋"
            tone={NAVY}
            surface="linear-gradient(135deg, #E1ECFF 0%, #F7FAFF 100%)"
          />
          <CounterCard
            label="Yours"
            value={stats.mine}
            emoji="✍️"
            tone={SKY}
            surface="linear-gradient(135deg, #DCEEFF 0%, #F5FAFF 100%)"
          />
          <CounterCard
            label="Active"
            value={stats.active}
            emoji="🟢"
            tone={MINT}
            surface="linear-gradient(135deg, #D6F5E2 0%, #F1FBF5 100%)"
          />
          <CounterCard
            label="Pinned"
            value={stats.pinned}
            emoji="📌"
            tone={stats.pinned > 0 ? BUTTER : "#94A3B8"}
            surface={
              stats.pinned > 0
                ? "linear-gradient(135deg, #FFEBC8 0%, #FFF7E5 100%)"
                : "linear-gradient(135deg, #F1F5F9 0%, #FFFFFF 100%)"
            }
          />
        </div>

        {/* Search */}
        <SearchPillow value={search} onChange={setSearch} />

        {/* Info banner */}
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 18,
            padding: "12px 14px",
            background: "linear-gradient(135deg, #DCEEFF 0%, #F5FAFF 100%)",
            boxShadow: PILLOW,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <DotScribbles color={SKY} />
          <span
            style={{
              position: "relative",
              zIndex: 1,
              width: 32,
              height: 32,
              borderRadius: 12,
              background: `linear-gradient(135deg, ${SKY}, #0284C7)`,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transform: "rotate(-6deg)",
              boxShadow: `0 6px 14px ${SKY}55`,
            }}
            aria-hidden
          >
            <Users size={15} strokeWidth={2.4} />
          </span>
          <p
            style={{
              position: "relative",
              zIndex: 1,
              fontSize: 12,
              fontWeight: 600,
              color: "#0F172A",
              lineHeight: 1.5,
            }}
          >
            Notices you post go to{" "}
            <strong style={{ color: SKY }}>parents of {primaryClass.name}</strong>{" "}
            only. School + stage notices below come from the principal — read-only.
          </p>
        </div>

        {/* List */}
        {loading ? (
          <CenteredLoader label="Loading notices…" />
        ) : filtered.length === 0 ? (
          <EmptyState
            hasNotices={notices.length > 0}
            onCompose={openNew}
          />
        ) : (
          <ul
            style={{
              display: "grid",
              gridTemplateColumns: cardCols,
              gap: 12,
              padding: 0,
              margin: 0,
              listStyle: "none",
            }}
          >
            {filtered.map((n) => (
              <li key={n.id}>
                <NoticeCard
                  notice={n}
                  myUid={myUid}
                  onEdit={() => openEdit(n)}
                  onDelete={() => handleDelete(n)}
                  onTogglePin={() => handleTogglePin(n)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {dialogOpen && (
        <ComposerSheet
          form={form}
          setForm={setForm}
          editing={!!editingId}
          saving={saving}
          className={primaryClass.name}
          onClose={() => {
            if (saving) return;
            setDialogOpen(false);
            setEditingId(null);
            setForm(emptyForm());
          }}
          onSave={handleSave}
          isDesktop={isDesktop}
        />
      )}
    </>
  );
}

/* ═══════════════════════ building blocks ═══════════════════════ */

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

function CounterCard({
  label,
  value,
  emoji,
  tone,
  surface,
}: {
  label: string;
  value: number;
  emoji: string;
  tone: string;
  surface: string;
}) {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 22,
        padding: "12px 12px 10px",
        background: surface,
        boxShadow: PILLOW,
      }}
    >
      <DotScribbles color={tone} />
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          position: "relative",
          zIndex: 1,
        }}
      >
        <span
          style={{
            fontSize: 28,
            fontWeight: 900,
            letterSpacing: "-1.2px",
            color: tone,
            lineHeight: 1,
          }}
        >
          {value}
        </span>
        <span
          style={{
            fontSize: 20,
            lineHeight: 1,
            transform: "rotate(8deg)",
            filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.08))",
          }}
          aria-hidden
        >
          {emoji}
        </span>
      </div>
      <p
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: tone,
          opacity: 0.75,
          marginTop: 6,
          position: "relative",
          zIndex: 1,
        }}
      >
        {label}
      </p>
    </div>
  );
}

function SearchPillow({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
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
        placeholder="Search notices…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
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
  );
}

function EmptyState({
  hasNotices,
  onCompose,
}: {
  hasNotices: boolean;
  onCompose: () => void;
}) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "40px 16px",
        borderRadius: 22,
        background: "#fff",
        boxShadow: PILLOW,
      }}
    >
      <p style={{ fontSize: 40, marginBottom: 8 }} aria-hidden>
        📬
      </p>
      <p style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>
        {hasNotices ? "No matches" : "No notices yet"}
      </p>
      <p
        style={{
          fontSize: 12,
          color: "#64748B",
          marginTop: 6,
          maxWidth: 280,
          margin: "6px auto 0",
          lineHeight: 1.5,
        }}
      >
        {hasNotices
          ? "Try a different search term."
          : "Send your first class notice — parents see it instantly in their app."}
      </p>
      {!hasNotices && (
        <button
          type="button"
          onClick={onCompose}
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
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            boxShadow: `0 8px 18px -6px ${SKY}88`,
          }}
          className="active:scale-95 hover:-translate-y-0.5 transition"
        >
          <Plus size={14} strokeWidth={2.6} />
          Compose first notice
        </button>
      )}
    </div>
  );
}

function NoticeCard({
  notice,
  myUid,
  onEdit,
  onDelete,
  onTogglePin,
}: {
  notice: NoticeRow;
  myUid?: string;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
}) {
  const typeMeta = TYPES.find((t) => t.key === notice.type) || TYPES[0];
  const tt = TYPE_TONE[notice.type];
  const audMeta = AUDIENCE_META[notice.audience];
  const expired =
    !!notice.expiresAt && new Date(notice.expiresAt).getTime() < Date.now();
  const mine = notice.createdBy === myUid;

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 22,
        padding: 14,
        background: tt.surface,
        boxShadow: PILLOW,
        borderLeft: `5px solid ${tt.tone}`,
        opacity: expired ? 0.6 : 1,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <DotScribbles color={tt.tone} />

      {/* Pin sticker */}
      {notice.pinned && (
        <span
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 26,
            height: 26,
            borderRadius: 999,
            background: `linear-gradient(135deg, ${BUTTER}, ${PEACH})`,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 4px 10px ${BUTTER}66`,
            transform: "rotate(8deg)",
            zIndex: 2,
          }}
          aria-hidden
        >
          <Pin size={12} strokeWidth={2.6} fill="#fff" />
        </span>
      )}

      {/* Header */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
        }}
      >
        <span
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            background: `linear-gradient(135deg, ${tt.tone}, ${tt.tone}cc)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            boxShadow: `0 6px 14px ${tt.tone}55`,
            transform: "rotate(-6deg)",
            flexShrink: 0,
          }}
          aria-hidden
        >
          {typeMeta.emoji}
        </span>
        <div style={{ flex: 1, minWidth: 0, paddingRight: notice.pinned ? 30 : 0 }}>
          <p
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: NAVY,
              letterSpacing: "-0.2px",
              lineHeight: 1.25,
            }}
          >
            {notice.title}
          </p>
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              marginTop: 6,
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: 9,
                fontWeight: 900,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#fff",
                background: `linear-gradient(135deg, ${tt.tone}, ${tt.tone}cc)`,
                padding: "3px 8px",
                borderRadius: 999,
                boxShadow: `0 3px 8px ${tt.tone}44`,
              }}
            >
              {typeMeta.emoji} {typeMeta.label}
            </span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: audMeta.tone,
                background: "#fff",
                padding: "3px 8px",
                borderRadius: 999,
                boxShadow: `inset 0 0 0 1px ${audMeta.tone}55`,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {audMeta.emoji} {audMeta.label}
            </span>
            {expired && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 900,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "#fff",
                  background: RED,
                  padding: "3px 8px",
                  borderRadius: 999,
                  boxShadow: `0 3px 8px ${RED}44`,
                }}
              >
                Expired
              </span>
            )}
            {notice.publishedAt && (
              <span style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8" }}>
                · {formatDistanceToNow(new Date(notice.publishedAt), { addSuffix: true })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <p
        style={{
          position: "relative",
          zIndex: 1,
          fontSize: 12,
          color: "#0F172A",
          lineHeight: 1.55,
          whiteSpace: "pre-wrap",
          display: "-webkit-box",
          WebkitLineClamp: 4,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {notice.body}
      </p>

      {/* Footer */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          paddingTop: 8,
          borderTop: "1px dashed rgba(15,23,42,0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 700, color: "#64748B" }}>
          {mine ? (
            <span style={{ color: SKY }}>✍️ By you</span>
          ) : (
            <>— {notice.createdByName || "Principal"}</>
          )}
          {notice.expiresAt && !expired && (
            <span style={{ color: PEACH, marginLeft: 6, fontWeight: 800 }}>
              · exp {format(new Date(notice.expiresAt), "d MMM, h:mm a")}
            </span>
          )}
        </span>
        {mine && (
          <div style={{ display: "flex", gap: 4 }}>
            <IconButton
              tone={notice.pinned ? BUTTER : "#64748B"}
              onClick={onTogglePin}
              title={notice.pinned ? "Unpin" : "Pin to top"}
            >
              {notice.pinned ? (
                <PinOff size={13} strokeWidth={2.4} />
              ) : (
                <Pin size={13} strokeWidth={2.4} />
              )}
            </IconButton>
            <IconButton tone={SKY} onClick={onEdit} title="Edit">
              <Pencil size={13} strokeWidth={2.4} />
            </IconButton>
            <IconButton tone={RED} onClick={onDelete} title="Delete">
              <Trash2 size={13} strokeWidth={2.4} />
            </IconButton>
          </div>
        )}
      </div>
    </div>
  );
}

function IconButton({
  tone,
  onClick,
  title,
  children,
}: {
  tone: string;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        width: 28,
        height: 28,
        borderRadius: 999,
        background: "#fff",
        color: tone,
        border: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        boxShadow: `inset 0 0 0 1px ${tone}33`,
      }}
      className="active:scale-90 hover:-translate-y-0.5 transition"
    >
      {children}
    </button>
  );
}

/* ═══════════════════════ Composer sheet ═══════════════════════ */

function ComposerSheet({
  form,
  setForm,
  editing,
  saving,
  className,
  onClose,
  onSave,
  isDesktop,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  editing: boolean;
  saving: boolean;
  className: string;
  onClose: () => void;
  onSave: () => void;
  isDesktop: boolean;
}) {
  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
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
          maxWidth: isDesktop ? 540 : 480,
          maxHeight: isDesktop ? "92vh" : "94vh",
          overflowY: "auto",
          background:
            "linear-gradient(180deg, #F0F9FF 0%, #FFFFFF 28%, #FFFFFF 100%)",
          borderRadius: isDesktop ? 28 : "28px 28px 0 0",
          boxShadow: "0 -20px 60px rgba(15,23,42,0.18)",
          animation: "slide-up 240ms cubic-bezier(.34,1.56,.64,1)",
          position: "relative",
          margin: isDesktop ? "0 16px" : 0,
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {/* Sticky header */}
        <div
          style={{
            position: "sticky",
            top: 0,
            background:
              "linear-gradient(180deg, rgba(240,249,255,0.95) 0%, rgba(255,255,255,0.85) 100%)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            padding: isDesktop ? "16px 22px 14px" : "10px 18px 12px",
            borderRadius: isDesktop ? "28px 28px 0 0" : "28px 28px 0 0",
            zIndex: 10,
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
                {editing ? "Edit notice" : "New notice"}
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
                {editing ? "Update Notice" : "Compose Notice"}{" "}
                <span
                  aria-hidden
                  style={{
                    display: "inline-block",
                    transform: "rotate(-6deg)",
                  }}
                >
                  📝
                </span>
              </p>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#64748B",
                  marginTop: 4,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Megaphone size={11} strokeWidth={2.4} />
                Posts to <strong style={{ color: SKY }}>{className}</strong>{" "}
                parents only
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
            padding: isDesktop ? "16px 22px 24px" : "12px 18px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {/* Title */}
          <div>
            <FieldLabel emoji="🏷️">Title</FieldLabel>
            <PillowInput
              value={form.title}
              onChange={(v) => setForm({ ...form, title: v })}
              placeholder="e.g. Picnic Friday — pack lunch"
              maxLength={120}
            />
          </div>

          {/* Body */}
          <div>
            <FieldLabel emoji="📝">Body</FieldLabel>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Full details parents need to know…"
              rows={4}
              maxLength={1500}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 16,
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
            <p
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: form.body.length > 1400 ? PEACH : "#94A3B8",
                marginTop: 4,
                textAlign: "right",
              }}
            >
              {form.body.length}/1500
            </p>
          </div>

          {/* Type tiles */}
          <div>
            <FieldLabel emoji="🎯">Type</FieldLabel>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                gap: 6,
              }}
            >
              {TYPES.map((t) => {
                const tt = TYPE_TONE[t.key];
                const selected = form.type === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setForm({ ...form, type: t.key })}
                    style={{
                      position: "relative",
                      overflow: "hidden",
                      aspectRatio: "3 / 4",
                      borderRadius: 16,
                      background: selected ? tt.surface : "#fff",
                      border: "none",
                      cursor: "pointer",
                      boxShadow: selected
                        ? `inset 0 0 0 2px ${tt.tone}, ${PILLOW}`
                        : PILLOW,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      padding: 4,
                      transition: "transform 140ms ease",
                    }}
                    className="active:scale-95"
                  >
                    <span
                      style={{
                        fontSize: 22,
                        transform: selected ? "rotate(-8deg)" : "none",
                        transition: "transform 200ms ease",
                      }}
                      aria-hidden
                    >
                      {t.emoji}
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 800,
                        letterSpacing: "0.04em",
                        color: selected ? tt.tone : "#475569",
                        textAlign: "center",
                        lineHeight: 1.2,
                      }}
                    >
                      {t.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pin + Expiry */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
            }}
          >
            {/* Pin toggle */}
            <label
              style={{
                position: "relative",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: 12,
                borderRadius: 16,
                background: form.pinned
                  ? "linear-gradient(135deg, #FFEBC8 0%, #FFF7E5 100%)"
                  : "#fff",
                boxShadow: form.pinned
                  ? `inset 0 0 0 2px ${BUTTER}, ${PILLOW}`
                  : PILLOW,
                cursor: "pointer",
              }}
            >
              {form.pinned && <DotScribbles color={BUTTER} />}
              <input
                type="checkbox"
                checked={form.pinned}
                onChange={(e) =>
                  setForm({ ...form, pinned: e.target.checked })
                }
                style={{
                  width: 16,
                  height: 16,
                  accentColor: BUTTER,
                  cursor: "pointer",
                  position: "relative",
                  zIndex: 1,
                }}
              />
              <div style={{ position: "relative", zIndex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: form.pinned ? "#92400E" : NAVY,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Pin size={12} strokeWidth={2.4} fill={form.pinned ? "#92400E" : "none"} />
                  Pin to top
                </p>
                <p style={{ fontSize: 10, color: "#64748B", marginTop: 2 }}>
                  Stays at top
                </p>
              </div>
            </label>

            {/* Expiry */}
            <div>
              <FieldLabel emoji="📅">Expires (optional)</FieldLabel>
              <PillowInput
                type="datetime-local"
                value={form.expiresAt}
                onChange={(v) => setForm({ ...form, expiresAt: v })}
                placeholder=""
              />
            </div>
          </div>

          {/* Buttons */}
          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 4,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                padding: "12px 18px",
                borderRadius: 16,
                background: "#fff",
                color: "#64748B",
                fontSize: 13,
                fontWeight: 800,
                border: "none",
                cursor: saving ? "default" : "pointer",
                boxShadow: PILLOW,
                opacity: saving ? 0.6 : 1,
              }}
              className="active:scale-95 hover:-translate-y-0.5 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              style={{
                flex: 1,
                padding: "12px 18px",
                borderRadius: 16,
                background: saving
                  ? "#CBD5E1"
                  : `linear-gradient(135deg, ${SKY}, #0284C7)`,
                color: "#fff",
                fontSize: 13,
                fontWeight: 800,
                border: "none",
                cursor: saving ? "default" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                boxShadow: saving ? "none" : `0 10px 24px -6px ${SKY}88`,
              }}
              className="active:scale-95 hover:-translate-y-0.5 transition"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Megaphone size={14} strokeWidth={2.4} />
              )}
              {editing ? "Save changes" : "Post notice"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldLabel({
  emoji,
  children,
}: {
  emoji?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        marginBottom: 8,
      }}
    >
      {emoji && (
        <span
          aria-hidden
          style={{
            fontSize: 13,
            transform: "rotate(-6deg)",
            display: "inline-block",
          }}
        >
          {emoji}
        </span>
      )}
      <p
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: NAVY,
          opacity: 0.75,
        }}
      >
        {children}
      </p>
    </div>
  );
}

function PillowInput({
  value,
  onChange,
  placeholder,
  maxLength,
  type,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  type?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      type={type}
      style={{
        width: "100%",
        padding: "12px 14px",
        borderRadius: 16,
        background: "#fff",
        border: "none",
        fontSize: 13,
        fontWeight: 600,
        color: "#0F172A",
        outline: "none",
        boxShadow: PILLOW,
      }}
    />
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

// Palette constants reserved for future variants on this page.
void LAV;

/* Calendar icon kept imported but not used directly outside the FieldLabel
   emoji prefix. Reference to keep tree-shaker happy. */
void CalendarIcon;
