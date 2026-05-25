import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Phone,
  Search,
  X,
  Loader2,
  Send,
  Check,
  UserCircle,
  AlertTriangle,
  Mail,
} from "lucide-react";
import { useTeacherClass } from "@/hooks/useTeacherClass";
import { useClassRoster, type RosterChild } from "@/hooks/useClassRoster";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { CartoonAvatar } from "@/components/CartoonAvatar";
import { auditedUpdate } from "@/lib/auditedWrites";
import { doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";

/* ═══════════════════════════════════════════════════════════════════════
   PRE-PRIMARY TEACHER · CLASS ROSTER
   Storybook-sherbet class home base. CartoonAvatar grid, sherbet pillows,
   bottom-sheet (mobile) / centered modal (desktop) profile preview.
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

const PRE_PRIMARY_PARENT_URL = "https://pre-parent-dashboard.vercel.app";

export default function Roster() {
  const [query, setQuery] = useState("");
  const [openChildId, setOpenChildId] = useState<string | null>(null);
  const { primaryClass, loading: classLoading } = useTeacherClass();
  const { roster, loading: rosterLoading } = useClassRoster(primaryClass?.id);
  const isDesktop = useIsDesktop();

  const loading = classLoading || rosterLoading;
  const filtered = roster.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase())
  );

  const open = openChildId ? roster.find((c) => c.id === openChildId) : null;

  if (loading && roster.length === 0) {
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
        <p style={{ fontSize: 12, fontWeight: 600 }}>Loading class…</p>
      </div>
    );
  }

  if (!primaryClass) {
    return (
      <div style={{ padding: "48px 16px", textAlign: "center" }}>
        <p style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>
          🌱 No class assigned
        </p>
        <p style={{ fontSize: 12, color: "#64748B", marginTop: 6 }}>
          Ask your principal to assign you to a Playgroup / Nursery / LKG / UKG
          class.
        </p>
      </div>
    );
  }

  const stats = roster.reduce(
    (acc, c) => {
      acc.total++;
      if ((c.allergies?.length || 0) > 0 || !!c.medical) acc.alerts++;
      if (c.parentEmail) acc.linked++;
      return acc;
    },
    { total: 0, alerts: 0, linked: 0 }
  );

  const gridCols = isDesktop
    ? "repeat(6, minmax(0, 1fr))"
    : "repeat(3, minmax(0, 1fr))";

  return (
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
      {/* Hero greeting */}
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 28,
          padding: isDesktop ? "22px 26px" : "18px 18px",
          background:
            "linear-gradient(135deg, #FFE0CC 0%, #FFF1E0 55%, #FFFAF1 100%)",
          boxShadow: PILLOW,
        }}
      >
        <DotScribbles color={PEACH} dense />
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
              background: `linear-gradient(135deg, ${PEACH}, ${BUTTER})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              boxShadow: `0 8px 18px ${PEACH}55`,
              transform: "rotate(-8deg)",
              flexShrink: 0,
            }}
            aria-hidden
          >
            🎒
          </span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <p
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: PEACH,
                opacity: 0.9,
              }}
            >
              My class
            </p>
            <h1
              style={{
                fontSize: isDesktop ? 28 : 22,
                fontWeight: 800,
                letterSpacing: "-0.6px",
                color: NAVY,
                marginTop: 2,
              }}
            >
              {primaryClass.name}{" "}
              <span
                aria-hidden
                style={{
                  display: "inline-block",
                  transform: "rotate(6deg)",
                  marginLeft: 4,
                }}
              >
                🌈
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
              {roster.length} {roster.length === 1 ? "child" : "children"} ·
              Tap a face to see safety + parent contact.
            </p>
          </div>
        </div>
      </div>

      {/* Counter strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 10,
        }}
      >
        <CounterCard
          label="Children"
          value={stats.total}
          emoji="👧"
          tone={NAVY}
          surface="linear-gradient(135deg, #E1ECFF 0%, #F7FAFF 100%)"
        />
        <CounterCard
          label="Safety alerts"
          value={stats.alerts}
          emoji="🛟"
          tone={RED}
          surface="linear-gradient(135deg, #FFD6D6 0%, #FFF1F1 100%)"
        />
        <CounterCard
          label="Parents linked"
          value={stats.linked}
          emoji="💌"
          tone={MINT}
          surface="linear-gradient(135deg, #C9F5DE 0%, #F0FBF5 100%)"
        />
      </div>

      {/* Search pillow */}
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
          placeholder="Search by name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
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
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
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
            aria-label="Clear search"
          >
            <X size={14} color="#64748B" strokeWidth={2.4} />
          </button>
        )}
      </div>

      {/* Empty / no-match */}
      {roster.length === 0 ? (
        <EmptyState
          emoji="🌱"
          title="No students enrolled"
          subtitle={`Ask your principal to add students to ${primaryClass.name}.`}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          emoji="🔍"
          title="No matches"
          subtitle={`No child in ${primaryClass.name} matches "${query}".`}
        />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 12 }}>
          {filtered.map((c) => (
            <ChildCard key={c.id} child={c} onTap={() => setOpenChildId(c.id)} />
          ))}
        </div>
      )}

      {open && (
        <ChildSheet
          child={open}
          onClose={() => setOpenChildId(null)}
          isDesktop={isDesktop}
        />
      )}
    </div>
  );
}

/* ═══════════════════════ building blocks ═══════════════════════ */

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
        padding: "14px 14px 12px",
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
            fontSize: 32,
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
            fontSize: 22,
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
          letterSpacing: "0.14em",
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

function ChildCard({
  child,
  onTap,
}: {
  child: RosterChild;
  onTap: () => void;
}) {
  const hasAlert = (child.allergies?.length || 0) > 0 || !!child.medical;
  const parentLinked = !!child.parentEmail;
  const ageYears = child.ageMonths ? Math.floor(child.ageMonths / 12) : null;
  const ageMonths = child.ageMonths ? child.ageMonths % 12 : null;

  const surface = hasAlert
    ? "linear-gradient(135deg, #FFE9D9 0%, #FFF7EE 100%)"
    : "linear-gradient(135deg, #ECF3FF 0%, #FAFCFF 100%)";
  const scribble = hasAlert ? PEACH : NAVY;
  const ring = hasAlert ? PEACH : SKY;

  return (
    <button
      type="button"
      onClick={onTap}
      style={{
        position: "relative",
        overflow: "hidden",
        aspectRatio: "3 / 4",
        borderRadius: 22,
        background: surface,
        boxShadow: PILLOW,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-end",
        padding: "12px 8px 10px",
        border: "none",
        cursor: "pointer",
        transition: "transform 140ms ease",
      }}
      className="active:scale-95 hover:-translate-y-0.5"
    >
      <DotScribbles color={scribble} />

      {/* Avatar centered */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "42%",
          transform: "translateY(-50%)",
          display: "flex",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <CartoonAvatar
          name={child.name}
          size={64}
          ringColor={ring}
          ringWidth={3}
        />
      </div>

      {/* Safety alert sticker top-right */}
      {hasAlert && (
        <div
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 26,
            height: 26,
            borderRadius: 999,
            background: PEACH,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 4px 10px ${PEACH}66`,
            transform: "rotate(8deg)",
          }}
          aria-hidden
          title="Has safety alert"
        >
          <AlertTriangle size={14} strokeWidth={2.6} />
        </div>
      )}

      {/* Parent-linked dot top-left */}
      {parentLinked && (
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            width: 18,
            height: 18,
            borderRadius: 999,
            background: MINT,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 4px 8px ${MINT}55`,
            transform: "rotate(-8deg)",
          }}
          aria-hidden
          title="Parent linked"
        >
          <Check size={11} strokeWidth={3.2} />
        </div>
      )}

      {/* Roll badge bottom-left (subtle) */}
      <div
        style={{
          position: "absolute",
          bottom: 10,
          left: 8,
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: "0.06em",
          color: "#64748B",
          background: "rgba(255,255,255,0.85)",
          padding: "2px 6px",
          borderRadius: 999,
          zIndex: 1,
        }}
        aria-hidden
      >
        #{child.rollNo}
      </div>

      {/* Name pill bottom */}
      <p
        style={{
          position: "relative",
          zIndex: 1,
          fontSize: 11,
          fontWeight: 800,
          color: "#0F172A",
          background: "rgba(255,255,255,0.9)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          padding: "3px 10px",
          borderRadius: 999,
          maxWidth: "100%",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          marginTop: 2,
        }}
      >
        {child.name.split(" ")[0]}
      </p>
      {ageYears !== null && (
        <p
          style={{
            position: "relative",
            zIndex: 1,
            fontSize: 9,
            fontWeight: 700,
            color: "#94A3B8",
            marginTop: 2,
          }}
        >
          {ageYears}y {ageMonths}m
        </p>
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

function ChildSheet({
  child,
  onClose,
  isDesktop,
}: {
  child: RosterChild;
  onClose: () => void;
  isDesktop: boolean;
}) {
  const hasAlert = (child.allergies?.length || 0) > 0 || !!child.medical;
  const ageYears = child.ageMonths ? Math.floor(child.ageMonths / 12) : null;
  const ageMonths = child.ageMonths ? child.ageMonths % 12 : null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(15,23,42,0.42)",
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
          maxWidth: 480,
          maxHeight: isDesktop ? "88vh" : "92vh",
          overflowY: "auto",
          background:
            "linear-gradient(180deg, #FFF7EE 0%, #FFFFFF 28%, #FFFFFF 100%)",
          borderRadius: isDesktop ? 28 : "28px 28px 0 0",
          boxShadow: "0 -20px 60px rgba(15,23,42,0.18)",
          animation: "slide-up 240ms cubic-bezier(.34,1.56,.64,1)",
          position: "relative",
          margin: isDesktop ? "0 16px" : 0,
        }}
      >
        {/* Header */}
        <div
          style={{
            position: "sticky",
            top: 0,
            background:
              "linear-gradient(180deg, rgba(255,247,238,0.95) 0%, rgba(255,255,255,0.85) 100%)",
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
            <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
              <CartoonAvatar
                name={child.name}
                size={52}
                ringColor={hasAlert ? PEACH : SKY}
                ringWidth={3}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    letterSpacing: "-0.3px",
                    color: NAVY,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {child.name}{" "}
                  <span
                    aria-hidden
                    style={{
                      display: "inline-block",
                      transform: "rotate(-6deg)",
                      fontSize: 16,
                    }}
                  >
                    ⭐
                  </span>
                </h2>
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#64748B",
                    marginTop: 2,
                  }}
                >
                  Roll #{child.rollNo}
                  {ageYears !== null && ` · ${ageYears}y ${ageMonths}m`}
                  {child.diet ? ` · ${child.diet}` : ""}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              type="button"
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

        {/* Body */}
        <div
          style={{
            padding: isDesktop ? "16px 22px 24px" : "12px 18px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <Link
            to={`/child/${child.id}`}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              width: "100%",
              padding: "12px 16px",
              borderRadius: 18,
              background: `linear-gradient(135deg, ${NAVY}, #2C4694)`,
              color: "#fff",
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "-0.1px",
              boxShadow: `0 10px 24px -8px ${NAVY}88`,
              textDecoration: "none",
            }}
            className="active:scale-[0.98] hover:-translate-y-0.5 transition"
          >
            <UserCircle size={16} strokeWidth={2.4} />
            Open full profile
          </Link>

          {hasAlert && (
            <SherbetCard tone={RED} surface="linear-gradient(135deg, #FFD6D6 0%, #FFF1F1 100%)">
              <SectionLabel
                tone={RED}
                emoji="🛟"
                title="Safety alerts"
              />
              {child.allergies && child.allergies.length > 0 && (
                <p style={{ fontSize: 12, color: "#0F172A", marginTop: 6 }}>
                  <strong style={{ color: RED }}>Allergies:</strong>{" "}
                  {child.allergies.join(", ")}
                </p>
              )}
              {child.medical && (
                <p style={{ fontSize: 12, color: "#0F172A", marginTop: 4 }}>
                  <strong style={{ color: RED }}>Medical:</strong> {child.medical}
                </p>
              )}
              {child.bloodGroup && (
                <p style={{ fontSize: 12, color: "#0F172A", marginTop: 4 }}>
                  <strong style={{ color: RED }}>Blood group:</strong>{" "}
                  {child.bloodGroup}
                </p>
              )}
            </SherbetCard>
          )}

          <SherbetCard tone={SKY} surface="linear-gradient(135deg, #DCEEFF 0%, #F5FAFF 100%)">
            <SectionLabel tone={SKY} emoji="📞" title="Parent" />
            <p style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", marginTop: 6 }}>
              {child.parentName || "—"}
            </p>
            <p style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
              {child.parentPhone || child.parentEmail || "No contact yet"}
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              {child.parentPhone && (
                <a
                  href={`tel:${child.parentPhone.replace(/\s/g, "")}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 800,
                    color: "#fff",
                    background: `linear-gradient(135deg, ${SKY}, #0284C7)`,
                    padding: "8px 14px",
                    borderRadius: 999,
                    textDecoration: "none",
                    boxShadow: `0 6px 14px ${SKY}55`,
                  }}
                  className="active:scale-95 hover:-translate-y-0.5 transition"
                >
                  <Phone size={12} strokeWidth={2.6} />
                  Call
                </a>
              )}
              {child.parentEmail && (
                <a
                  href={`mailto:${child.parentEmail}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 800,
                    color: NAVY,
                    background: "#fff",
                    padding: "8px 14px",
                    borderRadius: 999,
                    textDecoration: "none",
                    boxShadow: "inset 0 0 0 1px #CBD5E1",
                  }}
                  className="active:scale-95 hover:-translate-y-0.5 transition"
                >
                  <Mail size={12} strokeWidth={2.6} />
                  Email
                </a>
              )}
            </div>
          </SherbetCard>

          {child.authorizedPickup && child.authorizedPickup.length > 0 && (
            <SherbetCard tone={LAV} surface="linear-gradient(135deg, #EDE2FF 0%, #F8F3FF 100%)">
              <SectionLabel tone={LAV} emoji="🚸" title="Authorized pickup" />
              <ul
                style={{
                  marginTop: 8,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  padding: 0,
                  listStyle: "none",
                }}
              >
                {child.authorizedPickup.map((p) => (
                  <li
                    key={p.name}
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <CartoonAvatar name={p.name} size={36} ringColor={LAV} ringWidth={2} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>
                        {p.name}
                      </p>
                      <p style={{ fontSize: 11, color: "#64748B" }}>{p.relation}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </SherbetCard>
          )}

          {child.comfortCue && (
            <SherbetCard tone={BLUSH} surface="linear-gradient(135deg, #FFE0EC 0%, #FFF4F8 100%)">
              <SectionLabel tone={BLUSH} emoji="💗" title="Comfort cue (from parent)" />
              <p
                style={{
                  fontSize: 12,
                  fontStyle: "italic",
                  color: "#0F172A",
                  opacity: 0.85,
                  marginTop: 6,
                }}
              >
                "{child.comfortCue}"
              </p>
            </SherbetCard>
          )}

          <SherbetCard tone={MINT} surface="linear-gradient(135deg, #D6F5E2 0%, #F1FBF5 100%)">
            <SectionLabel tone={MINT} emoji="💌" title="Parent invite" />
            <div style={{ marginTop: 8 }}>
              <ParentInviteRow child={child} />
            </div>
          </SherbetCard>
        </div>
      </div>
    </div>
  );
}

function SherbetCard({
  tone,
  surface,
  children,
}: {
  tone: string;
  surface: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 22,
        padding: 14,
        background: surface,
        boxShadow: PILLOW,
      }}
    >
      <DotScribbles color={tone} />
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  );
}

function SectionLabel({
  tone,
  emoji,
  title,
}: {
  tone: string;
  emoji: string;
  title: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span
        style={{
          fontSize: 16,
          transform: "rotate(-6deg)",
          display: "inline-block",
          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.08))",
        }}
        aria-hidden
      >
        {emoji}
      </span>
      <p
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: tone,
        }}
      >
        {title}
      </p>
    </div>
  );
}

/* ═══════════════════════ Parent invite mini-form ═══════════════════════
   Inline parent-invite. Writes parentName + parentEmail (lowercased) to
   /students/{id} via auditedUpdate. Mirrors `email` field so
   syncUserClaimsV2 + parent-dashboard self-discovery both work. Real
   email delivery lives in principal-dashboard's PreParents page.
   ═══════════════════════════════════════════════════════════════════════ */
function ParentInviteRow({ child }: { child: RosterChild }) {
  const [editing, setEditing] = useState(false);
  const [parentName, setParentName] = useState(child.parentName || "");
  const [parentEmail, setParentEmail] = useState(child.parentEmail || "");
  const [saving, setSaving] = useState(false);
  const alreadyLinked = !!child.parentEmail;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(PRE_PRIMARY_PARENT_URL);
      toast.success("Parent app link copied 📋");
    } catch {
      toast.message(`Parent app: ${PRE_PRIMARY_PARENT_URL}`);
    }
  };

  const save = async () => {
    const cleanEmail = parentEmail.trim().toLowerCase();
    const cleanName = parentName.trim();
    if (!cleanEmail) {
      toast.error("Parent email is required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      toast.error("Enter a valid email address.");
      return;
    }
    setSaving(true);
    try {
      await auditedUpdate(doc(db, "students", child.id), {
        parentEmail: cleanEmail,
        email: cleanEmail,
        parentName: cleanName || child.parentName || "",
      });
      toast.success(
        `Saved. Share ${PRE_PRIMARY_PARENT_URL} with the parent — they'll sign in with this email.`
      );
      setEditing(false);
    } catch (err) {
      console.error("[Roster] parent invite save failed:", err);
      toast.error("Save failed. Check permissions & try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {alreadyLinked && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              fontWeight: 700,
              color: "#047857",
            }}
          >
            <Check size={13} strokeWidth={3} />
            Linked: {child.parentEmail}
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => setEditing(true)}
            style={{
              flex: 1,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "9px 14px",
              borderRadius: 14,
              fontSize: 12,
              fontWeight: 800,
              background: alreadyLinked
                ? "#fff"
                : `linear-gradient(135deg, ${MINT}, #059669)`,
              color: alreadyLinked ? NAVY : "#fff",
              boxShadow: alreadyLinked
                ? "inset 0 0 0 1px #CBD5E1"
                : `0 8px 18px -6px ${MINT}66`,
              border: "none",
              cursor: "pointer",
            }}
            className="active:scale-95 hover:-translate-y-0.5 transition"
          >
            <Send size={12} strokeWidth={2.6} />
            {alreadyLinked ? "Update contact" : "Invite parent"}
          </button>
          {alreadyLinked && (
            <button
              type="button"
              onClick={copyLink}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                padding: "9px 12px",
                borderRadius: 14,
                fontSize: 12,
                fontWeight: 800,
                background: "#fff",
                color: NAVY,
                boxShadow: "inset 0 0 0 1px #CBD5E1",
                border: "none",
                cursor: "pointer",
              }}
              className="active:scale-95 hover:-translate-y-0.5 transition"
            >
              Copy link
            </button>
          )}
        </div>
        <p style={{ fontSize: 10, color: "#64748B", lineHeight: 1.5 }}>
          Saves the parent's email to {child.name.split(" ")[0]}'s profile.
          Parent then signs in with Google at{" "}
          <span style={{ color: SKY, fontWeight: 700 }}>
            {PRE_PRIMARY_PARENT_URL.replace("https://", "")}
          </span>
          . (Real email invites are sent by the Principal.)
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <input
        placeholder="Parent's name (optional)"
        value={parentName}
        onChange={(e) => setParentName(e.target.value)}
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid #CBD5E1",
          background: "#fff",
          fontSize: 12,
          fontWeight: 600,
          outline: "none",
          color: "#0F172A",
        }}
      />
      <input
        type="email"
        placeholder="parent.email@example.com"
        value={parentEmail}
        onChange={(e) => setParentEmail(e.target.value)}
        autoFocus
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid #CBD5E1",
          background: "#fff",
          fontSize: 12,
          fontWeight: 600,
          outline: "none",
          color: "#0F172A",
        }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          style={{
            flex: 1,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "9px 14px",
            borderRadius: 14,
            fontSize: 12,
            fontWeight: 800,
            background: `linear-gradient(135deg, ${MINT}, #059669)`,
            color: "#fff",
            boxShadow: `0 8px 18px -6px ${MINT}66`,
            border: "none",
            cursor: saving ? "default" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
          className="active:scale-95 hover:-translate-y-0.5 transition"
        >
          {saving ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Check size={12} strokeWidth={3} />
          )}
          Save
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setParentName(child.parentName || "");
            setParentEmail(child.parentEmail || "");
          }}
          disabled={saving}
          style={{
            padding: "9px 14px",
            borderRadius: 14,
            fontSize: 12,
            fontWeight: 800,
            background: "#fff",
            color: NAVY,
            boxShadow: "inset 0 0 0 1px #CBD5E1",
            border: "none",
            cursor: "pointer",
          }}
          className="active:scale-95 hover:-translate-y-0.5 transition"
        >
          Cancel
        </button>
      </div>
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

