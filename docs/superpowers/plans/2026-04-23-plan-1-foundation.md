# Plan 1 — Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [2026-04-23-daily-family-digest-design.md](../specs/2026-04-23-daily-family-digest-design.md)

**Goal:** Deliver a deployable PWA skeleton where a user can sign in with Google, complete the 5-step onboarding wizard, have their preferences saved to Firestore, and navigate between five empty tab shells (Home, Bulgaria, World, Sports, Settings).

**Architecture:** React 18 + Vite 6 single-page app with state-based tab navigation (no react-router). Firebase Auth + Firestore for user prefs. Feature-folder structure. Firestore rules enforce per-user isolation. Onboarding is gated on `users/{uid}/private/preferences.onboardingComplete`. No content, no Cloud Functions, no push yet — those come in Plans 2 and 4.

**Tech Stack:** React 18, Vite 6, Firebase Web SDK v12 (Auth + Firestore), Lucide-react, Vitest + @testing-library/react + jsdom for tests.

**Working directory for every command below:** `/Users/vladislavgeorgiev/Daily Family Digest/`

**Deliverable at end of plan:**
- `npm run dev` starts a local server
- Signing in with Google creates a `users/{uid}/private/preferences` doc
- Completing the wizard sets `onboardingComplete: true` and lands on the Home tab
- Signing out clears state; signing back in restores prefs
- Firestore rules deny reads/writes to another user's doc
- All services and the wizard state machine are covered by Vitest unit tests

---

## File map

Files that this plan creates or modifies. Each has a single clear responsibility.

```
/Users/vladislavgeorgiev/Daily Family Digest/
├─ package.json                              # deps + scripts
├─ vite.config.js                            # Vite + Vitest config
├─ index.html                                # app entry
├─ .env.example                              # template for Firebase config
├─ .env.local                                # local secrets (gitignored)
├─ .gitignore
├─ firebase.json                             # Firebase CLI config
├─ firestore.rules                           # per-user isolation rules
├─ firestore.indexes.json                    # empty for Plan 1; Plan 2 adds news indexes
├─ .firebaserc                               # Firebase project id
├─ public/
│  └─ favicon.svg
├─ src/
│  ├─ main.jsx                               # Vite entry point
│  ├─ App.jsx                                # auth gate + onboarding gate + tab router
│  ├─ services/
│  │  ├─ firebase.js                         # SDK init (auth, firestore)
│  │  ├─ auth.js                             # signInWithGoogle, signOut, deleteAccount
│  │  ├─ prefs.js                            # getPrefs, updatePrefs, ensurePrefsDoc
│  │  ├─ outlets.js                          # Bulgarian outlet slug → display name
│  │  ├─ worldConfig.js                      # world topic + region slug lists
│  │  └─ teams.js                            # football team catalog (leagues + teams)
│  ├─ hooks/
│  │  ├─ useAuth.js                          # subscribe to Firebase auth state
│  │  └─ usePrefs.js                         # live Firestore subscription to prefs doc
│  ├─ contexts/
│  │  ├─ AuthContext.jsx                     # { user, loading }
│  │  └─ PrefsContext.jsx                    # { prefs, loading, update }
│  ├─ components/
│  │  ├─ Spinner.jsx
│  │  ├─ TabBar.jsx                          # bottom 5-tab nav
│  │  └─ AppLayout.jsx                       # chrome (content slot + TabBar)
│  └─ features/
│     ├─ onboarding/
│     │  ├─ OnboardingWizard.jsx             # step state + transitions + persist
│     │  ├─ WelcomeStep.jsx                  # sign in with Google
│     │  ├─ BulgariaStep.jsx                 # outlet multi-select (≥1)
│     │  ├─ WorldStep.jsx                    # topics (≥1) + regions (≥1)
│     │  ├─ SportsStep.jsx                   # football teams (0+) + F1 toggle
│     │  └─ NotificationsStep.jsx            # request permission + 3 toggles
│     ├─ home/HomeTab.jsx                    # empty state
│     ├─ bulgaria/BulgariaTab.jsx            # empty state
│     ├─ world/WorldTab.jsx                  # empty state
│     ├─ sports/SportsTab.jsx                # empty state
│     └─ settings/
│        ├─ SettingsTab.jsx                  # profile + re-run wizard + sign out
│        └─ ProfileSection.jsx
└─ tests/
   ├─ setup.js                               # jsdom + testing-library setup
   └─ (per-module test files colocated under src/ alongside their modules)
```

Tests are colocated: `src/services/prefs.js` → `src/services/prefs.test.js`. The top-level `tests/setup.js` is only for shared env setup (e.g. importing `@testing-library/jest-dom/vitest`).

---

## Prerequisites (manual, before Task 1)

These are one-time manual steps the implementer does in a browser. The plan cannot automate them.

1. **Create a Firebase project** at https://console.firebase.google.com
   - Name: `daily-family-digest` (or similar)
   - Enable Google Analytics: no (not needed)
   - Note the **Project ID** — used in `.firebaserc`
2. **Enable Google sign-in** under Authentication → Sign-in method → Google → Enable. Set the support email.
3. **Create a Firestore database** in Native mode, region `eur3` (or closest).
4. **Register a web app** under Project settings → Your apps → Web (`</>`). Copy the config object — the `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId` go into `.env.local` in Task 2.
5. **Upgrade to Blaze plan** — required to deploy Cloud Functions in Plan 2. Plan 1 does not hit functions, so upgrading now is optional but recommended.
6. **Install the Firebase CLI** locally: `npm install -g firebase-tools` and `firebase login`.

---

## Task 1: Scaffold Vite + React project

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `src/main.jsx`, `src/App.jsx`, `.gitignore`, `public/favicon.svg`

- [ ] **Step 1: Initialize the project**

Run from `/Users/vladislavgeorgiev/Daily Family Digest/`:

```bash
npm create vite@latest . -- --template react
```

When prompted to continue in a non-empty directory (`docs/` exists), choose **"Ignore files and continue"**.

- [ ] **Step 2: Install base dependencies**

```bash
npm install
npm install firebase@^12 lucide-react
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 3: Verify `package.json` scripts**

Open `package.json`. Scripts block should read:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "test": "vitest",
  "test:run": "vitest run"
}
```

Add the `test` and `test:run` scripts if Vite's default didn't include them.

- [ ] **Step 4: Replace `vite.config.js` with test-enabled config**

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    globals: true,
  },
});
```

- [ ] **Step 5: Create `tests/setup.js`**

```js
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 6: Replace `src/App.jsx` with a minimal placeholder**

```jsx
export default function App() {
  return <div>Daily Family Digest — loading…</div>;
}
```

- [ ] **Step 7: Extend `.gitignore`**

Append:

```
.env
.env.local
.firebase/
*.log
```

- [ ] **Step 8: Initialize git and commit scaffold**

```bash
git init
git add -A
git commit -m "chore: initial Vite + React scaffold"
```

- [ ] **Step 9: Smoke test the dev server**

```bash
npm run dev
```

Expected: Vite prints a local URL (likely http://localhost:5173). Open it — page shows "Daily Family Digest — loading…". Stop the server with Ctrl+C.

- [ ] **Step 10: Smoke test Vitest**

```bash
npm run test:run
```

Expected: "No test files found" — that's correct for now; Vitest is wired up but we haven't written tests yet. Exit code 1 is expected — that's fine.

---

## Task 2: Firebase project config and env vars

**Files:**
- Create: `.env.example`, `.env.local`, `.firebaserc`, `firebase.json`, `firestore.rules`, `firestore.indexes.json`

- [ ] **Step 1: Create `.env.example`**

This is the committed template. Real values go in `.env.local`.

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

- [ ] **Step 2: Create `.env.local`**

Copy `.env.example` and fill in the values from the Firebase console (from Prerequisites step 4). File is gitignored.

- [ ] **Step 3: Create `.firebaserc`**

Replace `<your-project-id>` with the Project ID from Prerequisites step 1.

```json
{
  "projects": {
    "default": "<your-project-id>"
  }
}
```

- [ ] **Step 4: Create `firebase.json`**

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  }
}
```

- [ ] **Step 5: Create `firestore.rules`**

Per-user isolation. Reads and writes to `users/{uid}/**` only allowed when `request.auth.uid == uid`.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

- [ ] **Step 6: Create empty `firestore.indexes.json`**

Plan 2 will add the `news` indexes.

```json
{
  "indexes": [],
  "fieldOverrides": []
}
```

- [ ] **Step 7: Verify Firebase CLI connects**

```bash
firebase projects:list
```

Expected: your project id appears in the list.

- [ ] **Step 8: Deploy Firestore rules**

```bash
firebase deploy --only firestore:rules
```

Expected: "Deploy complete!" and a link to the console.

- [ ] **Step 9: Commit**

```bash
git add .env.example .firebaserc firebase.json firestore.rules firestore.indexes.json .gitignore
git commit -m "chore: Firebase project config and Firestore rules"
```

---

## Task 3: Firebase SDK init service

**Files:**
- Create: `src/services/firebase.js`, `src/services/firebase.test.js`

- [ ] **Step 1: Write the failing test**

`src/services/firebase.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { auth, db } from './firebase.js';

describe('firebase service', () => {
  it('exports an auth instance', () => {
    expect(auth).toBeDefined();
    expect(auth.app).toBeDefined();
  });

  it('exports a firestore instance', () => {
    expect(db).toBeDefined();
    expect(typeof db.type).toBe('string');
  });
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npm run test:run -- src/services/firebase.test.js
```

Expected: FAIL — module `./firebase.js` not found.

- [ ] **Step 3: Implement `src/services/firebase.js`**

```js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
```

- [ ] **Step 4: Run test to verify pass**

```bash
npm run test:run -- src/services/firebase.test.js
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/firebase.js src/services/firebase.test.js
git commit -m "feat: Firebase SDK init service"
```

---

## Task 4: Auth service (sign in / sign out / delete account)

**Files:**
- Create: `src/services/auth.js`, `src/services/auth.test.js`

- [ ] **Step 1: Write the failing test**

`src/services/auth.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./firebase.js', () => ({
  auth: { currentUser: null },
}));

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: vi.fn(() => ({})),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  deleteUser: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('auth service', () => {
  it('signInWithGoogle calls signInWithPopup with the auth instance and Google provider', async () => {
    const { signInWithGoogle } = await import('./auth.js');
    const firebaseAuth = await import('firebase/auth');
    firebaseAuth.signInWithPopup.mockResolvedValue({ user: { uid: 'abc' } });

    const result = await signInWithGoogle();

    expect(firebaseAuth.signInWithPopup).toHaveBeenCalledOnce();
    expect(result.uid).toBe('abc');
  });

  it('signOutCurrent calls firebase signOut', async () => {
    const { signOutCurrent } = await import('./auth.js');
    const firebaseAuth = await import('firebase/auth');

    await signOutCurrent();

    expect(firebaseAuth.signOut).toHaveBeenCalledOnce();
  });

  it('deleteCurrentAccount throws if no user is signed in', async () => {
    const { deleteCurrentAccount } = await import('./auth.js');
    await expect(deleteCurrentAccount()).rejects.toThrow(/not signed in/i);
  });
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npm run test:run -- src/services/auth.test.js
```

Expected: FAIL — `./auth.js` not found.

- [ ] **Step 3: Implement `src/services/auth.js`**

```js
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  deleteUser,
} from 'firebase/auth';
import { auth } from './firebase.js';

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle() {
  const credential = await signInWithPopup(auth, googleProvider);
  return credential.user;
}

export async function signOutCurrent() {
  await signOut(auth);
}

export async function deleteCurrentAccount() {
  if (!auth.currentUser) {
    throw new Error('Cannot delete: not signed in');
  }
  await deleteUser(auth.currentUser);
}
```

- [ ] **Step 4: Run test to verify pass**

```bash
npm run test:run -- src/services/auth.test.js
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/auth.js src/services/auth.test.js
git commit -m "feat: auth service (sign in, sign out, delete account)"
```

---

## Task 5: Bulgarian outlets config

**Files:**
- Create: `src/services/outlets.js`, `src/services/outlets.test.js`

- [ ] **Step 1: Write the failing test**

`src/services/outlets.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { BULGARIA_OUTLETS, outletBySlug } from './outlets.js';

describe('Bulgaria outlets config', () => {
  it('exposes at least 8 outlets', () => {
    expect(BULGARIA_OUTLETS.length).toBeGreaterThanOrEqual(8);
  });

  it('every outlet has slug, name, and rssUrl', () => {
    for (const o of BULGARIA_OUTLETS) {
      expect(o.slug).toMatch(/^[a-z0-9-]+$/);
      expect(o.name).toBeTruthy();
      expect(o.rssUrl).toMatch(/^https?:\/\//);
    }
  });

  it('slugs are unique', () => {
    const slugs = BULGARIA_OUTLETS.map((o) => o.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('outletBySlug returns the right outlet', () => {
    const any = BULGARIA_OUTLETS[0];
    expect(outletBySlug(any.slug)).toBe(any);
  });

  it('outletBySlug returns undefined for unknown slug', () => {
    expect(outletBySlug('nope-nope')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npm run test:run -- src/services/outlets.test.js
```

Expected: FAIL.

- [ ] **Step 3: Implement `src/services/outlets.js`**

Starter list — RSS URLs are best-effort and will be verified for liveness in Plan 2 before ingest starts. If any feed is dead on that audit, it can be removed without breaking Plan 1 (the client only uses slug + name here).

```js
export const BULGARIA_OUTLETS = [
  { slug: 'dnevnik',   name: 'Dnevnik',    rssUrl: 'https://www.dnevnik.bg/rss' },
  { slug: 'mediapool', name: 'Mediapool',  rssUrl: 'https://www.mediapool.bg/rss' },
  { slug: 'bnr',       name: 'BNR',        rssUrl: 'https://bnr.bg/post/rss' },
  { slug: 'sega',      name: 'Sega',       rssUrl: 'https://www.segabg.com/rss.xml' },
  { slug: 'offnews',   name: 'Offnews',    rssUrl: 'https://offnews.bg/rss.xml' },
  { slug: 'darik',     name: 'Darik News', rssUrl: 'https://dariknews.bg/rss' },
  { slug: 'nova',      name: 'Nova',       rssUrl: 'https://nova.bg/rss' },
  { slug: 'btv',       name: 'bTV Novinite', rssUrl: 'https://btvnovinite.bg/rss/' },
  { slug: 'clubz',     name: 'Club Z',     rssUrl: 'https://clubz.bg/feed' },
  { slug: 'capital',   name: 'Capital',    rssUrl: 'https://www.capital.bg/rss' },
];

export function outletBySlug(slug) {
  return BULGARIA_OUTLETS.find((o) => o.slug === slug);
}
```

- [ ] **Step 4: Run test to verify pass**

```bash
npm run test:run -- src/services/outlets.test.js
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/outlets.js src/services/outlets.test.js
git commit -m "feat: Bulgarian outlets config"
```

---

## Task 6: World news topics + regions config

**Files:**
- Create: `src/services/worldConfig.js`, `src/services/worldConfig.test.js`

- [ ] **Step 1: Write the failing test**

`src/services/worldConfig.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { WORLD_TOPICS, WORLD_REGIONS, topicBySlug, regionBySlug } from './worldConfig.js';

describe('world config', () => {
  it('exposes at least 6 topics', () => {
    expect(WORLD_TOPICS.length).toBeGreaterThanOrEqual(6);
  });

  it('exposes at least 6 regions', () => {
    expect(WORLD_REGIONS.length).toBeGreaterThanOrEqual(6);
  });

  it('topics and regions each have unique slugs', () => {
    const topicSlugs = WORLD_TOPICS.map((t) => t.slug);
    const regionSlugs = WORLD_REGIONS.map((r) => r.slug);
    expect(new Set(topicSlugs).size).toBe(topicSlugs.length);
    expect(new Set(regionSlugs).size).toBe(regionSlugs.length);
  });

  it('regions include a Google News gl/ceid code', () => {
    for (const r of WORLD_REGIONS) {
      expect(r.gl).toMatch(/^[A-Z]{2}$/);
      expect(r.ceid).toMatch(/^[A-Z]{2}:[a-z]{2}$/);
    }
  });

  it('lookup helpers return the right entries', () => {
    const topic = WORLD_TOPICS[0];
    const region = WORLD_REGIONS[0];
    expect(topicBySlug(topic.slug)).toBe(topic);
    expect(regionBySlug(region.slug)).toBe(region);
    expect(topicBySlug('x')).toBeUndefined();
    expect(regionBySlug('x')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npm run test:run -- src/services/worldConfig.test.js
```

Expected: FAIL.

- [ ] **Step 3: Implement `src/services/worldConfig.js`**

```js
export const WORLD_TOPICS = [
  { slug: 'politics',      name: 'Politics',      query: 'politics' },
  { slug: 'business',      name: 'Business',      query: 'business' },
  { slug: 'tech',          name: 'Technology',    query: 'technology' },
  { slug: 'science',       name: 'Science',       query: 'science' },
  { slug: 'health',        name: 'Health',        query: 'health' },
  { slug: 'entertainment', name: 'Entertainment', query: 'entertainment' },
  { slug: 'sports',        name: 'Sports',        query: 'sports' },
];

export const WORLD_REGIONS = [
  { slug: 'us',          name: 'United States',  gl: 'US', ceid: 'US:en' },
  { slug: 'uk',          name: 'United Kingdom', gl: 'GB', ceid: 'GB:en' },
  { slug: 'eu',          name: 'Europe',         gl: 'DE', ceid: 'DE:en' },
  { slug: 'asia',        name: 'Asia',           gl: 'IN', ceid: 'IN:en' },
  { slug: 'middle-east', name: 'Middle East',    gl: 'AE', ceid: 'AE:en' },
  { slug: 'africa',      name: 'Africa',         gl: 'ZA', ceid: 'ZA:en' },
  { slug: 'latam',       name: 'Latin America',  gl: 'MX', ceid: 'MX:en' },
];

export function topicBySlug(slug) {
  return WORLD_TOPICS.find((t) => t.slug === slug);
}

export function regionBySlug(slug) {
  return WORLD_REGIONS.find((r) => r.slug === slug);
}
```

- [ ] **Step 4: Run test to verify pass**

```bash
npm run test:run -- src/services/worldConfig.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/worldConfig.js src/services/worldConfig.test.js
git commit -m "feat: world news topics and regions config"
```

---

## Task 7: Football team catalog

**Files:**
- Create: `src/services/teams.js`, `src/services/teams.test.js`

- [ ] **Step 1: Write the failing test**

`src/services/teams.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { LEAGUES, TEAMS, teamsByLeague, teamById } from './teams.js';

describe('football teams catalog', () => {
  it('covers at least 5 leagues', () => {
    expect(LEAGUES.length).toBeGreaterThanOrEqual(5);
  });

  it('every team has id, name, and leagueId', () => {
    for (const t of TEAMS) {
      expect(t.id).toMatch(/^[A-Z0-9-]+$/);
      expect(t.name).toBeTruthy();
      expect(LEAGUES.some((l) => l.id === t.leagueId)).toBe(true);
    }
  });

  it('team ids are unique', () => {
    const ids = TEAMS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('teamsByLeague filters correctly', () => {
    const first = LEAGUES[0];
    const sub = teamsByLeague(first.id);
    expect(sub.length).toBeGreaterThan(0);
    for (const t of sub) expect(t.leagueId).toBe(first.id);
  });

  it('teamById round-trips', () => {
    const any = TEAMS[0];
    expect(teamById(any.id)).toBe(any);
  });
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npm run test:run -- src/services/teams.test.js
```

Expected: FAIL.

- [ ] **Step 3: Implement `src/services/teams.js`**

Starter catalog — abbreviated to keep the plan readable. Each league has a representative subset; the implementer is free to expand or trim in a follow-up commit within the same task once satisfied the shape is right.

```js
export const LEAGUES = [
  { id: 'PL',  name: 'Premier League' },
  { id: 'PD',  name: 'La Liga' },
  { id: 'SA',  name: 'Serie A' },
  { id: 'BL1', name: 'Bundesliga' },
  { id: 'CL',  name: 'Champions League' },
];

export const TEAMS = [
  // Premier League (subset; expand as desired)
  { id: 'PL-ARS', leagueId: 'PL', name: 'Arsenal' },
  { id: 'PL-AVL', leagueId: 'PL', name: 'Aston Villa' },
  { id: 'PL-CHE', leagueId: 'PL', name: 'Chelsea' },
  { id: 'PL-LIV', leagueId: 'PL', name: 'Liverpool' },
  { id: 'PL-MCI', leagueId: 'PL', name: 'Manchester City' },
  { id: 'PL-MUN', leagueId: 'PL', name: 'Manchester United' },
  { id: 'PL-TOT', leagueId: 'PL', name: 'Tottenham Hotspur' },

  // La Liga
  { id: 'PD-BAR', leagueId: 'PD', name: 'Barcelona' },
  { id: 'PD-RMA', leagueId: 'PD', name: 'Real Madrid' },
  { id: 'PD-ATM', leagueId: 'PD', name: 'Atlético Madrid' },
  { id: 'PD-SEV', leagueId: 'PD', name: 'Sevilla' },

  // Serie A
  { id: 'SA-JUV', leagueId: 'SA', name: 'Juventus' },
  { id: 'SA-INT', leagueId: 'SA', name: 'Inter' },
  { id: 'SA-MIL', leagueId: 'SA', name: 'Milan' },
  { id: 'SA-NAP', leagueId: 'SA', name: 'Napoli' },
  { id: 'SA-ROM', leagueId: 'SA', name: 'Roma' },

  // Bundesliga
  { id: 'BL1-BAY', leagueId: 'BL1', name: 'Bayern Munich' },
  { id: 'BL1-BVB', leagueId: 'BL1', name: 'Borussia Dortmund' },
  { id: 'BL1-LEV', leagueId: 'BL1', name: 'Bayer Leverkusen' },

  // Champions League (catalog placeholder — teams rotate each season)
  { id: 'CL-GEN', leagueId: 'CL', name: 'Champions League (all)' },
];

export function teamsByLeague(leagueId) {
  return TEAMS.filter((t) => t.leagueId === leagueId);
}

export function teamById(id) {
  return TEAMS.find((t) => t.id === id);
}
```

- [ ] **Step 4: Run test to verify pass**

```bash
npm run test:run -- src/services/teams.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/teams.js src/services/teams.test.js
git commit -m "feat: football team catalog"
```

---

## Task 8: Prefs service (read/write/ensure)

**Files:**
- Create: `src/services/prefs.js`, `src/services/prefs.test.js`

- [ ] **Step 1: Write the failing test**

`src/services/prefs.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./firebase.js', () => ({ db: {} }));

const mockDocRef = { __type: 'docRef' };
const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockOnSnapshot = vi.fn();
const mockServerTimestamp = vi.fn(() => '__server_ts__');

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => mockDocRef),
  getDoc: (...args) => mockGetDoc(...args),
  setDoc: (...args) => mockSetDoc(...args),
  updateDoc: (...args) => mockUpdateDoc(...args),
  onSnapshot: (...args) => mockOnSnapshot(...args),
  serverTimestamp: () => mockServerTimestamp(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('prefs service', () => {
  it('ensurePrefsDoc writes defaults when doc does not exist', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    const { ensurePrefsDoc } = await import('./prefs.js');

    await ensurePrefsDoc('user-1');

    expect(mockSetDoc).toHaveBeenCalledOnce();
    const payload = mockSetDoc.mock.calls[0][1];
    expect(payload.onboardingComplete).toBe(false);
    expect(payload.bulgariaOutlets).toEqual([]);
    expect(payload.worldTopics).toEqual([]);
    expect(payload.worldRegions).toEqual([]);
    expect(payload.footballTeams).toEqual([]);
    expect(payload.f1Follow).toBe(false);
    expect(payload.notifications).toEqual({
      bulgariaBreaking: false,
      worldBreaking: false,
      sportsBreaking: false,
    });
    expect(payload.fcmTokens).toEqual([]);
  });

  it('ensurePrefsDoc does not overwrite an existing doc', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true });
    const { ensurePrefsDoc } = await import('./prefs.js');

    await ensurePrefsDoc('user-1');

    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('updatePrefs calls updateDoc with merged data and updatedAt', async () => {
    const { updatePrefs } = await import('./prefs.js');

    await updatePrefs('user-1', { bulgariaOutlets: ['dnevnik'] });

    expect(mockUpdateDoc).toHaveBeenCalledOnce();
    const payload = mockUpdateDoc.mock.calls[0][1];
    expect(payload.bulgariaOutlets).toEqual(['dnevnik']);
    expect(payload.updatedAt).toBe('__server_ts__');
  });

  it('subscribePrefs wires onSnapshot and returns the unsubscribe fn', async () => {
    const unsub = vi.fn();
    mockOnSnapshot.mockReturnValue(unsub);
    const { subscribePrefs } = await import('./prefs.js');
    const cb = vi.fn();

    const returned = subscribePrefs('user-1', cb);

    expect(mockOnSnapshot).toHaveBeenCalledOnce();
    expect(returned).toBe(unsub);
  });
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npm run test:run -- src/services/prefs.test.js
```

Expected: FAIL — `./prefs.js` not found.

- [ ] **Step 3: Implement `src/services/prefs.js`**

```js
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase.js';

const DEFAULTS = {
  bulgariaOutlets: [],
  worldTopics: [],
  worldRegions: [],
  footballTeams: [],
  f1Follow: false,
  notifications: {
    bulgariaBreaking: false,
    worldBreaking: false,
    sportsBreaking: false,
  },
  fcmTokens: [],
  onboardingComplete: false,
};

function prefsRef(uid) {
  return doc(db, 'users', uid, 'private', 'preferences');
}

export async function ensurePrefsDoc(uid) {
  const ref = prefsRef(uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      ...DEFAULTS,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}

export async function updatePrefs(uid, patch) {
  await updateDoc(prefsRef(uid), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export function subscribePrefs(uid, callback) {
  return onSnapshot(prefsRef(uid), (snap) => {
    callback(snap.exists() ? snap.data() : null);
  });
}
```

- [ ] **Step 4: Run test to verify pass**

```bash
npm run test:run -- src/services/prefs.test.js
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/prefs.js src/services/prefs.test.js
git commit -m "feat: prefs service (ensure/update/subscribe)"
```

---

## Task 9: Auth context + useAuth hook

**Files:**
- Create: `src/contexts/AuthContext.jsx`, `src/hooks/useAuth.js`, `src/hooks/useAuth.test.jsx`

- [ ] **Step 1: Write the failing test**

`src/hooks/useAuth.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

const onAuthStateChangedMock = vi.fn();

vi.mock('../services/firebase.js', () => ({
  auth: { __type: 'mockAuth' },
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (...args) => onAuthStateChangedMock(...args),
}));

vi.mock('../services/prefs.js', () => ({
  ensurePrefsDoc: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

async function renderWithProvider(testId = 'result') {
  const { AuthProvider } = await import('../contexts/AuthContext.jsx');
  const { useAuth } = await import('./useAuth.js');
  function Probe() {
    const { user, loading } = useAuth();
    return (
      <div data-testid={testId}>
        {loading ? 'loading' : user ? `user:${user.uid}` : 'anon'}
      </div>
    );
  }
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
}

describe('useAuth', () => {
  it('starts in loading state', async () => {
    onAuthStateChangedMock.mockImplementation(() => () => {});
    await renderWithProvider();
    expect(screen.getByTestId('result').textContent).toBe('loading');
  });

  it('transitions to signed-out when callback fires with null', async () => {
    let callback;
    onAuthStateChangedMock.mockImplementation((_auth, cb) => {
      callback = cb;
      return () => {};
    });
    await renderWithProvider();
    await act(async () => callback(null));
    expect(screen.getByTestId('result').textContent).toBe('anon');
  });

  it('transitions to signed-in when callback fires with a user', async () => {
    let callback;
    onAuthStateChangedMock.mockImplementation((_auth, cb) => {
      callback = cb;
      return () => {};
    });
    const { ensurePrefsDoc } = await import('../services/prefs.js');
    await renderWithProvider();
    await act(async () => callback({ uid: 'u-1' }));
    expect(screen.getByTestId('result').textContent).toBe('user:u-1');
    expect(ensurePrefsDoc).toHaveBeenCalledWith('u-1');
  });
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npm run test:run -- src/hooks/useAuth.test.jsx
```

Expected: FAIL.

- [ ] **Step 3: Implement `src/contexts/AuthContext.jsx`**

```jsx
import { createContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase.js';
import { ensurePrefsDoc } from '../services/prefs.js';

export const AuthContext = createContext({ user: null, loading: true });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (next) => {
      if (next) {
        await ensurePrefsDoc(next.uid);
      }
      setUser(next);
      setLoading(false);
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
```

- [ ] **Step 4: Implement `src/hooks/useAuth.js`**

```js
import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext.jsx';

export function useAuth() {
  return useContext(AuthContext);
}
```

- [ ] **Step 5: Run test to verify pass**

```bash
npm run test:run -- src/hooks/useAuth.test.jsx
```

Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/contexts/AuthContext.jsx src/hooks/useAuth.js src/hooks/useAuth.test.jsx
git commit -m "feat: auth context and useAuth hook"
```

---

## Task 10: Prefs context + usePrefs hook

**Files:**
- Create: `src/contexts/PrefsContext.jsx`, `src/hooks/usePrefs.js`, `src/hooks/usePrefs.test.jsx`

- [ ] **Step 1: Write the failing test**

`src/hooks/usePrefs.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

const subscribePrefs = vi.fn();
const updatePrefs = vi.fn();

vi.mock('../services/prefs.js', () => ({
  subscribePrefs: (...a) => subscribePrefs(...a),
  updatePrefs: (...a) => updatePrefs(...a),
}));

vi.mock('./useAuth.js', () => ({
  useAuth: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

async function renderWithAuth(authValue) {
  const { useAuth } = await import('./useAuth.js');
  useAuth.mockReturnValue(authValue);
  const { PrefsProvider } = await import('../contexts/PrefsContext.jsx');
  const { usePrefs } = await import('./usePrefs.js');

  function Probe() {
    const { prefs, loading } = usePrefs();
    return (
      <div data-testid="result">
        {loading ? 'loading' : prefs ? `prefs:${JSON.stringify(prefs)}` : 'null'}
      </div>
    );
  }

  render(
    <PrefsProvider>
      <Probe />
    </PrefsProvider>
  );
}

describe('usePrefs', () => {
  it('returns null prefs + not-loading when user is signed out', async () => {
    await renderWithAuth({ user: null, loading: false });
    expect(screen.getByTestId('result').textContent).toBe('null');
    expect(subscribePrefs).not.toHaveBeenCalled();
  });

  it('subscribes when user is signed in, updates state on snapshot', async () => {
    let callback;
    subscribePrefs.mockImplementation((uid, cb) => {
      callback = cb;
      return () => {};
    });
    await renderWithAuth({ user: { uid: 'u-1' }, loading: false });
    expect(subscribePrefs).toHaveBeenCalledWith('u-1', expect.any(Function));
    await act(async () => callback({ onboardingComplete: true, bulgariaOutlets: ['dnevnik'] }));
    expect(screen.getByTestId('result').textContent).toContain('onboardingComplete":true');
  });
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npm run test:run -- src/hooks/usePrefs.test.jsx
```

Expected: FAIL.

- [ ] **Step 3: Implement `src/contexts/PrefsContext.jsx`**

```jsx
import { createContext, useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { subscribePrefs, updatePrefs } from '../services/prefs.js';

export const PrefsContext = createContext({
  prefs: null,
  loading: true,
  update: async () => {},
});

export function PrefsProvider({ children }) {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPrefs(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribePrefs(user.uid, (next) => {
      setPrefs(next);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  async function update(patch) {
    if (!user) throw new Error('Cannot update prefs: not signed in');
    await updatePrefs(user.uid, patch);
  }

  return (
    <PrefsContext.Provider value={{ prefs, loading, update }}>
      {children}
    </PrefsContext.Provider>
  );
}
```

- [ ] **Step 4: Implement `src/hooks/usePrefs.js`**

```js
import { useContext } from 'react';
import { PrefsContext } from '../contexts/PrefsContext.jsx';

export function usePrefs() {
  return useContext(PrefsContext);
}
```

- [ ] **Step 5: Run test to verify pass**

```bash
npm run test:run -- src/hooks/usePrefs.test.jsx
```

Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/contexts/PrefsContext.jsx src/hooks/usePrefs.js src/hooks/usePrefs.test.jsx
git commit -m "feat: prefs context and usePrefs hook"
```

---

## Task 11: Spinner + TabBar + AppLayout components

**Files:**
- Create: `src/components/Spinner.jsx`, `src/components/TabBar.jsx`, `src/components/AppLayout.jsx`, `src/components/TabBar.test.jsx`

- [ ] **Step 1: Implement `src/components/Spinner.jsx`**

No test — trivial presentational component.

```jsx
export default function Spinner({ label = 'Loading…' }) {
  return (
    <div style={{ padding: 24, textAlign: 'center', color: '#666' }}>
      {label}
    </div>
  );
}
```

- [ ] **Step 2: Write the failing TabBar test**

`src/components/TabBar.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TabBar from './TabBar.jsx';

describe('TabBar', () => {
  it('renders all five tab labels', () => {
    render(<TabBar active="home" onChange={() => {}} />);
    for (const label of ['Home', 'Bulgaria', 'World', 'Sports', 'Settings']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('marks the active tab with aria-current', () => {
    render(<TabBar active="world" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'World' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('button', { name: 'Home' })).not.toHaveAttribute(
      'aria-current'
    );
  });

  it('calls onChange with the tab key when clicked', () => {
    const onChange = vi.fn();
    render(<TabBar active="home" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bulgaria' }));
    expect(onChange).toHaveBeenCalledWith('bulgaria');
  });
});
```

- [ ] **Step 3: Run and verify failure**

```bash
npm run test:run -- src/components/TabBar.test.jsx
```

Expected: FAIL.

- [ ] **Step 4: Implement `src/components/TabBar.jsx`**

```jsx
import { Home, Newspaper, Globe, Trophy, Settings } from 'lucide-react';

const TABS = [
  { key: 'home',     label: 'Home',     Icon: Home },
  { key: 'bulgaria', label: 'Bulgaria', Icon: Newspaper },
  { key: 'world',    label: 'World',    Icon: Globe },
  { key: 'sports',   label: 'Sports',   Icon: Trophy },
  { key: 'settings', label: 'Settings', Icon: Settings },
];

export default function TabBar({ active, onChange }) {
  return (
    <nav
      style={{
        display: 'flex',
        justifyContent: 'space-around',
        borderTop: '1px solid #e5e5e5',
        background: '#fff',
        padding: '8px 0 calc(8px + env(safe-area-inset-bottom))',
      }}
    >
      {TABS.map(({ key, label, Icon }) => (
        <button
          key={key}
          aria-current={active === key ? 'page' : undefined}
          onClick={() => onChange(key)}
          style={{
            background: 'none',
            border: 'none',
            color: active === key ? '#111' : '#888',
            fontSize: 12,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            minWidth: 60,
            cursor: 'pointer',
          }}
        >
          <Icon size={20} />
          {label}
        </button>
      ))}
    </nav>
  );
}
```

- [ ] **Step 5: Run test to verify pass**

```bash
npm run test:run -- src/components/TabBar.test.jsx
```

Expected: PASS (3 tests).

- [ ] **Step 6: Implement `src/components/AppLayout.jsx`**

```jsx
import TabBar from './TabBar.jsx';

export default function AppLayout({ activeTab, onTabChange, children }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        minHeight: 0,
      }}
    >
      <main style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>{children}</main>
      <TabBar active={activeTab} onChange={onTabChange} />
    </div>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add src/components/Spinner.jsx src/components/TabBar.jsx src/components/AppLayout.jsx src/components/TabBar.test.jsx
git commit -m "feat: Spinner, TabBar, AppLayout shell components"
```

---

## Task 12: Empty tab screens

**Files:**
- Create: `src/features/home/HomeTab.jsx`, `src/features/bulgaria/BulgariaTab.jsx`, `src/features/world/WorldTab.jsx`, `src/features/sports/SportsTab.jsx`

- [ ] **Step 1: Create the empty-state screens**

All four follow the same shape. Plan 3 replaces each body with real content.

`src/features/home/HomeTab.jsx`:

```jsx
export default function HomeTab() {
  return (
    <section style={{ padding: 16 }}>
      <h1 style={{ margin: 0, fontSize: 20 }}>Home</h1>
      <p style={{ color: '#666' }}>
        Your daily digest will appear here once news starts flowing.
      </p>
    </section>
  );
}
```

`src/features/bulgaria/BulgariaTab.jsx`:

```jsx
export default function BulgariaTab() {
  return (
    <section style={{ padding: 16 }}>
      <h1 style={{ margin: 0, fontSize: 20 }}>Bulgaria</h1>
      <p style={{ color: '#666' }}>No articles yet — news ingest lands in Plan 2.</p>
    </section>
  );
}
```

`src/features/world/WorldTab.jsx`:

```jsx
export default function WorldTab() {
  return (
    <section style={{ padding: 16 }}>
      <h1 style={{ margin: 0, fontSize: 20 }}>World</h1>
      <p style={{ color: '#666' }}>No articles yet — news ingest lands in Plan 2.</p>
    </section>
  );
}
```

`src/features/sports/SportsTab.jsx`:

```jsx
export default function SportsTab() {
  return (
    <section style={{ padding: 16 }}>
      <h1 style={{ margin: 0, fontSize: 20 }}>Sports</h1>
      <p style={{ color: '#666' }}>No articles yet — news ingest lands in Plan 2.</p>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/home src/features/bulgaria src/features/world src/features/sports
git commit -m "feat: empty-state tab screens (Home, Bulgaria, World, Sports)"
```

---

## Task 13: Settings tab with Profile section

**Files:**
- Create: `src/features/settings/ProfileSection.jsx`, `src/features/settings/SettingsTab.jsx`

- [ ] **Step 1: Implement `src/features/settings/ProfileSection.jsx`**

```jsx
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth.js';
import { signOutCurrent, deleteCurrentAccount } from '../../services/auth.js';

export default function ProfileSection() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (!user) return null;

  async function onSignOut() {
    setBusy(true);
    setError(null);
    try {
      await signOutCurrent();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!confirm('Delete your account? This removes your preferences and signs you out.')) return;
    setBusy(true);
    setError(null);
    try {
      await deleteCurrentAccount();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ color: '#333' }}>Signed in as <strong>{user.email}</strong></div>
      <button onClick={onSignOut} disabled={busy}>Sign out</button>
      <button onClick={onDelete} disabled={busy} style={{ color: '#b00' }}>
        Delete account
      </button>
      {error && <div style={{ color: '#b00' }}>{error}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Implement `src/features/settings/SettingsTab.jsx`**

`onRestartOnboarding` is wired via props so the root `App.jsx` (Task 14) owns the onboarding-restart state without Settings needing to know about routing internals.

```jsx
import ProfileSection from './ProfileSection.jsx';

export default function SettingsTab({ onRestartOnboarding }) {
  return (
    <section style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <h1 style={{ margin: 0, fontSize: 20 }}>Settings</h1>

      <section>
        <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>Profile</h2>
        <ProfileSection />
      </section>

      <section>
        <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>Preferences</h2>
        <button onClick={onRestartOnboarding}>Re-run setup wizard</button>
      </section>

      <section>
        <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>About</h2>
        <div style={{ color: '#666' }}>Daily Family Digest — v1 foundation</div>
      </section>
    </section>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/settings
git commit -m "feat: Settings tab with Profile section"
```

---

## Task 14: App root — auth gate, onboarding gate, tab router

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/main.jsx`

- [ ] **Step 1: Replace `src/main.jsx`**

```jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { PrefsProvider } from './contexts/PrefsContext.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <PrefsProvider>
        <App />
      </PrefsProvider>
    </AuthProvider>
  </StrictMode>
);
```

- [ ] **Step 2: Replace `src/App.jsx`**

Keep onboarding-related imports as stubs for Task 15 — we import the wizard here so the gate is clear.

```jsx
import { useState } from 'react';
import { useAuth } from './hooks/useAuth.js';
import { usePrefs } from './hooks/usePrefs.js';
import { signInWithGoogle } from './services/auth.js';
import Spinner from './components/Spinner.jsx';
import AppLayout from './components/AppLayout.jsx';
import OnboardingWizard from './features/onboarding/OnboardingWizard.jsx';
import HomeTab from './features/home/HomeTab.jsx';
import BulgariaTab from './features/bulgaria/BulgariaTab.jsx';
import WorldTab from './features/world/WorldTab.jsx';
import SportsTab from './features/sports/SportsTab.jsx';
import SettingsTab from './features/settings/SettingsTab.jsx';

export default function App() {
  const { user, loading: authLoading } = useAuth();
  const { prefs, loading: prefsLoading } = usePrefs();
  const [activeTab, setActiveTab] = useState('home');
  const [rerunOnboarding, setRerunOnboarding] = useState(false);

  if (authLoading) return <Spinner label="Starting…" />;

  if (!user) {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 360, margin: '64px auto' }}>
        <h1 style={{ margin: 0 }}>Daily Family Digest</h1>
        <p style={{ color: '#666' }}>
          Sign in with Google to set up your news feed.
        </p>
        <button onClick={signInWithGoogle}>Continue with Google</button>
      </div>
    );
  }

  if (prefsLoading) return <Spinner label="Loading your preferences…" />;

  if (!prefs?.onboardingComplete || rerunOnboarding) {
    return (
      <OnboardingWizard
        onFinish={() => setRerunOnboarding(false)}
      />
    );
  }

  return (
    <AppLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'home' && <HomeTab />}
      {activeTab === 'bulgaria' && <BulgariaTab />}
      {activeTab === 'world' && <WorldTab />}
      {activeTab === 'sports' && <SportsTab />}
      {activeTab === 'settings' && (
        <SettingsTab onRestartOnboarding={() => setRerunOnboarding(true)} />
      )}
    </AppLayout>
  );
}
```

- [ ] **Step 3: Run tests (should still all pass)**

```bash
npm run test:run
```

Expected: all existing tests PASS. `App.jsx` has no dedicated tests — it is wired through integration. A smoke render happens during Task 22.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx src/main.jsx
git commit -m "feat: App root with auth + onboarding gates and tab router"
```

---

## Task 15: OnboardingWizard shell (state machine)

**Files:**
- Create: `src/features/onboarding/OnboardingWizard.jsx`, `src/features/onboarding/OnboardingWizard.test.jsx`

- [ ] **Step 1: Write the failing test**

`src/features/onboarding/OnboardingWizard.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../hooks/usePrefs.js', () => ({
  usePrefs: vi.fn(),
}));

const updateMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

async function renderWizard(onFinish = vi.fn()) {
  const { usePrefs } = await import('../../hooks/usePrefs.js');
  usePrefs.mockReturnValue({ prefs: {}, loading: false, update: updateMock });
  const OnboardingWizard = (await import('./OnboardingWizard.jsx')).default;
  render(<OnboardingWizard onFinish={onFinish} />);
}

describe('OnboardingWizard', () => {
  it('starts on the Welcome step', async () => {
    await renderWizard();
    expect(screen.getByText(/welcome/i)).toBeInTheDocument();
  });

  it('advances through all five steps in order', async () => {
    await renderWizard();
    // Welcome → Bulgaria
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByText(/which bulgarian outlets/i)).toBeInTheDocument();
    // Bulgaria requires ≥1 selection; pick one
    fireEvent.click(screen.getByLabelText('Dnevnik'));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    // World — pick ≥1 topic and ≥1 region
    expect(screen.getByText(/topics/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Politics'));
    fireEvent.click(screen.getByLabelText('United States'));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    // Sports — skippable (heading selector avoids matching the skip-if-you-don't paragraph)
    expect(screen.getByRole('heading', { level: 1, name: /^sports$/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^skip$/i }));
    // Notifications — skippable
    expect(screen.getByRole('heading', { level: 1, name: /^notifications$/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^skip$/i }));
    // Should have called update with onboardingComplete: true
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ onboardingComplete: true })
    );
  });
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npm run test:run -- src/features/onboarding/OnboardingWizard.test.jsx
```

Expected: FAIL — module not yet implemented. (Individual step components are implemented in Tasks 16-20; the wizard shell here composes them.)

- [ ] **Step 3: Implement the wizard shell**

`src/features/onboarding/OnboardingWizard.jsx`:

```jsx
import { useState } from 'react';
import { usePrefs } from '../../hooks/usePrefs.js';
import WelcomeStep from './WelcomeStep.jsx';
import BulgariaStep from './BulgariaStep.jsx';
import WorldStep from './WorldStep.jsx';
import SportsStep from './SportsStep.jsx';
import NotificationsStep from './NotificationsStep.jsx';

const STEPS = ['welcome', 'bulgaria', 'world', 'sports', 'notifications'];

export default function OnboardingWizard({ onFinish }) {
  const { prefs, update } = usePrefs();
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState({
    bulgariaOutlets: prefs?.bulgariaOutlets ?? [],
    worldTopics: prefs?.worldTopics ?? [],
    worldRegions: prefs?.worldRegions ?? [],
    footballTeams: prefs?.footballTeams ?? [],
    f1Follow: prefs?.f1Follow ?? false,
    notifications: prefs?.notifications ?? {
      bulgariaBreaking: false,
      worldBreaking: false,
      sportsBreaking: false,
    },
  });

  function patchDraft(patch) {
    setDraft((d) => ({ ...d, ...patch }));
  }

  function next() {
    if (stepIndex < STEPS.length - 1) setStepIndex((i) => i + 1);
  }

  function back() {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  }

  async function finish() {
    await update({ ...draft, onboardingComplete: true });
    onFinish?.();
  }

  const step = STEPS[stepIndex];

  return (
    <div style={{ padding: 24, maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ color: '#888', fontSize: 12 }}>
        Step {stepIndex + 1} of {STEPS.length}
      </div>

      {step === 'welcome' && <WelcomeStep onNext={next} />}
      {step === 'bulgaria' && (
        <BulgariaStep
          selected={draft.bulgariaOutlets}
          onChange={(bulgariaOutlets) => patchDraft({ bulgariaOutlets })}
          onBack={back}
          onNext={next}
        />
      )}
      {step === 'world' && (
        <WorldStep
          selectedTopics={draft.worldTopics}
          selectedRegions={draft.worldRegions}
          onChangeTopics={(worldTopics) => patchDraft({ worldTopics })}
          onChangeRegions={(worldRegions) => patchDraft({ worldRegions })}
          onBack={back}
          onNext={next}
        />
      )}
      {step === 'sports' && (
        <SportsStep
          selectedTeams={draft.footballTeams}
          f1Follow={draft.f1Follow}
          onChangeTeams={(footballTeams) => patchDraft({ footballTeams })}
          onChangeF1={(f1Follow) => patchDraft({ f1Follow })}
          onBack={back}
          onNext={next}
        />
      )}
      {step === 'notifications' && (
        <NotificationsStep
          notifications={draft.notifications}
          onChange={(notifications) => patchDraft({ notifications })}
          onBack={back}
          onFinish={finish}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Do not yet run the wizard test**

The step components don't exist yet (Tasks 16-20 add them). Skip running this suite until after Task 20. Continue to Task 16.

- [ ] **Step 5: Commit**

```bash
git add src/features/onboarding/OnboardingWizard.jsx src/features/onboarding/OnboardingWizard.test.jsx
git commit -m "feat: onboarding wizard shell (state machine)"
```

---

## Task 16: WelcomeStep

**Files:**
- Create: `src/features/onboarding/WelcomeStep.jsx`

- [ ] **Step 1: Implement `src/features/onboarding/WelcomeStep.jsx`**

```jsx
export default function WelcomeStep({ onNext }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h1 style={{ margin: 0 }}>Welcome</h1>
      <p style={{ color: '#666' }}>
        Let's set up your news feed. It'll take about a minute.
      </p>
      <button onClick={onNext}>Continue</button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/onboarding/WelcomeStep.jsx
git commit -m "feat: onboarding — welcome step"
```

---

## Task 17: BulgariaStep (outlet multi-select, requires ≥1)

**Files:**
- Create: `src/features/onboarding/BulgariaStep.jsx`

- [ ] **Step 1: Implement `src/features/onboarding/BulgariaStep.jsx`**

```jsx
import { BULGARIA_OUTLETS } from '../../services/outlets.js';

export default function BulgariaStep({ selected, onChange, onBack, onNext }) {
  function toggle(slug) {
    if (selected.includes(slug)) {
      onChange(selected.filter((s) => s !== slug));
    } else {
      onChange([...selected, slug]);
    }
  }

  const canContinue = selected.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h1 style={{ margin: 0 }}>Which Bulgarian outlets?</h1>
      <p style={{ color: '#666' }}>Pick at least one.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {BULGARIA_OUTLETS.map((o) => (
          <label key={o.slug} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={selected.includes(o.slug)}
              onChange={() => toggle(o.slug)}
            />
            {o.name}
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
        <button onClick={onBack}>Back</button>
        <button disabled={!canContinue} onClick={onNext}>Next</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/onboarding/BulgariaStep.jsx
git commit -m "feat: onboarding — Bulgaria outlet step"
```

---

## Task 18: WorldStep (topics + regions, each ≥1)

**Files:**
- Create: `src/features/onboarding/WorldStep.jsx`

- [ ] **Step 1: Implement `src/features/onboarding/WorldStep.jsx`**

```jsx
import { WORLD_TOPICS, WORLD_REGIONS } from '../../services/worldConfig.js';

function toggle(list, value) {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

export default function WorldStep({
  selectedTopics,
  selectedRegions,
  onChangeTopics,
  onChangeRegions,
  onBack,
  onNext,
}) {
  const canContinue = selectedTopics.length > 0 && selectedRegions.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h1 style={{ margin: 0 }}>World news</h1>

      <section>
        <h2 style={{ fontSize: 16, margin: '0 0 4px' }}>Topics</h2>
        <p style={{ color: '#666', margin: '0 0 8px' }}>Pick at least one.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {WORLD_TOPICS.map((t) => (
            <label key={t.slug} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={selectedTopics.includes(t.slug)}
                onChange={() => onChangeTopics(toggle(selectedTopics, t.slug))}
              />
              {t.name}
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 16, margin: '0 0 4px' }}>Regions</h2>
        <p style={{ color: '#666', margin: '0 0 8px' }}>Pick at least one.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {WORLD_REGIONS.map((r) => (
            <label key={r.slug} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={selectedRegions.includes(r.slug)}
                onChange={() => onChangeRegions(toggle(selectedRegions, r.slug))}
              />
              {r.name}
            </label>
          ))}
        </div>
      </section>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
        <button onClick={onBack}>Back</button>
        <button disabled={!canContinue} onClick={onNext}>Next</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/onboarding/WorldStep.jsx
git commit -m "feat: onboarding — World topics + regions step"
```

---

## Task 19: SportsStep (football + F1, skippable)

**Files:**
- Create: `src/features/onboarding/SportsStep.jsx`

- [ ] **Step 1: Implement `src/features/onboarding/SportsStep.jsx`**

```jsx
import { LEAGUES, teamsByLeague } from '../../services/teams.js';

function toggle(list, value) {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

export default function SportsStep({
  selectedTeams,
  f1Follow,
  onChangeTeams,
  onChangeF1,
  onBack,
  onNext,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h1 style={{ margin: 0 }}>Sports</h1>
      <p style={{ color: '#666' }}>Optional — skip if you don't follow sports.</p>

      <section>
        <h2 style={{ fontSize: 16, margin: '0 0 4px' }}>Football teams</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {LEAGUES.map((l) => (
            <details key={l.id} open>
              <summary style={{ fontWeight: 600, cursor: 'pointer' }}>{l.name}</summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 0 0 12px' }}>
                {teamsByLeague(l.id).map((t) => (
                  <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={selectedTeams.includes(t.id)}
                      onChange={() => onChangeTeams(toggle(selectedTeams, t.id))}
                    />
                    {t.name}
                  </label>
                ))}
              </div>
            </details>
          ))}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 16, margin: '0 0 4px' }}>Formula 1</h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={f1Follow}
            onChange={(e) => onChangeF1(e.target.checked)}
          />
          Follow Formula 1
        </label>
      </section>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
        <button onClick={onBack}>Back</button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onNext}>Skip</button>
          <button onClick={onNext}>Next</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/onboarding/SportsStep.jsx
git commit -m "feat: onboarding — Sports step (football + F1)"
```

---

## Task 20: NotificationsStep (permission + 3 toggles, skippable)

**Files:**
- Create: `src/features/onboarding/NotificationsStep.jsx`

- [ ] **Step 1: Implement `src/features/onboarding/NotificationsStep.jsx`**

FCM token acquisition is out of scope for Plan 1 — it lands in Plan 4 where it belongs with the service worker. This step only asks for browser Notification permission and captures the 3 preference toggles.

```jsx
import { useState } from 'react';

export default function NotificationsStep({ notifications, onChange, onBack, onFinish }) {
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );

  async function requestPermission() {
    if (typeof Notification === 'undefined') {
      setPermission('denied');
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
  }

  function toggle(key) {
    onChange({ ...notifications, [key]: !notifications[key] });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h1 style={{ margin: 0 }}>Notifications</h1>
      <p style={{ color: '#666' }}>Optional — you can change these later in Settings.</p>

      <section>
        <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>Browser permission</h2>
        <div style={{ color: '#333', marginBottom: 8 }}>
          Status: <strong>{permission}</strong>
        </div>
        {permission !== 'granted' && (
          <button onClick={requestPermission}>Enable notifications</button>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>What to alert me about</h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={notifications.bulgariaBreaking}
            onChange={() => toggle('bulgariaBreaking')}
          />
          Bulgaria — breaking news
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={notifications.worldBreaking}
            onChange={() => toggle('worldBreaking')}
          />
          World — breaking news
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={notifications.sportsBreaking}
            onChange={() => toggle('sportsBreaking')}
          />
          Sports — breaking news
        </label>
      </section>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
        <button onClick={onBack}>Back</button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onFinish}>Skip</button>
          <button onClick={onFinish}>Finish</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/onboarding/NotificationsStep.jsx
git commit -m "feat: onboarding — Notifications step"
```

---

## Task 21: Run the full wizard test suite

- [ ] **Step 1: Run the wizard test written in Task 15**

```bash
npm run test:run -- src/features/onboarding/OnboardingWizard.test.jsx
```

Expected: PASS (2 tests).

- [ ] **Step 2: Run the entire suite**

```bash
npm run test:run
```

Expected: all tests PASS. Fix anything red before moving on.

- [ ] **Step 3: Commit any test-selector fixes**

If Step 1 required adjusting the test:

```bash
git add src/features/onboarding/OnboardingWizard.test.jsx
git commit -m "test: refine wizard-suite selectors"
```

---

## Task 22: End-to-end smoke test locally

No new code — just manual verification against a real Firebase project.

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open the browser, open devtools, and walk the flow**

1. Visit the Vite URL (http://localhost:5173).
2. Should see the "Sign in with Google" screen.
3. Click "Continue with Google" — sign in.
4. Should land in the onboarding wizard on the Welcome step.
5. Walk all 5 steps, picking a real outlet, topic, region; skip Sports; skip Notifications.
6. Should land on the Home tab with the "Your daily digest will appear here…" empty state.
7. Click through each tab — Bulgaria, World, Sports, Settings — verify each renders its empty state without errors.
8. In Settings, click "Re-run setup wizard" — verify wizard re-opens with previous answers pre-checked.
9. Finish it again — verify you're back at Home.
10. In Settings, click "Sign out" — verify you land back at the sign-in screen.
11. Sign in again — verify Home tab loads directly (no wizard), prefs persisted.

- [ ] **Step 3: Inspect Firestore**

In the Firebase console, navigate to Firestore Database → `users` → (your uid) → `private` → `preferences`. Verify the doc contains:
- `onboardingComplete: true`
- The outlets, topics, regions you picked
- `notifications.bulgariaBreaking` etc. all booleans
- `createdAt` and `updatedAt` timestamps

- [ ] **Step 4: Verify rules enforcement**

From another Firebase project (or just trust the rules file deployed in Task 2) — rules already forbid cross-user access. No action needed unless you have a second account to actually test. If not, this step is satisfied by the `firestore.rules` source being the security reviewer's sole source of truth for Plan 1.

- [ ] **Step 5: Verify production build compiles**

```bash
npm run build
```

Expected: `dist/` created, no errors. Don't deploy yet — hosting deploy is Task 23.

- [ ] **Step 6: (Optional) Deploy to Hosting**

Since the app has no useful content yet, hosting is optional for Plan 1. If you want a live URL to test PWA install on phones in Plan 4:

```bash
firebase deploy --only hosting
```

Expected: "Deploy complete" and a `*.web.app` URL.

- [ ] **Step 7: Write smoke-test notes**

No commit — this task is manual verification.

---

## Task 23: Run-it-all verification

- [ ] **Step 1: Run the full test suite**

```bash
npm run test:run
```

Expected: all tests PASS.

- [ ] **Step 2: Verify no stray TODOs**

```bash
git grep -n 'TODO\|FIXME' -- 'src/*'
```

Expected: no results (other than commented-out content that the plan intentionally leaves for later plans).

- [ ] **Step 3: Tag the commit**

```bash
git tag plan-1-complete
```

---

## Dependencies between tasks

```
1 (scaffold)
 └─ 2 (firebase config)
     └─ 3 (firebase SDK) ──┬─ 4 (auth service)
                           ├─ 5 (outlets)
                           ├─ 6 (worldConfig)
                           ├─ 7 (teams)
                           └─ 8 (prefs service)
                              └─ 9 (auth context)
                                  └─ 10 (prefs context)
                                      └─ 11 (components)
                                          └─ 12 (empty tabs)
                                              └─ 13 (settings)
                                                  └─ 14 (App root)
                                                      └─ 15 (wizard shell)
                                                          └─ 16-20 (step components)
                                                              └─ 21 (wizard tests green)
                                                                  └─ 22 (manual smoke)
                                                                      └─ 23 (final run)
```

Tasks 4-8 can run in parallel after Task 3. Everything else is sequential.
