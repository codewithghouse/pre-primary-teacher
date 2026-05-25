/**
 * Setup.tsx — one-time bootstrap for pre-primary teacher + class.
 * Cartoonified 2026-05-25 — preserves multi-phase auth + writeBatch logic.
 *
 * Phases: signin → verifying → form → creating → done → error.
 * Writes (atomic writeBatch): 1 classes doc + 1 teachers doc (status=Invited)
 * + 1 teaching_assignments doc. Students are NOT seeded — added by principal
 * via principal-dashboard's existing Students page so data is real.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import {
  LogOut,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

/* ═══════════════════════════════════════════════════════════════════════
   PRE-PRIMARY · ONE-TIME SETUP
   Storybook-sherbet multi-phase principal authoriser + teacher inviter.
   Light sherbet shell + Edullent brand mark. Preserves all writeBatch
   semantics — only the visual layer changed.
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

type Phase = "signin" | "verifying" | "form" | "creating" | "done" | "error";

interface PrincipalContext {
  uid: string;
  email: string;
  schoolId: string;
  schoolName: string;
  role: "owner" | "principal";
}

const LEVELS = ["Playgroup", "Nursery", "LKG", "UKG"] as const;
const LEVEL_EMOJI: Record<(typeof LEVELS)[number], string> = {
  Playgroup: "🐣",
  Nursery: "🌱",
  LKG: "🌼",
  UKG: "🌟",
};
const LEVEL_TONE: Record<(typeof LEVELS)[number], string> = {
  Playgroup: BLUSH,
  Nursery: MINT,
  LKG: BUTTER,
  UKG: LAV,
};

export default function Setup() {
  const [phase, setPhase] = useState<Phase>("signin");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [principal, setPrincipal] = useState<PrincipalContext | null>(null);

  const [teacherEmail, setTeacherEmail] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("UKG");
  const [section, setSection] = useState("A");

  const [createdClassName, setCreatedClassName] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser?.email) {
        setPhase("signin");
        setPrincipal(null);
        return;
      }
      setPhase("verifying");
      try {
        const ctx = await resolvePrincipal(currentUser);
        if (ctx) {
          setPrincipal(ctx);
          setPhase("form");
        } else {
          setErrorMessage(
            `${currentUser.email} is not a principal or owner of any school in this Edullent project. Sign in with a principal Google account.`
          );
          setPhase("error");
        }
      } catch (err) {
        console.error("[Setup] resolvePrincipal failed:", err);
        setErrorMessage("Could not verify your principal status. See console.");
        setPhase("error");
      }
    });
    return () => unsub();
  }, []);

  const signIn = async () => {
    try {
      setErrorMessage(null);
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err: unknown) {
      const code = (err as { code?: string } | null)?.code;
      const cancelled =
        code === "auth/popup-closed-by-user" ||
        code === "auth/cancelled-popup-request";
      if (!cancelled) {
        setErrorMessage(
          err instanceof Error ? err.message : "Sign-in failed."
        );
      }
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!principal) return;
    if (!teacherEmail.trim() || !teacherName.trim()) {
      toast.error("Email and name are required.");
      return;
    }
    setPhase("creating");
    try {
      const className = `${level}-${section.toUpperCase()}`;
      await bootstrapClass({
        principal,
        teacherEmail: teacherEmail.trim().toLowerCase(),
        teacherName: teacherName.trim(),
        className,
        section: section.toUpperCase(),
        level,
      });
      setCreatedClassName(className);
      setPhase("done");
    } catch (err) {
      console.error("[Setup] bootstrap failed:", err);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Setup failed. Check console for details."
      );
      setPhase("error");
    }
  };

  /* ─── Render by phase ─── */

  if (phase === "signin") {
    return (
      <Shell title="One-time setup">
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 28,
            padding: 24,
            background: "#fff",
            boxShadow: PILLOW,
            textAlign: "center",
          }}
        >
          <DotScribbles color={SKY} dense />
          <div style={{ position: "relative", zIndex: 1 }}>
            <span
              style={{
                width: 64,
                height: 64,
                borderRadius: 22,
                background: `linear-gradient(135deg, ${SKY}, #0284C7)`,
                color: "#fff",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 12px 28px -8px ${SKY}88`,
                transform: "rotate(-8deg)",
                marginBottom: 16,
              }}
              aria-hidden
            >
              <ShieldAlert size={30} strokeWidth={2.4} />
            </span>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: NAVY,
                letterSpacing: "-0.4px",
              }}
            >
              Sign in as Principal{" "}
              <span aria-hidden style={{ transform: "rotate(-6deg)", display: "inline-block" }}>
                🔑
              </span>
            </h2>
            <p
              style={{
                fontSize: 12,
                color: "#64748B",
                marginTop: 8,
                lineHeight: 1.55,
              }}
            >
              Use the Google account that owns or principals an Edullent school.
              This page writes class + teacher records using your principal
              authorization.
            </p>
            <button
              type="button"
              onClick={signIn}
              style={{
                width: "100%",
                marginTop: 18,
                padding: "14px 18px",
                borderRadius: 18,
                background: `linear-gradient(135deg, ${SKY}, #0284C7)`,
                color: "#fff",
                fontSize: 14,
                fontWeight: 800,
                border: "none",
                cursor: "pointer",
                boxShadow: `0 12px 28px -8px ${SKY}88`,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
              className="active:scale-95 hover:-translate-y-0.5 transition"
            >
              🚪 Sign in with Google
            </button>
            {errorMessage && <ErrorBanner message={errorMessage} />}
          </div>
        </div>
        <FootnoteHint>
          After setup, sign out and sign in again as the new teacher to test the
          dashboard.
        </FootnoteHint>
      </Shell>
    );
  }

  if (phase === "verifying") {
    return (
      <Shell title="Verifying access…">
        <PhaseLoader label="Checking principal claims…" />
      </Shell>
    );
  }

  if (phase === "error") {
    return (
      <Shell title="Setup blocked">
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 28,
            padding: 22,
            background: "#fff",
            boxShadow: PILLOW,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <ErrorBanner message={errorMessage || "Unknown error."} />
          <button
            type="button"
            onClick={handleSignOut}
            style={{
              width: "100%",
              padding: "12px 18px",
              borderRadius: 16,
              background: "#fff",
              color: NAVY,
              fontSize: 13,
              fontWeight: 800,
              border: "none",
              cursor: "pointer",
              boxShadow: "inset 0 0 0 1px #CBD5E1",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
            className="active:scale-95 hover:-translate-y-0.5 transition"
          >
            <LogOut size={14} strokeWidth={2.4} />
            Sign out & try a different account
          </button>
        </div>
      </Shell>
    );
  }

  if (phase === "creating") {
    return (
      <Shell title="Creating records…">
        <PhaseLoader label="Writing class + teacher + enrollments…" />
      </Shell>
    );
  }

  if (phase === "done") {
    return (
      <Shell title="Setup complete!">
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 28,
            padding: 22,
            background:
              "linear-gradient(135deg, #D6F5E2 0%, #F1FBF5 55%, #FFFFFF 100%)",
            boxShadow: PILLOW,
            display: "flex",
            flexDirection: "column",
            gap: 14,
            textAlign: "center",
          }}
        >
          <DotScribbles color={MINT} dense />
          <div style={{ position: "relative", zIndex: 1 }}>
            <span
              style={{
                width: 64,
                height: 64,
                borderRadius: 22,
                background: `linear-gradient(135deg, ${MINT}, #059669)`,
                color: "#fff",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 12px 28px -8px ${MINT}88`,
                transform: "rotate(-8deg)",
                marginBottom: 14,
              }}
              aria-hidden
            >
              <CheckCircle2 size={34} strokeWidth={2.4} />
            </span>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: NAVY,
                letterSpacing: "-0.4px",
              }}
            >
              {teacherName} is ready to log in{" "}
              <span aria-hidden style={{ transform: "rotate(6deg)", display: "inline-block" }}>
                🌱
              </span>
            </h2>
            <p
              style={{
                fontSize: 12,
                color: "#64748B",
                marginTop: 6,
              }}
            >
              Class{" "}
              <strong style={{ color: MINT }}>{createdClassName}</strong>{" "}
              created · teacher invited
            </p>
            <div
              style={{
                marginTop: 16,
                padding: 14,
                borderRadius: 16,
                background: "#fff",
                boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.08)",
                textAlign: "left",
              }}
            >
              <FieldLabel emoji="🚀">Next steps</FieldLabel>
              <ol
                style={{
                  margin: 0,
                  paddingLeft: 18,
                  fontSize: 12,
                  color: "#0F172A",
                  lineHeight: 1.7,
                }}
              >
                <li>
                  Add students to <strong>{createdClassName}</strong> via the
                  principal-dashboard Students page
                </li>
                <li>Sign out from this page (button below)</li>
                <li>
                  Visit{" "}
                  <code
                    style={{
                      background: "#F1F5F9",
                      padding: "1px 5px",
                      borderRadius: 4,
                      fontSize: 11,
                    }}
                  >
                    /
                  </code>{" "}
                  and sign in with{" "}
                  <strong style={{ color: SKY }}>{teacherEmail}</strong>
                </li>
                <li>
                  First login auto-activates the teacher (status: Invited →
                  Active)
                </li>
                <li>
                  Test attendance, daily activities, roster, pickup verification
                </li>
              </ol>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                marginTop: 14,
              }}
            >
              <button
                type="button"
                onClick={handleSignOut}
                style={{
                  padding: "12px 16px",
                  borderRadius: 16,
                  background: "#fff",
                  color: NAVY,
                  fontSize: 12,
                  fontWeight: 800,
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "inset 0 0 0 1px #CBD5E1",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
                className="active:scale-95 hover:-translate-y-0.5 transition"
              >
                <LogOut size={14} strokeWidth={2.4} />
                Sign out
              </button>
              <Link
                to="/setup"
                style={{
                  padding: "12px 16px",
                  borderRadius: 16,
                  background: `linear-gradient(135deg, ${MINT}, #059669)`,
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 800,
                  border: "none",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  textDecoration: "none",
                  boxShadow: `0 8px 18px -6px ${MINT}66`,
                }}
                className="active:scale-95 hover:-translate-y-0.5 transition"
              >
                ➕ Add another
              </Link>
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  /* phase === "form" */
  return (
    <Shell title="Set up a Pre-Primary teacher">
      {principal && (
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 18,
            padding: "12px 14px",
            background: "linear-gradient(135deg, #D6F5E2 0%, #F1FBF5 100%)",
            boxShadow: PILLOW,
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <DotScribbles color={MINT} />
          <span
            style={{
              position: "relative",
              zIndex: 1,
              width: 36,
              height: 36,
              borderRadius: 12,
              background: `linear-gradient(135deg, ${MINT}, #059669)`,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              boxShadow: `0 6px 14px ${MINT}55`,
              transform: "rotate(-6deg)",
              flexShrink: 0,
            }}
            aria-hidden
          >
            ✓
          </span>
          <div style={{ position: "relative", zIndex: 1, flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: NAVY,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              Signed in: {principal.email}
            </p>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#047857" }}>
              {principal.role.toUpperCase()} · {principal.schoolName}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            style={{
              position: "relative",
              zIndex: 1,
              fontSize: 11,
              fontWeight: 800,
              color: RED,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: 999,
              flexShrink: 0,
            }}
            className="hover:bg-red-50 transition"
          >
            Sign out
          </button>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <FieldGroup
          emoji="📧"
          label="Teacher's Google email"
          hint="They'll log in with this Gmail account"
        >
          <PillowInput
            type="email"
            required
            value={teacherEmail}
            onChange={setTeacherEmail}
            placeholder="teacher.ukga@example.com"
          />
        </FieldGroup>

        <FieldGroup emoji="👤" label="Teacher's name">
          <PillowInput
            required
            value={teacherName}
            onChange={setTeacherName}
            placeholder="Priya Kapoor"
          />
        </FieldGroup>

        <FieldGroup emoji="🎒" label="Class level">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 6,
            }}
          >
            {LEVELS.map((lvl) => {
              const tone = LEVEL_TONE[lvl];
              const selected = level === lvl;
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setLevel(lvl)}
                  style={{
                    position: "relative",
                    overflow: "hidden",
                    padding: "12px 4px",
                    borderRadius: 16,
                    background: selected
                      ? `linear-gradient(135deg, ${tone}, ${tone}cc)`
                      : "#fff",
                    color: selected ? "#fff" : NAVY,
                    border: "none",
                    cursor: "pointer",
                    boxShadow: selected
                      ? `0 8px 18px -6px ${tone}66`
                      : PILLOW,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                    transition: "transform 140ms ease",
                  }}
                  className="active:scale-95"
                >
                  <span
                    style={{
                      fontSize: 22,
                      transform: selected ? "rotate(-8deg)" : "none",
                      transition: "transform 200ms ease",
                    }}
                    aria-hidden
                  >
                    {LEVEL_EMOJI[lvl]}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: "0.04em",
                    }}
                  >
                    {lvl}
                  </span>
                </button>
              );
            })}
          </div>
        </FieldGroup>

        <FieldGroup
          emoji="🔤"
          label="Section"
          hint="Single letter — A, B, etc."
        >
          <PillowInput
            required
            maxLength={2}
            value={section}
            onChange={(v) => setSection(v.toUpperCase())}
            placeholder="A"
            uppercase
          />
        </FieldGroup>

        <p
          style={{
            fontSize: 11,
            color: "#64748B",
            padding: "0 4px",
            lineHeight: 1.5,
          }}
        >
          💡 Students for this class are added separately via the existing
          principal-dashboard Students page — no dummy data is seeded here.
        </p>

        <button
          type="submit"
          style={{
            padding: "14px 18px",
            borderRadius: 18,
            background: `linear-gradient(135deg, ${LEVEL_TONE[level]}, ${LEVEL_TONE[level]}cc)`,
            color: "#fff",
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: "-0.1px",
            border: "none",
            cursor: "pointer",
            boxShadow: `0 12px 28px -8px ${LEVEL_TONE[level]}88`,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
          className="active:scale-95 hover:-translate-y-0.5 transition"
        >
          <Sparkles size={16} strokeWidth={2.4} />
          Create {level}-{section.toUpperCase()} + invite{" "}
          {teacherName || "teacher"}
        </button>

        {errorMessage && <ErrorBanner message={errorMessage} />}
      </form>
    </Shell>
  );
}

/* ═══════════════════════ building blocks ═══════════════════════ */

function Shell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #EEF4FF 0%, #F8FAFF 50%, #EEF4FF 100%)",
        padding: "32px 16px",
      }}
    >
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <ShellHeader title={title} />
        {children}
      </div>
    </div>
  );
}

function ShellHeader({ title }: { title: string }) {
  return (
    <div style={{ textAlign: "center", marginBottom: 22 }}>
      <div
        style={{
          width: 64,
          height: 64,
          margin: "0 auto 12px",
          borderRadius: 20,
          background: NAVY,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 8,
          boxShadow: `0 12px 28px -8px ${NAVY}66`,
        }}
      >
        <img
          src="/edullent-icon.png"
          alt="Edullent"
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </div>
      <p
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: SKY,
        }}
      >
        Edullent
      </p>
      <h1
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: NAVY,
          letterSpacing: "-0.4px",
          marginTop: 2,
        }}
      >
        Pre-Primary{" "}
        <span aria-hidden style={{ transform: "rotate(-6deg)", display: "inline-block" }}>
          🌱
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
        {title}
      </p>
    </div>
  );
}

function PhaseLoader({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: "48px 24px",
        textAlign: "center",
        borderRadius: 28,
        background: "#fff",
        boxShadow: PILLOW,
      }}
    >
      <Loader2 className="animate-spin" color={SKY} />
      <p
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "#64748B",
          marginTop: 12,
        }}
      >
        {label}
      </p>
    </div>
  );
}

function FieldGroup({
  emoji,
  label,
  hint,
  children,
}: {
  emoji?: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        background: "#fff",
        borderRadius: 18,
        padding: 14,
        boxShadow: PILLOW,
      }}
    >
      <FieldLabel emoji={emoji}>{label}</FieldLabel>
      {children}
      {hint && (
        <p
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: "#94A3B8",
            marginTop: 6,
          }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

function FieldLabel({
  emoji,
  children,
}: {
  emoji?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        marginBottom: 8,
      }}
    >
      {emoji && (
        <span
          aria-hidden
          style={{
            fontSize: 13,
            transform: "rotate(-6deg)",
            display: "inline-block",
          }}
        >
          {emoji}
        </span>
      )}
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
        {children}
      </p>
    </div>
  );
}

function PillowInput({
  value,
  onChange,
  placeholder,
  maxLength,
  type,
  required,
  uppercase,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  type?: string;
  required?: boolean;
  uppercase?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      type={type}
      required={required}
      style={{
        width: "100%",
        padding: "12px 14px",
        borderRadius: 14,
        background: "#F8FAFC",
        border: "none",
        fontSize: 13,
        fontWeight: 600,
        color: "#0F172A",
        outline: "none",
        boxShadow: "inset 0 0 0 1px #E2E8F0",
        textTransform: uppercase ? "uppercase" : "none",
      }}
    />
  );
}

function FootnoteHint({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: 10,
        fontWeight: 600,
        color: "#94A3B8",
        textAlign: "center",
        marginTop: 16,
        lineHeight: 1.55,
      }}
    >
      {children}
    </p>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        marginTop: 12,
        padding: "10px 12px",
        borderRadius: 14,
        background: "linear-gradient(135deg, #FFD6D6 0%, #FFF1F1 100%)",
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
        style={{ flexShrink: 0, marginTop: 2, position: "relative", zIndex: 1 }}
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
        {message}
      </span>
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

// Palette constants reserved for future variants on this page.
void PEACH;

/* ═══════════════════════ Firestore logic (unchanged) ═══════════════════════ */

async function resolvePrincipal(user: User): Promise<PrincipalContext | null> {
  const email = user.email!.toLowerCase();
  try {
    const ownerSchool = await getDoc(doc(db, "schools", user.uid));
    if (ownerSchool.exists()) {
      const data = ownerSchool.data() as { name?: string };
      return {
        uid: user.uid,
        email,
        schoolId: user.uid,
        schoolName: data.name || "School",
        role: "owner",
      };
    }
  } catch (err) {
    console.warn("[Setup] schools/{uid} read failed:", err);
  }

  try {
    const principalSnap = await getDocs(
      query(collection(db, "principals"), where("email", "==", email))
    );
    if (!principalSnap.empty) {
      const principalDoc = principalSnap.docs[0];
      const data = principalDoc.data() as { schoolId?: string };
      const schoolId = data.schoolId;
      if (!schoolId) return null;
      let schoolName = "School";
      try {
        const sSnap = await getDoc(doc(db, "schools", schoolId));
        if (sSnap.exists()) {
          schoolName = (sSnap.data() as { name?: string }).name || "School";
        }
      } catch {
        /* ignore */
      }
      return {
        uid: user.uid,
        email,
        schoolId,
        schoolName,
        role: "principal",
      };
    }
  } catch (err) {
    console.warn("[Setup] principals read failed:", err);
  }

  return null;
}

interface BootstrapArgs {
  principal: PrincipalContext;
  teacherEmail: string;
  teacherName: string;
  className: string;
  section: string;
  level: string;
}

async function bootstrapClass(args: BootstrapArgs) {
  const { principal, teacherEmail, teacherName, className, section, level } =
    args;

  const batch = writeBatch(db);
  const now = serverTimestamp();
  const audit = {
    _lastModifiedBy: principal.uid,
    _lastModifiedAt: now,
  };

  // 1. Class doc
  const classRef = doc(collection(db, "classes"));
  batch.set(classRef, {
    schoolId: principal.schoolId,
    name: className,
    section,
    level,
    stage: "pre_primary",
    classTeacherEmail: teacherEmail,
    classTeacherName: teacherName,
    teacherEmail,
    teacherName,
    studentCount: 0,
    academicYear: currentAcademicYear(),
    features: {
      diaperLog: level === "Playgroup" || level === "Nursery",
      napTracker: true,
      photoStudio: true,
      pickupVerification: true,
    },
    createdAt: now,
    updatedAt: now,
    ...audit,
  });

  // 2. Teacher doc — status "Invited" auto-promotes on first login
  const teacherDocId = `pp_${teacherEmail.replace(/[^a-z0-9]/g, "_")}_${principal.schoolId.slice(0, 8)}`;
  const teacherRef = doc(db, "teachers", teacherDocId);
  batch.set(teacherRef, {
    schoolId: principal.schoolId,
    email: teacherEmail,
    name: teacherName,
    displayName: teacherName,
    assignedClass: className,
    subject: "Class Teacher",
    status: "Invited",
    isActive: true,
    isPrimarySchool: true,
    stage: "pre_primary",
    classId: classRef.id,
    createdAt: now,
    invitedBy: principal.uid,
    invitedAt: now,
    ...audit,
  });

  // 3. teaching_assignments doc
  const assignmentRef = doc(collection(db, "teaching_assignments"));
  batch.set(assignmentRef, {
    schoolId: principal.schoolId,
    teacherId: teacherDocId,
    teacherEmail,
    teacherName,
    classId: classRef.id,
    className,
    subject: "Class Teacher",
    subjectName: "Class Teacher",
    role: "class",
    status: "Active",
    createdAt: now,
    ...audit,
  });

  await batch.commit();
  toast.success(`${className} created · ${teacherName} invited 🎉`);
}

function currentAcademicYear(): string {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  if (month >= 3) {
    return `${year}-${(year + 1).toString().slice(-2)}`;
  }
  return `${year - 1}-${year.toString().slice(-2)}`;
}
