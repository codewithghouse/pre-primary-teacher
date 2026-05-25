import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Loader2,
  Plus,
  Eye,
  EyeOff,
  Lock,
  X,
  Search,
  Filter,
  Star,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useTeacherClass } from "@/hooks/useTeacherClass";
import { useClassRoster } from "@/hooks/useClassRoster";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { CartoonAvatar } from "@/components/CartoonAvatar";
import {
  usePPBehaviorNotes,
  type BehaviorTier,
  type BehaviorType,
  BEHAVIOR_TIER_LABEL,
  BEHAVIOR_TYPE_LABEL,
} from "@/hooks/usePPBehaviorNotes";

/* ═══════════════════════════════════════════════════════════════════════
   PRE-PRIMARY TEACHER · BEHAVIOR NOTES
   Storybook-sherbet observation log. Sherbet surface per type
   (positive mint / neutral sky / concern red). CartoonAvatar in
   every card. Tier-visibility lock/eye stickers.
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

const TIERS: BehaviorTier[] = ["teacher_only", "principal", "parent"];
const TYPES: BehaviorType[] = ["positive", "neutral", "concern"];

const TYPE_TONE: Record<
  BehaviorType,
  { tone: string; surface: string; emoji: string }
> = {
  positive: {
    tone: MINT,
    surface: "linear-gradient(135deg, #D6F5E2 0%, #F1FBF5 100%)",
    emoji: "🌟",
  },
  neutral: {
    tone: SKY,
    surface: "linear-gradient(135deg, #DCEEFF 0%, #F5FAFF 100%)",
    emoji: "📝",
  },
  concern: {
    tone: RED,
    surface: "linear-gradient(135deg, #FFD6D6 0%, #FFF1F1 100%)",
    emoji: "⚠️",
  },
};

const TIER_META: Record<
  BehaviorTier,
  { tone: string; emoji: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }
> = {
  teacher_only: { tone: "#94A3B8", emoji: "🔒", icon: Lock },
  principal: { tone: BUTTER, emoji: "👁️", icon: EyeOff },
  parent: { tone: MINT, emoji: "💌", icon: Eye },
};

export default function BehaviorNotes() {
  const { primaryClass, loading: classLoading } = useTeacherClass();
  const { roster } = useClassRoster(primaryClass?.id);
  const { notes, loading: notesLoading, addNote } = usePPBehaviorNotes(
    primaryClass?.id
  );
  const isDesktop = useIsDesktop();

  const [search, setSearch] = useState("");
  const [filterChild, setFilterChild] = useState<string>("");
  const [filterTier, setFilterTier] = useState<BehaviorTier | "">("");
  const [dialog, setDialog] = useState(false);
  const [justSavedAt, setJustSavedAt] = useState<number | null>(null);

  const [studentId, setStudentId] = useState("");
  const [content, setContent] = useState("");
  const [tier, setTier] = useState<BehaviorTier>("parent");
  const [type, setType] = useState<BehaviorType>("positive");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (justSavedAt === null) return;
    const t = setTimeout(() => setJustSavedAt(null), 2500);
    return () => clearTimeout(t);
  }, [justSavedAt]);

  useEffect(() => {
    if (!dialog) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [dialog]);

  const filtersActive = !!(filterChild || filterTier || search.trim());
  const clearFilters = () => {
    setFilterChild("");
    setFilterTier("");
    setSearch("");
  };

  const loading = classLoading || notesLoading;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notes.filter((n) => {
      if (filterChild && n.studentId !== filterChild) return false;
      if (filterTier && n.tier !== filterTier) return false;
      if (q) {
        const hay = `${n.studentName} ${n.content}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [notes, search, filterChild, filterTier]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      total: notes.length,
      today: notes.filter((n) => n.date === today).length,
      positive: notes.filter((n) => n.type === "positive").length,
      concern: notes.filter((n) => n.type === "concern").length,
    };
  }, [notes]);

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
  if (loading && notes.length === 0)
    return <CenteredLoader label="Loading notes…" />;

  const openAdd = () => {
    setStudentId("");
    setContent("");
    setTier("parent");
    setType("positive");
    setDialog(true);
  };

  const submit = async () => {
    const child = roster.find((c) => c.id === studentId);
    if (!child) {
      toast.error("Pick a child");
      return;
    }
    if (content.trim().length < 5) {
      toast.error("Note is too short");
      return;
    }
    setSaving(true);
    try {
      await addNote({
        studentId: child.id,
        studentName: child.name,
        content,
        tier,
        type,
      });
      toast.success(`Note saved for ${child.name.split(" ")[0]}`);
      setDialog(false);
      clearFilters();
      setJustSavedAt(Date.now());
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (e) {
      console.error("[BehaviorNotes] addNote:", e);
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Could not save note: ${msg.slice(0, 120)}`);
    } finally {
      setSaving(false);
    }
  };

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
              "linear-gradient(135deg, #D6F5E2 0%, #F1FBF5 55%, #FFFFFF 100%)",
            boxShadow: PILLOW,
          }}
        >
          <DotScribbles color={MINT} dense />
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
                background: `linear-gradient(135deg, ${MINT}, #059669)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26,
                boxShadow: `0 8px 18px ${MINT}55`,
                transform: "rotate(-8deg)",
                flexShrink: 0,
              }}
              aria-hidden
            >
              🌟
            </span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: MINT,
                  opacity: 0.9,
                }}
              >
                Observations
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
                Behavior Notes{" "}
                <span
                  aria-hidden
                  style={{ display: "inline-block", transform: "rotate(6deg)" }}
                >
                  💗
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
                {primaryClass.name} · {format(new Date(), "EEEE, d MMM")} ·
                Behavior-focused, specific
              </p>
            </div>
            <button
              type="button"
              onClick={openAdd}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "12px 18px",
                borderRadius: 16,
                background: `linear-gradient(135deg, ${MINT}, #059669)`,
                color: "#fff",
                fontSize: 13,
                fontWeight: 800,
                border: "none",
                cursor: "pointer",
                boxShadow: `0 10px 24px -8px ${MINT}88`,
              }}
              className="active:scale-95 hover:-translate-y-0.5 transition"
            >
              <Plus size={16} strokeWidth={2.6} />
              {isDesktop ? "New note" : "New"}
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
            label="Total"
            value={stats.total}
            emoji="📋"
            tone={NAVY}
            surface="linear-gradient(135deg, #E1ECFF 0%, #F7FAFF 100%)"
          />
          <CounterCard
            label="Today"
            value={stats.today}
            emoji="📅"
            tone={SKY}
            surface="linear-gradient(135deg, #DCEEFF 0%, #F5FAFF 100%)"
          />
          <CounterCard
            label="Positive"
            value={stats.positive}
            emoji="🌟"
            tone={MINT}
            surface="linear-gradient(135deg, #D6F5E2 0%, #F1FBF5 100%)"
          />
          <CounterCard
            label="Concern"
            value={stats.concern}
            emoji="⚠️"
            tone={stats.concern > 0 ? RED : "#94A3B8"}
            surface={
              stats.concern > 0
                ? "linear-gradient(135deg, #FFD6D6 0%, #FFF1F1 100%)"
                : "linear-gradient(135deg, #F1F5F9 0%, #FFFFFF 100%)"
            }
          />
        </div>

        {/* Search */}
        <SearchPillow value={search} onChange={setSearch} />

        {/* Filter pillows */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isDesktop ? "repeat(2, minmax(0, 1fr))" : "1fr",
            gap: 8,
          }}
        >
          <SelectPillow value={filterChild} onChange={setFilterChild}>
            <option value="">👶 All children</option>
            {roster.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectPillow>
          <SelectPillow
            value={filterTier}
            onChange={(v) => setFilterTier(v as BehaviorTier | "")}
          >
            <option value="">👁️ All visibility</option>
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {TIER_META[t].emoji} {BEHAVIOR_TIER_LABEL[t]}
              </option>
            ))}
          </SelectPillow>
        </div>

        {filtersActive && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <p
              style={{
                fontSize: 11,
                color: "#64748B",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                flexWrap: "wrap",
              }}
            >
              <Filter size={11} />
              Showing{" "}
              <span style={{ fontWeight: 800, color: NAVY }}>
                {filtered.length}
              </span>{" "}
              of {notes.length}
              {filterChild && roster.find((r) => r.id === filterChild) && (
                <FilterChip>
                  {roster.find((r) => r.id === filterChild)?.name.split(" ")[0]}
                </FilterChip>
              )}
              {filterTier && (
                <FilterChip>
                  {TIER_META[filterTier].emoji}{" "}
                  {BEHAVIOR_TIER_LABEL[filterTier]}
                </FilterChip>
              )}
            </p>
            <button
              type="button"
              onClick={clearFilters}
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: SKY,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                textDecoration: "underline",
                textDecorationStyle: "dotted",
                textUnderlineOffset: 3,
              }}
            >
              Clear filters
            </button>
          </div>
        )}

        {/* List */}
        {filtered.length === 0 ? (
          <EmptyState
            emoji="📝"
            title={filtersActive ? "No matches" : "No notes yet"}
            subtitle={
              filtersActive
                ? "Your saved note might be hidden by an active filter."
                : "Tap + to record an observation about a child."
            }
            actionLabel={filtersActive ? "Clear filters" : undefined}
            onAction={filtersActive ? clearFilters : undefined}
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
            {filtered.map((n, i) => (
              <li key={n.id}>
                <NoteCard
                  note={n}
                  pulse={justSavedAt !== null && i === 0}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {dialog && (
        <ComposerDialog
          isDesktop={isDesktop}
          studentId={studentId}
          setStudentId={setStudentId}
          type={type}
          setType={setType}
          tier={tier}
          setTier={setTier}
          content={content}
          setContent={setContent}
          saving={saving}
          onSubmit={submit}
          onClose={() => !saving && setDialog(false)}
          roster={roster}
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
        placeholder="Search notes…"
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

function SelectPillow({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "relative",
        borderRadius: 16,
        background: "#fff",
        boxShadow: PILLOW,
      }}
    >
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          height: 44,
          padding: "0 14px",
          borderRadius: 16,
          background: "transparent",
          border: "none",
          fontSize: 12,
          fontWeight: 700,
          color: NAVY,
          outline: "none",
          appearance: "none",
          cursor: "pointer",
        }}
      >
        {children}
      </select>
      <span
        aria-hidden
        style={{
          position: "absolute",
          right: 14,
          top: "50%",
          transform: "translateY(-50%)",
          fontSize: 10,
          color: "#94A3B8",
          pointerEvents: "none",
        }}
      >
        ▼
      </span>
    </div>
  );
}

function FilterChip({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 999,
        background: "#F1F5F9",
        color: NAVY,
        fontWeight: 800,
        fontSize: 10,
      }}
    >
      {children}
    </span>
  );
}

function EmptyState({
  emoji,
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  emoji: string;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "32px 16px",
        borderRadius: 22,
        background: "#fff",
        boxShadow: PILLOW,
      }}
    >
      <p style={{ fontSize: 32, marginBottom: 8 }} aria-hidden>
        {emoji}
      </p>
      <p style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>{title}</p>
      <p style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>{subtitle}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          style={{
            marginTop: 14,
            padding: "10px 18px",
            borderRadius: 14,
            background: NAVY,
            color: "#fff",
            fontSize: 12,
            fontWeight: 800,
            border: "none",
            cursor: "pointer",
            boxShadow: `0 8px 18px -6px ${NAVY}66`,
          }}
          className="active:scale-95 hover:-translate-y-0.5 transition"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function NoteCard({
  note,
  pulse,
}: {
  note: {
    id: string;
    studentId: string;
    studentName: string;
    content: string;
    tier: BehaviorTier;
    type: BehaviorType;
    createdAt: string;
    createdByName?: string;
  };
  pulse: boolean;
}) {
  const tt = TYPE_TONE[note.type];
  const tier = TIER_META[note.tier];
  const TierIcon = tier.icon;

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 22,
        padding: 14,
        background: tt.surface,
        boxShadow: pulse ? `${PILLOW}, 0 0 0 3px ${MINT}88` : PILLOW,
        borderLeft: `5px solid ${tt.tone}`,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        animation: pulse ? "pulse 1.4s ease-in-out infinite" : undefined,
      }}
    >
      <DotScribbles color={tt.tone} />

      {/* Header row */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <CartoonAvatar
          name={note.studentName}
          size={44}
          ringColor={tt.tone}
          ringWidth={3}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link
            to={`/child/${note.studentId}`}
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: NAVY,
              letterSpacing: "-0.2px",
              textDecoration: "none",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
            className="hover:underline"
          >
            <span aria-hidden style={{ transform: "rotate(-6deg)", display: "inline-block" }}>
              {tt.emoji}
            </span>
            {note.studentName}
          </Link>
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#64748B",
              marginTop: 2,
            }}
          >
            {format(new Date(note.createdAt), "d MMM · h:mm a")} ·{" "}
            {note.createdByName || "Teacher"}
          </p>
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              marginTop: 8,
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
              {tt.emoji} {BEHAVIOR_TYPE_LABEL[note.type]}
            </span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: tier.tone,
                background: "#fff",
                padding: "3px 8px",
                borderRadius: 999,
                boxShadow: `inset 0 0 0 1px ${tier.tone}55`,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <TierIcon size={10} strokeWidth={2.6} />
              {BEHAVIOR_TIER_LABEL[note.tier]}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <p
        style={{
          position: "relative",
          zIndex: 1,
          fontSize: 12,
          color: "#0F172A",
          lineHeight: 1.55,
          whiteSpace: "pre-wrap",
        }}
      >
        {note.content}
      </p>
    </div>
  );
}

/* ═══════════════════════ Composer ═══════════════════════ */

function ComposerDialog({
  isDesktop,
  studentId,
  setStudentId,
  type,
  setType,
  tier,
  setTier,
  content,
  setContent,
  saving,
  onSubmit,
  onClose,
  roster,
}: {
  isDesktop: boolean;
  studentId: string;
  setStudentId: (v: string) => void;
  type: BehaviorType;
  setType: (v: BehaviorType) => void;
  tier: BehaviorTier;
  setTier: (v: BehaviorTier) => void;
  content: string;
  setContent: (v: string) => void;
  saving: boolean;
  onSubmit: () => void;
  onClose: () => void;
  roster: { id: string; name: string }[];
}) {
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
          maxWidth: isDesktop ? 540 : 480,
          maxHeight: isDesktop ? "92vh" : "94vh",
          overflowY: "auto",
          background:
            "linear-gradient(180deg, #F1FBF5 0%, #FFFFFF 28%, #FFFFFF 100%)",
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
              "linear-gradient(180deg, rgba(241,251,245,0.95) 0%, rgba(255,255,255,0.85) 100%)",
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
                  color: MINT,
                  opacity: 0.85,
                }}
              >
                New note
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
                Behavior observation{" "}
                <span
                  aria-hidden
                  style={{ display: "inline-block", transform: "rotate(-6deg)" }}
                >
                  💗
                </span>
              </p>
            </div>
            <button
              type="button"
              disabled={saving}
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
                cursor: saving ? "default" : "pointer",
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
            gap: 16,
          }}
        >
          {/* Child */}
          <div>
            <FieldLabel emoji="👶">Child</FieldLabel>
            <SelectPillow value={studentId} onChange={setStudentId}>
              <option value="">Choose a child…</option>
              {roster.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectPillow>
          </div>

          {/* Type tiles */}
          <div>
            <FieldLabel emoji="🎯">Type</FieldLabel>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 8,
              }}
            >
              {TYPES.map((t) => {
                const tt = TYPE_TONE[t];
                const selected = type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    style={{
                      position: "relative",
                      overflow: "hidden",
                      padding: "14px 8px",
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
                      gap: 6,
                      transition: "transform 140ms ease",
                    }}
                    className="active:scale-95"
                  >
                    <span
                      style={{
                        fontSize: 24,
                        transform: selected ? "rotate(-6deg)" : "none",
                        transition: "transform 200ms ease",
                      }}
                      aria-hidden
                    >
                      {tt.emoji}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        color: selected ? tt.tone : "#475569",
                      }}
                    >
                      {BEHAVIOR_TYPE_LABEL[t]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tier */}
          <div>
            <FieldLabel emoji="👁️">Visibility</FieldLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {TIERS.map((t) => {
                const m = TIER_META[t];
                const TIcon = m.icon;
                const selected = tier === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTier(t)}
                    style={{
                      position: "relative",
                      overflow: "hidden",
                      padding: "12px 14px",
                      borderRadius: 16,
                      background: selected
                        ? `linear-gradient(135deg, ${m.tone}1f, ${m.tone}0f)`
                        : "#fff",
                      border: "none",
                      cursor: "pointer",
                      boxShadow: selected
                        ? `inset 0 0 0 2px ${m.tone}, ${PILLOW}`
                        : PILLOW,
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      transition: "transform 140ms ease",
                    }}
                    className="active:scale-[0.99]"
                  >
                    <span
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 12,
                        background: selected
                          ? `linear-gradient(135deg, ${m.tone}, ${m.tone}cc)`
                          : "#F1F5F9",
                        color: selected ? "#fff" : m.tone,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        transform: selected ? "rotate(-6deg)" : "none",
                        transition: "transform 200ms ease",
                        boxShadow: selected ? `0 6px 14px ${m.tone}44` : "none",
                      }}
                      aria-hidden
                    >
                      <TIcon size={16} strokeWidth={2.4} />
                    </span>
                    <span
                      style={{
                        flex: 1,
                        textAlign: "left",
                        fontSize: 13,
                        fontWeight: 800,
                        color: selected ? NAVY : "#475569",
                      }}
                    >
                      {BEHAVIOR_TIER_LABEL[t]}
                    </span>
                    {selected && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 900,
                          color: "#fff",
                          background: m.tone,
                          padding: "3px 10px",
                          borderRadius: 999,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          flexShrink: 0,
                        }}
                      >
                        Selected
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Observation */}
          <div>
            <FieldLabel emoji="📝">Observation</FieldLabel>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder="What did you observe? Specific, behavior-focused."
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
          </div>

          {/* Submit */}
          <button
            type="button"
            disabled={saving}
            onClick={onSubmit}
            style={{
              width: "100%",
              padding: "14px 18px",
              borderRadius: 18,
              background: saving
                ? "#CBD5E1"
                : `linear-gradient(135deg, ${MINT}, #059669)`,
              color: "#fff",
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: "-0.1px",
              border: "none",
              cursor: saving ? "default" : "pointer",
              boxShadow: saving ? "none" : `0 12px 28px -8px ${MINT}88`,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
            className="active:scale-95 hover:-translate-y-0.5 transition"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Star size={16} strokeWidth={2.4} />
            )}
            Save note
          </button>
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
void PEACH;
void BLUSH;
void LAV;
