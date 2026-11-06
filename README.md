# Jonaki Pothe — Setup Guide

> **জোনাকি পথে** (Jonaki Pothe) means *"Path of the Firefly"* in Bengali — a community-driven safety-reporting web app that lets users map hazards, confirm danger spots, trigger SOS alerts, and find safe routes in their neighbourhood.

---

## About

Jonaki Pothe is a, progressive web application (PWA) that empowers communities — especially women and vulnerable road users — to collaboratively map safety hazards in real time. Users can:

- **Report** hazards (dark streets, stray dogs, waterlogging, isolated areas, broken roads) on an interactive map.
- **Confirm** existing reports to increase their credibility score.
- **Flag** inappropriate content for admin review.
- **Trigger SOS** alerts that notify pre-saved emergency contacts.
- **Browse safe spots** curated by administrators.
- Filter and explore reports by category, time of day, and severity.

All data is stored in **Firebase Firestore** with strict server-side security rules, served via **Firebase Hosting**, and protected with **Firebase App Check** (reCAPTCHA v3).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML5, CSS3, JavaScript (ES Modules) |
| Map | [Leaflet.js](https://leafletjs.com/) + OpenStreetMap tiles |
| Backend / DB | [Firebase Firestore](https://firebase.google.com/docs/firestore) (NoSQL) |
| Auth | [Firebase Authentication](https://firebase.google.com/docs/auth) — Google Sign-In |
| Hosting | [Firebase Hosting](https://firebase.google.com/docs/hosting) |
| Bot Protection | [Firebase App Check](https://firebase.google.com/docs/app-check) + reCAPTCHA v3 |
| Fonts | Google Fonts — Poppins |
| Icons | Unicode emoji + custom SVG markers |

---

## Project Structure

```
jonaki_pothe/
├── firebase.json              # Firebase Hosting & Firestore config
├── firestore.rules            # Firestore security rules (deployed separately)
├── firestore.indexes.json     # Composite index definitions
├── .gitignore                 # Excludes secrets, build output, OS files
├── README.md                  # This file
│
└── public/                    # Everything served by Firebase Hosting
    ├── index.html             # Landing page / home
    ├── login.html             # Google Sign-In page
    ├── map.html               # Interactive hazard map (Leaflet)
    ├── report.html            # Submit a new hazard report
    ├── profile.html           # User profile, contacts, SOS history
    ├── admin.html             # Admin dashboard (approve/reject reports)
    ├── seed.html              # One-time data seeder (admin only)
    ├── 404.html               # Custom not-found page
    │
    ├── css/
    │   ├── global.css         # Reset, variables, typography
    │   ├── map.css            # Map-specific overrides
    │   ├── report.css         # Report form styles
    │   └── admin.css          # Admin panel styles
    │
    └── js/
        ├── firebase-config.js # Firebase + App Check initialisation (edit this!)
        ├── auth.js            # Auth helpers, sign-in/sign-out, role checks
        ├── map.js             # Leaflet map, marker rendering, filter logic
        ├── report.js          # Report form submit, geolocation, reverse geocode
        ├── profile.js         # Profile page logic, contacts CRUD, SOS history
        ├── admin.js           # Admin dashboard: approve/reject, flagged queue
        └── seed.js            # Sample data seeder (called from seed.html)
```

---

## Step-by-Step Setup

### 1. Prerequisites

Make sure you have the following installed before you begin:

- **Node.js 18+** — [https://nodejs.org](https://nodejs.org)
- **Firebase CLI** — install globally:

```bash
npm install -g firebase-tools
```

Verify installation:

```bash
firebase --version   # should print 13.x or later
node --version       # should print v18.x or later
```

---

### 2. Create a Firebase Project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com).
2. Click **"Add project"**.
3. Enter a project name (e.g., `jonaki-pothe`). The project ID will be auto-generated — note it down.
4. Disable Google Analytics if you don't need it, or enable it for usage insights.
5. Click **"Create project"** and wait for provisioning.

> **Billing:** The free **Spark** plan is sufficient for development and small-scale use. For production or if you use Cloud Functions, upgrade to the **Blaze (pay-as-you-go)** plan. Firestore security rules deployment requires at minimum the Spark plan.

---

### 3. Enable Firebase Services

#### 3a. Authentication

1. In the Firebase Console, go to **Build → Authentication**.
2. Click **"Get started"**.
3. Under the **Sign-in method** tab, click **Google** → toggle **Enable** → set your project support email → **Save**.
4. Under **Settings → Authorized domains**, verify that `localhost` and `YOUR_PROJECT_ID.web.app` are listed. Add your custom domain if applicable.

#### 3b. Firestore Database

1. Go to **Build → Firestore Database**.
2. Click **"Create database"**.
3. Select **"Start in production mode"** (we deploy our own rules via CLI).
4. Choose your database region — for Indian users, select **`asia-south1` (Mumbai)** for lowest latency.
5. Click **"Enable"** and wait for the database to provision.

#### 3c. Firebase Hosting

1. Go to **Build → Hosting**.
2. Click **"Get started"** and follow the wizard (you'll deploy via CLI later, so the wizard steps are just for registration).
3. Note your default hosting URL: `https://YOUR_PROJECT_ID.web.app`.

---

### 4. Get Your Firebase Config

1. In the Firebase Console, click the **gear icon ⚙** → **Project settings**.
2. Scroll down to **"Your apps"** section.
3. Click the **"</>"** (Web) icon to register a new web app.
4. Enter an app nickname (e.g., `Jonaki Pothe Web`) and check **"Also set up Firebase Hosting for this app"**.
5. Click **"Register app"**.
6. Copy the `firebaseConfig` object — it will look like:

```javascript
const firebaseConfig = {
  apiKey:            "AIzaSy...",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "123456789012",
  appId:             "1:123456789012:web:abcdef1234567890",
  measurementId:     "G-XXXXXXXXXX"   // optional, only if Analytics enabled
};
```

---

### 5. Add Config to Code

Open [`public/js/firebase-config.js`](public/js/firebase-config.js) and paste the values from Step 4 into the appropriate constants. The file contains clearly labelled placeholders:

```javascript
// public/js/firebase-config.js
const FIREBASE_CONFIG = {
  apiKey:            "PASTE_YOUR_API_KEY_HERE",
  authDomain:        "PASTE_YOUR_AUTH_DOMAIN_HERE",
  projectId:         "PASTE_YOUR_PROJECT_ID_HERE",
  storageBucket:     "PASTE_YOUR_STORAGE_BUCKET_HERE",
  messagingSenderId: "PASTE_YOUR_MESSAGING_SENDER_ID_HERE",
  appId:             "PASTE_YOUR_APP_ID_HERE"
};

const RECAPTCHA_SITE_KEY = "PASTE_YOUR_RECAPTCHA_V3_SITE_KEY_HERE";
```

> **Never commit this file with real values to a public repository.** Add `public/js/firebase-config.js` to `.gitignore` if your repo is public, and use a CI/CD secret injection step instead.

---

### 6. Set Up reCAPTCHA v3 and App Check

App Check acts as a firewall — it ensures only your legitimate web app (not bots or scrapers) can access your Firestore database.

#### 6a. Register your site with reCAPTCHA v3

1. Go to [https://www.google.com/recaptcha/admin](https://www.google.com/recaptcha/admin).
2. Click the **"+"** button to register a new site.
3. Enter a label (e.g., `Jonaki Pothe`).
4. Select **reCAPTCHA v3** as the type.
5. Under **Domains**, add:
   - `localhost` (for local development)
   - `YOUR_PROJECT_ID.web.app` (Firebase Hosting)
   - `YOUR_PROJECT_ID.firebaseapp.com`
   - Your custom domain, if applicable.
6. Accept the terms and click **Submit**.
7. Copy the **Site Key** (the Secret Key stays server-side — do not use it in client code).

#### 6b. Register App Check in Firebase Console

1. In Firebase Console, go to **Build → App Check**.
2. Click **"Get started"**.
3. Under **Apps**, select your web app.
4. Click **"reCAPTCHA v3"** as the provider.
5. Paste your **Site Key** from Step 6a.
6. Click **Save**.

#### 6c. Configure Site Key in your code

Paste the Site Key into `firebase-config.js`:

```javascript
const RECAPTCHA_SITE_KEY = "6LcXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
```

#### 6d. Enforce App Check (Production)

- On the App Check page, click **"Enforce"** next to **Firestore** (and any other service you want to protect).
- **During development**, leave it **unenforced** (monitored only) so local testing still works.
- Once deployed and tested, switch to **Enforce** in production.

---

### 7. Set Your Admin Custom Claim

The app uses a **Firebase custom claim** (`admin: true`) to identify administrators. This is enforced server-side in Firestore rules:

```
function isAdmin() { return isSignedIn() && request.auth.token.admin == true; }
```

This claim **cannot be set or forged by any client** — it must be set via the Firebase Admin SDK or Firebase CLI with admin privileges.

#### Method A: Firebase Admin SDK script (Recommended)

**Step 1 — Download your service account:**
1. Firebase Console → **Project Settings** → **Service accounts** tab.
2. Click **"Generate new private key"** → Download the JSON file.
3. Rename it `service-account.json` and place it in the project root (it is already in `.gitignore`).

**Step 2 — Install the Admin SDK:**

```bash
npm install firebase-admin
```

**Step 3 — Create the script:**

```javascript
// set-admin.js — run with Node.js, then DELETE this file
const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const uid = 'YOUR_UID_HERE'; // Firebase Console → Authentication → Users → copy UID

admin.auth().setCustomUserClaims(uid, { admin: true })
  .then(() => {
    console.log('✅ Admin claim set for UID:', uid);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
```

**Step 4 — Find your UID:**
1. Firebase Console → **Authentication** → **Users** tab.
2. Sign in to the app first (so your account appears), then copy your **UID**.

**Step 5 — Run the script:**

```bash
node set-admin.js
```

**Step 6 — Refresh your token:**
Sign out of the app completely and sign back in. Firebase ID tokens are cached — the new `admin: true` claim only takes effect after a fresh login.

> [!CAUTION]
> **Delete `service-account.json` immediately after use**, or move it to a location outside the project directory. This file grants full admin access to your Firebase project. Never commit it to version control.

#### Method B: Via Firebase Cloud Functions (Alternative)

If you have Firebase Functions enabled, you can expose a secure callable function that sets the admin claim after verifying a secret passphrase. This is useful for a hosted admin setup process. See the [Firebase Admin SDK docs](https://firebase.google.com/docs/auth/admin/custom-claims) for a callable function example.

---

### 8. Deploy Firestore Rules and Indexes

```bash
# Log in to Firebase (opens browser)
firebase login

# Associate this directory with your Firebase project
firebase use --add
# Select your project from the list, give it an alias like "default"

# Deploy security rules
firebase deploy --only firestore:rules

# Deploy composite indexes (may take a few minutes to build)
firebase deploy --only firestore:indexes
```

You can verify the rules and indexes are active in:
- **Firebase Console → Firestore → Rules**
- **Firebase Console → Firestore → Indexes**

---

### 9. Seed Sample Data

The app ships with a seeder page that populates Firestore with sample approved reports and safe spots so the map isn't empty on first load.

1. Deploy to hosting first (Step 10), or run a local dev server.
2. Navigate to `/seed.html` in your browser while **signed in as an admin user**.
3. Click **"Seed Database"** and wait for the confirmation toast.
4. Navigate to `/map.html` — you should see markers on the map.

Alternatively, you can manually add documents via **Firebase Console → Firestore → Start collection** using the field schema documented in `firestore.rules`.

> [!NOTE]
> The seeder is intentionally not protected by a URL rewrite — it is a plain HTML page. Remove or restrict access to `seed.html` after initial setup by deleting the file or adding an auth guard in `seed.js`.

---

### 10. Deploy to Hosting

```bash
firebase deploy --only hosting
```

Your app will be live at:

```
https://YOUR_PROJECT_ID.web.app
```

To deploy everything at once (rules + indexes + hosting):

```bash
firebase deploy
```

---

### 11. Add Authorized Domains

If you are using a **custom domain** (e.g., `jonakipothe.in`):

1. Firebase Console → **Authentication** → **Settings** → **Authorized domains**.
2. Click **"Add domain"** and enter your custom domain.
3. Also add it to your reCAPTCHA site's domain list (Step 6a).

To connect a custom domain to Firebase Hosting:
- Firebase Console → **Hosting** → **Add custom domain** → follow the DNS verification steps.

---

## Security Notes

| Concern | Mitigation |
|---|---|
| Unauthorised database access | Firestore rules require auth for all writes; public reads limited to `approved` reports only |
| Bot / scraper abuse | Firebase App Check (reCAPTCHA v3) blocks non-browser clients |
| Privilege escalation | Admin status is a server-side custom claim, unmodifiable by clients |
| XSS | All user content rendered via `textContent` (never `innerHTML`) |
| Credential leaks | `service-account.json` and `.env` files in `.gitignore`; CSP headers restrict script sources |
| Clickjacking | `X-Frame-Options: DENY` header on all responses |
| MIME sniffing | `X-Content-Type-Options: nosniff` header |
| Transport | `Strict-Transport-Security` with 1-year max-age enforces HTTPS |
| Overly-permissive API | Composite Firestore indexes are defined explicitly; no wildcard collection access |

> [!IMPORTANT]
> Never commit `firebase-config.js` with real API keys to a **public** repository. While Firebase API keys are not strictly secret (they are rate-limited by App Check and security rules), exposing them publicly can attract quota abuse. Use environment variable injection in CI/CD pipelines.

---

## Adding Phone OTP Authentication (Future)

The login flow currently supports **Google Sign-In** only. To add phone/OTP:

1. Firebase Console → **Authentication** → **Sign-in method** → **Phone** → Enable.
2. In `login.html`, locate the comment `<!-- PHONE AUTH UI GOES HERE -->` and add:
   - A phone number input (`<input type="tel" id="phoneInput">`)
   - A "Send OTP" button that calls `signInWithPhoneNumber(auth, phone, recaptchaVerifier)`
   - An OTP input and "Verify" button that calls `confirmationResult.confirm(otp)`
3. See the [Firebase Phone Auth docs](https://firebase.google.com/docs/auth/web/phone-auth) for the full flow.

> [!NOTE]
> Phone authentication requires the **Blaze (pay-as-you-go)** plan for production volumes beyond the free tier's 10 SMS/day limit.

---

## Adding Safe Route Suggestions (Future)

The codebase is intentionally structured to make route planning a natural next step:

- The `safe_spots` Firestore collection is already defined, seeded, and displayed on the map.
- Approved `reports` carry `lat`, `lng`, `severity`, and `category` fields — ideal for route scoring.

**Recommended implementation path:**

1. **Add a "Plan Route" UI** in `map.html` — an origin and destination input (or click-to-select on map).
2. **Fetch candidate routes** using the [OSRM public API](http://router.project-osrm.org) or [Leaflet Routing Machine](https://www.lh9.de/leaflet-routing-machine/) (open-source, works with OSM data).
3. **Score route segments** by proximity to:
   - High-severity `dark_street` or `isolated_area` reports → **penalty**
   - `safe_spot` markers → **bonus**
4. **Display the safest route** in green and the standard route in grey for comparison.

**Cloud Function approach (advanced):**

```
Cloud Function: scoreRoute(origin, destination)
  → queries Firestore for reports within 200m of each route waypoint
  → computes a composite danger score per segment
  → returns ranked route options
```

This avoids heavy computation on the client and keeps report data server-side.

---

## Data Deletion Requests

To comply with privacy regulations (e.g., India's DPDP Act), users may request deletion of their personal data by emailing **privacy@jonakipothe.in**.

**To fully delete a user's data:**

1. **Firestore — Users collection:** Delete `users/{uid}` and its `contacts` subcollection.
2. **Firestore — Report authors:** Query `report_authors` where `uid == targetUid`. For each document, decide whether to:
   - Delete the corresponding `reports/{reportId}` entirely, or
   - Anonymise it (remove any name/email fields; keep the hazard data for community safety).
3. **Firestore — SOS events:** Delete all `sos_events` where `uid == targetUid`.
4. **Firebase Auth:** Delete the Firebase Auth account:

```javascript
// Admin SDK
admin.auth().deleteUser(uid);
```

5. **Confirm** deletion to the user within the statutory timeframe.

> [!WARNING]
> Deleting a user's Auth account immediately revokes all their active sessions. Coordinate timing with the user if possible.

---

*Built with 🌟 for safer streets.*
