# Edullent — Pre-Primary Teacher Dashboard

Mobile-first teacher dashboard for Playgroup, Nursery, LKG, UKG sections (ages 2–6).

Sibling project to `teacher-dashboard/` (K-12). Shares the same Firebase backend (`eduintellect-7e709`), the same `teachers` / `classes` / `enrollments` / `attendance` schema, and three new pre-primary-specific collections (`pp_daily_activities`, `pp_pickups`, `pp_incidents`).

A teacher is routed here based on `assignedClass` containing Playgroup / Nursery / LKG / UKG.

---

## 🚀 Quick start

```bash
cd pre-primary-teacher-dashboard
bun install        # or npm install
bun run dev        # opens at http://localhost:5174
```

Port 5174 — doesn't clash with `teacher-dashboard` (5173).

### Before first use

1. **Merge Firestore rules** from `PP_FIRESTORE_RULES.md` into the root `firestore.rules` and run `firebase deploy --only firestore:rules`. Without this, writes to `pp_daily_activities` / `pp_pickups` will be rejected.

2. **Invite a pre-primary teacher — proper flow is from `principal-dashboard`:**

   The `principal-dashboard` now ships a dedicated **Pre-Teachers** page (sidebar entry below "Teachers") that mirrors the existing K-12 Teachers invite UX:
   - Click "Add Teacher" → fill in name, email, class level (Playgroup/Nursery/LKG/UKG), section
   - Submit → atomic write of `classes` + `teachers` (status "Invited") + `teaching_assignments`
   - Invite email auto-sent via Resend with CTA pointing to this dashboard
   - Configure the email CTA URL with `VITE_PREPRIMARY_DASHBOARD_URL` env var in principal-dashboard's `.env`

   **Add students separately** via the existing principal-dashboard `Students` page — target them at the newly created pre-primary class. No dummy data is ever seeded.

   **Optional fallback `/setup` page:**

   If you can't access `principal-dashboard` for whatever reason, this dashboard still ships a `/setup` route that lets you sign in with your principal Google account and bootstrap a class + teacher (NO student seeding). Same result, fewer features. Visit `http://localhost:5174/setup`.

3. (Optional) Deploy the scheduled Cloud Function:
   ```bash
   cd functions
   bun install && bun run build
   bun run deploy
   ```

---

## ✅ Phase 1 + 2 — what's working now

### Real Firestore data, end-to-end

| Surface | Reads | Writes | Notes |
|---|---|---|---|
| Google Sign-In + stage gate | ✅ `teachers` collection | ✅ Auto-activate Invited → Active | Mirrors teacher-dashboard pattern |
| Class resolution | ✅ UNION: `teaching_assignments` + `classes.teacherId` | — | Same bug-fix pattern as MyClasses / MarkAttendance |
| Roster | ✅ `enrollments` + `students` merge | — | Allergies, medical, diet, comfort cues, authorized pickup |
| Attendance & Mood | ✅ `attendance/{studentId_classId_date}` | ✅ `auditedSet` with mood/arrivalTime fields | Pre-primary EXTENDS K-12 schema (backward-compatible) |
| Daily Activity Log | ✅ `pp_daily_activities/{date_classId}` | ✅ Slot updates, report publish | NEW collection |
| Pickup Verification | ✅ `pp_pickups/{date_classId}` | ✅ Verify + escalate mismatch | NEW collection — safety-critical |
| Home / Today | ✅ Live attendance/activities/pickup KPIs | — | Reactive snapshot |
| Cloud Function | ✅ `autoPublishDailyReport` (6 PM IST) + `onPickupMismatch` (real-time) | — | Deploy with `firebase deploy --only functions:preprimary` |

### Patterns inherited from teacher-dashboard

- **Multi-tenant queries:** Every Firestore read includes `where("schoolId", "==", teacherData.schoolId)` — security rules enforce.
- **Audited writes:** All client writes go through `auditedSet` / `auditedAdd` / `auditedUpdate` (`src/lib/auditedWrites.ts`) which inject `_lastModifiedBy` + `_lastModifiedAt`.
- **S2 class-teacher gate:** Daily attendance write surface blocked for subject teachers (only `classTeacherEmail` can mark) — mirrors teacher-dashboard.
- **Real-time `onSnapshot` listeners** everywhere (not polled queries).
- **Offline-tolerant by default:** Firebase 12 IndexedDB persistence + multi-tab manager — writes queue when offline, sync on reconnect.
- **Lazy routes + chunk-load retry** — survives stale deploys.
- **App Check (reCAPTCHA v3)** in production — set `VITE_RECAPTCHA_SITE_KEY` in `.env` for prod.

---

## 📂 Project structure

```
pre-primary-teacher-dashboard/
├── .env                       # Shared Firebase keys
├── .env.example
├── .gitignore
├── PP_FIRESTORE_RULES.md      # ⚠ Merge into root firestore.rules before use
├── README.md
├── components.json
├── eslint.config.js
├── functions/                 # Cloud Functions (deploy separately)
│   ├── package.json
│   ├── tsconfig.json
│   └── src/index.ts           # autoPublishDailyReport + onPickupMismatch
├── index.html
├── package.json
├── postcss.config.js
├── public/
├── tailwind.config.ts
├── tsconfig.{json,app,node}.json
├── vite.config.ts             # port 5174
└── src/
    ├── App.tsx
    ├── main.tsx
    ├── index.css
    ├── vite-env.d.ts
    ├── components/
    │   ├── ErrorBoundary.tsx
    │   ├── MobileBottomNav.tsx     # 5 tabs: Home Attend Day Class Pickup
    │   ├── OfflineBanner.tsx
    │   ├── PageLoader.tsx
    │   ├── PrePrimaryLayout.tsx
    │   ├── TopBar.tsx              # avatar tap → /profile
    │   └── ui/                     # button, card, input
    ├── hooks/                      # Phase 2 data layer
    │   ├── useTeacherClass.ts      # UNION pattern class resolution
    │   ├── useClassRoster.ts       # enrollments + students merge
    │   ├── useTodayAttendance.ts   # attendance reads + writes with mood
    │   ├── usePPDailyActivities.ts # daily activity log
    │   └── usePPPickups.ts         # pickup verification
    ├── lib/
    │   ├── AuthContext.tsx         # Google sign-in + stage gate
    │   ├── auditedWrites.ts        # _lastModifiedBy injection
    │   ├── dates.ts                # todayISO, deterministic doc IDs
    │   ├── firebase.ts
    │   └── utils.ts
    └── pages/
        ├── Attendance.tsx          # ✅ real
        ├── DailyActivities.tsx     # ⭐ ✅ real
        ├── Home.tsx                # ✅ real (live KPIs)
        ├── Login.tsx
        ├── NotFound.tsx
        ├── PickupVerification.tsx  # ⭐ ✅ real (new in Phase 2)
        ├── Profile.tsx
        └── Roster.tsx              # ✅ real
```

---

## 🗄️ Firestore data model

### Existing collections (shared with teacher-dashboard)

- `teachers/{id}` — has `schoolId`, `email`, `name`, `assignedClass`, `status` ("Invited" | "Active"), `isPrimarySchool`
- `classes/{id}` — has `schoolId`, `teacherId`, `classTeacherEmail`, `name`, `section`
- `teaching_assignments/{id}` — has `schoolId`, `teacherId`, `classId`, `status`
- `enrollments/{id}` — has `schoolId`, `classId`, `studentId`, `studentName`, `studentEmail`, `rollNo`
- `students/{id}` — has `schoolId`, `photoURL`, `allergies`, `medical`, `bloodGroup`, `diet`, `comfortCue`, `parentName`, `parentPhone`, `ageMonths`, `authorizedPickup`
- `attendance/{studentId_classId_date}` — pre-primary EXTENDS this with optional `mood`, `arrivalTime` fields. Existing K-12 docs unaffected.

### New collections (this dashboard introduces)

- `pp_daily_activities/{date_classId}` — slots array, themeOfWeek, reportStatus, reportHtml, publishedAt
- `pp_pickups/{date_classId}` — records map keyed by studentId
- `pp_incidents/{auto-id}` — append-only escalation log (server-written only)

See `PP_FIRESTORE_RULES.md` for the security rules.

---

## 🎯 Phase 3 — what's left

| Feature | Status | Priority |
|---|---|---|
| **Photo / Video Studio** with face-detect + consent matrix | Stub button only | High — wedge feature |
| **Voice-first input** across all text fields | Stub (toast message) | High — teachers don't type |
| **Meals & Nap Tracker** with allergen flash | Not built | High |
| **Diaper / Washroom Log** (age-toggled) | Not built | Medium |
| **Milestones & Observations** (NEP 2020 5 domains) | Not built | Medium |
| **Behavior Notes** with visibility tiers | Not built | Medium |
| **Messages** (parent chat, voice-first) | Not built | Medium |
| **Calendar** + theme of the week | Not built | Low |
| **Timetable** + Didi assistant overlap | Not built | Low |
| Hindi / regional i18n | English only | Medium |
| PWA splash + manifest + icons | Not built | Low |
| Vitest tests | Not configured | Medium |
| Real FCM push fan-out in Cloud Function | Stub (console log) | High once parents are on platform |
| Actual PDF generation for daily report | HTML only | Medium |

---

## 🧪 Testing manually

```bash
bun run dev   # http://localhost:5174
```

1. Sign in with a Google account whose `teachers` doc has `assignedClass` containing "Playgroup" / "Nursery" / "LKG" / "UKG".
2. **Attendance:** tap any child card → marked present + mood sheet pops up → pick mood → check Firestore `attendance/` for the doc with `mood` field.
3. **Daily Activities:** tap any slot → write note → "Mark Done" → check `pp_daily_activities/{today}_{classId}` in Firestore.
4. **Roster:** tap any child → bottom sheet shows allergies, medical alerts, authorized pickup persons.
5. **Pickup:** tap any child → bottom sheet shows authorized pickup grid → tap a person → record written to `pp_pickups/{today}_{classId}`.
6. **Home:** all KPI tiles should reflect live data from the above actions.

### If you see "Missing or insufficient permissions"

The `pp_*` collection rules haven't been merged into root `firestore.rules` yet. See `PP_FIRESTORE_RULES.md`.

### If the auth gate rejects you

Open `src/lib/AuthContext.tsx`, find the `isPrePrimaryClass(...)` check, and either:
- Update your `teachers` doc's `assignedClass` to "UKG-A" or similar pre-primary value, OR
- Temporarily comment out the stage gate for a quick smoke test (re-enable before prod).

---

## 🔒 Security note

`.env` contains real Firebase web API keys. These are designed to be public (security is enforced by Firestore/Storage rules, not the key), but the file is `.gitignore`d. Cloud Functions use Admin SDK and bypass rules — make sure no untrusted code paths invoke them.

---

## 📝 Architecture deviations from earlier session

Two product-locked decisions were corrected based on the actual Edullent codebase:

1. **One-app-with-variants → separate-folder-per-persona.** Earlier session locked a unified app architecture; the actual codebase has 7 separate dashboards. This project follows the established pattern. See memory file `project_app_architecture.md`.

2. **Pre-primary student dashboard → enhanced parent surface.** Confirmed 2026-05-21: at 2–6 years old, the child is never the app user. Only the parent app monitors. This dashboard is for the teacher / Didi. See memory file `project_pre_primary.md`.

---

Built across two phases on 2026-05-21:
- **Phase 1:** Scaffold + auth + 5 pages with mock data
- **Phase 2:** Real Firestore reads/writes + Pickup Verification + Cloud Functions

Iterate from here.
