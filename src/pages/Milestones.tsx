import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Plus, X, Search, Filter, Sprout } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useTeacherClass } from "@/hooks/useTeacherClass";
import { useClassRoster } from "@/hooks/useClassRoster";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { CartoonAvatar } from "@/components/CartoonAvatar";
import {
  usePPMilestones,
  type Domain,
  type RubricLevel,
  DOMAIN_LABEL,
  DOMAIN_EMOJI,
  LEVEL_LABEL,
  ALL_DOMAINS,
  ALL_LEVELS,
} from "@/hooks/usePPMilestones";

/* ═══════════════════════════════════════════════════════════════════════
   PRE-PRIMARY TEACHER · MILESTONES & OBSERVATIONS
   NEP 2020 5-domain framework. Storybook-sherbet with per-domain
   sherbet surface + rubric level color pill. CartoonAvatar in every
   card. 5-tile domain filter strip in hero.
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

const DOMAIN_TONE: Record<Domain, { tone: string; surface: string }> = {
  physical: {
    tone: PEACH,
    surface: "linear-gradient(135deg, #FFE0CC 0%, #FFF5EC 100%)",
  },
  cognitive: {
    tone: SKY,
    surface: "linear-gradient(135deg, #DCEEFF 0%, #F5FAFF 100%)",
  },
  language: {
    tone: MINT,
    surface: "linear-gradient(135deg, #D6F5E2 0%, #F1FBF5 100%)",
  },
  socio_emotional: {
    tone: BUTTER,
    surface: "linear-gradient(135deg, #FFEBC8 0%, #FFF7E5 100%)",
  },
  creative: {
    tone: BLUSH,
    surface: "linear-gradient(135deg, #FFE0EC 0%, #FFF4F8 100%)",
  },
};

const LEVEL_TONE: Record<RubricLevel, { tone: string; emoji: string }> = {
  beginning: { tone: RED, emoji: "🌱" },
  developing: { tone: BUTTER, emoji: "🌿" },
  achieving: { tone: MINT, emoji: "🌳" },
  excelling: { tone: LAV, emoji: "🌟" },
};

export default function Milestones() {
  const { primaryClass, loading: classLoading } = useTeacherClass();
  const { roster } = useClassRoster(primaryClass?.id);
  const { milestones, loading: msLoading, addMilestone } = usePPMilestones(
    primaryClass?.id
  );
  const isDesktop = useIsDesktop();

  const [search, setSearch] = useState("");
  const [filterChild, setFilterChild] = useState<string>("");
  const [filterDomain, setFilterDomain] = useState<Domain | "">("");
  const [dialog, setDialog] = useState(false);
  const [justSavedAt, setJustSavedAt] = useState<number | null>(null);

  const [studentId, setStudentId] = useState("");
  const [domain, setDomain] = useState<Domain>("cognitive");
  const [level, setLevel] = useState<RubricLevel>("developing");
  const [observation, setObservation] = useState("");
  const [evidence, setEvidence] = useState("");
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

  const filtersActive = !!(filterChild || filterDomain || search.trim());
  const clearFilters = () => {
    setFilterChild("");
    setFilterDomain("");
    setSearch("");
  };

  const loading = classLoading || msLoading;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return milestones.filter((m) => {
      if (filterChild && m.studentId !== filterChild) return false;
      if (filterDomain && m.domain !== filterDomain) return false;
      if (q) {
        const hay = `${m.studentName} ${m.observation} ${m.evidence || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [milestones, search, filterChild, filterDomain]);

  const byDomain = useMemo(() => {
    const map: Record<Domain, number> = {
      physical: 0,
      cognitive: 0,
      language: 0,
      socio_emotional: 0,
      creative: 0,
    };
    for (const m of milestones) map[m.domain]++;
    return map;
  }, [milestones]);

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
  if (loading && milestones.length === 0)
    return <CenteredLoader label="Loading milestones…" />;

  const openAdd = () => {
    setStudentId("");
    setDomain("cognitive");
    setLevel("developing");
    setObservation("");
    setEvidence("");
    setDialog(true);
  };

  const submit = async () => {
    const child = roster.find((c) => c.id === studentId);
    if (!child) {
      toast.error("Pick a child");
      return;
    }
    if (observation.trim().length < 5) {
      toast.error("Observation too short");
      return;
    }
    setSaving(true);
    try {
      await addMilestone({
        studentId: child.id,
        studentName: child.name,
        domain,
        level,
        observation,
        evidence: evidence.trim() || undefined,
      });
      toast.success(
        `${DOMAIN_EMOJI[domain]} ${DOMAIN_LABEL[domain]} milestone saved for ${child.name.split(" ")[0]}`
      );
      setDialog(false);
      clearFilters();
      setJustSavedAt(Date.now());
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (e) {
      console.error("[Milestones] addMilestone:", e);
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Could not save milestone: ${msg.slice(0, 120)}`);
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
              🌱
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
                Term snapshot · NEP 2020
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
                Milestones{" "}
                <span
                  aria-hidden
                  style={{ display: "inline-block", transform: "rotate(6deg)" }}
                >
                  🌟
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
                {primaryClass.name} · {milestones.length} total observation
                {milestones.length === 1 ? "" : "s"} · 5-domain framework
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
              {isDesktop ? "New observation" : "New"}
            </button>
          </div>
        </div>

        {/* 5-domain tappable filter strip */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
            gap: 6,
          }}
        >
          {ALL_DOMAINS.map((d) => {
            const dt = DOMAIN_TONE[d];
            const selected = filterDomain === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setFilterDomain(selected ? "" : d)}
                style={{
                  position: "relative",
                  overflow: "hidden",
                  borderRadius: 18,
                  padding: "10px 6px 8px",
                  background: selected ? dt.surface : "#fff",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: selected
                    ? `inset 0 0 0 2px ${dt.tone}, ${PILLOW}`
                    : PILLOW,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  transition: "transform 140ms ease",
                }}
                className="active:scale-95 hover:-translate-y-0.5"
              >
                <DotScribbles color={dt.tone} />
                <span
                  style={{
                    fontSize: 22,
                    transform: selected ? "rotate(-6deg)" : "none",
                    transition: "transform 200ms ease",
                    position: "relative",
                    zIndex: 1,
                  }}
                  aria-hidden
                >
                  {DOMAIN_EMOJI[d]}
                </span>
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 900,
                    color: selected ? dt.tone : NAVY,
                    letterSpacing: "-0.4px",
                    position: "relative",
                    zIndex: 1,
                    lineHeight: 1,
                  }}
                >
                  {byDomain[d]}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: "0.04em",
                    color: selected ? dt.tone : "#64748B",
                    position: "relative",
                    zIndex: 1,
                    textAlign: "center",
                    lineHeight: 1.2,
                  }}
                >
                  {DOMAIN_LABEL[d]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search + child filter */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isDesktop ? "2fr 1fr" : "1fr",
            gap: 8,
          }}
        >
          <SearchPillow value={search} onChange={setSearch} />
          <SelectPillow value={filterChild} onChange={setFilterChild}>
            <option value="">👶 All children</option>
            {roster.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
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
              of {milestones.length}
              {filterChild && roster.find((r) => r.id === filterChild) && (
                <FilterChip>
                  {roster.find((r) => r.id === filterChild)?.name.split(" ")[0]}
                </FilterChip>
              )}
              {filterDomain && (
                <FilterChip>
                  {DOMAIN_EMOJI[filterDomain]} {DOMAIN_LABEL[filterDomain]}
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
            emoji="🌱"
            title={filtersActive ? "No matches" : "No milestones yet"}
            subtitle={
              filtersActive
                ? "Your saved entry might be hidden by an active filter."
                : "Tap + to record an observation against any of the 5 NEP 2020 domains."
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
            {filtered.map((m, i) => (
              <li key={m.id}>
                <MilestoneCard
                  milestone={m}
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
          domain={domain}
          setDomain={setDomain}
          level={level}
          setLevel={setLevel}
          observation={observation}
          setObservation={setObservation}
          evidence={evidence}
          setEvidence={setEvidence}
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
        placeholder="Search milestones…"
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
        borderRadius: 22,
        background: "#fff",
        boxShadow: PILLOW,
      }}
    >
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          height: 48,
          padding: "0 14px",
          borderRadius: 22,
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

function MilestoneCard({
  milestone,
  pulse,
}: {
  milestone: {
    id: string;
    studentId: string;
    studentName: string;
    domain: Domain;
    level: RubricLevel;
    observation: string;
    evidence?: string;
    recordedAt: string;
    term?: string;
  };
  pulse: boolean;
}) {
  const dt = DOMAIN_TONE[milestone.domain];
  const lt = LEVEL_TONE[milestone.level];

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 22,
        padding: 14,
        background: dt.surface,
        boxShadow: pulse ? `${PILLOW}, 0 0 0 3px ${MINT}88` : PILLOW,
        borderLeft: `5px solid ${dt.tone}`,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        animation: pulse ? "pulse 1.4s ease-in-out infinite" : undefined,
      }}
    >
      <DotScribbles color={dt.tone} />

      {/* Header */}
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
          name={milestone.studentName}
          size={44}
          ringColor={dt.tone}
          ringWidth={3}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link
            to={`/child/${milestone.studentId}`}
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: NAVY,
              letterSpacing: "-0.2px",
              textDecoration: "none",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "block",
            }}
            className="hover:underline"
          >
            {milestone.studentName}
          </Link>
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#64748B",
              marginTop: 2,
            }}
          >
            {format(new Date(milestone.recordedAt), "d MMM · h:mm a")}
            {milestone.term && ` · ${milestone.term}`}
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
                background: `linear-gradient(135deg, ${dt.tone}, ${dt.tone}cc)`,
                padding: "3px 8px",
                borderRadius: 999,
                boxShadow: `0 3px 8px ${dt.tone}44`,
              }}
            >
              {DOMAIN_EMOJI[milestone.domain]} {DOMAIN_LABEL[milestone.domain]}
            </span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 900,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: lt.tone,
                background: "#fff",
                padding: "3px 8px",
                borderRadius: 999,
                boxShadow: `inset 0 0 0 1px ${lt.tone}55`,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {lt.emoji} {LEVEL_LABEL[milestone.level]}
            </span>
          </div>
        </div>
      </div>

      {/* Observation */}
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
        {milestone.observation}
      </p>

      {/* Evidence */}
      {milestone.evidence && (
        <div
          style={{
            position: "relative",
            zIndex: 1,
            padding: "8px 10px",
            background: "#fff",
            borderRadius: 12,
            fontSize: 11,
            color: "#0F172A",
            boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.08)",
            fontStyle: "italic",
          }}
        >
          <span style={{ fontWeight: 800, fontStyle: "normal", color: dt.tone }}>
            🔍 Evidence:
          </span>{" "}
          {milestone.evidence}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ Composer ═══════════════════════ */

function ComposerDialog({
  isDesktop,
  studentId,
  setStudentId,
  domain,
  setDomain,
  level,
  setLevel,
  observation,
  setObservation,
  evidence,
  setEvidence,
  saving,
  onSubmit,
  onClose,
  roster,
}: {
  isDesktop: boolean;
  studentId: string;
  setStudentId: (v: string) => void;
  domain: Domain;
  setDomain: (v: Domain) => void;
  level: RubricLevel;
  setLevel: (v: RubricLevel) => void;
  observation: string;
  setObservation: (v: string) => void;
  evidence: string;
  setEvidence: (v: string) => void;
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
          maxWidth: isDesktop ? 560 : 480,
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
                New observation · NEP 2020
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
                Milestone entry{" "}
                <span
                  aria-hidden
                  style={{ display: "inline-block", transform: "rotate(-6deg)" }}
                >
                  🌱
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

          {/* Domain tiles */}
          <div>
            <FieldLabel emoji="🧩">Domain · NEP 2020 5-domain</FieldLabel>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                gap: 6,
              }}
            >
              {ALL_DOMAINS.map((d) => {
                const dt = DOMAIN_TONE[d];
                const selected = domain === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDomain(d)}
                    style={{
                      position: "relative",
                      overflow: "hidden",
                      aspectRatio: "3 / 4",
                      borderRadius: 16,
                      background: selected ? dt.surface : "#fff",
                      border: "none",
                      cursor: "pointer",
                      boxShadow: selected
                        ? `inset 0 0 0 2px ${dt.tone}, ${PILLOW}`
                        : PILLOW,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      padding: 6,
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
                      {DOMAIN_EMOJI[d]}
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 800,
                        color: selected ? dt.tone : "#475569",
                        textAlign: "center",
                        lineHeight: 1.2,
                      }}
                    >
                      {DOMAIN_LABEL[d]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Rubric level tiles */}
          <div>
            <FieldLabel emoji="📊">Rubric level</FieldLabel>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 6,
              }}
            >
              {ALL_LEVELS.map((l) => {
                const lt = LEVEL_TONE[l];
                const selected = level === l;
                return (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLevel(l)}
                    style={{
                      position: "relative",
                      overflow: "hidden",
                      padding: "10px 4px",
                      borderRadius: 14,
                      background: selected
                        ? `linear-gradient(135deg, ${lt.tone}, ${lt.tone}cc)`
                        : "#fff",
                      color: selected ? "#fff" : lt.tone,
                      border: "none",
                      cursor: "pointer",
                      boxShadow: selected
                        ? `0 8px 18px -6px ${lt.tone}66`
                        : PILLOW,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                      transition: "transform 140ms ease",
                    }}
                    className="active:scale-95"
                  >
                    <span
                      style={{
                        fontSize: 20,
                        transform: selected ? "rotate(-6deg)" : "none",
                        transition: "transform 200ms ease",
                      }}
                      aria-hidden
                    >
                      {lt.emoji}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: "0.04em",
                      }}
                    >
                      {LEVEL_LABEL[l]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Observation */}
          <div>
            <FieldLabel emoji="📝">Observation</FieldLabel>
            <textarea
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              rows={3}
              placeholder="What did the child do? Specific, observable behavior."
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

          {/* Evidence */}
          <div>
            <FieldLabel emoji="🔍">Evidence (optional)</FieldLabel>
            <input
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              placeholder="e.g. drew first recognisable circle / counted 1-10"
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
                boxShadow: PILLOW,
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
              <Sprout size={16} strokeWidth={2.4} />
            )}
            Save observation
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
