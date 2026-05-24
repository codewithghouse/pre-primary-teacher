import type { ComponentType, CSSProperties, ReactNode } from "react";

// Themed Card — pre-primary "storybook pediatric premium" surface.
// Pastel sherbet palette + 28px radius + soft pillow shadow + optional
// emoji prefix + floating sticker. Duplicated in pre-primary-teacher-dashboard.

export type CardTheme =
  | "navy"
  | "pink"
  | "green"
  | "orange"
  | "blue"
  | "lavender"
  | "butter";

interface ThemeTokens {
  surface: string;
  iconBg: string;
  iconShadow: string;
  watermark: string;
  accent: string;
  scribble: string;
}

export const THEME: Record<CardTheme, ThemeTokens> = {
  navy: {
    surface: "linear-gradient(135deg, #E1ECFF 0%, #F7FAFF 100%)",
    iconBg: "linear-gradient(135deg, #6E8BFF, #A1B6FF)",
    iconShadow: "0 6px 16px rgba(110,139,255,0.30)",
    watermark: "#5B7CFF",
    accent: "#1e3272",
    scribble: "#5B7CFF",
  },
  pink: {
    surface: "linear-gradient(135deg, #FFDDEB 0%, #FFF6FA 100%)",
    iconBg: "linear-gradient(135deg, #F472B6, #FBA5C8)",
    iconShadow: "0 6px 16px rgba(244,114,182,0.28)",
    watermark: "#EC4899",
    accent: "#9D174D",
    scribble: "#EC4899",
  },
  green: {
    surface: "linear-gradient(135deg, #C9F5DE 0%, #F0FBF5 100%)",
    iconBg: "linear-gradient(135deg, #34D399, #6EE7B7)",
    iconShadow: "0 6px 16px rgba(52,211,153,0.28)",
    watermark: "#10B981",
    accent: "#065F46",
    scribble: "#10B981",
  },
  orange: {
    surface: "linear-gradient(135deg, #FFDFC8 0%, #FFF6EE 100%)",
    iconBg: "linear-gradient(135deg, #FB923C, #FDBA74)",
    iconShadow: "0 6px 16px rgba(251,146,60,0.28)",
    watermark: "#F97316",
    accent: "#9A3412",
    scribble: "#F97316",
  },
  blue: {
    surface: "linear-gradient(135deg, #CFEAF7 0%, #F2FAFE 100%)",
    iconBg: "linear-gradient(135deg, #38BDF8, #7DD3FC)",
    iconShadow: "0 6px 16px rgba(56,189,248,0.28)",
    watermark: "#0EA5E9",
    accent: "#075985",
    scribble: "#0EA5E9",
  },
  lavender: {
    surface: "linear-gradient(135deg, #E8DDFF 0%, #F6F1FF 100%)",
    iconBg: "linear-gradient(135deg, #A78BFA, #C4B5FD)",
    iconShadow: "0 6px 16px rgba(167,139,250,0.28)",
    watermark: "#8B5CF6",
    accent: "#5B21B6",
    scribble: "#8B5CF6",
  },
  butter: {
    surface: "linear-gradient(135deg, #FFEFBF 0%, #FFFAE8 100%)",
    iconBg: "linear-gradient(135deg, #FBBF24, #FCD34D)",
    iconShadow: "0 6px 16px rgba(251,191,36,0.30)",
    watermark: "#F59E0B",
    accent: "#92400E",
    scribble: "#F59E0B",
  },
};

// Softer "pillow" shadow — replaces the principal-vibe 3-layer navy stack.
export const SHADOW_VIBE =
  "0 1px 0 rgba(255,255,255,0.55) inset, 0 14px 32px -10px rgba(30,50,114,0.16), 0 4px 10px rgba(30,50,114,0.06)";

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
  emoji?: string;
  action?: ReactNode;
  theme?: CardTheme;
  icon?: IconType;
  watermark?: IconType;
  sticker?: ReactNode;
  style?: CSSProperties;
  className?: string;
}

export function ThemedCard({
  children,
  title,
  emoji,
  action,
  theme = "navy",
  icon: Icon,
  watermark: WatermarkIcon,
  sticker,
  style,
  className,
}: ThemedCardProps) {
  const tk = THEME[theme];
  return (
    <div
      className={className}
      style={{
        borderRadius: 28,
        overflow: "hidden",
        position: "relative",
        background: tk.surface,
        boxShadow: SHADOW_VIBE,
        ...style,
      }}
    >
      {/* Scribble dots — playful background texture */}
      <ScribbleDots color={tk.scribble} />

      {WatermarkIcon && (
        <WatermarkIcon
          size={140}
          strokeWidth={1.4}
          color={tk.watermark}
          style={{
            position: "absolute",
            bottom: -22,
            right: -18,
            opacity: 0.07,
            pointerEvents: "none",
            transform: "rotate(-8deg)",
          }}
        />
      )}

      {sticker && (
        <div
          style={{
            position: "absolute",
            top: -10,
            right: 18,
            transform: "rotate(8deg)",
            zIndex: 2,
            pointerEvents: "none",
          }}
        >
          {sticker}
        </div>
      )}

      {title && (
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px",
            background: "rgba(255,255,255,0.55)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
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
                  width: 36,
                  height: 36,
                  borderRadius: 14,
                  background: tk.iconBg,
                  boxShadow: tk.iconShadow,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transform: "rotate(-4deg)",
                }}
              >
                <Icon size={17} strokeWidth={2.6} color="#fff" />
              </span>
            )}
            {emoji && (
              <span
                style={{
                  fontSize: 18,
                  lineHeight: 1,
                  flexShrink: 0,
                  filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.08))",
                }}
                aria-hidden="true"
              >
                {emoji}
              </span>
            )}
            <span
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: tk.accent,
                letterSpacing: "-0.2px",
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
      <div style={{ padding: "18px 20px", position: "relative", zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  emoji?: string;
  icon: IconType;
  watermark?: IconType;
  theme?: CardTheme;
}

export function KpiCard({
  label,
  value,
  hint,
  emoji,
  icon: Icon,
  watermark: WatermarkIcon,
  theme = "navy",
}: KpiCardProps) {
  const tk = THEME[theme];
  return (
    <div
      style={{
        padding: "18px 18px 16px",
        borderRadius: 26,
        background: tk.surface,
        boxShadow: SHADOW_VIBE,
        position: "relative",
        overflow: "hidden",
        minHeight: 140,
        transition: "transform 180ms cubic-bezier(.34,1.56,.64,1)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px) rotate(-0.6deg)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0) rotate(0deg)";
      }}
    >
      <ScribbleDots color={tk.scribble} dense />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 16,
            background: tk.iconBg,
            boxShadow: tk.iconShadow,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: "rotate(-5deg)",
          }}
        >
          <Icon size={22} color="#fff" strokeWidth={2.4} />
        </div>
        {emoji && (
          <span
            style={{
              fontSize: 24,
              lineHeight: 1,
              transform: "rotate(8deg)",
              filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.10))",
            }}
            aria-hidden="true"
          >
            {emoji}
          </span>
        )}
      </div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: tk.accent,
          opacity: 0.7,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 36,
          fontWeight: 900,
          color: tk.accent,
          letterSpacing: "-1.4px",
          lineHeight: 1,
          marginBottom: 6,
          position: "relative",
          zIndex: 1,
        }}
      >
        {value}
      </div>
      {hint && (
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: tk.accent,
            opacity: 0.75,
            position: "relative",
            zIndex: 1,
          }}
        >
          {hint}
        </div>
      )}
      {WatermarkIcon && (
        <WatermarkIcon
          size={56}
          strokeWidth={1.8}
          color={tk.watermark}
          style={{
            position: "absolute",
            bottom: 10,
            right: 10,
            opacity: 0.15,
            pointerEvents: "none",
            transform: "rotate(-10deg)",
          }}
        />
      )}
    </div>
  );
}

/** Scattered dots + stars in the card surface for storybook texture. */
function ScribbleDots({
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
        opacity: dense ? 0.10 : 0.07,
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
