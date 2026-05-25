import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Filter,
  Loader2,
  Plus,
  Search,
  ShieldAlert,
  X,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useTeacherClass } from "@/hooks/useTeacherClass";
import { useClassRoster } from "@/hooks/useClassRoster";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { CartoonAvatar } from "@/components/CartoonAvatar";
import {
  usePPIncidents,
  INCIDENT_TYPE_EMOJI,
  INCIDENT_TYPE_LABEL,
  SEVERITY_LABEL,
  ALL_INCIDENT_TYPES,
  ALL_SEVERITIES,
  type Incident,
  type IncidentSeverity,
  type IncidentType,
} from "@/hooks/usePPIncidents";

/* ═══════════════════════════════════════════════════════════════════════
   PRE-PRIMARY TEACHER · INCIDENTS LOG
   Storybook-sherbet append-only safety + escalation log. Severity colors
   drive every surface; cartoon avatars on each child reference.
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

const SEV_TONE: Record<IncidentSeverity, { tone: string; surface: string; bar: string; emoji: string }> = {
  low: {
    tone: MINT,
    surface: "linear-gradient(135deg, #D6F5E2 0%, #F1FBF5 100%)",
    bar: "#10B981",
    emoji: "🟢",
  },
  medium: {
    tone: BUTTER,
    surface: "linear-gradient(135deg, #FFEBC8 0%, #FFF7E5 100%)",
    bar: "#F59E0B",
    emoji: "🟡",
  },
  high: {
    tone: PEACH,
    surface: "linear-gradient(135deg, #FFE0CC 0%, #FFF5EC 100%)",
    bar: "#F97316",
    emoji: "🟠",
  },
  critical: {
    tone: RED,
    surface: "linear-gradient(135deg, #FFD6D6 0%, #FFF1F1 100%)",
    bar: "#DC2626",
    emoji: "🔴",
  },
};

export default function Incidents() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { primaryClass, loading: classLoading } = useTeacherClass();
  const { roster } = useClassRoster(primaryClass?.id);
  const { incidents, loading: incLoading, addIncident } = usePPIncidents(
    primaryClass?.id
  );
  const isDesktop = useIsDesktop();

  const [search, setSearch] = useState("");
  const [filterChild, setFilterChild] = useState<string>("");
  const [filterType, setFilterType] = useState<IncidentType | "">("");
  const [filterSeverity, setFilterSeverity] = useState<IncidentSeverity | "">("");
  const [showHandled, setShowHandled] = useState(false);

  const [dialog, setDialog] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [type, setType] = useState<IncidentType>("injury");
  const [severity, setSeverity] = useState<IncidentSeverity>("medium");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [parentNotified, setParentNotified] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justSavedAt, setJustSavedAt] = useState<number | null>(null);

  useEffect(() => {
    const childParam = searchParams.get("child");
    const openParam = searchParams.get("open");
    if (openParam === "1" && childParam) {
      setStudentId(childParam);
      setDialog(true);
      const next = new URLSearchParams(searchParams);
      next.delete("child");
      next.delete("open");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (justSavedAt === null) return;
    const t = setTimeout(() => setJustSavedAt(null), 2500);
    return () => clearTimeout(t);
  }, [justSavedAt]);

  // Body scroll lock when dialog is open
  useEffect(() => {
    if (!dialog) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [dialog]);

  const filtersActive = !!(
    filterChild ||
    filterType ||
    filterSeverity ||
    search.trim() ||
    showHandled
  );
  const clearFilters = () => {
    setFilterChild("");
    setFilterType("");
    setFilterSeverity("");
    setSearch("");
    setShowHandled(false);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return incidents.filter((i) => {
      if (!showHandled && i.handled) return false;
      if (filterChild && i.studentId !== filterChild) return false;
      if (filterType && i.type !== filterType) return false;
      if (filterSeverity && i.severity !== filterSeverity) return false;
      if (q) {
        const hay = `${i.studentName} ${i.title} ${i.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [incidents, search, filterChild, filterType, filterSeverity, showHandled]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      total: incidents.length,
      today: incidents.filter((i) => i.date === today).length,
      unhandled: incidents.filter((i) => !i.handled).length,
      critical: incidents.filter((i) => i.severity === "critical" && !i.handled)
        .length,
    };
  }, [incidents]);

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
  if (incLoading && incidents.length === 0)
    return <CenteredLoader label="Loading incidents…" />;

  const openAdd = (preChildId?: string) => {
    setStudentId(preChildId || "");
    setType("injury");
    setSeverity("medium");
    setTitle("");
    setDescription("");
    setActionTaken("");
    setParentNotified(false);
    setDialog(true);
  };

  const submit = async () => {
    const child = roster.find((c) => c.id === studentId);
    if (!child) {
      toast.error("Pick a child");
      return;
    }
    if (title.trim().length < 3) {
      toast.error("Title too short");
      return;
    }
    if (description.trim().length < 10) {
      toast.error("Description too short — give some detail");
      return;
    }
    setSaving(true);
    try {
      await addIncident({
        studentId: child.id,
        studentName: child.name,
        type,
        severity,
        title,
        description,
        actionTaken: actionTaken.trim() || undefined,
        parentNotified,
      });
      toast.success(
        `${INCIDENT_TYPE_EMOJI[type]} ${INCIDENT_TYPE_LABEL[type]} incident logged for ${child.name.split(" ")[0]}`
      );
      setDialog(false);
      clearFilters();
      setJustSavedAt(Date.now());
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (e) {
      console.error("[Incidents] addIncident:", e);
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Could not save incident: ${msg.slice(0, 140)}`);
    } finally {
      setSaving(false);
    }
  };

  const cardGridCols = isDesktop ? "repeat(2, minmax(0, 1fr))" : "1fr";

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
              "linear-gradient(135deg, #FFD6D6 0%, #FFEDED 55%, #FFFFFF 100%)",
            boxShadow: PILLOW,
          }}
        >
          <DotScribbles color={RED} dense />
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
                background: `linear-gradient(135deg, ${RED}, #DC2626)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26,
                boxShadow: `0 8px 18px ${RED}55`,
                transform: "rotate(-8deg)",
                flexShrink: 0,
              }}
              aria-hidden
            >
              🛡️
            </span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: RED,
                  opacity: 0.9,
                }}
              >
                Safety log
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
                Incidents{" "}
                <span
                  aria-hidden
                  style={{ display: "inline-block", transform: "rotate(6deg)" }}
                >
                  ⚠️
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
                Append-only · visible to principal
              </p>
            </div>
            <button
              type="button"
              onClick={() => openAdd()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "12px 18px",
                borderRadius: 16,
                background: `linear-gradient(135deg, ${RED}, #DC2626)`,
                color: "#fff",
                fontSize: 13,
                fontWeight: 800,
                border: "none",
                cursor: "pointer",
                boxShadow: `0 10px 24px -8px ${RED}88`,
              }}
              className="active:scale-95 hover:-translate-y-0.5 transition"
            >
              <Plus size={16} strokeWidth={2.6} />
              {isDesktop ? "Log incident" : "Log"}
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
            label="Unhandled"
            value={stats.unhandled}
            emoji="⏳"
            tone={stats.unhandled > 0 ? PEACH : MINT}
            surface={
              stats.unhandled > 0
                ? "linear-gradient(135deg, #FFE0CC 0%, #FFF5EC 100%)"
                : "linear-gradient(135deg, #D6F5E2 0%, #F1FBF5 100%)"
            }
          />
          <CounterCard
            label="Critical"
            value={stats.critical}
            emoji="🚨"
            tone={stats.critical > 0 ? RED : "#94A3B8"}
            surface={
              stats.critical > 0
                ? "linear-gradient(135deg, #FFD6D6 0%, #FFF1F1 100%)"
                : "linear-gradient(135deg, #F1F5F9 0%, #FFFFFF 100%)"
            }
            pulse={stats.critical > 0}
          />
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
            placeholder="Search incidents…"
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

        {/* Filters: child + type + severity selects rendered as pillow chips */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isDesktop ? "repeat(3, minmax(0, 1fr))" : "1fr",
            gap: 8,
          }}
        >
          <SelectPillow
            value={filterChild}
            onChange={setFilterChild}
            placeholder="👶 All children"
          >
            <option value="">👶 All children</option>
            {roster.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectPillow>
          <SelectPillow
            value={filterType}
            onChange={(v) => setFilterType(v as IncidentType | "")}
            placeholder="🗂️ All types"
          >
            <option value="">🗂️ All types</option>
            {ALL_INCIDENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {INCIDENT_TYPE_EMOJI[t]} {INCIDENT_TYPE_LABEL[t]}
              </option>
            ))}
          </SelectPillow>
          <SelectPillow
            value={filterSeverity}
            onChange={(v) => setFilterSeverity(v as IncidentSeverity | "")}
            placeholder="🎯 All severities"
          >
            <option value="">🎯 All severities</option>
            {ALL_SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {SEV_TONE[s].emoji} {SEVERITY_LABEL[s]}
              </option>
            ))}
          </SelectPillow>
        </div>

        {/* Show handled toggle */}
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
            background: showHandled ? `${MINT}1f` : "transparent",
            border: `1px dashed ${showHandled ? MINT : "#CBD5E1"}`,
            width: "fit-content",
            transition: "all 160ms ease",
          }}
        >
          <input
            type="checkbox"
            checked={showHandled}
            onChange={(e) => setShowHandled(e.target.checked)}
            style={{
              width: 14,
              height: 14,
              accentColor: MINT,
              cursor: "pointer",
            }}
          />
          {showHandled ? "✓ Showing handled" : "Also show handled / resolved"}
        </label>

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
              of {incidents.length}
              {filterChild && roster.find((r) => r.id === filterChild) && (
                <FilterChip>
                  {roster.find((r) => r.id === filterChild)?.name.split(" ")[0]}
                </FilterChip>
              )}
              {filterType && (
                <FilterChip>
                  {INCIDENT_TYPE_EMOJI[filterType]}{" "}
                  {INCIDENT_TYPE_LABEL[filterType]}
                </FilterChip>
              )}
              {filterSeverity && (
                <FilterChip>{SEVERITY_LABEL[filterSeverity]}</FilterChip>
              )}
              {showHandled && <FilterChip>+ handled</FilterChip>}
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
              🛡️
            </p>
            <p style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>
              {filtersActive ? "No matches — clear filters to see all" : "No incidents recorded"}
            </p>
            <p style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>
              {filtersActive
                ? "Your saved incident might be hidden by an active filter."
                : "A clean log is good news. Tap + if you need to record something."}
            </p>
            {filtersActive && (
              <button
                type="button"
                onClick={clearFilters}
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
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <ul
            style={{
              display: "grid",
              gridTemplateColumns: cardGridCols,
              gap: 12,
              padding: 0,
              margin: 0,
              listStyle: "none",
            }}
          >
            {filtered.map((inc, i) => {
              const child = roster.find((c) => c.id === inc.studentId);
              return (
                <li key={inc.id}>
                  <IncidentCard
                    incident={inc}
                    child={child}
                    pulse={justSavedAt !== null && i === 0}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Composer dialog */}
      {dialog && (
        <ComposerDialog
          isDesktop={isDesktop}
          studentId={studentId}
          setStudentId={setStudentId}
          type={type}
          setType={setType}
          severity={severity}
          setSeverity={setSeverity}
          title={title}
          setTitle={setTitle}
          description={description}
          setDescription={setDescription}
          actionTaken={actionTaken}
          setActionTaken={setActionTaken}
          parentNotified={parentNotified}
          setParentNotified={setParentNotified}
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
  pulse,
}: {
  label: string;
  value: number;
  emoji: string;
  tone: string;
  surface: string;
  pulse?: boolean;
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
        animation: pulse ? "pulse 2s ease-in-out infinite" : undefined,
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

function SelectPillow({
  value,
  onChange,
  placeholder,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  children: React.ReactNode;
}) {
  void placeholder;
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

function IncidentCard({
  incident,
  child,
  pulse,
}: {
  incident: Incident;
  child: { name: string } | undefined;
  pulse: boolean;
}) {
  const sev = SEV_TONE[incident.severity];
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 22,
        padding: 14,
        background: sev.surface,
        boxShadow: pulse
          ? `${PILLOW}, 0 0 0 3px ${MINT}88`
          : PILLOW,
        borderLeft: `5px solid ${sev.bar}`,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        animation: pulse ? "pulse 1.4s ease-in-out infinite" : undefined,
      }}
    >
      <DotScribbles color={sev.tone} />

      {/* Header row: child avatar + severity pill + type pill + status pill */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          position: "relative",
          zIndex: 1,
        }}
      >
        <CartoonAvatar
          name={incident.studentName}
          size={42}
          ringColor={sev.bar}
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
            {incident.title}
          </p>
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#64748B",
              marginTop: 2,
            }}
          >
            {(child?.name || incident.studentName).split(" ")[0]} ·{" "}
            {format(new Date(incident.createdAt), "d MMM · h:mm a")}
          </p>
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              marginTop: 8,
            }}
          >
            <SevPill severity={incident.severity} />
            <TypePill type={incident.type} />
            <HandledPill handled={incident.handled} />
          </div>
        </div>
      </div>

      {/* Description */}
      <p
        style={{
          fontSize: 12,
          color: "#0F172A",
          lineHeight: 1.55,
          whiteSpace: "pre-wrap",
          position: "relative",
          zIndex: 1,
        }}
      >
        {incident.description}
      </p>

      {/* Action taken */}
      {incident.actionTaken && (
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
          }}
        >
          <span style={{ fontWeight: 800, color: sev.tone }}>🩹 Action:</span>{" "}
          {incident.actionTaken}
        </div>
      )}

      {/* Footer: created by + parent notified */}
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
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8" }}>
          — {incident.createdByName || "Teacher"}
        </span>
        {incident.parentNotified ? (
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: "#047857",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 8px",
              borderRadius: 999,
              background: "#fff",
              boxShadow: `inset 0 0 0 1px ${MINT}55`,
            }}
          >
            <CheckCircle2 size={10} strokeWidth={3} /> Parent notified
          </span>
        ) : (
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: "#92400E",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 8px",
              borderRadius: 999,
              background: "#fff",
              boxShadow: `inset 0 0 0 1px ${BUTTER}55`,
            }}
          >
            <AlertTriangle size={10} strokeWidth={2.6} /> Parent not notified
          </span>
        )}
      </div>
    </div>
  );
}

function SevPill({ severity }: { severity: IncidentSeverity }) {
  const sev = SEV_TONE[severity];
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 900,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "#fff",
        background: `linear-gradient(135deg, ${sev.tone}, ${sev.tone}cc)`,
        padding: "3px 8px",
        borderRadius: 999,
        boxShadow: `0 3px 8px ${sev.tone}44`,
      }}
    >
      {sev.emoji} {SEVERITY_LABEL[severity]}
    </span>
  );
}

function TypePill({ type }: { type: IncidentType }) {
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: NAVY,
        background: "#fff",
        padding: "3px 8px",
        borderRadius: 999,
        boxShadow: "inset 0 0 0 1px #CBD5E1",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      {INCIDENT_TYPE_EMOJI[type]} {INCIDENT_TYPE_LABEL[type]}
    </span>
  );
}

function HandledPill({ handled }: { handled: boolean }) {
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 900,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: handled ? "#047857" : "#92400E",
        background: handled ? `${MINT}1f` : `${BUTTER}1f`,
        padding: "3px 8px",
        borderRadius: 999,
        boxShadow: `inset 0 0 0 1px ${handled ? MINT : BUTTER}55`,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      {handled ? (
        <>
          <CheckCircle2 size={10} strokeWidth={3} /> Handled
        </>
      ) : (
        <>
          <Clock size={10} strokeWidth={2.6} /> Pending
        </>
      )}
    </span>
  );
}

/* ═══════════════════════ Composer ═══════════════════════ */

function ComposerDialog({
  isDesktop,
  studentId,
  setStudentId,
  type,
  setType,
  severity,
  setSeverity,
  title,
  setTitle,
  description,
  setDescription,
  actionTaken,
  setActionTaken,
  parentNotified,
  setParentNotified,
  saving,
  onSubmit,
  onClose,
  roster,
}: {
  isDesktop: boolean;
  studentId: string;
  setStudentId: (v: string) => void;
  type: IncidentType;
  setType: (v: IncidentType) => void;
  severity: IncidentSeverity;
  setSeverity: (v: IncidentSeverity) => void;
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  actionTaken: string;
  setActionTaken: (v: string) => void;
  parentNotified: boolean;
  setParentNotified: (v: boolean) => void;
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
            "linear-gradient(180deg, #FFF1F1 0%, #FFFFFF 28%, #FFFFFF 100%)",
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
              "linear-gradient(180deg, rgba(255,241,241,0.95) 0%, rgba(255,255,255,0.85) 100%)",
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
                  color: RED,
                  opacity: 0.85,
                }}
              >
                New incident
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
                Log incident{" "}
                <span
                  aria-hidden
                  style={{ display: "inline-block", transform: "rotate(-6deg)" }}
                >
                  📝
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
            <FieldLabel tone={NAVY} emoji="👶">Child</FieldLabel>
            <SelectPillow
              value={studentId}
              onChange={setStudentId}
              placeholder="Choose a child…"
            >
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
            <FieldLabel tone={NAVY} emoji="🗂️">Type</FieldLabel>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                gap: 6,
              }}
            >
              {ALL_INCIDENT_TYPES.map((t) => {
                const selected = type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    style={{
                      aspectRatio: "3 / 4",
                      borderRadius: 18,
                      background: selected
                        ? "linear-gradient(135deg, #E1ECFF 0%, #F7FAFF 100%)"
                        : "#fff",
                      boxShadow: selected
                        ? `inset 0 0 0 2px ${NAVY}, ${PILLOW}`
                        : PILLOW,
                      border: "none",
                      cursor: "pointer",
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
                      {INCIDENT_TYPE_EMOJI[t]}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        color: selected ? NAVY : "#475569",
                      }}
                    >
                      {INCIDENT_TYPE_LABEL[t]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Severity tiles */}
          <div>
            <FieldLabel tone={NAVY} emoji="🎯">Severity</FieldLabel>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 6,
              }}
            >
              {ALL_SEVERITIES.map((s) => {
                const sev = SEV_TONE[s];
                const selected = severity === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSeverity(s)}
                    style={{
                      height: 56,
                      borderRadius: 16,
                      background: selected
                        ? `linear-gradient(135deg, ${sev.tone}, ${sev.tone}cc)`
                        : "#fff",
                      color: selected ? "#fff" : "#475569",
                      boxShadow: selected
                        ? `0 8px 18px -6px ${sev.tone}66`
                        : PILLOW,
                      border: "none",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 800,
                      letterSpacing: "-0.1px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 5,
                      transition: "transform 140ms ease",
                    }}
                    className="active:scale-95"
                  >
                    <span aria-hidden>{sev.emoji}</span>
                    {SEVERITY_LABEL[s]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <FieldLabel tone={NAVY} emoji="📝">Title</FieldLabel>
            <PillowInput
              value={title}
              onChange={setTitle}
              placeholder="e.g. Bumped head on shelf"
              maxLength={199}
            />
          </div>

          {/* Description */}
          <div>
            <FieldLabel tone={NAVY} emoji="💬">What happened</FieldLabel>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={3999}
              placeholder="Where, when, who was around, how the child responded."
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

          {/* Action taken */}
          <div>
            <FieldLabel tone={NAVY} emoji="🩹">Action taken (optional)</FieldLabel>
            <PillowInput
              value={actionTaken}
              onChange={setActionTaken}
              placeholder="First aid, comforted, isolated from source, etc."
            />
          </div>

          {/* Parent notified toggle */}
          <label
            style={{
              position: "relative",
              overflow: "hidden",
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: 14,
              borderRadius: 18,
              background: parentNotified
                ? "linear-gradient(135deg, #D6F5E2 0%, #F1FBF5 100%)"
                : "linear-gradient(135deg, #F8FAFC 0%, #FFFFFF 100%)",
              boxShadow: PILLOW,
              cursor: "pointer",
            }}
          >
            <DotScribbles color={parentNotified ? MINT : NAVY} />
            <input
              type="checkbox"
              checked={parentNotified}
              onChange={(e) => setParentNotified(e.target.checked)}
              style={{
                marginTop: 2,
                width: 16,
                height: 16,
                accentColor: MINT,
                cursor: "pointer",
                position: "relative",
                zIndex: 1,
              }}
            />
            <span
              style={{
                fontSize: 12,
                color: "#0F172A",
                lineHeight: 1.55,
                fontWeight: 500,
                position: "relative",
                zIndex: 1,
              }}
            >
              <strong style={{ color: parentNotified ? "#047857" : NAVY }}>
                Parent has been notified
              </strong>{" "}
              about this incident (phone, WhatsApp, or in person). Timestamp
              gets recorded.
            </span>
          </label>

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
                : `linear-gradient(135deg, ${RED}, #DC2626)`,
              color: "#fff",
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: "-0.1px",
              border: "none",
              cursor: saving ? "default" : "pointer",
              boxShadow: saving ? "none" : `0 12px 28px -8px ${RED}88`,
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
              <ShieldAlert size={16} strokeWidth={2.4} />
            )}
            Log incident
          </button>
          <p
            style={{
              fontSize: 10,
              textAlign: "center",
              color: "#94A3B8",
              lineHeight: 1.55,
            }}
          >
            Incidents are append-only and visible to your principal. Cannot be
            deleted after submission.
          </p>
        </div>
      </div>
    </div>
  );
}

function FieldLabel({
  tone,
  emoji,
  children,
}: {
  tone: string;
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
          color: tone,
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
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
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
void BLUSH;
void LAV;
