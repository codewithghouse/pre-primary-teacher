/**
 * Setup.tsx — one-time bootstrap for pre-primary teacher + class.
 *
 * WHY this page exists:
 * The mature principal-dashboard only supports K-12 class creation + teacher
 * invites. To test the pre-primary dashboard, we need to insert:
 *   - 1 `classes` doc       (with classTeacherEmail set so S2 gate passes)
 *   - 1 `teachers` doc      (status: "Invited" → auto-activates on first login)
 *   - 1 `teaching_assignments` doc (linking teacher to class)
 *   - N `students` docs     (with allergies / medical / comfort cues)
 *   - N `enrollments` docs  (denormalized roster link)
 *
 * This page lets a principal sign in with their EXISTING Google account and
 * write all of the above via the client SDK. Security rules accept the writes
 * because the principal has admin role for their school.
 *
 * No service account key needed.
 *
 * Once principal-dashboard is patched to support pre-primary natively, this
 * page can be deleted (or kept as a quick demo seeder).
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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sprout,
  LogOut,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

type Phase = "signin" | "verifying" | "form" | "creating" | "done" | "error";

interface PrincipalContext {
  uid: string;
  email: string;
  schoolId: string;
  schoolName: string;
  role: "owner" | "principal";
}

const LEVELS = ["Playgroup", "Nursery", "LKG", "UKG"] as const;

export default function Setup() {
  const [phase, setPhase] = useState<Phase>("signin");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [principal, setPrincipal] = useState<PrincipalContext | null>(null);

  // Form state
  const [teacherEmail, setTeacherEmail] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("UKG");
  const [section, setSection] = useState("A");

  const [createdClassName, setCreatedClassName] = useState("");

  // Bind to current Firebase user — separate flow from AuthContext (which has
  // a pre-primary stage gate that would reject a principal).
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

  // ─── Render by phase ────────────────────────────────────────────────────

  if (phase === "signin") {
    return (
      <Shell>
        <ShellHeader title="One-time setup" />
        <Card>
          <CardContent className="p-6 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-edu-light-blue flex items-center justify-center">
              <ShieldAlert className="w-7 h-7 text-edu-blue" />
            </div>
            <div>
              <h2 className="text-lg font-black text-edu-navy">
                Sign in as Principal
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Use the Google account that owns or principals an Edullent school.
                This page writes class + teacher records using your principal authorization.
              </p>
            </div>
            <Button size="lg" className="w-full" onClick={signIn}>
              Sign in with Google
            </Button>
            {errorMessage && <ErrorBanner message={errorMessage} />}
          </CardContent>
        </Card>
        <p className="text-[11px] text-white/40 text-center mt-4">
          After setup, sign out and sign in again as the new teacher to test the dashboard.
        </p>
      </Shell>
    );
  }

  if (phase === "verifying") {
    return (
      <Shell>
        <ShellHeader title="Verifying access…" />
        <div className="flex flex-col items-center gap-3 py-12 text-white/80">
          <Loader2 className="w-7 h-7 animate-spin text-edu-blue" />
          <p className="text-xs">Checking principal claims…</p>
        </div>
      </Shell>
    );
  }

  if (phase === "error") {
    return (
      <Shell>
        <ShellHeader title="Setup blocked" />
        <Card>
          <CardContent className="p-6 space-y-4">
            <ErrorBanner message={errorMessage || "Unknown error."} />
            <Button variant="outline" className="w-full" onClick={handleSignOut}>
              Sign out & try a different account
            </Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (phase === "creating") {
    return (
      <Shell>
        <ShellHeader title="Creating records…" />
        <div className="flex flex-col items-center gap-3 py-12 text-white/80">
          <Loader2 className="w-7 h-7 animate-spin text-edu-blue" />
          <p className="text-xs">Writing class + teacher + enrollments…</p>
        </div>
      </Shell>
    );
  }

  if (phase === "done") {
    return (
      <Shell>
        <ShellHeader title="Setup complete!" />
        <Card>
          <CardContent className="p-6 space-y-4 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-edu-light-green flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-edu-green" />
            </div>
            <div>
              <h2 className="text-lg font-black text-edu-navy">
                {teacherName} is ready to log in 🌱
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Class <strong>{createdClassName}</strong> created · teacher invited
              </p>
            </div>
            <div className="bg-secondary/50 rounded-xl p-4 text-left text-xs space-y-2">
              <p className="font-bold text-edu-navy">Next steps:</p>
              <ol className="list-decimal list-inside text-foreground/80 space-y-1.5">
                <li>
                  Add students to <strong>{createdClassName}</strong> via the existing
                  principal-dashboard Students page
                </li>
                <li>Sign out from this page (button below)</li>
                <li>
                  Visit <code className="bg-white px-1.5 py-0.5 rounded">/</code> and sign in with{" "}
                  <strong className="text-edu-blue">{teacherEmail}</strong>
                </li>
                <li>
                  First login auto-activates the teacher (status: Invited → Active)
                </li>
                <li>Test attendance, daily activities, roster, pickup verification</li>
              </ol>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="w-4 h-4" />
                Sign out
              </Button>
              <Button asChild>
                <Link to="/setup">Add another</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  // phase === "form"
  return (
    <Shell>
      <ShellHeader title="Set up a Pre-Primary teacher" />
      {principal && (
        <Card className="bg-edu-light-green/30 border-edu-green/30">
          <CardContent className="p-3 text-xs flex items-center justify-between">
            <div>
              <p className="font-bold text-edu-navy">
                Signed in: {principal.email}
              </p>
              <p className="text-muted-foreground">
                {principal.role.toUpperCase()} · {principal.schoolName}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="text-xs font-semibold text-edu-red"
            >
              Sign out
            </button>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 mt-4">
        <FieldGroup label="Teacher's Google email" hint="They'll log in with this Gmail account">
          <Input
            type="email"
            required
            value={teacherEmail}
            onChange={(e) => setTeacherEmail(e.target.value)}
            placeholder="teacher.ukga@example.com"
          />
        </FieldGroup>

        <FieldGroup label="Teacher's name">
          <Input
            required
            value={teacherName}
            onChange={(e) => setTeacherName(e.target.value)}
            placeholder="Priya Kapoor"
          />
        </FieldGroup>

        <FieldGroup label="Class level">
          <div className="grid grid-cols-4 gap-2">
            {LEVELS.map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setLevel(lvl)}
                className={`h-11 rounded-xl text-xs font-bold transition active:scale-95 ${
                  level === lvl
                    ? "bg-edu-navy text-white shadow"
                    : "bg-white border border-border text-foreground hover:border-edu-navy"
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </FieldGroup>

        <FieldGroup label="Section" hint="Single letter — A, B, etc.">
          <Input
            required
            maxLength={2}
            value={section}
            onChange={(e) => setSection(e.target.value.toUpperCase())}
            placeholder="A"
            className="uppercase"
          />
        </FieldGroup>

        <div className="text-[11px] text-white/60 px-1">
          Students for this class are added separately via the existing
          principal-dashboard Students page — no dummy data is seeded here.
        </div>

        <Button type="submit" size="lg" className="w-full">
          <Sparkles className="w-4 h-4" />
          Create {level}-{section.toUpperCase()} + invite {teacherName || "teacher"}
        </Button>

        {errorMessage && <ErrorBanner message={errorMessage} />}
      </form>
    </Shell>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-edu-navy py-8 px-4">
      <div className="max-w-md mx-auto">{children}</div>
    </div>
  );
}

function ShellHeader({ title }: { title: string }) {
  return (
    <div className="text-center mb-6">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-white/10 flex items-center justify-center mb-3">
        <Sprout className="w-7 h-7 text-edu-green" />
      </div>
      <h1 className="text-2xl font-black text-white tracking-tight">
        Edullent · Pre-Primary
      </h1>
      <p className="text-xs text-white/60 mt-1">{title}</p>
    </div>
  );
}

function FieldGroup({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl p-4">
      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="text-[11px] text-muted-foreground mt-1.5">{hint}</p>}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 bg-edu-red/10 border border-edu-red/30 text-foreground text-xs rounded-xl p-3">
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-edu-red" />
      <span className="leading-relaxed">{message}</span>
    </div>
  );
}

// ── Firestore logic ────────────────────────────────────────────────────────

/**
 * Resolves whether the signed-in user is an owner or principal of a school.
 * Owner: uid matches `schools/{uid}` doc.
 * Principal: email matches a `principals` doc (where email is the lookup key).
 */
async function resolvePrincipal(user: User): Promise<PrincipalContext | null> {
  const email = user.email!.toLowerCase();

  // 1. Try owner — owner's uid IS the schoolId (firestore.rules convention)
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

  // 2. Try principal — match by email
  try {
    const principalSnap = await getDocs(
      query(collection(db, "principals"), where("email", "==", email))
    );
    if (!principalSnap.empty) {
      const principalDoc = principalSnap.docs[0];
      const data = principalDoc.data() as { schoolId?: string };
      const schoolId = data.schoolId;
      if (!schoolId) return null;

      // Fetch school name for display
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

/**
 * Atomic bootstrap — single writeBatch for class + teacher + assignment.
 * Students are NOT seeded here — they're added by the principal via the
 * existing principal-dashboard Students page. If any write is rejected by
 * rules, the whole batch rolls back so we never leave the DB in a partial
 * state.
 */
async function bootstrapClass(args: BootstrapArgs) {
  const {
    principal,
    teacherEmail,
    teacherName,
    className,
    section,
    level,
  } = args;

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
    level,                       // pre-primary marker
    stage: "pre_primary",        // explicit stage for future variant rendering
    classTeacherEmail: teacherEmail,
    classTeacherName: teacherName,
    teacherEmail,                 // legacy compat
    teacherName,                  // legacy compat
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
  // via AuthContext. Use email-based deterministic id for idempotency
  // (re-running setup with same email updates, doesn't duplicate).
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

  // No student seeding — principal adds students via principal-dashboard's
  // existing Students page so the data is real, not dummy.

  await batch.commit();
  toast.success(`${className} created · ${teacherName} invited 🎉`);
}

function currentAcademicYear(): string {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  const year = now.getFullYear();
  // Indian academic year usually April-March
  if (month >= 3) {
    return `${year}-${(year + 1).toString().slice(-2)}`;
  }
  return `${year - 1}-${year.toString().slice(-2)}`;
}
