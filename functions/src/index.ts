/**
 * Edullent — Pre-Primary Teacher · Cloud Functions
 *
 * Single deploy target: `firebase deploy --only functions:preprimary`
 * Region: us-central1 (matches other Edullent dashboards).
 *
 * V1 functions:
 *   - autoPublishDailyReport  — scheduled 18:00 IST. For every pp_daily_activities
 *                                doc dated today with reportStatus="unpublished",
 *                                compiles a light-weight HTML summary, flips status
 *                                to "auto_published", and fans out FCM push to
 *                                enrolled parents.
 *   - onPickupMismatch        — Firestore trigger. When a pp_pickups doc gets a
 *                                "mismatch" record, sends a high-priority push to
 *                                the school's principal + parent.
 *
 * V2+:
 *   - Actual PDF generation (currently HTML only). Use Puppeteer/Chrome-aws-lambda.
 *   - FCM token resolution from parents collection.
 *   - Localized push content (English + Hindi).
 */
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

admin.initializeApp();
const db = admin.firestore();

const TIMEZONE = "Asia/Kolkata";

/** YYYY-MM-DD in IST. */
function todayInIST(): string {
  const now = new Date();
  // toLocaleDateString with "en-CA" → YYYY-MM-DD; timeZone forces IST.
  return now.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

/**
 * Scheduled: every day at 18:00 IST. Compiles a lite daily report HTML for
 * any pp_daily_activities doc still in `unpublished` state and pushes to
 * parents.
 */
export const autoPublishDailyReport = functions
  .region("us-central1")
  .pubsub.schedule("0 18 * * *")
  .timeZone(TIMEZONE)
  .onRun(async () => {
    const today = todayInIST();
    const snap = await db
      .collection("pp_daily_activities")
      .where("date", "==", today)
      .where("reportStatus", "==", "unpublished")
      .get();

    if (snap.empty) {
      console.log(`[autoPublishDailyReport] No unpublished docs for ${today}.`);
      return null;
    }

    const results = await Promise.allSettled(
      snap.docs.map(async (doc) => {
        const data = doc.data();
        const html = buildReportHTML(data);
        await doc.ref.set(
          {
            reportStatus: "auto_published",
            reportHtml: html,
            publishedAt: admin.firestore.FieldValue.serverTimestamp(),
            autoPublishedAt: admin.firestore.FieldValue.serverTimestamp(),
            _lastModifiedBy: "system:autoPublishDailyReport",
            _lastModifiedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        // Fan out push to enrolled parents — V2 wires real FCM tokens.
        await sendPushToClassParents(data.schoolId, data.classId, {
          title: "Today's report is ready 🌱",
          body: `${data.classId} · ${countCompleted(data.slots)} activities, see what your child did today.`,
          deepLink: `edullent://pre-primary-parent/today/${data.classId}/${today}`,
        });
      })
    );

    const failed = results.filter((r) => r.status === "rejected").length;
    console.log(
      `[autoPublishDailyReport] ${snap.size - failed}/${snap.size} published. ${failed} failed.`
    );
    return null;
  });

/**
 * Firestore trigger: when pp_pickups doc changes, check for newly added
 * "mismatch" records and escalate.
 */
export const onPickupMismatch = functions
  .region("us-central1")
  .firestore.document("pp_pickups/{docId}")
  .onWrite(async (change) => {
    const after = change.after.exists ? change.after.data() : null;
    const before = change.before.exists ? change.before.data() : null;
    if (!after) return null;

    const afterRecords = (after.records as Record<string, any>) || {};
    const beforeRecords = (before?.records as Record<string, any>) || {};

    const newMismatches = Object.entries(afterRecords).filter(
      ([studentId, rec]: [string, any]) =>
        rec.status === "mismatch" && beforeRecords[studentId]?.status !== "mismatch"
    );

    if (newMismatches.length === 0) return null;

    await Promise.allSettled(
      newMismatches.map(async ([studentId, rec]: [string, any]) => {
        console.warn(
          `[onPickupMismatch] ESCALATING ${studentId} (${rec.studentName}) at school=${after.schoolId}`
        );
        // Send to principal + owner + parent
        await sendCriticalEscalation(after.schoolId, after.classId, studentId, rec);
      })
    );

    return null;
  });

// ── Helpers ──────────────────────────────────────────────────────────────

function countCompleted(slots: any[] = []): number {
  return slots.filter((s) => s.status === "done").length;
}

function buildReportHTML(data: any): string {
  const slots: any[] = data.slots || [];
  const completed = slots.filter((s) => s.status === "done");
  const slotHTML = completed
    .map(
      (s) => `
      <div style="margin: 16px 0; padding: 12px; border-radius: 12px; background: #F5F6F9;">
        <div style="font-weight: 700; color: #1e3272; font-size: 14px;">${escapeHTML(
          s.title
        )}</div>
        <div style="color: #5070B0; font-size: 11px; margin-top: 2px;">${escapeHTML(
          s.plannedStart
        )}</div>
        ${
          s.note
            ? `<p style="font-style: italic; color: #42475A; font-size: 13px; margin: 8px 0 0;">"${escapeHTML(
                s.note
              )}"</p>`
            : ""
        }
        ${
          s.highlightedKids?.length
            ? `<div style="margin-top: 6px; font-size: 11px; color: #F59E0B; font-weight: 700;">⭐ ${(
                s.highlightedKids as string[]
              )
                .map(escapeHTML)
                .join(", ")}</div>`
            : ""
        }
      </div>`
    )
    .join("");

  return `
<!doctype html>
<html>
<head><meta charset="utf-8"><title>Today's Report</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; max-width: 600px; margin: auto; padding: 24px; background: white;">
  <div style="background: linear-gradient(135deg, #000A33 0%, #1e3272 100%); color: white; padding: 24px; border-radius: 16px;">
    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.7;">Edullent · Pre-Primary</div>
    <h1 style="margin: 4px 0 0; font-size: 24px;">Today's Report</h1>
    <p style="margin: 8px 0 0; font-size: 13px; opacity: 0.85;">${escapeHTML(data.date)} · ${escapeHTML(
    data.classId || ""
  )}</p>
  </div>
  <div style="padding: 16px 0;">${slotHTML || "<p>No activities logged today.</p>"}</div>
  <p style="text-align: center; font-size: 10px; color: #99AACC; margin-top: 32px;">
    Auto-published by Edullent · Pre-Primary at 6 PM IST.
  </p>
</body>
</html>`.trim();
}

function escapeHTML(s: string): string {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as Record<
        string,
        string
      >)[c]
  );
}

async function sendPushToClassParents(
  _schoolId: string,
  _classId: string,
  _payload: { title: string; body: string; deepLink?: string }
) {
  // V2: Resolve parent FCM tokens via:
  //   1. enrollments where schoolId=? AND classId=?
  //   2. For each studentId → students/{studentId} → parentIds
  //   3. For each parentId → parent_fcm_tokens/{parentId} → tokens[]
  //   4. admin.messaging().sendMulticast({ tokens, notification, data })
  console.log("[sendPushToClassParents] stub", { _schoolId, _classId });
}

async function sendCriticalEscalation(
  schoolId: string,
  classId: string,
  studentId: string,
  rec: any
) {
  console.error("[ESCALATION]", { schoolId, classId, studentId, rec });
  // V2: Push to principal FCM tokens + log to incidents collection.
  // For now, write to a `pp_incidents` log so principal-dashboard can read it.
  await db.collection("pp_incidents").add({
    type: "pickup_mismatch",
    schoolId,
    classId,
    studentId,
    studentName: rec.studentName,
    triggeredAt: admin.firestore.FieldValue.serverTimestamp(),
    handled: false,
    severity: "critical",
  });
}
