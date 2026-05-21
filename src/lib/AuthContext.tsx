import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  type User,
} from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { isPrePrimaryClass } from "./utils";

// Shape of a teacher document, mirroring teacher-dashboard's TeacherDoc.
// Pre-primary teachers are stored in the same `teachers` collection —
// distinguished by `assignedClass` containing Playgroup/Nursery/LKG/UKG.
export interface TeacherDoc {
  id: string;
  schoolId?: string;
  branchId?: string;
  email?: string;
  name?: string;
  displayName?: string;
  phone?: string;
  schoolName?: string;
  branch?: string;
  className?: string;
  assignedClass?: string;
  subject?: string;
  status?: string;
  isActive?: boolean;
  isPrimarySchool?: boolean;
  activatedAt?: Timestamp;
  createdAt?: Timestamp;
  lastLoginAt?: Timestamp;
  notifications?: Record<string, unknown>;
  preferences?: Record<string, unknown>;
  [key: string]: unknown;
}

interface AuthContextType {
  user: User | null;
  teacherData: TeacherDoc | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Skip `lastLoginAt` write if updated less than this many ms ago — avoids
// redundant Firestore writes on tab focus / token refresh.
const LAST_LOGIN_DEBOUNCE_MS = 5 * 60 * 1000;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [teacherData, setTeacherData] = useState<TeacherDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    let snapshotUnsub: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (snapshotUnsub) {
        snapshotUnsub();
        snapshotUnsub = null;
      }

      if (isInitialLoad.current) setLoading(true);

      if (currentUser && currentUser.email) {
        try {
          const email = currentUser.email.toLowerCase();
          // V1: skip claims-sync Cloud Function; query teachers directly by email.
          // Future: mirror teacher-dashboard pattern with syncClaimsAndRefreshToken
          // for multi-school edge cases.
          const q = query(collection(db, "teachers"), where("email", "==", email));
          const snap = await getDocs(q);

          if (snap.empty) {
            await signOut(auth);
            setUser(null);
            setTeacherData(null);
            setError(
              "You are not authorized to access the Pre-Primary Teacher Dashboard. Please contact your school principal."
            );
            setLoading(false);
            return;
          }

          // Pick the best teacher doc when an email appears in multiple schools.
          // Priority: isPrimarySchool > status (Active > Invited) > most recent.
          const sortedDocs = [...snap.docs].sort((a, b) => {
            const aD = a.data();
            const bD = b.data();
            const primary =
              Number(!!bD.isPrimarySchool) - Number(!!aD.isPrimarySchool);
            if (primary !== 0) return primary;
            const score = (d: Record<string, unknown>) => {
              const status = String(d.status ?? "").toLowerCase();
              if (status === "active") return 2;
              if (status === "invited") return 1;
              return 0;
            };
            const diff = score(bD) - score(aD);
            if (diff !== 0) return diff;
            const aTime =
              (aD.activatedAt as Timestamp | undefined)?.toMillis?.() ??
              (aD.createdAt as Timestamp | undefined)?.toMillis?.() ??
              0;
            const bTime =
              (bD.activatedAt as Timestamp | undefined)?.toMillis?.() ??
              (bD.createdAt as Timestamp | undefined)?.toMillis?.() ??
              0;
            return bTime - aTime;
          });
          const teacherDoc = sortedDocs[0];
          const teacherInfo = teacherDoc.data();

          // STAGE GATE: pre-primary dashboard only allows teachers whose
          // assignedClass contains Playgroup/Nursery/LKG/UKG. K-12 teachers
          // are redirected to the regular teacher-dashboard.
          if (!isPrePrimaryClass(teacherInfo.assignedClass as string | undefined)) {
            await signOut(auth);
            setUser(null);
            setTeacherData(null);
            setError(
              "This dashboard is for Pre-Primary teachers only (Playgroup, Nursery, LKG, UKG). " +
                "Please use the K-12 Teacher Dashboard for your class."
            );
            setLoading(false);
            return;
          }

          // Auto-activate Invited → Active; debounced lastLoginAt write.
          const statusLower = String(teacherInfo.status ?? "").toLowerCase();
          if (statusLower === "invited") {
            updateDoc(doc(db, "teachers", teacherDoc.id), {
              status: "Active",
              isActive: true,
              activatedAt: serverTimestamp(),
              lastLoginAt: serverTimestamp(),
            }).catch((e) => console.error("[Auth] activate failed", e));
          } else {
            const lastLoginMs =
              (teacherInfo.lastLoginAt as Timestamp | undefined)?.toMillis?.() ?? 0;
            if (Date.now() - lastLoginMs > LAST_LOGIN_DEBOUNCE_MS) {
              updateDoc(doc(db, "teachers", teacherDoc.id), {
                lastLoginAt: serverTimestamp(),
              }).catch((e) => console.error("[Auth] lastLoginAt failed", e));
            }
          }

          // Real-time listener on the specific doc — covers in-flight edits
          // like principal updating the teacher's assignedClass.
          snapshotUnsub = onSnapshot(doc(db, "teachers", teacherDoc.id), (docSnap) => {
            if (docSnap.exists()) {
              setTeacherData({ id: docSnap.id, ...docSnap.data() } as TeacherDoc);
              setUser(currentUser);
              setError(null);
            } else {
              signOut(auth);
              setUser(null);
              setTeacherData(null);
              setError(
                "Your account has been deactivated. Please contact your school principal."
              );
            }
            setLoading(false);
            isInitialLoad.current = false;
          });
        } catch (err: unknown) {
          console.error("Auth Error:", err);
          setError("An error occurred during verification. Please try again.");
          setLoading(false);
          isInitialLoad.current = false;
        }
      } else {
        setUser(null);
        setTeacherData(null);
        setLoading(false);
        isInitialLoad.current = false;
      }
    });

    return () => {
      unsubscribe();
      if (snapshotUnsub) snapshotUnsub();
    };
  }, []);

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      setError(null);
      await signInWithPopup(auth, provider);
    } catch (err: unknown) {
      const code = (err as { code?: string } | null)?.code;
      const userCancelled =
        code === "auth/popup-closed-by-user" ||
        code === "auth/cancelled-popup-request" ||
        code === "auth/popup-blocked";
      if (!userCancelled) {
        const message =
          err instanceof Error ? err.message : "Sign-in failed. Please try again.";
        setError(message);
      }
      throw err;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (err: unknown) {
      console.error("[Auth] logout failed", err);
      setError("Could not sign out. Please try again.");
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, teacherData, loading, loginWithGoogle, logout, error }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
