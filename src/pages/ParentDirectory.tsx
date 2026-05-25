/**
 * ParentDirectory.tsx — Class-scoped parent contact list for the
 * pre-primary teacher. NOT a chat surface — purely a contact directory
 * with one-tap deep-links to WhatsApp / phone / email.
 *
 * Cartoonified 2026-05-25. Same sherbet palette + CartoonAvatar
 * vocabulary as Roster / Attendance / Pickup / Safety.
 */
import { useMemo, useState } from "react";
import {
  Phone,
  MessageCircle,
  Mail,
  Search,
  AlertTriangle,
  X,
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

function cleanPhone(raw?: string): string {
  if (!raw) return "";
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
}

export default function ParentDirectory() {
  const { primaryClass, loading: classLoading } = useTeacherClass();
  const { roster, loading: rosterLoading } = useClassRoster(primaryClass?.id);
  const isDesktop = useIsDesktop();
  const [search, setSearch] = useState("");
  const [openChild, setOpenChild] = useState<RosterChild | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.parentName || "").toLowerCase().includes(q) ||
        (c.parentPhone || "").includes(q) ||
        (c.parentEmail || "").toLowerCase().includes(q)
    );
  }, [roster, search]);

  const stats = useMemo(() => {
    let withPhone = 0;
    let withEmail = 0;
    let withAny = 0;
    roster.forEach((c) => {
      const hasPhone = !!c.parentPhone;
      const hasEmail = !!c.parentEmail;
      if (hasPhone) withPhone++;
      if (hasEmail) withEmail++;
      if (hasPhone || hasEmail) withAny++;
    });
    return { withPhone, withEmail, withAny, total: roster.length };
  }, [roster]);

  if (classLoading || rosterLoading) {
    return (
      <div
        style={{
          padding: "48px 16px",
          textAlign: "center",
          color: "#64748B",
          fontSize: 12,
        }}
      >
        Loading directory…
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

  const listCols = isDesktop ? "repeat(3, minmax(0, 1fr))" : "1fr";

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
              📒
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
                Class contacts
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
                Parent Directory{" "}
                <span
                  aria-hidden
                  style={{ display: "inline-block", transform: "rotate(6deg)" }}
                >
                  💌
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
                {roster.length} {roster.length === 1 ? "family" : "families"}
              </p>
            </div>
          </div>
        </div>

        {/* 3-stat strip */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 10,
          }}
        >
          <CounterCard
            label="Reachable"
            value={stats.withAny}
            total={stats.total}
            emoji="📞"
            tone={MINT}
            surface="linear-gradient(135deg, #D6F5E2 0%, #F1FBF5 100%)"
          />
          <CounterCard
            label="Phone"
            value={stats.withPhone}
            total={stats.total}
            emoji="📱"
            tone={SKY}
            surface="linear-gradient(135deg, #DCEEFF 0%, #F5FAFF 100%)"
          />
          <CounterCard
            label="Email"
            value={stats.withEmail}
            total={stats.total}
            emoji="💌"
            tone={LAV}
            surface="linear-gradient(135deg, #EDE2FF 0%, #F8F3FF 100%)"
          />
        </div>

        {/* Missing-contact warning */}
        {stats.withAny < stats.total && (
          <div
            style={{
              position: "relative",
              overflow: "hidden",
              borderRadius: 22,
              padding: "12px 16px",
              background: "linear-gradient(135deg, #FFEBC8 0%, #FFF7E5 100%)",
              boxShadow: PILLOW,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <DotScribbles color={BUTTER} />
            <span
              style={{
                position: "relative",
                zIndex: 1,
                width: 36,
                height: 36,
                borderRadius: 12,
                background: `linear-gradient(135deg, ${BUTTER}, ${PEACH})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                boxShadow: `0 6px 14px ${BUTTER}55`,
                flexShrink: 0,
                transform: "rotate(-6deg)",
              }}
              aria-hidden
            >
              <AlertTriangle size={18} strokeWidth={2.4} />
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
              <strong style={{ color: "#92400E" }}>
                {stats.total - stats.withAny}
              </strong>{" "}
              child
              {stats.total - stats.withAny === 1 ? "" : "ren"} have no parent
              contact on file. Ask principal to update their PreStudents record
              for emergency access.
            </p>
          </div>
        )}

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
            placeholder="Search by child or parent name…"
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

        {/* List */}
        {filtered.length === 0 ? (
          <EmptyState
            emoji={roster.length === 0 ? "🌱" : "🔍"}
            title={roster.length === 0 ? "No children on roster" : "No matches"}
            subtitle={
              roster.length === 0
                ? "Ask principal to add students."
                : `Nothing matches "${search}".`
            }
          />
        ) : (
          <ul
            style={{
              display: "grid",
              gridTemplateColumns: listCols,
              gap: 12,
              padding: 0,
              margin: 0,
              listStyle: "none",
            }}
          >
            {filtered.map((child) => (
              <li key={child.id}>
                <ParentRow child={child} onOpen={() => setOpenChild(child)} />
              </li>
            ))}
          </ul>
        )}

        <p
          style={{
            fontSize: 10,
            textAlign: "center",
            color: "#94A3B8",
            fontWeight: 600,
            lineHeight: 1.55,
            paddingTop: 8,
          }}
        >
          🔒 Privacy — contacts visible only to teachers assigned to this class.
          Use professionally; not a chat surface.
        </p>
      </div>

      {openChild && (
        <ContactSheet
          child={openChild}
          onClose={() => setOpenChild(null)}
          isDesktop={isDesktop}
        />
      )}
    </>
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

function ParentRow({
  child,
  onOpen,
}: {
  child: RosterChild;
  onOpen: () => void;
}) {
  const hasContact = !!child.parentPhone || !!child.parentEmail;
  const phone = cleanPhone(child.parentPhone);
  const wa = phone ? `https://wa.me/${phone.replace("+", "")}` : null;

  const surface = hasContact
    ? "linear-gradient(135deg, #ECF3FF 0%, #FAFCFF 100%)"
    : "linear-gradient(135deg, #FFEBC8 0%, #FFF7E5 100%)";
  const scribble = hasContact ? SKY : BUTTER;
  const ring = hasContact ? SKY : BUTTER;

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 22,
        background: surface,
        boxShadow: PILLOW,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <DotScribbles color={scribble} />

      <button
        type="button"
        onClick={onOpen}
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "transparent",
          border: "none",
          padding: 0,
          textAlign: "left",
          cursor: "pointer",
        }}
        className="active:scale-[0.99] transition"
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
              letterSpacing: "-0.2px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
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
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {child.parentName || "Parent"}
            {child.parentPhone ? ` · ${child.parentPhone}` : ""}
          </p>
        </div>
      </button>

      {hasContact ? (
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            gap: 6,
            paddingTop: 8,
            borderTop: "1px dashed rgba(15,23,42,0.12)",
          }}
        >
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                padding: "9px 10px",
                borderRadius: 14,
                background: `linear-gradient(135deg, #25D366, #128C7E)`,
                color: "#fff",
                fontSize: 11,
                fontWeight: 800,
                textDecoration: "none",
                boxShadow: `0 6px 14px rgba(37,211,102,0.45)`,
              }}
              className="active:scale-95 hover:-translate-y-0.5 transition"
            >
              <MessageCircle size={12} strokeWidth={2.6} />
              WhatsApp
            </a>
          )}
          {child.parentPhone && (
            <a
              href={`tel:${cleanPhone(child.parentPhone)}`}
              style={{
                flex: 1,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                padding: "9px 10px",
                borderRadius: 14,
                background: `linear-gradient(135deg, ${SKY}, #0284C7)`,
                color: "#fff",
                fontSize: 11,
                fontWeight: 800,
                textDecoration: "none",
                boxShadow: `0 6px 14px ${SKY}55`,
              }}
              className="active:scale-95 hover:-translate-y-0.5 transition"
            >
              <Phone size={12} strokeWidth={2.6} />
              Call
            </a>
          )}
          {child.parentEmail && !child.parentPhone && (
            <a
              href={`mailto:${child.parentEmail}`}
              style={{
                flex: 1,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                padding: "9px 10px",
                borderRadius: 14,
                background: "#fff",
                color: NAVY,
                fontSize: 11,
                fontWeight: 800,
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
      ) : (
        <div
          style={{
            position: "relative",
            zIndex: 1,
            paddingTop: 8,
            borderTop: "1px dashed rgba(15,23,42,0.12)",
            fontSize: 11,
            fontWeight: 700,
            fontStyle: "italic",
            color: "#92400E",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <AlertTriangle size={11} strokeWidth={2.6} />
          No contact on file
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ Contact sheet ═══════════════════════ */

function ContactSheet({
  child,
  onClose,
  isDesktop,
}: {
  child: RosterChild;
  onClose: () => void;
  isDesktop: boolean;
}) {
  const phone = cleanPhone(child.parentPhone);
  const wa = phone ? `https://wa.me/${phone.replace("+", "")}` : null;

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
          maxWidth: isDesktop ? 520 : 480,
          maxHeight: isDesktop ? "88vh" : "92vh",
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
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flex: 1,
                minWidth: 0,
              }}
            >
              <CartoonAvatar
                name={child.name}
                size={52}
                ringColor={SKY}
                ringWidth={3}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2
                  style={{
                    fontSize: 17,
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
                      fontSize: 15,
                    }}
                  >
                    💌
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
                  {child.parentName && (
                    <>
                      {" · "}
                      <span style={{ fontWeight: 800, color: SKY }}>
                        {child.parentName}
                      </span>
                    </>
                  )}
                </p>
              </div>
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

        {/* Body */}
        <div
          style={{
            padding: isDesktop ? "16px 22px 24px" : "12px 18px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {wa && (
            <ContactAction
              href={wa}
              target="_blank"
              tone="#25D366"
              gradient="linear-gradient(135deg, #25D366, #128C7E)"
              surface="linear-gradient(135deg, #DCF8E0 0%, #F1FBF1 100%)"
              icon={<MessageCircle size={20} strokeWidth={2.4} color="#fff" />}
              label="WhatsApp"
              value={phone}
            />
          )}
          {child.parentPhone && (
            <ContactAction
              href={`tel:${phone}`}
              tone={SKY}
              gradient={`linear-gradient(135deg, ${SKY}, #0284C7)`}
              surface="linear-gradient(135deg, #DCEEFF 0%, #F5FAFF 100%)"
              icon={<Phone size={20} strokeWidth={2.4} color="#fff" />}
              label="Call"
              value={child.parentPhone}
            />
          )}
          {child.parentEmail && (
            <ContactAction
              href={`mailto:${child.parentEmail}`}
              tone={LAV}
              gradient={`linear-gradient(135deg, ${LAV}, #7C3AED)`}
              surface="linear-gradient(135deg, #EDE2FF 0%, #F8F3FF 100%)"
              icon={<Mail size={20} strokeWidth={2.4} color="#fff" />}
              label="Email"
              value={child.parentEmail}
            />
          )}

          {!child.parentPhone && !child.parentEmail && (
            <div
              style={{
                position: "relative",
                overflow: "hidden",
                borderRadius: 18,
                padding: 14,
                background: "linear-gradient(135deg, #FFEBC8 0%, #FFF7E5 100%)",
                boxShadow: PILLOW,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <DotScribbles color={BUTTER} />
              <span
                style={{
                  position: "relative",
                  zIndex: 1,
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  background: `linear-gradient(135deg, ${BUTTER}, ${PEACH})`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  boxShadow: `0 6px 14px ${BUTTER}55`,
                  transform: "rotate(-6deg)",
                  flexShrink: 0,
                }}
                aria-hidden
              >
                <AlertTriangle size={18} strokeWidth={2.4} />
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
                No parent contact on file. Ask principal to update{" "}
                {child.name.split(" ")[0]}'s record in PreStudents.
              </p>
            </div>
          )}

          <p
            style={{
              fontSize: 10,
              textAlign: "center",
              color: "#94A3B8",
              fontWeight: 600,
              lineHeight: 1.55,
              paddingTop: 10,
            }}
          >
            🔒 Use for emergencies, picnic announcements, or sub-teacher days.
            Not for personal/casual chat.
          </p>
        </div>
      </div>
    </div>
  );
}

function ContactAction({
  href,
  target,
  tone,
  gradient,
  surface,
  icon,
  label,
  value,
}: {
  href: string;
  target?: string;
  tone: string;
  gradient: string;
  surface: string;
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <a
      href={href}
      target={target}
      rel={target === "_blank" ? "noopener noreferrer" : undefined}
      style={{
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: 14,
        borderRadius: 18,
        background: surface,
        boxShadow: PILLOW,
        textDecoration: "none",
      }}
      className="active:scale-[0.98] hover:-translate-y-0.5 transition"
    >
      <DotScribbles color={tone} />
      <span
        style={{
          position: "relative",
          zIndex: 1,
          width: 44,
          height: 44,
          borderRadius: 14,
          background: gradient,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 8px 18px -4px ${tone}66`,
          transform: "rotate(-6deg)",
          flexShrink: 0,
        }}
        aria-hidden
      >
        {icon}
      </span>
      <div style={{ position: "relative", zIndex: 1, flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: NAVY,
            letterSpacing: "-0.2px",
          }}
        >
          {label}
        </p>
        <p
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#64748B",
            marginTop: 2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {value}
        </p>
      </div>
    </a>
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
void RED;
