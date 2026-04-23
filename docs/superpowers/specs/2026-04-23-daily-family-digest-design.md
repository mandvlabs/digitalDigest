# Daily Family Digest — v1 Design

**Date:** 2026-04-23
**Status:** Approved design, ready for implementation planning
**Scope:** v1 only. v2 (football fixtures/tables/reminders) and v3 (F1 calendar/standings/reminders) are out of scope for this spec.

---

## 1. Product summary

A personal Progressive Web App that aggregates news from three sections:

1. **Bulgaria** — curated Bulgarian outlets via RSS
2. **World** — global news filtered by topic + region via Google News RSS
3. **Sports** — news for followed football teams + Formula 1 (news only in v1)

Content is multilingual (English UI, articles in their source language). First-launch onboarding is required and persists prefs per-user in Firestore.

Primary user: the project owner (personal use). Not public. No multi-tenant concerns beyond Firestore security rules isolating each authed user's private data.

---

## 2. Stack

- **Client:** React 18 + Vite 6, feature-folder structure (not single-file)
- **Auth + data:** Firebase Web SDK v12 — Google sign-in, Firestore for prefs
- **Push:** Firebase Cloud Messaging (FCM) via service worker
- **Hosting:** Firebase Hosting
- **Cloud Functions:** Node 20, v2 API, us-central1
- **Icons:** Lucide-react
- **Styling:** inline styles / CSS modules (decide during implementation; no heavy framework)

New Firebase project, independent from My Sports Scores. New git repo at `/Users/vladislavgeorgiev/Daily Family Digest/`.

---

## 3. High-level architecture

```
                  Scheduled Cloud Functions (every 30 min)
                  ──────────────────────────────────────────
                  ingestBulgariaNews  ingestWorldNews  ingestSportsNews
                              │             │             │
                              └─── write ───┼─── write ───┘
                                            ▼
                                   Firestore: news/{sha1(url)}
                                            │
                                            │ onCreate trigger
                                            ▼
                                    onNewsArticle → FCM fan-out
                                            │
                                            ▼
                        Client PWA  ←────── Firestore reads ────
                    (React + Firebase SDK)    (filtered by prefs)
```

---

## 4. Project layout

```
/Users/vladislavgeorgiev/Daily Family Digest/
├─ src/
│  ├─ features/
│  │  ├─ home/           # today's digest across sections
│  │  ├─ bulgaria/       # feed + outlet picker
│  │  ├─ world/          # feed + topic/region picker
│  │  ├─ sports/         # feed (v1 = news only)
│  │  ├─ onboarding/     # 5-step wizard
│  │  └─ settings/
│  ├─ services/          # firebase, news, prefs, messaging, rssFeeds
│  ├─ hooks/             # usePrefs, useNews
│  ├─ components/        # ArticleCard, TabBar, SectionHeader, etc.
│  ├─ App.jsx
│  └─ main.jsx
├─ functions/            # Cloud Functions (ingest + push fan-out)
├─ public/               # manifest, service worker, firebase-messaging-sw
├─ firestore.rules
├─ firestore.indexes.json
├─ docs/
└─ package.json
```

---

## 5. Data model (Firestore)

### `users/{uid}/private/preferences`

```js
{
  // Bulgaria section
  bulgariaOutlets: string[],        // e.g. ["dnevnik", "mediapool", "bnr"]

  // World section
  worldTopics: string[],            // e.g. ["politics", "business", "tech"]
  worldRegions: string[],           // e.g. ["us", "eu", "middle-east"]

  // Sports (v1 = news only)
  footballTeams: string[],          // e.g. ["PL-ARS", "PL-LIV"]
  f1Follow: boolean,                // single toggle: do you follow F1?

  // Notifications
  notifications: {
    bulgariaBreaking: boolean,
    worldBreaking: boolean,
    sportsBreaking: boolean
  },

  // Device tokens for push
  fcmTokens: string[],

  // Onboarding state
  onboardingComplete: boolean,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### `users/{uid}/private/pushState`

```js
{
  lastPushAt: {
    bulgaria: Timestamp | null,
    world: Timestamp | null,
    sports: Timestamp | null
  }
}
```

Used for rate-limiting: no more than one push per section per 30 minutes per user.

### `news/{sha1(url)}` — shared across all users

```js
{
  section: "bulgaria" | "world" | "sports",
  headline: string,
  excerpt: string,                  // first ~200 chars if available
  url: string,
  source: string,                   // e.g. "Dnevnik", "BBC"
  imageUrl: string | null,          // from RSS media tag if present
  tags: string[],                   // shape per section (see below)
  publishedAt: Timestamp,
  ingestedAt: Timestamp
}
```

**Tag conventions:**
- Bulgaria: `["outlet:<slug>"]` — e.g. `["outlet:dnevnik"]`
- World: `["topic:<slug>", "region:<slug>"]` — e.g. `["topic:politics", "region:us"]`
- Sports (football): `["team:<teamId>", "sport:football"]`
- Sports (F1): `["sport:f1"]`

Dedupe by `sha1(url)` — same URL ingested twice is one Firestore doc.

### Retention

Daily scheduled `cleanupOldNews` deletes docs where `ingestedAt < now - 14 days`.

### Firestore rules

- `users/{uid}/**` — read/write only when `request.auth.uid == uid`
- `news/**` — read for any authed user; write only via admin SDK (Cloud Functions)

### Composite indexes

- `news` on `(section, publishedAt desc)`
- `news` on `(section, tags array-contains, publishedAt desc)`

---

## 6. Ingest pipeline (Cloud Functions)

### `ingestBulgariaNews` — scheduler, every 30 min

Hard-coded outlet → RSS URL map. Initial list (editable before launch):

- Dnevnik, Mediapool, BNR, Sega, Offnews, Darik, Nova, bTV, Club Z, Capital

For each outlet: fetch RSS → parse → for each item, check if `news/{sha1(url)}` exists; if not, write with `section: "bulgaria"`, `tags: ["outlet:<slug>"]`.

### `ingestWorldNews` — scheduler, every 30 min

Topic × region query matrix. Hard-coded:

- **Topics:** `politics, business, tech, science, health, entertainment, sports`
  (note: the `sports` world topic is a general catch-all; the dedicated Sports section is separate and has its own ingest)
- **Regions:** `us, uk, eu, asia, middle-east, africa, latam`

URL shape: `https://news.google.com/rss/search?q=<topic>+when:1d&hl=en&gl=<region>&ceid=<region>:en`

Each result tagged `["topic:<t>", "region:<r>"]`. URL-level dedupe handles items appearing in multiple topic/region combos.

### `ingestSportsNews` — scheduler, every 30 min

- For each football team in the team list (mirror of `teams.js` from My Sports Scores): Google News RSS query on team name, tag with `["team:<teamId>", "sport:football"]`.
- For F1: single query `"Formula 1"`, tag with `["sport:f1"]`.

### `onNewsArticle` — Firestore `news/{id}` onCreate

Fan-out push notification:

1. Load article's `section`, `tags`, `publishedAt`.
2. Skip if `publishedAt < now - 6 hours` (avoids backfill blast).
3. Find matching users (see matching logic in Section 8).
4. For each matching user, check rate limit (`pushState.lastPushAt[section]` ≥ 30 min ago).
5. Send FCM to each valid `fcmTokens[]` entry; update `pushState.lastPushAt[section] = now`.
6. On invalid-token errors, remove token from the user's `fcmTokens[]`.

### `cleanupOldNews` — scheduler, daily

Deletes `news` docs where `ingestedAt < now - 14 days`.

### Manual trigger

`ingestNewsHttp` — optional HTTP function gated by `INGEST_KEY` env var for debugging. Mirrors My Sports Scores pattern.

### Failure handling

- Per-outlet/per-query try/catch — one bad feed doesn't abort the run
- Structured Cloud Logging on all errors
- No retries on RSS failures; the next scheduled run naturally retries
- Fan-out errors logged and swallowed per-user — one broken token never blocks others

---

## 7. Client structure

### Navigation

Bottom tab bar with 5 tabs: **Home | Bulgaria | World | Sports | Settings**.

### Onboarding (required on first launch, re-runnable from Settings)

5 steps. Steps 2 and 3 require at least one selection; steps 4 and 5 are skippable with documented defaults.

1. **Welcome + Google sign-in**
2. **Bulgaria outlets** — multi-select from ~10, must pick ≥1
3. **World preferences** — Topics multi-select (≥1) + Regions multi-select (≥1)
4. **Sports** —
   - Football: search/pick teams from 5 leagues (reuse My Sports Scores team list), can pick 0+
   - F1: single "Follow F1" toggle
   - Entire step skippable; skipping sets football `[]` and `f1Follow: false`
5. **Notifications** — request browser permission, show 3 toggles (Bulgaria / World / Sports breaking). Skippable; defaults all to `false`.

On finish: write prefs, set `onboardingComplete: true`, land on **Home**.

### Screens

**Home — today's digest**
- "Top from Bulgaria" (3 latest from user's outlets)
- "Top from the World" (3 latest matching topics ∩ regions)
- "Top from Sports" (3 latest for followed teams + F1 if enabled)
- Each block has a "See all →" link to its tab

**Bulgaria / World / Sports — reverse-chronological feed**
- Infinite scroll, `limit(30)` + cursor pagination
- Pull-to-refresh
- Filter chip row at top for session-level narrowing (e.g. toggle one outlet off for this session)
- Each item = `ArticleCard`:
  - source + relative time
  - headline
  - excerpt
  - optional image (lazy-loaded)
  - "Read on [source]" → opens URL in new tab (A+light pattern — no in-app webview)

**Settings**
- Profile: email, sign-out, delete account
- Edit preferences: entry points for each onboarding step (re-runnable)
- Notification toggles (same 3 as onboarding)
- About / version
- iOS hint: if running in a regular Safari tab on iOS, show "Install to home screen to enable push"

### State management

- React context for auth + prefs (live Firestore subscription)
- Component-local state everywhere else
- No Redux / Zustand / similar

### Hooks & services

- `usePrefs()` — live Firestore subscription, returns `{ prefs, loading, update }`
- `useNews(section)` — Firestore query per section, takes prefs into account; returns `{ articles, loading, loadMore, refresh }`
- `services/firebase.js` — SDK init from `VITE_FIREBASE_*` env vars
- `services/prefs.js` — read/write user preferences
- `services/news.js` — query builders; handles `array-contains-any` 30-element cap by chunking
- `services/messaging.js` — FCM token lifecycle; writes/removes tokens from `fcmTokens[]`
- `services/rssFeeds.js` — static slug → display name map (mirrored on server for ingest)

---

## 8. Push notification matching

Article triggers a push to user `U` only if all of:

- `article.publishedAt` within the last 6 hours
- `U.notifications.<section>Breaking === true`
- `U.pushState.lastPushAt[section]` is null or ≥ 30 min ago
- Section-specific content match:
  - **Bulgaria:** article tag `outlet:<x>` exists where `<x> ∈ U.bulgariaOutlets`
  - **World:** article has a `topic:<t>` where `t ∈ U.worldTopics` **AND** a `region:<r>` where `r ∈ U.worldRegions`
  - **Sports:**
    - article has `team:<x>` where `x ∈ U.footballTeams`, OR
    - article has `sport:f1` AND `U.f1Follow === true`

### Notification payload

- Title: `article.source` (e.g. "BBC")
- Body: `article.headline`
- Data: `{ url: article.url }` — tap opens `article.url` externally

### Foreground behavior

`onMessage` handler shows an in-app toast and suppresses the native notification (prevents duplicate).

### iOS note

Web push on iOS requires the PWA to be installed to home screen (iOS 16.4+). Settings surfaces this as a hint when running in a regular tab.

---

## 9. Error handling

### Client

- **Auth failure** — retry screen with the Firebase error message
- **Firestore read failure** — "Couldn't load — tap to retry" per feed, never a blank screen
- **Empty feed (valid, no articles)** — "No articles yet. Check back later." + refresh button
- **FCM permission denied** — Settings shows "Notifications blocked — enable in browser settings"
- **Offline** — Firestore SDK local persistence handles reads; top banner when offline
- **Incomplete onboarding** — router gates on `onboardingComplete`; any section access without prefs runs the wizard

### Functions

- Per-outlet / per-query try/catch in ingest
- Structured Cloud Logging on failure (function name, outlet/section, error)
- No alerting infra in v1 — Cloud Logging inspected on demand
- Dead FCM tokens removed on `messaging/registration-token-not-registered` or `messaging/invalid-registration-token`

---

## 10. Testing

Pragmatic, not exhaustive.

### Unit tests (Vitest)

- `services/news.js` query builder — especially the 30-element `array-contains-any` chunking logic
- Push-match logic in functions (pure fn: given article + prefs, fire? which tokens?)
- RSS parser adapter — given fixture XML, produces expected article records

### Hook tests

- Light tests for `usePrefs`, `useNews` using the Firebase Emulator Suite

### Component tests

- No snapshot tests
- 1–2 interaction tests for the onboarding wizard with React Testing Library

### E2E

- None for v1
- `docs/manual-qa.md` checklist for manual smoke tests

### Functions

- Firebase Emulator Suite for local dev
- Integration test: seed fake articles, verify fan-out targets expected users

---

## 11. Deployment

### Environments

- **Dev:** Firebase Emulator Suite locally, `npm run dev` at `http://localhost:5173`
- **Prod:** Firebase Hosting at a `*.web.app` URL

### CI (GitHub Actions)

On push to `main`:
1. `npm test`
2. `npm run build`
3. `firebase deploy --only hosting,functions,firestore:rules,firestore:indexes` (via service account secret)

### Secrets / env

- `VITE_FIREBASE_*` (client-safe config)
- `VITE_FCM_VAPID_KEY` (client-safe)
- `INGEST_KEY` (optional server-side HTTP trigger gate)

No third-party API keys needed — all news sources are free public RSS feeds.

---

## 12. Out of scope for v1

Explicitly deferred. Each will get its own design doc when we start it.

- **v2** — Football fixtures, standings, match details, kickoff reminder pushes. Server-side fixture ingest into Firestore (port from My Sports Scores), scheduled reminder function.
- **v3** — F1 race calendar, driver & constructor standings, race detail screens, race reminder pushes. Via Jolpica-F1 (Ergast successor).
- Bookmarks / "Saved articles"
- In-app article webview (not possible cleanly in a PWA — publishers block iframes)
- Reader mode article extraction
- Search across feeds
- Multi-user (this is personal-only)
- Light mode
- Code splitting / bundle optimization
- Offline pre-cache of the shell

---

## 13. Open questions to confirm during implementation

- Final Bulgarian outlet list and their specific RSS URLs — verify each is live and well-formed before hard-coding
- Final World topic and region slug lists (above is a starting set)
- Football team list — reuse My Sports Scores `teams.js` verbatim, or trim to a smaller set
- Whether to use CSS modules or inline styles (style choice, not architecture)
- Exact icon set and visual identity — decide early implementation, not in spec

---

## 14. Success criteria for v1

The app is "done" when, signed in on phone and desktop:

1. First-launch onboarding flows end-to-end and persists prefs to Firestore
2. Home tab shows a 3/3/3 digest across sections, updating as new articles ingest
3. Each section tab shows a paginated, pull-to-refresh feed filtered by the user's prefs
4. Tapping an article opens it externally
5. Enabling notifications and waiting for fresh articles produces targeted pushes, respecting the 30-min-per-section rate limit
6. iOS installed-to-home-screen behaviour works (pushes received when installed, hint shown when not)
7. Signing out clears auth state; re-signing in restores prefs (no device-specific storage assumed)
8. Deleting account wipes `users/{uid}/**` and signs out
