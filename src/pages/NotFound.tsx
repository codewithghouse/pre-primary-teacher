/**
 * NotFound.tsx — Pre-primary teacher 404 page.
 * Cartoonified 2026-05-25. Light sherbet shell + Edullent logo + cute lost-kid SVG.
 */
import { Link } from "react-router-dom";
import { Home } from "lucide-react";

const NAVY = "#1e3272";
const SKY = "#0EA5E9";
const BUTTER = "#F59E0B";
const PEACH = "#FB923C";
const BLUSH = "#EC4899";

const PILLOW =
  "0 1px 0 rgba(255,255,255,0.55) inset, 0 14px 32px -10px rgba(30,50,114,0.16), 0 4px 10px rgba(30,50,114,0.06)";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #EEF4FF 0%, #F8FAFF 40%, #FFE0EC 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 20px",
        textAlign: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        {/* Sherbet card */}
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 28,
            padding: "32px 24px 28px",
            background: "#fff",
            boxShadow: PILLOW,
          }}
        >
          <DotScribbles color={SKY} dense />
          <div style={{ position: "relative", zIndex: 1 }}>
            {/* Edullent logo chip + sticker */}
            <div
              style={{
                width: 64,
                height: 64,
                margin: "0 auto 14px",
                borderRadius: 20,
                background: NAVY,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 8,
                boxShadow: `0 12px 28px -8px ${NAVY}66`,
                position: "relative",
              }}
            >
              <img
                src="/edullent-icon.png"
                alt="Edullent"
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  bottom: -8,
                  right: -8,
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  background: `linear-gradient(135deg, ${PEACH}, ${BLUSH})`,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  boxShadow: `0 4px 10px ${PEACH}66`,
                  transform: "rotate(12deg)",
                  border: "3px solid #fff",
                }}
              >
                ❓
              </span>
            </div>

            {/* Huge lost emoji */}
            <p
              style={{
                fontSize: 64,
                lineHeight: 1,
                marginBottom: 8,
                transform: "rotate(-6deg)",
                display: "inline-block",
                filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.10))",
              }}
              aria-hidden
            >
              🌱
            </p>

            <p
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: BUTTER,
                marginTop: 12,
              }}
            >
              Oops · 404
            </p>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: NAVY,
                letterSpacing: "-0.4px",
                marginTop: 4,
              }}
            >
              Page not found
            </h1>
            <p
              style={{
                fontSize: 12,
                color: "#64748B",
                marginTop: 8,
                lineHeight: 1.55,
              }}
            >
              This page doesn't exist or has moved. Let's take you back to your
              classroom.
            </p>

            <Link
              to="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                marginTop: 18,
                padding: "12px 22px",
                borderRadius: 16,
                background: `linear-gradient(135deg, ${SKY}, #0284C7)`,
                color: "#fff",
                fontSize: 13,
                fontWeight: 800,
                textDecoration: "none",
                boxShadow: `0 10px 24px -6px ${SKY}88`,
              }}
              className="active:scale-95 hover:-translate-y-0.5 transition"
            >
              <Home size={14} strokeWidth={2.6} />
              Back to Home
            </Link>
          </div>
        </div>

        <p
          style={{
            fontSize: 10,
            color: "#94A3B8",
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            marginTop: 16,
          }}
        >
          Edullent · Pre-Primary · v0.1
        </p>
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
