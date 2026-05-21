/**
 * syncClaims.ts — ported from teacher-dashboard.
 *
 * Calls the `syncUserClaimsV2` Cloud Function to populate Firebase custom
 * claims ({ schoolId, role, branchId }) on the user's ID token, then
 * force-refreshes the token so Firestore security rules see the new claims.
 *
 * WHY: Without this, the user's Firebase token has no `schoolId` claim, so
 * Firestore rules that gate reads on `inSameSchool()` (e.g. the `teachers`
 * collection list rule) reject the query — the AuthContext then throws
 * "An error occurred during verification" and the user can never log in.
 */
import { httpsCallable } from "firebase/functions";
import type { User } from "firebase/auth";
import { functions } from "./firebase";

type SyncClaimsResult = {
  role: string;
  schoolId: string | null;
  branchId?: string | null;
};

export async function syncClaimsAndRefreshToken(
  user: User
): Promise<SyncClaimsResult | null> {
  try {
    // Migrated 2026-05-18 to syncUserClaimsV2 — legacy function stuck on
    // deleted India SA. Keep this in sync with teacher-dashboard / parent-
    // dashboard so all clients share the same callable.
    const call = httpsCallable<unknown, SyncClaimsResult>(
      functions,
      "syncUserClaimsV2"
    );
    const res = await call({});
    // Force-refresh the ID token so the freshly-set claims are visible to
    // Firestore rules on the very next read. Without this, rules see the
    // old (claim-less) token.
    await user.getIdToken(true);
    return res.data ?? null;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[syncClaims] failed:", message);
    return null;
  }
}
