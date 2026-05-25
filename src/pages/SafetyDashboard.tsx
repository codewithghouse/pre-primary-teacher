/**
 * SafetyDashboard.tsx — Class-wide safety reference for the pre-primary
 * teacher. Read-only consolidated view of every child's allergens,
 * medical notes, blood group, comfort cue, dietary restrictions, and
 * emergency contacts.
 *
 * Cartoonified 2026-05-25. Print-friendly desktop layout preserved via
 * the .print:hidden Tailwind utility on interactive chrome.
 */
import { useMemo, useState } from "react";
import {
  Phone,
  Search,
  AlertTriangle,
  Mail,
  Printer,
} from "lucide-react";
import { format } from "date-fns";
import { useTeacherClass } from "@/hooks/useTeacherClass";
import { useClassRoster, type RosterChild } from "@/hooks/useClassRoster";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { CartoonAvatar } from "@/components/CartoonAvatar";

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

type FilterKey = "all" | "alerts" | "allergens";

export default function SafetyDashboard() {
  const { primaryClass, loading: classLoading } = useTeacherClass();
  const { roster, loading: rosterLoading } = useClassRoster(primaryClass?.id);
  const isDesktop = useIsDesktop();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  const summary = useMemo(() => {
    const allergenSet = new Set<string>();
    let withAllergies = 0;
    let withMedical = 0;
    let withDiet = 0;
    let withPickupOnFile = 0;
    roster.forEach((c) => {
      const allergies = c.allergies || [];
      if (allergies.length > 0) {
        withAllergies++;
        allergies.forEach((a) => allergenSet.add(a.toLowerCase()));
      }
      if (c.medical) withMedical++;
      if (c.diet) withDiet++;
      if ((c.authorizedPickup?.length || 0) > 0) withPickupOnFile++;
    });
    return {
      withAllergies,
      withMedical,
      withDiet,
      withPickupOnFile,
      allergenList: Array.from(allergenSet).sort(),
    };
  }, [roster]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return roster.filter((c) => {
      const hasAlerts =
        (c.allergies && c.allergies.length > 0) || !!c.medical;
      if (filter === "alerts" && !hasAlerts) return false;
      if (filter === "allergens" && (!c.allergies || c.allergies.length === 0))
        return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [roster, search, filter]);

  // Priority sort — children with alerts surface first
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aAlerts =
        (a.allergies?.length || 0) > 0 ? 2 : !!a.medical ? 1 : 0;
      const bAlerts =
        (b.allergies?.length || 0) > 0 ? 2 : !!b.medical ? 1 : 0;
      if (aAlerts !== bAlerts) return bAlerts - aAlerts;
      return String(a.name).localeCompare(String(b.name));
    });
  }, [filtered]);

  if (classLoading || rosterLoading) {
    return (
      <div
        style={{
          padding: "48px 16px",
          textAlign: "center",
          fontSize: 12,
          color: "#64748B",
        }}
      >
        Loading roster…
      </div>
    );
  }

  if (!primaryClass) {
    return (
      <div style={{ padding: "48px 16px", textAlign: "center" }}>
        <p style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>
          🌱 No class assigned
        </p>
      </div>
    );
  }

  const cardGridCols = isDesktop ? "repeat(2, minmax(0, 1fr))" : "1fr";

  return (
    <div
      className="animate-fade-in print:bg-white"
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
            🛟
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
              Safety snapshot
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
              Safety Dashboard{" "}
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
              {primaryClass.name} · {format(new Date(), "EEEE, d MMM")} ·{" "}
              {roster.length} {roster.length === 1 ? "child" : "children"} on
              file
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="print:hidden"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 16px",
              borderRadius: 14,
              background: "#fff",
              color: NAVY,
              fontSize: 12,
              fontWeight: 800,
              border: "none",
              cursor: "pointer",
              boxShadow: PILLOW,
            }}
          >
            <Printer size={14} strokeWidth={2.4} />
            Print
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
          label="Allergies"
          value={summary.withAllergies}
          total={roster.length}
          emoji="🥜"
          tone={RED}
          surface="linear-gradient(135deg, #FFD6D6 0%, #FFF1F1 100%)"
        />
        <CounterCard
          label="Medical"
          value={summary.withMedical}
          total={roster.length}
          emoji="💊"
          tone={PEACH}
          surface="linear-gradient(135deg, #FFE0CC 0%, #FFF5EC 100%)"
        />
        <CounterCard
          label="Dietary"
          value={summary.withDiet}
          total={roster.length}
          emoji="🥗"
          tone={BUTTER}
          surface="linear-gradient(135deg, #FFEBC8 0%, #FFF7E5 100%)"
        />
        <CounterCard
          label="Pickup OK"
          value={summary.withPickupOnFile}
          total={roster.length}
          emoji="🚸"
          tone={MINT}
          surface="linear-gradient(135deg, #D6F5E2 0%, #F1FBF5 100%)"
        />
      </div>

      {/* Allergen roll-up — critical for picnic / shared snack days */}
      {summary.allergenList.length > 0 && (
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 22,
            padding: 16,
            background: "linear-gradient(135deg, #FFE3E3 0%, #FFF4F4 100%)",
            boxShadow: PILLOW,
          }}
        >
          <DotScribbles color={RED} dense />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 10,
              }}
            >
              <span
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  background: `linear-gradient(135deg, ${RED}, #DC2626)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  boxShadow: `0 6px 14px ${RED}55`,
                  transform: "rotate(-6deg)",
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={18} strokeWidth={2.4} />
              </span>
              <div>
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: RED,
                  }}
                >
                  Class-wide allergens
                </p>
                <p
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: NAVY,
                    marginTop: 2,
                    letterSpacing: "-0.3px",
                  }}
                >
                  {summary.allergenList.length} flagged
                </p>
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {summary.allergenList.map((a, idx) => (
                <span
                  key={a}
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: RED,
                    background: "#fff",
                    padding: "5px 12px",
                    borderRadius: 999,
                    textTransform: "capitalize",
                    boxShadow: `inset 0 0 0 1px ${RED}33, 0 2px 6px rgba(239,68,68,0.10)`,
                    transform: `rotate(${idx % 2 === 0 ? "-1.5deg" : "1.5deg"})`,
                  }}
                >
                  ⚠️ {a}
                </span>
              ))}
            </div>
            <p
              style={{
                fontSize: 11,
                color: "#64748B",
                marginTop: 12,
                lineHeight: 1.55,
              }}
            >
              Check this list before any shared snack, picnic lunch, or sweet
              treats. Specific child-allergen mapping below.
            </p>
          </div>
        </div>
      )}

      {/* Filters + search */}
      <div
        className="print:hidden"
        style={{
          display: "flex",
          flexDirection: isDesktop ? "row" : "column",
          gap: 10,
        }}
      >
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
            flex: isDesktop ? 1 : "0 1 auto",
          }}
        >
          <Search size={16} color="#94A3B8" strokeWidth={2.4} />
          <input
            placeholder="Search a child…"
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
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            paddingBottom: 2,
          }}
        >
          <FilterPill
            active={filter === "all"}
            onClick={() => setFilter("all")}
            label="All"
            count={roster.length}
            tone={NAVY}
          />
          <FilterPill
            active={filter === "alerts"}
            onClick={() => setFilter("alerts")}
            label="With alerts"
            count={summary.withAllergies + summary.withMedical}
            tone={RED}
          />
          <FilterPill
            active={filter === "allergens"}
            onClick={() => setFilter("allergens")}
            label="Allergies"
            count={summary.withAllergies}
            tone={PEACH}
          />
        </div>
      </div>

      {/* Children cards */}
      {sorted.length === 0 ? (
        <EmptyState
          emoji="🔍"
          title="No children match"
          subtitle="Try a different search or filter."
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: cardGridCols,
            gap: 12,
          }}
        >
          {sorted.map((child) => (
            <ChildSafetyCard key={child.id} child={child} />
          ))}
        </div>
      )}

      <p
        style={{
          fontSize: 10,
          textAlign: "center",
          color: "#94A3B8",
          fontWeight: 600,
          paddingTop: 8,
        }}
        className="print:pt-4"
      >
        Edullent · Pre-Primary · printed {format(new Date(), "d MMM yyyy")}
      </p>
    </div>
  );
}

/* ═══════════════════════ building blocks ═══════════════════════ */

function CounterCard({
  label,
  value,
  total,
  emoji,
  tone,
  surface,
}: {
  label: string;
  value: number;
  total: number;
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
          gap: 4,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
          <span
            style={{
              fontSize: 28,
              fontWeight: 900,
              letterSpacing: "-1px",
              color: tone,
              lineHeight: 1,
            }}
          >
            {value}
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: tone,
              opacity: 0.55,
            }}
          >
            /{total}
          </span>
        </div>
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

function FilterPill({
  active,
  onClick,
  label,
  count,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  tone: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 16px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        background: active ? `linear-gradient(135deg, ${tone}, ${tone}cc)` : "#fff",
        color: active ? "#fff" : NAVY,
        border: "none",
        cursor: "pointer",
        boxShadow: active ? `0 8px 18px -6px ${tone}66` : PILLOW,
        transition: "all 160ms ease",
      }}
      className="active:scale-95 hover:-translate-y-0.5"
    >
      {label}
      {count > 0 && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 900,
            padding: "2px 8px",
            borderRadius: 999,
            background: active ? "rgba(255,255,255,0.22)" : `${tone}1f`,
            color: active ? "#fff" : tone,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function EmptyState({
  emoji,
  title,
  subtitle,
}: {
  emoji: string;
  title: string;
  subtitle: string;
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
    </div>
  );
}

function ChildSafetyCard({ child }: { child: RosterChild }) {
  const hasAllergies = (child.allergies?.length || 0) > 0;
  const hasMedical = !!child.medical;
  const flagged = hasAllergies || hasMedical;

  const surface = hasAllergies
    ? "linear-gradient(135deg, #FFD6D6 0%, #FFF1F1 100%)"
    : hasMedical
    ? "linear-gradient(135deg, #FFE0CC 0%, #FFF5EC 100%)"
    : "linear-gradient(135deg, #ECF3FF 0%, #FAFCFF 100%)";
  const scribble = hasAllergies ? RED : hasMedical ? PEACH : SKY;
  const ring = hasAllergies ? RED : hasMedical ? PEACH : SKY;

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 22,
        padding: 14,
        background: surface,
        boxShadow: PILLOW,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <DotScribbles color={scribble} />

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          position: "relative",
          zIndex: 1,
        }}
      >
        <CartoonAvatar
          name={child.name}
          size={48}
          ringColor={ring}
          ringWidth={3}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: NAVY,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              letterSpacing: "-0.2px",
            }}
          >
            {child.name}
          </p>
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#64748B",
              marginTop: 2,
            }}
          >
            Roll #{child.rollNo}
            {child.bloodGroup && (
              <span style={{ marginLeft: 6, fontWeight: 800, color: RED }}>
                · 🩸 {child.bloodGroup}
              </span>
            )}
          </p>
        </div>
        {flagged && (
          <span
            style={{
              flexShrink: 0,
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: "0.08em",
              padding: "4px 10px",
              borderRadius: 999,
              background: hasAllergies ? RED : PEACH,
              color: "#fff",
              textTransform: "uppercase",
              transform: "rotate(6deg)",
              boxShadow: `0 4px 10px ${hasAllergies ? RED : PEACH}55`,
            }}
          >
            {hasAllergies ? "Alert" : "Watch"}
          </span>
        )}
      </div>

      {/* Sections */}
      {hasAllergies && (
        <SafetySection emoji="🥜" tone={RED} label="Allergies">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {child.allergies!.map((a, idx) => (
              <span
                key={a}
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: RED,
                  background: "#fff",
                  padding: "4px 10px",
                  borderRadius: 999,
                  textTransform: "capitalize",
                  boxShadow: `inset 0 0 0 1px ${RED}33`,
                  transform: `rotate(${idx % 2 === 0 ? "-1.5deg" : "1.5deg"})`,
                }}
              >
                ⚠️ {a}
              </span>
            ))}
          </div>
        </SafetySection>
      )}

      {hasMedical && (
        <SafetySection emoji="💊" tone={PEACH} label="Medical">
          <p
            style={{
              fontSize: 12,
              color: "#0F172A",
              lineHeight: 1.55,
              fontWeight: 500,
            }}
          >
            {child.medical}
          </p>
        </SafetySection>
      )}

      {child.diet && (
        <SafetySection emoji="🥗" tone={BUTTER} label="Diet">
          <p style={{ fontSize: 12, color: "#0F172A", fontWeight: 500 }}>
            {child.diet}
          </p>
        </SafetySection>
      )}

      {child.comfortCue && (
        <SafetySection emoji="💗" tone={BLUSH} label="Comfort cue">
          <p
            style={{
              fontSize: 12,
              fontStyle: "italic",
              color: "#0F172A",
              opacity: 0.85,
              lineHeight: 1.55,
            }}
          >
            "{child.comfortCue}"
          </p>
        </SafetySection>
      )}

      {/* Emergency contact footer */}
      {(child.parentName || child.parentPhone || child.parentEmail) && (
        <div
          style={{
            position: "relative",
            zIndex: 1,
            paddingTop: 10,
            borderTop: "1px dashed rgba(15,23,42,0.12)",
            marginTop: "auto",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 6,
            }}
          >
            <span
              aria-hidden
              style={{ fontSize: 12, transform: "rotate(-6deg)", display: "inline-block" }}
            >
              📞
            </span>
            <p
              style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: NAVY,
                opacity: 0.7,
              }}
            >
              Emergency contact
            </p>
          </div>
          <p
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: NAVY,
              letterSpacing: "-0.1px",
            }}
          >
            {child.parentName || "Parent"}
          </p>
          <div
            style={{
              display: "flex",
              gap: 6,
              marginTop: 8,
              flexWrap: "wrap",
            }}
          >
            {child.parentPhone && (
              <a
                href={`tel:${child.parentPhone.replace(/\s/g, "")}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#fff",
                  background: `linear-gradient(135deg, ${SKY}, #0284C7)`,
                  padding: "6px 12px",
                  borderRadius: 999,
                  textDecoration: "none",
                  boxShadow: `0 4px 10px ${SKY}55`,
                }}
                className="active:scale-95 hover:-translate-y-0.5 transition print:bg-white print:text-blue-700 print:shadow-none"
              >
                <Phone size={11} strokeWidth={2.6} />
                {child.parentPhone}
              </a>
            )}
            {child.parentEmail && (
              <a
                href={`mailto:${child.parentEmail}`}
                title={child.parentEmail}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11,
                  fontWeight: 800,
                  color: NAVY,
                  background: "#fff",
                  padding: "6px 12px",
                  borderRadius: 999,
                  textDecoration: "none",
                  boxShadow: "inset 0 0 0 1px #CBD5E1",
                }}
                className="active:scale-95 hover:-translate-y-0.5 transition"
              >
                <Mail size={11} strokeWidth={2.6} />
                Email
              </a>
            )}
          </div>
        </div>
      )}

      {!flagged && !child.diet && !child.comfortCue && (
        <p
          style={{
            position: "relative",
            zIndex: 1,
            fontSize: 11,
            textAlign: "center",
            color: "#94A3B8",
            fontStyle: "italic",
            padding: "4px 0",
          }}
        >
          No safety notes on file 🌱
        </p>
      )}
    </div>
  );
}

function SafetySection({
  emoji,
  tone,
  label,
  children,
}: {
  emoji: string;
  tone: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ position: "relative", zIndex: 1 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 6,
        }}
      >
        <span
          aria-hidden
          style={{ fontSize: 14, transform: "rotate(-6deg)", display: "inline-block" }}
        >
          {emoji}
        </span>
        <p
          style={{
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: tone,
          }}
        >
          {label}
        </p>
      </div>
      {children}
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

// LAV is part of the shared sherbet palette but not currently used on this page.
// Keep the constant referenced so future variants don't need a re-import.
void LAV;
