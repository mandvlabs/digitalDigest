# Daily Family Digest — Project Notes

Personal news-aggregation PWA. Three sections: **Bulgaria** (Bulgarian-language outlets), **World** (topic × region Google News), **Sports** (football teams + F1). Home shows a 3/3/3 digest across all three.

## Stack

- **Client:** React 19 + Vite 8, modular file layout under `src/`. Inline styles, no CSS framework.
  Lucide-react for icons.
- **Auth + data:** Firebase Web SDK v12 — Google-only auth, Firestore for per-user preferences and the shared `news` collection.
- **Push:** FCM (planned in Plan 4, not wired yet).
- **News ingest:** server-side Cloud Functions pulling RSS every 30 min into Firestore.
- **Hosting:** Firebase Hosting (PWA at https://daily-family-digest.web.app).
- **Cloud Functions:** Node 20, v2 API. Live in us-central1.
- **Tests:** Vitest 4 (client uses jsdom, functions use node).

## Firebase project

- Project ID: `daily-family-digest`
- Plan: **Blaze** (required for Cloud Functions; within free quotas today)
- Hosting URL: https://daily-family-digest.web.app
- Composite indexes: see `firestore.indexes.json`
  - `news (section ASC, publishedAt DESC)` — section-level browse
  - `news (section ASC, tags CONTAINS, publishedAt DESC)` — tag-filtered browse
- Rules: per-user private `users/{uid}/**`; read-only `news/*` for any authed user

## Cloud Functions

| Function | Trigger | Purpose |
|---|---|---|
| `ingestBulgariaNews` | Scheduler (every 30 min) | Pulls RSS from each Bulgarian outlet, writes to `news/{sha1(url)}` with `section=bulgaria`, `tags=['outlet:<slug>']` |
| `ingestWorldNews` | Scheduler (every 30 min) | Google News RSS per topic × region, tagged `topic:<slug>` + `region:<slug>` |
| `ingestSportsNews` | Scheduler (every 30 min) | Google News per team (`"<team>" football when:1d`) + F1. Tags: `team:<id>` or `sport:f1` |
| `cleanupOldNews` | Scheduler (daily) | Deletes `news/*` older than 14 days. Batched (500/batch) |
| `ingestNewsHttp` | HTTP | Manual backfill trigger for all three ingest fns in parallel. `timeoutSeconds: 540`. Gated by `INGEST_KEY` env var (optional) |

Planned (Plan 4):
- `onNewsArticle` — Firestore `news/{id}` onCreate, fan-out push to users following that tag with the right notification pref enabled

Secrets / config:
- `INGEST_KEY` — optional gate for the HTTP trigger, set via `firebase functions:secrets:set`

## Data model

- `users/{uid}/private/preferences` — per-user document
  - `bulgariaOutlets: string[]` — outlet slugs (`dnevnik`, `bnr`, etc.)
  - `worldTopics: string[]` — topic slugs (`politics`, `tech`, etc.)
  - `worldRegions: string[]` — region slugs (`us`, `eu`, `asia`, etc.)
  - `footballTeams: string[]` — team IDs (`PL-ARS`, `PD-BAR`, etc.)
  - `f1Follow: boolean`
  - `notifications: { bulgariaBreaking, worldBreaking, sportsBreaking }` — booleans, all default `false`
  - `fcmTokens: string[]` — planned for Plan 4
- `news/{sha1(url)}` — ingested articles
  - `section: 'bulgaria' | 'world' | 'sports'`
  - `headline, excerpt, url, imageUrl, source`
  - `tags: string[]` — e.g. `['outlet:dnevnik']`, `['topic:tech', 'region:us']`, `['team:PL-ARS', 'sport:football']`
  - `publishedAt: Timestamp | null`
  - `ingestedAt: Timestamp`

## Key client files

- `src/App.jsx` — top-level wiring, auth gate, onboarding gate, tab switching
- `src/main.jsx` — React entry + providers
- `src/contexts/AuthContext.jsx` / `PrefsContext.jsx` — session state
- `src/hooks/useAuth.js`, `usePrefs.js`, `useNews.js` — thin context/data hooks
- `src/services/firebase.js` — SDK init from `VITE_FIREBASE_*` env vars
- `src/services/auth.js` — Google sign-in, sign-out
- `src/services/prefs.js` — Firestore reads/writes for user prefs (merges defaults)
- `src/services/news.js` — Firestore query builders per section with 30-element `array-contains-any` chunking + client-side region filter for World
- `src/services/outlets.js` — Bulgarian outlet registry (slug, name, rssUrl)
- `src/services/worldConfig.js` — `WORLD_TOPICS`, `WORLD_REGIONS` (slug, name, gl, ceid)
- `src/services/teams.js` — `LEAGUES`, `TEAMS` (id, leagueId, name)
- `src/components/Feed.jsx` — shared infinite-scroll feed (IntersectionObserver sentinel)
- `src/components/ArticleCard.jsx`, `EmptyState.jsx`, `ErrorState.jsx`, `Spinner.jsx`, `TabBar.jsx`, `AppLayout.jsx`
- `src/utils/time.js` — relative time formatter (just now / Nm / Nh / Nd / short date)
- `src/features/home/HomeTab.jsx` + `HomeSection.jsx` — 3/3/3 digest with per-section "See all →" that swaps active tab
- `src/features/{bulgaria,world,sports}/{Bulgaria,World,Sports}Tab.jsx` — feed-backed section tabs
- `src/features/settings/SettingsTab.jsx` + `Edit{BulgariaOutlets,WorldPrefs,SportsPrefs}.jsx` + `NotificationsSection.jsx`, `ProfileSection.jsx`
- `src/features/onboarding/OnboardingWizard.jsx` + `{Welcome,Bulgaria,World,Sports,Notifications}Step.jsx`
- `functions/index.js` — admin SDK init + exports all 5 functions
- `functions/ingest{Bulgaria,World,Sports}.js` — scheduled ingest entry points
- `functions/cleanup.js` — 14-day retention sweep
- `functions/ingestHttp.js` — manual HTTP trigger (runs all three in parallel via `Promise.allSettled`)
- `functions/lib/rss.js` — rss-parser wrapper (dynamic ESM import to work around vitest 4 CJS mock limitations)
- `functions/lib/ingest.js` — `sha1(url)` + `writeArticle(db, article)` dedup helper
- `functions/sources/{bulgaria,world,sports}.js` — per-section source config (URL builders)

## Commands

- `npm run dev` — local dev (vite picks first free port from 5173). To pin: `npm run dev -- --port 5180 --strictPort`
- `npm run build` — production build → `dist/`
- `npm run test:run` — one-shot vitest run (client)
- `cd functions && npm run test:run` — functions tests
- `firebase deploy --only hosting` — deploy built app
- `firebase deploy --only functions` — all functions
- `firebase deploy --only functions:<name>` — single function
- `firebase deploy --only firestore:rules,firestore:indexes` — rules + indexes
- `curl https://us-central1-daily-family-digest.cloudfunctions.net/ingestNewsHttp` — manual ingest kick (may timeout at Firebase proxy ~30s; the function keeps running to 540s)

## Conventions / gotchas

- **Flex-scroll layout:** every scrollable flex column needs `minHeight: 0` — otherwise content overflows instead of scrolling. Used consistently in `Feed`, `SettingsTab`, tab sections.
- **Firestore `array-contains-any` is capped at 30 elements.** `src/services/news.js` chunks larger tag arrays, runs parallel queries, dedups by doc ID (a doc can match via different tags in different chunks), and merges by `publishedAt desc`. Chunked paths don't return a unified cursor — first page is full, `loadMore` is best-effort.
- **Firestore cannot AND two `array-contains-any`.** World section queries by `topic:` tags (≤ 7 items, no chunking) and filters by region client-side. `fetchWorldNews` fetches `limit * 3` to leave room for the region filter.
- **Deduplication via `sha1(url)`.** `news/{sha1(url)}`; `writeArticle` skips if doc already exists (avoids unnecessary writes on re-ingest).
- **`publishedAt` may be `null`** when the RSS feed has a missing/invalid pubDate. Sort fallback treats null as 0 (pushes them to the end).
- **vitest 4 CJS mock interop:** `functions/lib/rss.js` uses `await import('rss-parser')` dynamically instead of top-level `require`, because vitest 4 can't intercept a top-level `require` the way v1 could.
- **Default `notifications.*` is `false`** — matches real subscription state since we haven't auto-requested permission yet.
- **No `.env` in git** — `.gitignore` covers it. Firebase web config is exposed to the browser via `VITE_*` (safe, protected by security rules).
- **Firebase HTTP proxy timeout ~30 s** — but Cloud Function `timeoutSeconds: 540` keeps the work running after the HTTP response drops. `curl` on `ingestNewsHttp` will show `upstream request timeout` even on successful ingest; check function logs to confirm.
- **`firebase deploy --only functions` needs Blaze plan.** Free tier blocks. Upgrade path was smooth; stays within free quotas at current usage.
- **iOS web push:** only works if the PWA is installed to home screen (iOS 16.4+). Relevant for Plan 4.

## What's done

### Plan 1 — Foundation (complete)
- Vite + React 19 scaffold, Firebase SDK init
- Google auth + AuthContext, PrefsContext with defaults-merging
- 5-tab nav (Home, Bulgaria, World, Sports, Settings) in `AppLayout` + `TabBar`
- Onboarding wizard — 5 steps saving to `users/{uid}/private/preferences`
- Static configs: `outlets.js`, `worldConfig.js`, `teams.js`
- Deployed to `daily-family-digest.web.app`

### Plan 2 — Ingest Pipeline (complete)
- `functions/` package, Node 20, firebase-admin 13, firebase-functions 6, rss-parser 3
- Scheduled ingest (every 30 min) for Bulgaria, World, Sports
- `news/{sha1(url)}` dedup via `writeArticle`
- `cleanupOldNews` — 14-day retention, batched
- `ingestNewsHttp` — HTTP trigger, 540s timeout, runs all three in parallel
- `firestore.rules` allows authed read of `news/*`
- 2 composite indexes for tag-filtered browse
- First run: 192 Bulgaria + 1,265 Sports + 4,900 World articles
- Spec: [docs/superpowers/specs/2026-04-23-daily-family-digest-design.md](docs/superpowers/specs/2026-04-23-daily-family-digest-design.md)
- Plan: [docs/superpowers/plans/2026-04-23-plan-2-ingest-pipeline.md](docs/superpowers/plans/2026-04-23-plan-2-ingest-pipeline.md)

### Plan 3 — Feeds + Home (complete, tag `plan-3-complete`)
- `src/utils/time.js` — relative time formatter (7 tests)
- `src/services/news.js` — query builders with chunking + client-side region filter (9 tests)
- `src/hooks/useNews.js` — pagination hook (`articles, loading, error, hasMore, loadMore, refresh`) (6 tests)
- `src/components/ArticleCard.jsx` — link card with image, source, relative time (5 tests)
- `src/components/Feed.jsx` + `EmptyState.jsx` + `ErrorState.jsx` — shared infinite-scroll feed via IntersectionObserver
- `BulgariaTab`, `WorldTab`, `SportsTab` — feed-backed, with Sports showing "No sports prefs set" when empty
- `HomeTab` 3/3/3 digest + `HomeSection` with "See all →" that calls `onNavigate` prop wired to `setActiveTab` in `App.jsx`
- Settings edit flows — `EditBulgariaOutlets`, `EditWorldPrefs`, `EditSportsPrefs`, `NotificationsSection`, updated `SettingsTab`
- 70/70 tests pass, prod build clean (572 kB)
- Plan: [docs/superpowers/plans/2026-04-23-plan-3-feeds-home.md](docs/superpowers/plans/2026-04-23-plan-3-feeds-home.md)

## Roadmap

### Plan 4 — Push + PWA polish (pending, not yet written)
- FCM token capture on sign-in, stored in `users/{uid}/private/preferences.fcmTokens`
- Service worker for background push (`public/firebase-messaging-sw.js`)
- PWA manifest (`public/manifest.webmanifest`), icons, install prompts
- `onNewsArticle` Firestore trigger — on-create fan-out push to users following matching tag with the right `notifications.*` toggle
- Per-user rate limiting (avoid push floods on burst ingests)
- CI deploy (GitHub Actions → `firebase deploy --only hosting,functions` on main)
- Offline-ready SW precache for the shell

### Nice-to-haves (no plan yet)
- Pull-to-refresh gesture (the `refresh` fn is already exposed by `useNews`)
- Filter chip row for session-only narrowing within a section
- Light mode toggle
- Code splitting (current bundle ~573 kB)
- Offline banner
- Per-article dismiss / "read" state
