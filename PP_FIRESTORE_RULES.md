# Pre-Primary — Firestore rules to add to root `firestore.rules`

The pre-primary dashboard writes to **3 new top-level collections** that don't have rules in the shared root `firestore.rules`. By default-deny, writes from this dashboard will be rejected until you merge these snippets in.

**Do NOT replace the root `firestore.rules`** — open it, find a logical spot (after the `attendance` block is a good fit), and paste these `match` blocks alongside the existing ones.

After merging, deploy with:

```bash
firebase deploy --only firestore:rules
```

---

## Collection 1: `pp_daily_activities`

Per-class-per-day doc storing the day's slot timeline, photos, and report status.

```firestore-rules
// ─── PRE-PRIMARY · DAILY ACTIVITIES ───────────────────────────────────────
match /pp_daily_activities/{docId} {
  // Read: any signed-in user in the same school. Parents (when they exist
  // on the platform) will read for daily-report consumption.
  allow get, list: if signedIn() && inSameSchool();

  // Create: staff in same school. New doc must carry schoolId.
  allow create: if signedIn()
                && hasSchoolId()
                && writingToOwnSchool()
                && hasStaffRole();

  // Update: staff in same school, schoolId immutable. Server-side
  // autoPublishDailyReport function uses Admin SDK and bypasses rules.
  allow update: if signedIn()
                && schoolIdImmutable()
                && hasStaffRole()
                && resource.data.schoolId == claimSchoolId();

  allow delete: if hasAdminRole()
                && resource.data.schoolId == claimSchoolId();
}
```

## Collection 2: `pp_pickups`

Per-class-per-day doc storing pickup verification records (safety-critical).

```firestore-rules
// ─── PRE-PRIMARY · PICKUP VERIFICATION ────────────────────────────────────
match /pp_pickups/{docId} {
  // Read: signed-in users in same school. Parents read to confirm pickup.
  allow get, list: if signedIn() && inSameSchool();

  // Create: staff in same school.
  allow create: if signedIn()
                && hasSchoolId()
                && writingToOwnSchool()
                && hasStaffRole();

  // Update: staff in same school, schoolId immutable.
  // Mismatch override (principal-only) lives at the application layer —
  // rules just enforce tenant + role.
  allow update: if signedIn()
                && schoolIdImmutable()
                && hasStaffRole()
                && resource.data.schoolId == claimSchoolId();

  allow delete: if hasAdminRole()
                && resource.data.schoolId == claimSchoolId();
}
```

## Collection 3: `pp_class_levels`

Per-school configurable class level labels (Playgroup, Nursery, LKG, UKG, + custom). Seeded automatically on first principal visit to the Pre-Teachers page. Soft-deletable.

```firestore-rules
// ─── PRE-PRIMARY · CLASS LEVELS (per-school config) ───────────────────────
match /pp_class_levels/{docId} {
  // Read: any signed-in user in the same school. The PreTeachers page,
  // future pre-primary parent dashboard, and teacher dashboard all read this.
  allow get, list: if signedIn() && inSameSchool();

  // Create + Update: admin only (owner / principal) of the target school.
  // Default seeding uses deterministic doc IDs ({schoolId}_playgroup etc.)
  // so concurrent first-loads from multiple principal sessions safely
  // overwrite with identical data.
  allow create: if signedIn()
                && hasSchoolId()
                && writingToOwnSchool()
                && hasAdminRole();

  allow update: if signedIn()
                && schoolIdImmutable()
                && hasAdminRole()
                && resource.data.schoolId == claimSchoolId();

  // No hard deletes — soft-delete via `active: false` on update.
  allow delete: if false;
}
```

## Collection 4: `pp_incidents`

Incident log written by the `onPickupMismatch` Cloud Function. Read by principal-dashboard.

```firestore-rules
// ─── PRE-PRIMARY · INCIDENTS LOG (append-only) ────────────────────────────
match /pp_incidents/{docId} {
  // Read: admins (owner / principal) of same school.
  allow get, list: if signedIn()
                   && hasAdminRole()
                   && resource.data.schoolId == claimSchoolId();

  // Create: server-side only (Admin SDK in Cloud Functions). Client writes
  // denied — incidents must come from validated Firestore triggers.
  allow create: if false;

  // Update: admin can flip `handled: true` after responding.
  allow update: if signedIn()
                && hasAdminRole()
                && schoolIdImmutable()
                && resource.data.schoolId == claimSchoolId();

  allow delete: if false; // append-only
}
```

---

## Storage rules (for Phase 3 photo studio)

When you wire up the Photo / Video Studio, add this to `storage.rules`:

```firestore-rules
// pre-primary class media — class-scoped, staff write, same-school read
match /b/{bucket}/o {
  match /pp_media/{schoolId}/{classId}/{allPaths=**} {
    allow read: if request.auth != null
                && request.auth.token.schoolId == schoolId;
    allow write: if request.auth != null
                 && request.auth.token.schoolId == schoolId
                 && request.auth.token.role in ['teacher', 'assistant', 'principal', 'owner']
                 && request.resource.size < 50 * 1024 * 1024
                 && request.resource.contentType.matches('image/.*|video/.*');
  }
}
```

---

## Verification after deployment

1. Sign in to pre-primary dashboard as a teacher.
2. Mark one student present → check Firestore console: `attendance/{studentId}_{classId}_{date}` should appear with `mood` field.
3. Complete one slot on Daily Activities → check `pp_daily_activities/{date}_{classId}`.
4. Verify a pickup → check `pp_pickups/{date}_{classId}`.
5. If any write fails with "Missing or insufficient permissions", the rules merge isn't deployed yet.
