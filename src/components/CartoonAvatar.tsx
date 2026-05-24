import type { CSSProperties } from "react";

// Cute SVG cartoon-kid avatar — deterministic palette from the child's name.
// Used as a fallback when no photo is on file. Six skin tones × six hair
// tones × four hair styles → 144 distinct combos.

const SKIN = ["#FFE2CC", "#FBD0AC", "#F0B687", "#D69A6A", "#A87148", "#7A5232"];
const HAIR = ["#1F1611", "#3E2A1F", "#5C3A22", "#8B6F47", "#D4A574", "#E8C18B"];
const CHEEK = ["#FFA8C5", "#FF99B5", "#FF93AB", "#F4869F", "#E26B85", "#C75575"];
const BLUSH = ["#FFD6E1", "#FFC9D6", "#FFBFCB", "#FAB3C0", "#E89CAA", "#CC7D8E"];

function nameHash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return h;
}

type HairStyle = "tuft" | "bowl" | "ponytail" | "curls";

interface Props {
  name: string;
  size?: number;
  ringColor?: string;
  ringWidth?: number;
  style?: CSSProperties;
}

export function CartoonAvatar({
  name,
  size = 120,
  ringColor,
  ringWidth = 4,
  style,
}: Props) {
  const h = nameHash(name || "kid");
  const skin = SKIN[h % SKIN.length];
  const hair = HAIR[(h >> 3) % HAIR.length];
  const cheek = CHEEK[(h >> 6) % CHEEK.length];
  const blush = BLUSH[(h >> 6) % BLUSH.length];
  const hairStyle = (["tuft", "bowl", "ponytail", "curls"] as HairStyle[])[
    (h >> 9) % 4
  ];
  const smile = ((h >> 12) % 2 === 0);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: blush,
        boxShadow: ringColor
          ? `0 0 0 ${ringWidth}px ${ringColor}, 0 14px 30px rgba(30,50,114,0.18)`
          : "0 14px 30px rgba(30,50,114,0.18)",
        overflow: "hidden",
        position: "relative",
        flexShrink: 0,
        ...style,
      }}
    >
      <svg
        viewBox="0 0 120 120"
        width="100%"
        height="100%"
        aria-hidden="true"
      >
        {/* shoulders */}
        <ellipse cx="60" cy="118" rx="48" ry="22" fill={skin} opacity="0.85" />

        {/* face */}
        <circle cx="60" cy="62" r="34" fill={skin} />

        {/* hair (per style) */}
        {hairStyle === "tuft" && (
          <>
            <path
              d="M 35 40 Q 50 18 75 22 Q 92 26 90 44 Q 80 36 60 36 Q 44 36 35 40 Z"
              fill={hair}
            />
            <path
              d="M 56 22 Q 60 14 66 22 Q 62 26 56 22 Z"
              fill={hair}
            />
          </>
        )}
        {hairStyle === "bowl" && (
          <path
            d="M 27 56 Q 28 26 60 24 Q 92 26 93 56 Q 86 50 60 50 Q 34 50 27 56 Z"
            fill={hair}
          />
        )}
        {hairStyle === "ponytail" && (
          <>
            <path
              d="M 32 48 Q 30 26 60 24 Q 90 26 88 48 Q 78 38 60 38 Q 42 38 32 48 Z"
              fill={hair}
            />
            <ellipse cx="96" cy="58" rx="8" ry="14" fill={hair} />
            <circle cx="89" cy="50" r="3.5" fill="#FF6F9C" />
          </>
        )}
        {hairStyle === "curls" && (
          <>
            <circle cx="38" cy="40" r="9" fill={hair} />
            <circle cx="52" cy="32" r="10" fill={hair} />
            <circle cx="68" cy="30" r="10" fill={hair} />
            <circle cx="84" cy="38" r="9" fill={hair} />
            <circle cx="46" cy="46" r="6" fill={hair} />
            <circle cx="78" cy="46" r="6" fill={hair} />
          </>
        )}

        {/* cheeks */}
        <ellipse cx="42" cy="74" rx="6" ry="4" fill={cheek} opacity="0.65" />
        <ellipse cx="78" cy="74" rx="6" ry="4" fill={cheek} opacity="0.65" />

        {/* eyes — closed-arc 'happy' look */}
        <path
          d="M 46 64 Q 50 60 54 64"
          stroke="#2A2235"
          strokeWidth="2.6"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M 66 64 Q 70 60 74 64"
          stroke="#2A2235"
          strokeWidth="2.6"
          strokeLinecap="round"
          fill="none"
        />

        {/* highlight dots on eyes */}
        <circle cx="51" cy="62" r="1.2" fill="#fff" />
        <circle cx="71" cy="62" r="1.2" fill="#fff" />

        {/* mouth */}
        {smile ? (
          <path
            d="M 52 80 Q 60 88 68 80"
            stroke="#2A2235"
            strokeWidth="2.4"
            strokeLinecap="round"
            fill="none"
          />
        ) : (
          <ellipse cx="60" cy="82" rx="4" ry="3" fill="#2A2235" opacity="0.85" />
        )}
      </svg>
    </div>
  );
}
