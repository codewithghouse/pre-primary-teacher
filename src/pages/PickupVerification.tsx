import { useEffect, useMemo, useState } from "react";
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  Search,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useTeacherClass } from "@/hooks/useTeacherClass";
import { useClassRoster, type RosterChild } from "@/hooks/useClassRoster";
import { usePPPickups, type PickupRecord } from "@/hooks/usePPPickups";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useAuth } from "@/lib/AuthContext";
import { CartoonAvatar } from "@/components/CartoonAvatar";

/* ═══════════════════════════════════════════════════════════════════════
   PRE-PRIMARY TEACHER · PICKUP VERIFICATION
   Storybook-sherbet pickup queue. Mint = verified, navy = pending,
   red = escalated. CartoonAvatar in every row + every authorized chip.
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

export default function PickupVerification() {
  const { teacherData } = useAuth();
  const { primaryClass, loading: classLoading } = useTeacherClass();
  const { roster, loading: rosterLoading } = useClassRoster(primaryClass?.id);
  const {
    data,
    loading: pickupLoading,
    verifyPickup,
  } = usePPPickups(primaryClass?.id);
  const isDesktop = useIsDesktop();

  const [search, setSearch] = useState("");
  const [verifyingFor, setVerifyingFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!verifyingFor) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [verifyingFor]);

  useEffect(() => {
    if (!verifyingFor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) setVerifyingFor(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [verifyingFor, saving]);

  const records = data?.records || {};

  const filteredRoster = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter((c) => c.name.toLowerCase().includes(q));
  }, [roster, search]);

  const stats = useMemo(() => {
    const values = Object.values(records);
    return {
      verified: values.filter((r) => r.status === "verified").length,
      mismatch: values.filter((r) => r.status === "mismatch").length,
      pending:
        roster.length -
        values.filter((r) =>
          ["verified", "mismatch"].includes(r.status as string)
        ).length,
    };
  }, [records, roster.length]);

  const verifyChild = useMemo(
    () => roster.find((c) => c.id === verifyingFor) || null,
    [roster, verifyingFor]
  );

  if (classLoading) {
    return (
      <CenteredLoader label="Resolving your class…" />
    );
  }

  if (!primaryClass) {
    return (
      <div style={{ padding: "48px 16px", textAlign: "center" }}>
        <p style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>
          🌱 No class assigned
        </p>
        <p style={{ fontSize: 12, color: "#64748B", marginTop: 6 }}>
          Contact your principal to be added to a class.
        </p>
      </div>
    );
  }

  if ((rosterLoading || pickupLoading) && roster.length === 0) {
    return <CenteredLoader label="Loading pickup queue…" />;
  }

  const handleVerify = async (
    child: RosterChild,
    person: { name: string; relation: string }
  ) => {
    if (!teacherData?.id) return;
    setSaving(true);
    try {
      const record: PickupRecord = {
        studentId: child.id,
        studentName: child.name,
        status: "verified",
        actualPickupPersonName: person.name,
        actualPickupPersonRelation: person.relation,
        verifiedAt: new Date().toISOString(),
        verifiedBy: teacherData.id,
      };
      await verifyPickup(record);
      setVerifyingFor(null);
      toast.success(
        `${child.name.split(" ")[0]} picked up by ${person.name} ✓`
      );
    } catch (err) {
      console.error("[Pickup] verify failed:", err);
      toast.error(
        "Could not save. " +
          ((err as Error)?.message || "Check permissions & try again.")
      );
    } finally {
      setSaving(false);
    }
  };

  const handleMismatch = async (child: RosterChild, reason?: string) => {
    if (!teacherData?.id) return;
    if (
      !window.confirm(
        `🚨 ESCALATE? An unauthorized person attempting to pick up ${child.name}. This will alert the principal and block release.`
      )
    )
      return;
    setSaving(true);
    try {
      const record: PickupRecord = {
        studentId: child.id,
        studentName: child.name,
        status: "mismatch",
        mismatchReason: reason || "Unauthorized person attempted pickup",
        verifiedAt: new Date().toISOString(),
        verifiedBy: teacherData.id,
      };
      await verifyPickup(record);
      setVerifyingFor(null);
      toast.error(`🚨 ESCALATED for ${child.name}. Principal notified.`);
    } catch (err) {
      console.error("[Pickup] mismatch failed:", err);
      toast.error(
        "Could not escalate. " +
          ((err as Error)?.message || "Phone the principal directly!")
      );
    } finally {
      setSaving(false);
    }
  };

  const handleUndo = async (child: RosterChild) => {
    if (!teacherData?.id) return;
    if (
      !window.confirm(
        `Undo pickup verification for ${child.name}? This sets them back to pending.`
      )
    )
      return;
    try {
      const record: PickupRecord = {
        studentId: child.id,
        studentName: child.name,
        status: "pending",
      };
      await verifyPickup(record);
      toast.message(`Pickup reset for ${child.name.split(" ")[0]}`);
    } catch (err) {
      console.error("[Pickup] undo failed:", err);
      toast.error("Could not undo.");
    }
  };

  const gridCols = isDesktop ? "repeat(3, minmax(0, 1fr))" : "1fr";

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
              🚸
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
                Home time
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
                Pickup Verification{" "}
                <span
                  aria-hidden
                  style={{ display: "inline-block", transform: "rotate(6deg)" }}
                >
                  🛡️
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
                {primaryClass.name} · {format(new Date(), "EEEE, d MMM")} · Tap
                a child to verify.
              </p>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 10,
          }}
        >
          <CounterCard
            label="Verified"
            value={stats.verified}
            emoji="✅"
            tone={MINT}
            surface="linear-gradient(135deg, #C9F5DE 0%, #F0FBF5 100%)"
          />
          <CounterCard
            label="Pending"
            value={Math.max(0, stats.pending)}
            emoji="⏳"
            tone={NAVY}
            surface="linear-gradient(135deg, #E1ECFF 0%, #F7FAFF 100%)"
          />
          <CounterCard
            label="Escalated"
            value={stats.mismatch}
            emoji="🚨"
            tone={RED}
            surface="linear-gradient(135deg, #FFD6D6 0%, #FFF1F1 100%)"
          />
        </div>

        {/* Mismatch banner */}
        {stats.mismatch > 0 && (
          <div
            style={{
              position: "relative",
              overflow: "hidden",
              borderRadius: 22,
              padding: "12px 16px",
              background: `linear-gradient(135deg, #FFD6D6, #FFE9E9)`,
              border: `1px solid ${RED}44`,
              boxShadow: PILLOW,
              display: "flex",
              alignItems: "center",
              gap: 10,
              animation: "pulse 2s ease-in-out infinite",
            }}
          >
            <span
              style={{
                width: 38,
                height: 38,
                borderRadius: 14,
                background: `linear-gradient(135deg, ${RED}, #DC2626)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                boxShadow: `0 6px 14px ${RED}55`,
                flexShrink: 0,
                transform: "rotate(-6deg)",
              }}
            >
              <AlertTriangle size={18} strokeWidth={2.4} />
            </span>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>
              <strong style={{ color: RED }}>
                {stats.mismatch} pickup mismatch
                {stats.mismatch > 1 ? "es" : ""}
              </strong>{" "}
              — principal alerted, children in safe area.
            </p>
          </div>
        )}

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
              aria-label="Clear search"
            >
              <X size={14} color="#64748B" strokeWidth={2.4} />
            </button>
          )}
        </div>

        {/* Queue */}
        {filteredRoster.length === 0 ? (
          <EmptyState
            emoji={roster.length === 0 ? "🌱" : "🔍"}
            title={
              roster.length === 0
                ? "No children in this class yet"
                : "No children match"
            }
            subtitle={
              roster.length === 0
                ? "Ask your principal to add students."
                : `No child matches "${search}".`
            }
          />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 12 }}>
            {filteredRoster.map((c) => (
              <PickupCard
                key={c.id}
                child={c}
                record={records[c.id]}
                onTap={() => setVerifyingFor(c.id)}
                onUndo={() => handleUndo(c)}
              />
            ))}
          </div>
        )}
      </div>

      {verifyChild && (
        <VerifySheet
          child={verifyChild}
          existingRecord={records[verifyChild.id]}
          onClose={() => !saving && setVerifyingFor(null)}
          onVerify={(person) => handleVerify(verifyChild, person)}
          onMismatch={(reason) => handleMismatch(verifyChild, reason)}
          saving={saving}
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

function PickupCard({
  child,
  record,
  onTap,
  onUndo,
}: {
  child: RosterChild;
  record: PickupRecord | undefined;
  onTap: () => void;
  onUndo: () => void;
}) {
  const status = record?.status || "pending";
  const isVerified = status === "verified";
  const isMismatch = status === "mismatch";

  const surface = isVerified
    ? "linear-gradient(135deg, #D6F5E2 0%, #F1FBF5 100%)"
    : isMismatch
    ? "linear-gradient(135deg, #FFD6D6 0%, #FFF1F1 100%)"
    : "linear-gradient(135deg, #F7FAFF 0%, #FFFFFF 100%)";
  const ring = isVerified ? MINT : isMismatch ? RED : "#CBD5E1";
  const scribble = isVerified ? MINT : isMismatch ? RED : NAVY;

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 22,
        padding: "12px 14px",
        background: surface,
        boxShadow: PILLOW,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <DotScribbles color={scribble} />

      <button
        type="button"
        onClick={onTap}
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "transparent",
          border: "none",
          padding: 0,
          textAlign: "left",
          cursor: "pointer",
          position: "relative",
          zIndex: 1,
        }}
        className="active:scale-[0.99] transition"
      >
        <div style={{ position: "relative", flexShrink: 0 }}>
          <CartoonAvatar
            name={child.name}
            size={52}
            ringColor={ring}
            ringWidth={3}
          />
          {isVerified && (
            <span
              aria-hidden
              style={{
                position: "absolute",
                bottom: -2,
                right: -2,
                width: 22,
                height: 22,
                borderRadius: 999,
                background: MINT,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 4px 10px ${MINT}66`,
                border: "2px solid #fff",
                transform: "rotate(8deg)",
              }}
            >
              <CheckCircle2 size={12} strokeWidth={3} />
            </span>
          )}
          {isMismatch && (
            <span
              aria-hidden
              style={{
                position: "absolute",
                bottom: -2,
                right: -2,
                width: 22,
                height: 22,
                borderRadius: 999,
                background: RED,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 4px 10px ${RED}66`,
                border: "2px solid #fff",
                transform: "rotate(8deg)",
                fontSize: 11,
                fontWeight: 900,
              }}
            >
              !
            </span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: "#0F172A",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {child.name}
          </p>
          {isVerified && record?.actualPickupPersonName ? (
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#047857",
                marginTop: 2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              ✓ Picked up by {record.actualPickupPersonName}
              {record.actualPickupPersonRelation
                ? ` (${record.actualPickupPersonRelation})`
                : ""}
            </p>
          ) : isMismatch ? (
            <p
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: RED,
                marginTop: 2,
              }}
            >
              🚨 ESCALATED — principal alerted
            </p>
          ) : (
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#64748B",
                marginTop: 2,
              }}
            >
              Tap to verify pickup
            </p>
          )}
        </div>
      </button>

      {isVerified && (
        <button
          type="button"
          onClick={onUndo}
          title="Undo verification"
          style={{
            flexShrink: 0,
            padding: "6px 12px",
            borderRadius: 999,
            background: "#fff",
            color: NAVY,
            fontSize: 11,
            fontWeight: 800,
            boxShadow: "inset 0 0 0 1px #CBD5E1",
            border: "none",
            cursor: "pointer",
            position: "relative",
            zIndex: 1,
          }}
          className="active:scale-95 hover:-translate-y-0.5 transition"
        >
          Undo
        </button>
      )}
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

/* ═══════════════════════ Verify sheet ═══════════════════════ */

function VerifySheet({
  child,
  existingRecord,
  onClose,
  onVerify,
  onMismatch,
  saving,
  isDesktop,
}: {
  child: RosterChild;
  existingRecord?: PickupRecord;
  onClose: () => void;
  onVerify: (person: { name: string; relation: string }) => void;
  onMismatch: (reason: string) => void;
  saving: boolean;
  isDesktop: boolean;
}) {
  const [mode, setMode] = useState<"verify" | "manual">("verify");
  const [manualName, setManualName] = useState("");
  const [manualRelation, setManualRelation] = useState("");
  const [mismatchReason, setMismatchReason] = useState("");

  const authorized = child.authorizedPickup || [];
  const alreadyVerified = existingRecord?.status === "verified";
  const manualReady = manualName.trim().length > 0 && manualRelation.trim().length > 0;

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
            <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
              <CartoonAvatar
                name={child.name}
                size={52}
                ringColor={SKY}
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
                    👋
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
                  Who's picking up?
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
          {alreadyVerified && existingRecord && (
            <SherbetCard tone={MINT} surface="linear-gradient(135deg, #D6F5E2 0%, #F1FBF5 100%)">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  aria-hidden
                  style={{
                    fontSize: 18,
                    transform: "rotate(-6deg)",
                    display: "inline-block",
                  }}
                >
                  ✅
                </span>
                <p style={{ fontSize: 12, fontWeight: 800, color: "#047857" }}>
                  Already verified — {existingRecord.actualPickupPersonName}
                  {existingRecord.actualPickupPersonRelation
                    ? ` (${existingRecord.actualPickupPersonRelation})`
                    : ""}
                </p>
              </div>
              <p style={{ fontSize: 10, color: "#64748B", marginTop: 4 }}>
                Re-verify only if pickup person has changed.
              </p>
            </SherbetCard>
          )}

          {/* Mode toggle */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 6,
              padding: 4,
              borderRadius: 16,
              background: "#F1F5F9",
            }}
          >
            <ModeButton
              active={mode === "verify"}
              onClick={() => setMode("verify")}
              icon={<UserCheck size={13} strokeWidth={2.6} />}
              label="Authorized"
            />
            <ModeButton
              active={mode === "manual"}
              onClick={() => setMode("manual")}
              icon={<UserPlus size={13} strokeWidth={2.6} />}
              label="Manual Entry"
            />
          </div>

          {/* Authorized list */}
          {mode === "verify" && (
            <>
              {authorized.length > 0 ? (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {authorized.map((p) => (
                    <button
                      key={`${p.name}-${p.relation}`}
                      type="button"
                      onClick={() => onVerify(p)}
                      disabled={saving}
                      style={{
                        position: "relative",
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: 12,
                        borderRadius: 18,
                        background:
                          "linear-gradient(135deg, #D6F5E2 0%, #F1FBF5 100%)",
                        boxShadow: PILLOW,
                        border: "none",
                        cursor: saving ? "default" : "pointer",
                        opacity: saving ? 0.6 : 1,
                        textAlign: "left",
                      }}
                      className="active:scale-[0.98] hover:-translate-y-0.5 transition"
                    >
                      <DotScribbles color={MINT} />
                      <div style={{ position: "relative", zIndex: 1 }}>
                        <CartoonAvatar
                          name={p.name}
                          size={48}
                          ringColor={MINT}
                          ringWidth={3}
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: 0, position: "relative", zIndex: 1 }}>
                        <p style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>
                          {p.name}
                        </p>
                        <p style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                          {p.relation}
                        </p>
                      </div>
                      <div style={{ position: "relative", zIndex: 1, flexShrink: 0 }}>
                        {saving ? (
                          <Loader2 size={20} color={MINT} className="animate-spin" />
                        ) : (
                          <span
                            aria-hidden
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 999,
                              background: `linear-gradient(135deg, ${MINT}, #059669)`,
                              color: "#fff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              boxShadow: `0 6px 14px ${MINT}66`,
                              transform: "rotate(6deg)",
                            }}
                          >
                            <UserCheck size={16} strokeWidth={2.6} />
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <SherbetCard tone={BUTTER} surface="linear-gradient(135deg, #FFEBC8 0%, #FFF7E5 100%)">
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span aria-hidden style={{ fontSize: 20, transform: "rotate(-6deg)", display: "inline-block" }}>⚠️</span>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>
                      <strong>No authorized pickup persons on file.</strong>
                    </p>
                  </div>
                  <p style={{ fontSize: 11, color: "#64748B", marginTop: 6, lineHeight: 1.5 }}>
                    Use Manual Entry to record who picked up, or escalate if uncertain.
                  </p>
                </SherbetCard>
              )}
            </>
          )}

          {/* Manual entry */}
          {mode === "manual" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <SherbetCard tone={PEACH} surface="linear-gradient(135deg, #FFE0CC 0%, #FFF5EC 100%)">
                <p style={{ fontSize: 11, fontWeight: 600, color: "#0F172A", lineHeight: 1.55 }}>
                  Use this only when the authorized list is missing or someone new is on the parent's verbal approval.{" "}
                  <strong style={{ color: PEACH }}>Always escalate</strong> if uncertain.
                </p>
              </SherbetCard>
              <FieldLabel tone={NAVY}>Pickup person name</FieldLabel>
              <PillowInput
                value={manualName}
                onChange={setManualName}
                placeholder="e.g. Anita Sharma"
                autoFocus
              />
              <FieldLabel tone={NAVY}>Relation</FieldLabel>
              <PillowInput
                value={manualRelation}
                onChange={setManualRelation}
                placeholder="e.g. Aunt, Driver, Family friend"
              />
              <button
                type="button"
                disabled={saving || !manualReady}
                onClick={() =>
                  onVerify({
                    name: manualName.trim(),
                    relation: manualRelation.trim(),
                  })
                }
                style={{
                  width: "100%",
                  padding: "12px 18px",
                  borderRadius: 16,
                  background:
                    saving || !manualReady
                      ? "#CBD5E1"
                      : `linear-gradient(135deg, ${MINT}, #059669)`,
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: "-0.1px",
                  border: "none",
                  cursor: saving || !manualReady ? "default" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  boxShadow:
                    saving || !manualReady ? "none" : `0 10px 24px -8px ${MINT}88`,
                  marginTop: 4,
                }}
                className="active:scale-95 hover:-translate-y-0.5 transition"
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={14} strokeWidth={2.6} />
                )}
                Save pickup
              </button>
            </div>
          )}

          {/* Escalate */}
          <div
            style={{
              position: "relative",
              overflow: "hidden",
              borderRadius: 22,
              padding: 14,
              background: "linear-gradient(135deg, #FFD6D6 0%, #FFF1F1 100%)",
              boxShadow: PILLOW,
              marginTop: 6,
            }}
          >
            <DotScribbles color={RED} />
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span
                  aria-hidden
                  style={{ fontSize: 18, transform: "rotate(-8deg)", display: "inline-block" }}
                >
                  🚨
                </span>
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: RED,
                  }}
                >
                  Unauthorized person attempting pickup?
                </p>
              </div>
              <PillowInput
                value={mismatchReason}
                onChange={setMismatchReason}
                placeholder="Optional: brief reason (unknown person, refused ID)"
              />
              <button
                type="button"
                onClick={() => onMismatch(mismatchReason.trim())}
                disabled={saving}
                style={{
                  width: "100%",
                  padding: "12px 18px",
                  borderRadius: 16,
                  background: `linear-gradient(135deg, ${RED}, #DC2626)`,
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: "-0.1px",
                  border: "none",
                  cursor: saving ? "default" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  boxShadow: `0 10px 24px -8px ${RED}88`,
                  marginTop: 10,
                  opacity: saving ? 0.7 : 1,
                }}
                className="active:scale-95 hover:-translate-y-0.5 transition"
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <ShieldAlert size={14} strokeWidth={2.4} />
                )}
                Escalate — block release & alert principal
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "8px 12px",
        borderRadius: 12,
        background: active ? "#fff" : "transparent",
        color: active ? NAVY : "#64748B",
        fontSize: 12,
        fontWeight: 800,
        border: "none",
        cursor: "pointer",
        boxShadow: active ? "0 2px 6px rgba(15,23,42,0.08)" : "none",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        transition: "all 160ms ease",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function PillowInput({
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      style={{
        width: "100%",
        padding: "10px 14px",
        borderRadius: 12,
        background: "#fff",
        border: "1px solid #E2E8F0",
        fontSize: 12,
        fontWeight: 600,
        color: "#0F172A",
        outline: "none",
      }}
    />
  );
}

function FieldLabel({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
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
        borderRadius: 18,
        padding: 12,
        background: surface,
        boxShadow: PILLOW,
      }}
    >
      <DotScribbles color={tone} />
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
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
// Keep the constant exported via reference so future variants (e.g. a lavender
// "soft-pending" state) don't need a re-import. No-op at runtime.
void LAV;
void BLUSH;
