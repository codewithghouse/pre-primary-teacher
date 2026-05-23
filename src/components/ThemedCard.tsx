import type { ComponentType, CSSProperties, ReactNode } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Themed Card — same vibe as principal-dashboard StudentProfilePage.
//
// Visual vocabulary:
//   • Pastel surface gradient (top-left colored → bottom-right near-white)
//   • Frosted title band (white/45 + backdrop-blur) with a rounded icon badge
//   • Solid icon badge: 32px rounded square with theme gradient + drop shadow
//   • Watermark icon: huge (120px), opacity 0.06, anchored bottom-right
//   • Layered shadow: hairline blue ring + soft glow + deep drop
//
// Palette swapped from principal's #0055FF blue → Edullent's edu-* tokens
// so the pre-primary feel stays warm/playful, not corporate.
// ─────────────────────────────────────────────────────────────────────────────

export type CardTheme = "navy" | "pink" | "green" | "orange" | "blue";

interface ThemeTokens {
  surface: string;
  iconBg: string;
  iconShadow: string;
  watermark: string;
  accent: string;
}

export const THEME: Record<CardTheme, ThemeTokens> = {
  navy: {
    surface: "linear-gradient(135deg, #D7DCEB 0%, #F5F7FC 100%)",
    iconBg: "linear-gradient(135deg, #1e3272, #2d4393)",
    iconShadow: "0 4px 14px rgba(30,50,114,0.28)",
    watermark: "#1e3272",
    accent: "#1e3272",
  },
  pink: {
    surface: "linear-gradient(135deg, #FBD5E8 0%, #FEF5F9 100%)",
    iconBg: "linear-gradient(135deg, #EC4899, #F472B6)",
    iconShadow: "0 4px 14px rgba(236,72,153,0.28)",
    watermark: "#EC4899",
    accent: "#9D174D",
  },
  green: {
    surface: "linear-gradient(135deg, #D1FAE5 0%, #F7FBF8 100%)",
    iconBg: "linear-gradient(135deg, #10B981, #34D399)",
    iconShadow: "0 4px 14px rgba(16,185,129,0.26)",
    watermark: "#10B981",
    accent: "#047857",
  },
  orange: {
    surface: "linear-gradient(135deg, #FED7AA 0%, #FFF7ED 100%)",
    iconBg: "linear-gradient(135deg, #F97316, #FB923C)",
    iconShadow: "0 4px 14px rgba(249,115,22,0.28)",
    watermark: "#F97316",
    accent: "#9A3412",
  },
  blue: {
    surface: "linear-gradient(135deg, #DBEAFE 0%, #F8FAFE 100%)",
    iconBg: "linear-gradient(135deg, #0055FF, #3B82F6)",
    iconShadow: "0 4px 14px rgba(0,85,255,0.28)",
    watermark: "#0055FF",
    accent: "#1e3272",
  },
};

// Shadow vocabulary borrowed from principal — 3-layer Edullent halo
// keeps cards floating over the soft scaffold without ever feeling heavy.
export const SHADOW_VIBE =
  "0 0 0 .5px rgba(30,50,114,.10), 0 4px 16px rgba(30,50,114,.10), 0 18px 44px rgba(30,50,114,.12)";

type IconType = ComponentType<{
  size?: number | string;
  strokeWidth?: number;
  color?: string;
  style?: CSSProperties;
  className?: string;
}>;

interface ThemedCardProps {
  children: ReactNode;
  title?: string;
  action?: ReactNode;
  theme?: CardTheme;
  icon?: IconType;
  watermark?: IconType;
  style?: CSSProperties;
  className?: string;
}

export function ThemedCard({
  children,
  title,
  action,
  theme = "navy",
  icon: Icon,
  watermark: WatermarkIcon,
  style,
  className,
}: ThemedCardProps) {
  const tk = THEME[theme];
  return (
    <div
      className={className}
      style={{
        borderRadius: 18,
        overflow: "hidden",
        position: "relative",
        background: tk.surface,
        border: "0.5px solid rgba(30,50,114,0.10)",
        boxShadow: SHADOW_VIBE,
        ...style,
      }}
    >
      {WatermarkIcon && (
        <WatermarkIcon
          size={120}
          strokeWidth={1.6}
          color={tk.watermark}
          style={{
            position: "absolute",
            bottom: -20,
            right: -16,
            opacity: 0.06,
            pointerEvents: "none",
          }}
        />
      )}

      {title && (
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "0.5px solid rgba(0,0,0,0.04)",
            background: "rgba(255,255,255,0.45)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              minWidth: 0,
            }}
          >
            {Icon && (
              <span
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: tk.iconBg,
                  boxShadow: tk.iconShadow,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon size={15} strokeWidth={2.4} color="#fff" />
              </span>
            )}
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: tk.accent,
                letterSpacing: "-0.1px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {title}
            </span>
          </div>
          {action || null}
        </div>
      )}
      <div style={{ padding: "16px 18px", position: "relative" }}>{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI Stat Card — the bigger, brighter sibling. Used for the 4-card top strip
// (huge number, badge, watermark, no title bar). Pulls from THEME so colours
// stay consistent with the section cards below.
// ─────────────────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: IconType;
  watermark?: IconType;
  theme?: CardTheme;
}

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  watermark: WatermarkIcon,
  theme = "navy",
}: KpiCardProps) {
  const tk = THEME[theme];
  return (
    <div
      style={{
        padding: "16px 18px",
        borderRadius: 18,
        background: tk.surface,
        border: "0.5px solid rgba(30,50,114,0.10)",
        boxShadow: SHADOW_VIBE,
        position: "relative",
        overflow: "hidden",
        minHeight: 132,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: tk.iconBg,
          boxShadow: tk.iconShadow,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 10,
        }}
      >
        <Icon size={22} color="#fff" strokeWidth={2.3} />
      </div>
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          color: "#5070B0",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 30,
          fontWeight: 700,
          color: tk.accent,
          letterSpacing: "-1.0px",
          lineHeight: 1,
          marginBottom: 4,
        }}
      >
        {value}
      </div>
      {hint && (
        <div style={{ fontSize: 10.5, fontWeight: 600, color: "#5070B0" }}>
          {hint}
        </div>
      )}
      {WatermarkIcon && (
        <WatermarkIcon
          size={48}
          strokeWidth={2}
          color={tk.watermark}
          style={{
            position: "absolute",
            bottom: 12,
            right: 12,
            opacity: 0.2,
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}
