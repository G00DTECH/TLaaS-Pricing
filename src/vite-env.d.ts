/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_REP_PASSPHRASE?: string;
  // Firebase web config (public — secured by rules + App Check, not secrecy)
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  // App Check (reCAPTCHA v3) site key — optional but recommended
  readonly VITE_RECAPTCHA_SITE_KEY?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
