# Daily Family Digest — Project Notes

Personal news-aggregation PWA. Three sections: **Bulgaria** (Bulgarian-language outlets), **World** (topic × region Google News), **Sports** (football teams + F1). Home shows a 3/3/3 digest across all three.

## Stack

- **Client:** React 19 + Vite 8, modular file layout under `src/`. Inline styles, no CSS framework.
  Lucide-react for icons.
- **Auth + data:** Firebase Web SDK v12 — Google-only auth, Firestore for per-user preferences and the shared `news` collection.
- **Push:** FCM via service worker (`public/firebase-messaging-sw.js`). Foreground messages surface as an in-app toast (macOS / Android); iOS PWAs always route push through the SW even when focused. Tapping a notification opens an in-app `ArticleReader` interstitial with headline/excerpt + "Open article" (system browser) + "Back" (returns to tabs). The SW has a custom `notificationclick` handler (registered BEFORE `importScripts` so FCM's SDK can't `stopImmediatePropagation` over it); it stashes the article ID in IndexedDB, then tries `WindowClient.navigate()` + `postMessage()` to route the running PWA, falling back to `openWindow()` for cold launch. The client reads the article ID via four redundant recovery paths (URL query, Launch Handler API, SW `postMessage`, **IndexedDB stash**) — the IDB path is the only one that reliably survives iOS WebKit Bug 263687. We do NOT register `onBackgroundMessage` — FCM's native display path handles the notification from the top-level `notification` block; adding a custom handler causes duplicate notifications on iOS.
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
- Field overrides (collection group): `private.notifications.{bulgaria,world,sports}Breaking` — single-field COLLECTION_GROUP indexes for `onNewsArticle` fan-out query
- Rules: per-user private `users/{uid}/**`; read-only `news/*` for any authed user

## Cloud Functions

| Function | Trigger | Purpose |
|---|---|---|
| `ingestBulgariaNews` | Scheduler (every 30 min) | Pulls RSS from each Bulgarian outlet, writes to `news/{sha1(url)}` with `section=bulgaria`, `tags=['outlet:<slug>']` |
| `ingestWorldNews` | Scheduler (every 30 min) | Google News RSS per topic × region, tagged `topic:<slug>` + `region:<slug>` |
| `ingestSportsNews` | Scheduler (every 30 min) | Google News per team (`"<team>" football when:1d`) + F1. Tags: `team:<id>` or `sport:f1` |
| `cleanupOldNews` | Scheduler (daily) | Deletes `news/*` older than 14 days. Batched (500/batch) |
| `ingestNewsHttp` | HTTP | Manual backfill trigger for all three ingest fns in parallel. `timeoutSeconds: 540`. Gated by `INGEST_KEY` env var (optional) |
| `onNewsArticle` | Firestore `news/{id}` onCreate | Fan-out push to users with matching `notifications.<section>Breaking=true` via `collectionGroup('private')`. Pure `pushMatch` logic (6h freshness, section toggle, 30-min per-section cooldown via `users/{uid}/private/pushState`, content match by tag). Prunes dead tokens on FCM `registration-token-not-registered` / `invalid-registration-token`. Payload shape: top-level `notification: { title, body }` for FCM's auto-display, `data: { section, targetRoute: '/?article=<docId>', articleUrl }` for our SW's notificationclick handler + reader interstitial, `webpush.fcmOptions.link: '<APP_ORIGIN>/?article=<docId>'` as same-origin fallback. |

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
  - `fcmTokens: string[]` — device tokens, appended on permission grant
- `users/{uid}/private/pushState` — per-user push rate-limit state
  - `lastPushAt: { bulgaria?, world?, sports? }` — serverTimestamps of the last push we sent for each section (30-min cooldown enforced by `pushMatch`)
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
- `src/components/ArticleCard.jsx` (hides broken images via `onError` so RSS feeds with bad/hotlink-protected image URLs render as clean text-only cards), `EmptyState.jsx`, `ErrorState.jsx`, `Spinner.jsx`, `TabBar.jsx`, `AppLayout.jsx`
- `src/utils/time.js` — relative time formatter (just now / Nm / Nh / Nd / short date)
- `src/features/home/HomeTab.jsx` + `HomeSection.jsx` — 3/3/3 digest with per-section "See all →" that swaps active tab
- `src/features/{bulgaria,world,sports}/{Bulgaria,World,Sports}Tab.jsx` — feed-backed section tabs
- `src/features/settings/SettingsTab.jsx` + `Edit{BulgariaOutlets,WorldPrefs,SportsPrefs}.jsx` + `NotificationsSection.jsx`, `ProfileSection.jsx`
- `src/features/onboarding/OnboardingWizard.jsx` + `{Welcome,Bulgaria,World,Sports,Notifications}Step.jsx`
- `src/services/messaging.js` — `subscribeToken(uid)` (registers SW, gets FCM token via VAPID, stores in prefs), `onForegroundMessage(cb)`
- `src/hooks/useMessaging.js` — wires foreground FCM → `{ toast, dismiss }` in `<AuthenticatedApp>`
- `src/components/PushToast.jsx` — fixed-bottom in-app toast with title/body/Read link
- `src/utils/standalone.js` — `isStandalone()` + `isIos()` for PWA-install detection
- `src/utils/pendingArticle.js` — tiny IDB client that consumes the article ID stashed by the SW's notificationclick handler. Only reliable recovery path on iOS cold launch (WebKit Bug 263687 rewrites the URL to `start_url`, so URL/Launch-Handler/postMessage paths all lose the ID).
- `src/features/reader/ArticleReader.jsx` — in-app article interstitial (fetches article from Firestore by doc ID, shows headline/source/excerpt/image, "Open article →" to system browser, "← Back" to tab view)
- `src/features/settings/InstallHint.jsx` — iOS-specific "Add to Home Screen" hint above Notifications in Settings
- `public/manifest.webmanifest`, `public/icon-{192,512}.png`, `public/icon-maskable-512.png` — PWA manifest + icons (sunrise-over-headlines design, purple/peach gradient). `short_name` is `DailyDigest`; theme color `#5b1a9e`. Maskable entry in the manifest points at the dedicated maskable PNG with an 80% safe zone.
- `public/firebase-messaging-sw.js` — FCM SW with custom `notificationclick` handler (registered BEFORE `importScripts`). Handler: extracts article ID from `data.targetRoute` (or `data.FCM_MSG.data.targetRoute` for FCM-auto-displayed notifications), **stashes it in IndexedDB** (`dfd-push.pending[article]`), then tries `client.focus()` + `client.navigate()` + `postMessage` to a running client, falling back to `openWindow` for cold launch. Does NOT register `onBackgroundMessage` (FCM auto-displays from top-level `notification`; a second showNotification would duplicate).
- `functions/ingest{Bulgaria,World,Sports}.js` — scheduled ingest entry points
- `functions/cleanup.js` — 14-day retention sweep
- `functions/ingestHttp.js` — manual HTTP trigger (runs all three in parallel via `Promise.allSettled`)
- `functions/lib/rss.js` — rss-parser wrapper (dynamic ESM import to work around vitest 4 CJS mock limitations)
- `functions/lib/ingest.js` — `sha1(url)` + `writeArticle(db, article)` dedup helper
- `functions/lib/pushMatch.js` — pure fan-out logic (freshness, toggle, cooldown, content match); 13 tests
- `functions/onNewsArticle.js` — Firestore onCreate trigger wrapping `pushMatch` + `sendEachForMulticast` + dead-token pruning. Payload shape: `{ tokens, data: { section }, webpush: { notification: { title, body, icon }, fcmOptions: { link: article.url } } }` — notification block drives FCM's native display (avoids duplicate push on iOS where a data-only payload + custom `onBackgroundMessage` both tried to show a toast), and `fcmOptions.link` is what FCM opens on tap.
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
- **Default `notifications.*` is `false`** — matches real subscription state; permission is requested only on the explicit "Enable notifications" action in onboarding or Settings.
- **FCM background SW config via URL query params** — `firebase-messaging-sw.js` is a static file that can't read Vite env vars directly, so `subscribeToken` registers it with `?apiKey=…&projectId=…&messagingSenderId=…&appId=…` appended. The SW reads those with `new URL(self.location).searchParams`.
- **Collection-group queries on nested fields need explicit index overrides.** `onNewsArticle` queries `collectionGroup('private').where('notifications.<section>Breaking','==',true)` — see `firestore.indexes.json fieldOverrides`.
- **No `.env` in git** — `.gitignore` covers it. Firebase web config is exposed to the browser via `VITE_*` (safe, protected by security rules).
- **Firebase HTTP proxy timeout ~30 s** — but Cloud Function `timeoutSeconds: 540` keeps the work running after the HTTP response drops. `curl` on `ingestNewsHttp` will show `upstream request timeout` even on successful ingest; check function logs to confirm.
- **`firebase deploy --only functions` needs Blaze plan.** Free tier blocks. Upgrade path was smooth; stays within free quotas at current usage.
- **iOS web push:** only works if the PWA is installed to home screen (iOS 16.4+). `InstallHint` shown above the Notifications section in Settings when not already standalone.
- **`notificationclick` handler must be registered BEFORE `importScripts` of the Firebase SDK.** FCM's SDK registers its own `notificationclick` handler that calls `event.stopImmediatePropagation()` — any handler registered after `importScripts` is silently skipped. Our SW registers the custom handler first, then imports Firebase.
- **iOS PWA cold-launch deep-link — WebKit Bug 263687 (worked around).** On iOS standalone PWAs, `clients.openWindow('/?article=<id>')` from an SW `notificationclick` gets its URL rewritten to `start_url` on cold launch, losing the query param. Our workaround: the SW also writes `{ articleId, ts }` to IndexedDB (`dfd-push.pending[article]`) before calling `openWindow`. On mount, the React app reads and clears the IDB entry (<60s freshness window) — this path survives the URL rewrite and is what actually makes cold-launch tap → reader work on iOS. Verified on real iPhone both cold (PWA killed) and warm (PWA in App Switcher).
- **iOS PWAs do NOT fire foreground `onMessage` for push.** Unlike macOS Safari and Chrome, iOS always routes FCM pushes through the SW (system notification), even when the PWA is open and focused. The in-app `PushToast` component is effectively macOS/Android-only. On iOS the only tap → reader path is notification tap → SW notificationclick → IDB stash / navigate / postMessage.
- **Cold-start auth flash.** `setLoading(false)` in `AuthContext` MUST fire inside the `onAuthStateChanged` callback, not from `getRedirectResult().finally(...)`. Otherwise `loading=false && user=null` for the ~1s window before the auth listener hydrates a persisted user, causing the sign-in screen to flash before the app lands on Home. Keep the spinner up until auth actually resolves.
- **Home-screen label is frozen at install time on iOS.** Changing `apple-mobile-web-app-title` in `index.html` does not update the label of already-installed shortcuts — user must Remove from Home Screen and re-Add. Same for icons if the *file path* in the manifest didn't change.
- **Firebase Hosting CDN caches aggressively.** `firebase deploy --only hosting` usually invalidates the edge, but we've seen `manifest.webmanifest` / icon changes appear to deploy successfully while the CDN still served the prior version for ~10-15 minutes. Verify by checking `curl -sI` `last-modified` against local deploy time, or force a redeploy if mismatched.
- **CSS must be explicitly imported in `main.jsx`.** `src/index.css` is not picked up by Vite automatically — it has to be `import './index.css'` in the entry. We lost an hour to this when font/button/checkbox size changes weren't appearing on mobile.

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

### Plan 4 — Push + PWA polish (complete)
- PWA manifest + iOS `apple-mobile-web-app-*` meta tags, 192/512 icons
- `addFcmToken`/`removeFcmToken` helpers on `prefs.js`
- `src/services/messaging.js` — `subscribeToken(uid)` + `onForegroundMessage`
- `public/firebase-messaging-sw.js` — background handler (notification click → focus existing tab or open URL)
- `useMessaging` hook + `PushToast` component mounted in `AuthenticatedApp`
- Onboarding NotificationsStep + Settings NotificationsSection wired to `subscribeToken` with permission-state UI
- `InstallHint` shown when app is not standalone (iOS-specific copy vs generic)
- `functions/lib/pushMatch.js` — pure match (6h freshness, per-section toggle, 30-min cooldown, content match: outlet / topic AND region / team OR F1-follow)
- `functions/onNewsArticle.js` — Firestore onCreate trigger fan-out via `collectionGroup('private')`; sends via `sendEachForMulticast`; prunes dead tokens (`registration-token-not-registered` / `invalid-registration-token`); writes `pushState.lastPushAt[section]` on success
- Firestore field overrides for `notifications.{bulgaria,world,sports}Breaking` collection-group indexes
- GitHub Actions `.github/workflows/deploy.yml` — tests → build (with VITE_FIREBASE_* secrets) → hosting deploy → functions + rules + indexes deploy on push to `main`
- 107 client tests + 26 function tests, prod build emits manifest / sw / icons
- Plan: [docs/superpowers/plans/2026-04-23-plan-4-push-pwa.md](docs/superpowers/plans/2026-04-23-plan-4-push-pwa.md)

**Remaining user action:** Add these secrets to the GitHub repo before the CI workflow can deploy: `FIREBASE_SERVICE_ACCOUNT_DAILY_FAMILY_DIGEST` (service-account JSON), `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FCM_VAPID_KEY`.

### Plan 5 — Push Notification Deep-Linking Fix (complete, verified on iPhone)

- Rewrote `public/firebase-messaging-sw.js` — custom `notificationclick` handler registered BEFORE `importScripts` (so FCM's SDK can't `stopImmediatePropagation` over it). Handler stashes the article ID in IndexedDB (`dfd-push.pending[article]`), then tries `client.focus()` + `client.navigate()` + `postMessage` to a running PWA, falling back to `openWindow` for cold launch. Does NOT register `onBackgroundMessage` — FCM's native display already shows the notification from the top-level `notification` block; a custom handler there caused duplicate notifications on iOS.
- Changed FCM payload in `functions/onNewsArticle.js` — top-level `notification: { title, body }` for FCM's auto-display, `data: { section, targetRoute: '/?article=<docId>', articleUrl }` for our SW handler and reader interstitial, `webpush.fcmOptions.link` points at the same internal `/?article=<docId>` route (same-origin fallback for browsers where our custom handler doesn't fire).
- New `src/features/reader/ArticleReader.jsx` — in-app interstitial showing headline, source, excerpt, image + "Open article →" (opens system browser via `target="_blank"`) + "← Back" (returns to tab view)
- New `src/utils/pendingArticle.js` — tiny IDB consumer the React app calls on mount to recover the article ID stashed by the SW.
- Deep-link bridge in `src/App.jsx` — **four** redundant recovery paths: (1) URL query param on mount, (2) Launch Handler API for Chromium, (3) `postMessage` from SW for running PWAs, (4) IndexedDB stash read on mount (the only path that reliably survives iOS WebKit Bug 263687 on cold launch).
- Added `launch_handler: { client_mode: "navigate-existing" }` to `manifest.webmanifest`
- Updated `useMessaging` + `PushToast` — foreground toast "Read" opens the in-app reader via `onArticleOpen(articleId)` callback (still useful on macOS/Chrome/Android; iOS doesn't fire foreground `onMessage` so the toast path doesn't apply there).
- Verified on real iPhone: tap notification → reader opens reliably whether PWA is killed (cold launch) OR in App Switcher (warm).
- Spec: [docs/superpowers/specs/2026-04-24-push-notification-deep-linking.md](docs/superpowers/specs/2026-04-24-push-notification-deep-linking.md)
- Plan: [docs/superpowers/plans/2026-04-24-plan-5-push-fix.md](docs/superpowers/plans/2026-04-24-plan-5-push-fix.md)

## Roadmap

### Nice-to-haves (no plan yet)
- Pull-to-refresh gesture (the `refresh` fn is already exposed by `useNews`)
- Filter chip row for session-only narrowing within a section
- Light mode toggle
- Code splitting (current bundle ~573 kB)
- Offline banner
- Per-article dismiss / "read" state
