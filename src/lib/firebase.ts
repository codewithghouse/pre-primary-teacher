import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

// Fail fast at module load if required config is missing — easier to debug
// than waiting for cryptic downstream errors from initializeApp accepting
// undefined fields.
const requiredEnv = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
] as const;
const missing = requiredEnv.filter((k) => !import.meta.env[k]);
if (missing.length > 0) {
  throw new Error(
    `[firebase] Missing required env vars: ${missing.join(", ")}. ` +
      `Check your .env file or deployment environment.`
  );
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

if (typeof window !== "undefined") {
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  if (siteKey) {
    try {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(siteKey),
        isTokenAutoRefreshEnabled: true,
      });
    } catch (err) {
      console.warn("[AppCheck] init failed:", err);
    }
  } else if (import.meta.env.PROD) {
    console.error(
      "[AppCheck] VITE_RECAPTCHA_SITE_KEY is not set in production. " +
        "Backend calls may be unprotected or rejected."
    );
  }
}

export const auth = getAuth(app);

// Multi-tab IndexedDB persistence — matches teacher-dashboard pattern.
// Critical for offline attendance / activity log writes when network drops
// mid-class. Multi-tab manager keeps reads in sync if the teacher opens the
// dashboard in two tabs.
//
// ignoreUndefinedProperties=true — strips undefined values from writes
// (instead of throwing). This matters for entries like
// `{ note: args.note?.trim() || undefined }` in pp_diaper_logs /
// pp_meals_naps — without this flag, the entire setDoc() rejects with
// "Unsupported field value: undefined" and the user sees
// "Could not save". With it set, undefined keys are simply omitted from
// the written doc, which is the intended behaviour for optional fields.
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

export const storage = getStorage(app);
export const functions = getFunctions(app);

export default app;
