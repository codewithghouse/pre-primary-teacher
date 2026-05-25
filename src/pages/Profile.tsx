/**
 * Profile.tsx — Teacher's profile + preferences + sign out.
 * Cartoonified 2026-05-25.
 */
import { useAuth } from "@/lib/AuthContext";
import { LogOut, ChevronRight, Bell, Globe, Mic, Wifi } from "lucide-react";
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

interface SettingItem {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  emoji: string;
  label: string;
  subline?: string;
  tone: string;
}

const SETTINGS: SettingItem[] = [
  { icon: Bell, emoji: "🔔", label: "Notifications", tone: PEACH },
  { icon: Globe, emoji: "🌐", label: "Language", subline: "English", tone: SKY },
  { icon: Mic, emoji: "🎤", label: "Voice input", subline: "Enabled", tone: MINT },
  { icon: Wifi, emoji: "📶", label: "Photos: Wi-Fi only", tone: LAV },
];

export default function Profile() {
  const { teacherData, logout } = useAuth();
  const displayName =
    teacherData?.name || teacherData?.displayName || "Teacher";

  return (
    <div
      className="animate-fade-in"
      style={{
        padding: "16px 16px 80px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        width: "100%",
        maxWidth: 480,
        margin: "0 auto",
      }}
    >
      {/* Hero */}
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 28,
          padding: "22px 22px 24px",
          background:
            "linear-gradient(135deg, #DCEEFF 0%, #F5FAFF 55%, #FFFFFF 100%)",
          boxShadow: PILLOW,
          textAlign: "center",
        }}
      >
        <DotScribbles color={SKY} dense />
        <div
          style={{
            position: "relative",
            zIndex: 1,
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: SKY,
              opacity: 0.9,
              marginBottom: 14,
            }}
          >
            Your profile
          </p>
          {/* Avatar with floating sticker */}
          <div
            style={{
              position: "relative",
              display: "inline-block",
              marginBottom: 12,
            }}
          >
            <CartoonAvatar
              name={displayName}
              size={92}
              ringColor={SKY}
              ringWidth={5}
            />
            <span
              aria-hidden
              style={{
                position: "absolute",
                top: -6,
                right: -6,
                width: 32,
                height: 32,
                borderRadius: 999,
                background: `linear-gradient(135deg, ${BUTTER}, ${PEACH})`,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                boxShadow: `0 6px 14px ${BUTTER}55`,
                transform: "rotate(12deg)",
                border: "3px solid #fff",
              }}
            >
              ⭐
            </span>
          </div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: NAVY,
              letterSpacing: "-0.4px",
            }}
          >
            {displayName}{" "}
            <span
              aria-hidden
              style={{ display: "inline-block", transform: "rotate(-6deg)" }}
            >
              👋
            </span>
          </h1>
          <p
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#64748B",
              marginTop: 4,
            }}
          >
            {teacherData?.email}
          </p>
          <div
            style={{
              display: "inline-flex",
              gap: 6,
              flexWrap: "wrap",
              justifyContent: "center",
              marginTop: 10,
            }}
          >
            {teacherData?.assignedClass && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 900,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "#fff",
                  background: `linear-gradient(135deg, ${SKY}, #0284C7)`,
                  padding: "4px 10px",
                  borderRadius: 999,
                  boxShadow: `0 4px 10px ${SKY}55`,
                }}
              >
                🎒 {teacherData.assignedClass}
              </span>
            )}
            {teacherData?.schoolName && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: NAVY,
                  background: "#fff",
                  padding: "4px 10px",
                  borderRadius: 999,
                  boxShadow: "inset 0 0 0 1px #CBD5E1",
                }}
              >
                🏫 {teacherData.schoolName}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Preferences */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 10,
            paddingLeft: 4,
          }}
        >
          <span
            aria-hidden
            style={{
              fontSize: 13,
              transform: "rotate(-6deg)",
              display: "inline-block",
            }}
          >
            ⚙️
          </span>
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
            Preferences
          </p>
        </div>
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 22,
            background: "#fff",
            boxShadow: PILLOW,
          }}
        >
          {SETTINGS.map((s, idx) => (
            <SettingRow
              key={s.label}
              item={s}
              isLast={idx === SETTINGS.length - 1}
            />
          ))}
        </div>
      </div>

      {/* Sign out */}
      <button
        type="button"
        onClick={logout}
        style={{
          width: "100%",
          padding: "14px 18px",
          borderRadius: 18,
          background: `linear-gradient(135deg, ${RED}, #DC2626)`,
          color: "#fff",
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: "-0.1px",
          border: "none",
          cursor: "pointer",
          boxShadow: `0 12px 28px -8px ${RED}88`,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
        className="active:scale-95 hover:-translate-y-0.5 transition"
      >
        <LogOut size={16} strokeWidth={2.4} />
        Sign out
      </button>

      <p
        style={{
          fontSize: 10,
          textAlign: "center",
          color: "#94A3B8",
          fontWeight: 600,
          paddingTop: 4,
        }}
      >
        Edullent · Pre-Primary Teacher · v0.1 ✨
      </p>
    </div>
  );
}

/* ═══════════════════════ building blocks ═══════════════════════ */

function SettingRow({
  item,
  isLast,
}: {
  item: SettingItem;
  isLast: boolean;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      style={{
        width: "100%",
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: "transparent",
        border: "none",
        borderBottom: isLast ? "none" : "1px dashed rgba(15,23,42,0.08)",
        cursor: "pointer",
        textAlign: "left",
        transition: "background 160ms ease",
      }}
      className="hover:bg-slate-50 active:bg-slate-100"
    >
      <span
        aria-hidden
        style={{
          width: 38,
          height: 38,
          borderRadius: 14,
          background: `linear-gradient(135deg, ${item.tone}1f, ${item.tone}0f)`,
          color: item.tone,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          boxShadow: `inset 0 0 0 1px ${item.tone}33`,
          transform: "rotate(-6deg)",
          flexShrink: 0,
        }}
      >
        {item.emoji}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: NAVY,
            letterSpacing: "-0.1px",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Icon size={13} strokeWidth={2.4} />
          {item.label}
        </p>
        {item.subline && (
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#64748B",
              marginTop: 2,
            }}
          >
            {item.subline}
          </p>
        )}
      </div>
      <span
        style={{
          fontSize: 9,
          fontWeight: 900,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#64748B",
          background: "#F1F5F9",
          padding: "3px 8px",
          borderRadius: 999,
          flexShrink: 0,
        }}
      >
        Soon
      </span>
      <ChevronRight size={14} strokeWidth={2.4} color="#CBD5E1" />
    </button>
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
