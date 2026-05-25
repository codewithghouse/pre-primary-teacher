/**
 * Login.tsx — Pre-primary teacher Google sign-in.
 * Cartoonified 2026-05-25. Light sherbet shell + Edullent logo brand mark.
 */
import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { AlertCircle, Loader2 } from "lucide-react";

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

interface LoginProps {
  authError?: string | null;
}

export default function Login({ authError }: LoginProps) {
  const { loginWithGoogle } = useAuth();
  const [signingIn, setSigningIn] = useState(false);

  const handleSignIn = async () => {
    setSigningIn(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      console.error("[Login] sign-in failed:", err);
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #EEF4FF 0%, #F8FAFF 40%, #FFE0EC 100%)",
        display: "flex",
        flexDirection: "column",
        padding: "32px 20px",
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ width: "100%", maxWidth: 400 }}>
          {/* Brand */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            {/* Edullent logo chip */}
            <div
              style={{
                width: 80,
                height: 80,
                margin: "0 auto",
                borderRadius: 24,
                background: NAVY,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 10,
                boxShadow: `0 14px 32px -8px ${NAVY}66`,
                position: "relative",
              }}
            >
              <img
                src="/edullent-icon.png"
                alt="Edullent"
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
              {/* Floating sticker */}
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  top: -10,
                  right: -10,
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  background: `linear-gradient(135deg, ${BUTTER}, ${PEACH})`,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  boxShadow: `0 6px 14px ${BUTTER}66`,
                  transform: "rotate(12deg)",
                  border: "3px solid #fff",
                }}
              >
                🌱
              </span>
            </div>
            <p
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: SKY,
                marginTop: 16,
              }}
            >
              Edullent
            </p>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: NAVY,
                letterSpacing: "-0.6px",
                marginTop: 2,
              }}
            >
              Pre-Primary{" "}
              <span
                aria-hidden
                style={{ display: "inline-block", transform: "rotate(-6deg)" }}
              >
                🎒
              </span>
            </h1>
            <p
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: NAVY,
                opacity: 0.7,
                marginTop: 4,
              }}
            >
              Teacher dashboard
            </p>
            <p
              style={{
                fontSize: 12,
                color: "#64748B",
                marginTop: 12,
                maxWidth: 300,
                margin: "12px auto 0",
                lineHeight: 1.55,
              }}
            >
              Daily moments, milestones, and trust — for Playgroup, Nursery, LKG,
              UKG teachers.
            </p>
          </div>

          {/* Card with sign-in */}
          <div
            style={{
              position: "relative",
              overflow: "hidden",
              borderRadius: 28,
              padding: 22,
              background: "#fff",
              boxShadow: PILLOW,
            }}
          >
            <DotScribbles color={SKY} dense />
            <div style={{ position: "relative", zIndex: 1 }}>
              {/* Error banner */}
              {authError && (
                <div
                  style={{
                    position: "relative",
                    overflow: "hidden",
                    marginBottom: 14,
                    padding: "10px 12px",
                    borderRadius: 14,
                    background:
                      "linear-gradient(135deg, #FFD6D6 0%, #FFF1F1 100%)",
                    boxShadow: `inset 0 0 0 1px ${RED}33`,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                  }}
                >
                  <DotScribbles color={RED} />
                  <AlertCircle
                    size={14}
                    strokeWidth={2.4}
                    color={RED}
                    style={{
                      flexShrink: 0,
                      marginTop: 2,
                      position: "relative",
                      zIndex: 1,
                    }}
                  />
                  <span
                    style={{
                      position: "relative",
                      zIndex: 1,
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#0F172A",
                      lineHeight: 1.5,
                    }}
                  >
                    {authError}
                  </span>
                </div>
              )}

              {/* Sign-in pillow */}
              <button
                type="button"
                onClick={handleSignIn}
                disabled={signingIn}
                style={{
                  width: "100%",
                  padding: "14px 18px",
                  borderRadius: 18,
                  background: signingIn
                    ? "#CBD5E1"
                    : `linear-gradient(135deg, ${SKY}, #0284C7)`,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 800,
                  letterSpacing: "-0.1px",
                  border: "none",
                  cursor: signingIn ? "default" : "pointer",
                  boxShadow: signingIn
                    ? "none"
                    : `0 12px 28px -8px ${SKY}88`,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                }}
                className="active:scale-95 hover:-translate-y-0.5 transition"
              >
                {signingIn ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    <GoogleIcon />
                    Sign in with Google
                  </>
                )}
              </button>

              <p
                style={{
                  fontSize: 11,
                  color: "#64748B",
                  textAlign: "center",
                  marginTop: 14,
                  lineHeight: 1.55,
                }}
              >
                Use the Google account registered by your principal.
                <br />
                Need access? Contact your school principal.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", paddingTop: 20 }}>
        <a
          href="/setup"
          style={{
            fontSize: 11,
            color: NAVY,
            opacity: 0.7,
            fontWeight: 700,
            textDecoration: "underline",
            textDecorationStyle: "dotted",
            textUnderlineOffset: 3,
          }}
          className="hover:opacity-100"
        >
          🔑 Principal? Set up a pre-primary teacher →
        </a>
        <p
          style={{
            fontSize: 10,
            color: "#94A3B8",
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            marginTop: 8,
          }}
        >
          Powered by Edullent · v0.1
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
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
void MINT;
void BLUSH;
void LAV;
