/**
 * Firebase initialization for lead capture.
 *
 * The web config below is NOT secret — the apiKey is a public project
 * identifier, safe to ship in the bundle. Firestore is secured by security
 * rules + App Check, not by hiding this config. Values come from env vars so
 * each environment (local / preview / prod) is configurable.
 *
 * Everything is lazy: nothing initializes until the first lead is submitted, so
 * the app runs fine (and this stays out of the critical path) when Firebase
 * isn't configured yet.
 */
import { initializeApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** True when the minimum config needed to talk to Firestore is present. */
export const firebaseEnabled = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);

let app: FirebaseApp | undefined;
let db: Firestore | undefined;

export function getDb(): Firestore {
  if (!firebaseEnabled) {
    throw new Error("Firebase is not configured — set the VITE_FIREBASE_* env vars.");
  }
  if (!app) {
    app = initializeApp(firebaseConfig);

    // App Check (reCAPTCHA v3) — recommended, stops bots spamming Firestore.
    // Optional: skipped cleanly if no site key is provided.
    const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
    if (siteKey) {
      try {
        initializeAppCheck(app, {
          provider: new ReCaptchaV3Provider(siteKey),
          isTokenAutoRefreshEnabled: true,
        });
      } catch (err) {
        // Non-fatal: leads still write if App Check enforcement isn't required.
        console.warn("Firebase App Check init failed:", err);
      }
    }

    db = getFirestore(app);
  }
  return db!;
}
