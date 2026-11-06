// firebase-config.js
// ─────────────────────────────────────────────────────────────────────────────
// Your Firebase project configuration.
// NEVER commit this file to a public repository if it contains real keys.
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp }    from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore }     from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getAuth }          from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  initializeAppCheck,
  ReCaptchaV3Provider
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-check.js';

// ── Firebase project config ───────────────────────────────────────────────────
export const firebaseConfig = {
  apiKey:            "AIzaSyAroEU363MfjX3yocRCJNbJAAUmWlC7pfs",
  authDomain:        "jonaki-pothe.firebaseapp.com",
  projectId:         "jonaki-pothe",
  storageBucket:     "jonaki-pothe.firebasestorage.app",
  messagingSenderId: "784986886626",
  appId:             "1:784986886626:web:359eb88384743ae51d69bb",
  measurementId:     "G-EPQQRKJE5Y"   // optional — Analytics
};

// ── App Check (reCAPTCHA v3) — OPTIONAL ──────────────────────────────────────
// Leave this empty string to skip App Check (fine during development).
// To enable later:
//   1. Go to console.google.com/recaptcha → register your site (v3) → copy Site Key.
//   2. Paste it below.
//   3. In Firebase Console → search "App Check" → register your web app → paste the same key.
//   4. Click "Enforce" next to Firestore when you are ready for production.
export const RECAPTCHA_SITE_KEY = "";   // ← paste your reCAPTCHA v3 site key here when ready

const app = initializeApp(firebaseConfig);

// App Check is initialised only when a key is provided, so the site works fine
// without one during development or before you register with reCAPTCHA.
export let appCheck = null;
if (RECAPTCHA_SITE_KEY) {
  try {
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(RECAPTCHA_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    console.warn('[App Check] Could not initialise:', err.message);
  }
}

export const db   = getFirestore(app);
export const auth = getAuth(app);
export default app;
