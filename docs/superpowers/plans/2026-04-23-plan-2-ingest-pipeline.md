# Plan 2 — Ingest Pipeline

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [2026-04-23-daily-family-digest-design.md](../specs/2026-04-23-daily-family-digest-design.md)

**Goal:** Deploy Cloud Functions that pull RSS feeds for Bulgaria, World, and Sports sections into a `news/{sha1(url)}` Firestore collection every 30 minutes, with a daily cleanup of articles older than 14 days.

**Architecture:** Four scheduled Cloud Functions (v2) + one HTTP trigger for manual testing. All share a common RSS-fetch + normalize + Firestore-write utility. No push fan-out yet (Plan 4). All news sources are free public RSS feeds — no API keys needed.

**Tech Stack:** Node 20, Firebase Functions v2 (`firebase-functions/v2`), firebase-admin v13, rss-parser v3, Vitest for unit tests.

**Working directory for all commands:** `/Users/vladislavgeorgiev/Daily Family Digest/`

**Deliverable at end of plan:**
- `firebase deploy --only functions` succeeds
- `curl https://us-central1-daily-family-digest.cloudfunctions.net/ingestNewsHttp` returns 200 and writes articles to Firestore
- Firestore console shows `news/` docs with correct section/tags/headline fields
- Scheduled functions appear in Firebase console → Functions

---

## Prerequisites (check before starting)

1. Firebase project is on **Blaze plan** — required for Cloud Functions deployment. Verify at Firebase console → Project settings → Billing.
2. `firebase login` is authenticated as `mandvlabs@gmail.com`.
3. Cloud Functions API and Cloud Scheduler API must be enabled. They activate automatically on first deploy, but if deployment fails with "API not enabled", go to Google Cloud Console → APIs → enable both.

---

## File map

```
/Users/vladislavgeorgiev/Daily Family Digest/
├─ firebase.json                          # MODIFY: add "functions" key
├─ firestore.indexes.json                 # MODIFY: add news indexes
├─ functions/
│  ├─ package.json                        # Node 20 engine, deps
│  ├─ .eslintrc.cjs                       # minimal ESLint for functions
│  ├─ index.js                            # exports all Cloud Functions
│  ├─ sources/
│  │  ├─ bulgaria.js                      # outlet slug → {name, rssUrl} (mirrors client outlets.js)
│  │  ├─ world.js                         # topic × region matrix (mirrors client worldConfig.js)
│  │  └─ sports.js                        # team name → teamId map + F1 query
│  ├─ lib/
│  │  ├─ rss.js                           # fetchFeed(url) → normalized article array
│  │  └─ ingest.js                        # sha1(url), writeArticle(db, article) — dedup write
│  ├─ ingestBulgaria.js                   # onSchedule handler — Bulgaria RSS
│  ├─ ingestWorld.js                      # onSchedule handler — World Google News RSS
│  ├─ ingestSports.js                     # onSchedule handler — Sports Google News RSS
│  ├─ cleanup.js                          # onSchedule handler — delete docs > 14 days old
│  └─ ingestHttp.js                       # onRequest handler — manual trigger
└─ functions/lib/
   ├─ rss.test.js                         # unit tests for RSS parser
   └─ ingest.test.js                      # unit tests for sha1 + writeArticle
```

---

## Task 1: functions/ project setup

**Files:**
- Create: `functions/package.json`
- Create: `functions/.eslintrc.cjs`
- Modify: `firebase.json`

- [ ] **Step 1: Create `functions/package.json`**

```json
{
  "name": "daily-family-digest-functions",
  "description": "Cloud Functions for Daily Family Digest",
  "engines": { "node": "20" },
  "main": "index.js",
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "lint": "eslint ."
  },
  "dependencies": {
    "firebase-admin": "^13",
    "firebase-functions": "^6",
    "rss-parser": "^3"
  },
  "devDependencies": {
    "vitest": "^4",
    "eslint": "^9"
  }
}
```

- [ ] **Step 2: Install functions dependencies**

```bash
cd functions && npm install && cd ..
```

Expected: `node_modules/` created inside `functions/`. No errors.

- [ ] **Step 3: Create `functions/.eslintrc.cjs`**

```js
module.exports = {
  env: { node: true, es2022: true },
  parserOptions: { ecmaVersion: 2022, sourceType: 'commonjs' },
  rules: { 'no-unused-vars': 'warn' },
};
```

- [ ] **Step 4: Add functions source to `firebase.json`**

Replace the entire `firebase.json` with:

```json
{
  "functions": {
    "source": "functions",
    "runtime": "nodejs20"
  },
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

- [ ] **Step 5: Create a minimal `functions/index.js` placeholder**

This file will be replaced in later tasks. For now, just make it valid so the project compiles:

```js
// Cloud Functions exported here — populated by tasks 6-10
```

- [ ] **Step 6: Commit**

```bash
git add functions/ firebase.json
git commit -m "chore: functions project setup (Node 20, rss-parser, firebase-admin)"
```

---

## Task 2: Firestore news indexes

**Files:**
- Modify: `firestore.indexes.json`

- [ ] **Step 1: Replace `firestore.indexes.json`**

```json
{
  "indexes": [
    {
      "collectionGroup": "news",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "section", "order": "ASCENDING" },
        { "fieldPath": "publishedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "news",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "section", "order": "ASCENDING" },
        { "fieldPath": "tags", "arrayConfig": "CONTAINS" },
        { "fieldPath": "publishedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "news",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "ingestedAt", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

- [ ] **Step 2: Deploy indexes**

```bash
firebase deploy --only firestore:indexes
```

Expected: "Deploy complete!" — indexes start building (takes ~1 min in Firebase console, but deploy command returns immediately).

- [ ] **Step 3: Commit**

```bash
git add firestore.indexes.json
git commit -m "feat: Firestore news collection indexes"
```

---

## Task 3: RSS fetch utility

**Files:**
- Create: `functions/lib/rss.js`
- Create: `functions/lib/rss.test.js`

- [ ] **Step 1: Write the failing test**

`functions/lib/rss.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockParse = vi.fn();

vi.mock('rss-parser', () => ({
  default: vi.fn(() => ({ parseURL: mockParse })),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('rss utility', () => {
  it('returns normalized articles from a feed', async () => {
    mockParse.mockResolvedValue({
      items: [
        {
          title: 'Test headline',
          link: 'https://example.com/article-1',
          contentSnippet: 'This is the excerpt text.',
          pubDate: 'Wed, 23 Apr 2026 10:00:00 +0000',
        },
      ],
    });

    const { fetchFeed } = await import('./rss.js');
    const articles = await fetchFeed('https://example.com/rss');

    expect(articles).toHaveLength(1);
    expect(articles[0].headline).toBe('Test headline');
    expect(articles[0].url).toBe('https://example.com/article-1');
    expect(articles[0].excerpt).toBe('This is the excerpt text.');
    expect(articles[0].publishedAt).toBeInstanceOf(Date);
    expect(articles[0].imageUrl).toBeNull();
  });

  it('extracts image from media:content', async () => {
    mockParse.mockResolvedValue({
      items: [
        {
          title: 'Image article',
          link: 'https://example.com/img',
          mediaContent: { $: { url: 'https://example.com/img.jpg' } },
          pubDate: 'Wed, 23 Apr 2026 10:00:00 +0000',
        },
      ],
    });

    const { fetchFeed } = await import('./rss.js');
    const articles = await fetchFeed('https://example.com/rss');

    expect(articles[0].imageUrl).toBe('https://example.com/img.jpg');
  });

  it('skips items with no URL', async () => {
    mockParse.mockResolvedValue({
      items: [
        { title: 'No link', pubDate: 'Wed, 23 Apr 2026 10:00:00 +0000' },
        { title: 'Has link', link: 'https://example.com/ok', pubDate: 'Wed, 23 Apr 2026 10:00:00 +0000' },
      ],
    });

    const { fetchFeed } = await import('./rss.js');
    const articles = await fetchFeed('https://example.com/rss');

    expect(articles).toHaveLength(1);
    expect(articles[0].headline).toBe('Has link');
  });

  it('returns empty array on fetch error', async () => {
    mockParse.mockRejectedValue(new Error('Network error'));

    const { fetchFeed } = await import('./rss.js');
    const articles = await fetchFeed('https://example.com/rss');

    expect(articles).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd functions && npm run test:run -- lib/rss.test.js
```

Expected: FAIL — `./rss.js` not found.

- [ ] **Step 3: Implement `functions/lib/rss.js`**

```js
const Parser = require('rss-parser');

const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['media:thumbnail', 'mediaThumbnail'],
    ],
  },
});

/**
 * Fetch and parse an RSS feed URL.
 * @param {string} url
 * @returns {Promise<Array<{headline, url, excerpt, imageUrl, publishedAt, source}>>}
 */
async function fetchFeed(url, source = '') {
  try {
    const feed = await parser.parseURL(url);
    return feed.items
      .filter((item) => !!(item.link || item.guid))
      .map((item) => ({
        headline: item.title || '',
        url: item.link || item.guid || '',
        excerpt: (item.contentSnippet || item.content || '').slice(0, 200),
        imageUrl:
          item.mediaContent?.$?.url ||
          item.mediaThumbnail?.$?.url ||
          null,
        publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
        source,
      }));
  } catch (err) {
    console.error(`fetchFeed error for ${url}:`, err.message);
    return [];
  }
}

module.exports = { fetchFeed };
```

Note: `rss.test.js` uses ES module `import` syntax (Vitest default) while the implementation uses CommonJS `require`. This is intentional — Cloud Functions run on Node 20 CommonJS, while Vitest can test either. Vitest handles the CJS→ESM interop automatically.

- [ ] **Step 4: Add Vitest config to `functions/package.json`**

The test file uses `import` (ESM). Add a vitest config so Vitest transforms CJS modules correctly. Replace `functions/package.json` with:

```json
{
  "name": "daily-family-digest-functions",
  "description": "Cloud Functions for Daily Family Digest",
  "engines": { "node": "20" },
  "main": "index.js",
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "lint": "eslint ."
  },
  "dependencies": {
    "firebase-admin": "^13",
    "firebase-functions": "^6",
    "rss-parser": "^3"
  },
  "devDependencies": {
    "vitest": "^4",
    "eslint": "^9"
  },
  "vitest": {
    "environment": "node"
  }
}
```

- [ ] **Step 5: Run test — expect PASS**

```bash
cd functions && npm run test:run -- lib/rss.test.js
```

Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
cd ..
git add functions/lib/rss.js functions/lib/rss.test.js functions/package.json
git commit -m "feat: RSS fetch utility"
```

---

## Task 4: Ingest utility (sha1 + Firestore write)

**Files:**
- Create: `functions/lib/ingest.js`
- Create: `functions/lib/ingest.test.js`

- [ ] **Step 1: Write the failing test**

`functions/lib/ingest.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSet = vi.fn();
const mockGet = vi.fn();
const mockDoc = vi.fn(() => ({ get: mockGet, set: mockSet }));
const mockCollection = vi.fn(() => ({ doc: mockDoc }));
const mockDb = { collection: mockCollection };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ingest utility', () => {
  it('sha1 produces a consistent 40-char hex string', async () => {
    const { sha1 } = await import('./ingest.js');
    const hash = sha1('https://example.com/article');
    expect(hash).toMatch(/^[a-f0-9]{40}$/);
    expect(sha1('https://example.com/article')).toBe(hash);
  });

  it('sha1 produces different hashes for different inputs', async () => {
    const { sha1 } = await import('./ingest.js');
    expect(sha1('url-a')).not.toBe(sha1('url-b'));
  });

  it('writeArticle writes doc when it does not exist', async () => {
    mockGet.mockResolvedValue({ exists: false });
    const { writeArticle } = await import('./ingest.js');

    await writeArticle(mockDb, {
      section: 'bulgaria',
      headline: 'Test',
      url: 'https://example.com/test',
      excerpt: 'excerpt',
      source: 'Dnevnik',
      imageUrl: null,
      tags: ['outlet:dnevnik'],
      publishedAt: new Date(),
      ingestedAt: new Date(),
    });

    expect(mockSet).toHaveBeenCalledOnce();
    const written = mockSet.mock.calls[0][0];
    expect(written.section).toBe('bulgaria');
    expect(written.headline).toBe('Test');
    expect(written.ingestedAt).toBeInstanceOf(Date);
  });

  it('writeArticle skips doc when it already exists', async () => {
    mockGet.mockResolvedValue({ exists: true });
    const { writeArticle } = await import('./ingest.js');

    await writeArticle(mockDb, {
      section: 'bulgaria',
      headline: 'Dup',
      url: 'https://example.com/dup',
      excerpt: '',
      source: 'Dnevnik',
      imageUrl: null,
      tags: [],
      publishedAt: new Date(),
      ingestedAt: new Date(),
    });

    expect(mockSet).not.toHaveBeenCalled();
  });

  it('writeArticle skips articles with empty url', async () => {
    const { writeArticle } = await import('./ingest.js');
    await writeArticle(mockDb, { url: '' });
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd functions && npm run test:run -- lib/ingest.test.js
```

Expected: FAIL — `./ingest.js` not found.

- [ ] **Step 3: Implement `functions/lib/ingest.js`**

```js
const { createHash } = require('crypto');

function sha1(str) {
  return createHash('sha1').update(str).digest('hex');
}

/**
 * Write an article to Firestore, skipping if the URL already exists.
 * @param {FirebaseFirestore.Firestore} db
 * @param {object} article
 */
async function writeArticle(db, article) {
  if (!article.url) return;
  const id = sha1(article.url);
  const ref = db.collection('news').doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({ ...article, ingestedAt: new Date() });
  }
}

module.exports = { sha1, writeArticle };
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd functions && npm run test:run -- lib/ingest.test.js
```

Expected: PASS (5 tests).

- [ ] **Step 5: Run full functions test suite**

```bash
cd functions && npm run test:run
```

Expected: PASS (9 tests — 4 from rss + 5 from ingest).

- [ ] **Step 6: Commit**

```bash
cd ..
git add functions/lib/ingest.js functions/lib/ingest.test.js
git commit -m "feat: ingest utility (sha1, writeArticle dedup)"
```

---

## Task 5: News sources config

**Files:**
- Create: `functions/sources/bulgaria.js`
- Create: `functions/sources/world.js`
- Create: `functions/sources/sports.js`

No tests needed — these are pure static data mirroring the client config.

- [ ] **Step 1: Create `functions/sources/bulgaria.js`**

Mirrors `src/services/outlets.js` on the client. Must stay in sync if outlets change.

```js
const BULGARIA_OUTLETS = [
  { slug: 'dnevnik',   name: 'Dnevnik',      rssUrl: 'https://www.dnevnik.bg/rss' },
  { slug: 'mediapool', name: 'Mediapool',    rssUrl: 'https://www.mediapool.bg/rss' },
  { slug: 'bnr',       name: 'BNR',          rssUrl: 'https://bnr.bg/post/rss' },
  { slug: 'sega',      name: 'Sega',         rssUrl: 'https://www.segabg.com/rss.xml' },
  { slug: 'offnews',   name: 'Offnews',      rssUrl: 'https://offnews.bg/rss.xml' },
  { slug: 'darik',     name: 'Darik News',   rssUrl: 'https://dariknews.bg/rss' },
  { slug: 'nova',      name: 'Nova',         rssUrl: 'https://nova.bg/rss' },
  { slug: 'btv',       name: 'bTV Novinite', rssUrl: 'https://btvnovinite.bg/rss/' },
  { slug: 'clubz',     name: 'Club Z',       rssUrl: 'https://clubz.bg/feed' },
  { slug: 'capital',   name: 'Capital',      rssUrl: 'https://www.capital.bg/rss' },
];

module.exports = { BULGARIA_OUTLETS };
```

- [ ] **Step 2: Create `functions/sources/world.js`**

Mirrors `src/services/worldConfig.js`. Includes the Google News RSS URL template.

```js
const WORLD_TOPICS = [
  { slug: 'politics',      query: 'politics' },
  { slug: 'business',      query: 'business' },
  { slug: 'tech',          query: 'technology' },
  { slug: 'science',       query: 'science' },
  { slug: 'health',        query: 'health' },
  { slug: 'entertainment', query: 'entertainment' },
  { slug: 'sports',        query: 'sports' },
];

const WORLD_REGIONS = [
  { slug: 'us',          gl: 'US', ceid: 'US:en' },
  { slug: 'uk',          gl: 'GB', ceid: 'GB:en' },
  { slug: 'eu',          gl: 'DE', ceid: 'DE:en' },
  { slug: 'asia',        gl: 'IN', ceid: 'IN:en' },
  { slug: 'middle-east', gl: 'AE', ceid: 'AE:en' },
  { slug: 'africa',      gl: 'ZA', ceid: 'ZA:en' },
  { slug: 'latam',       gl: 'MX', ceid: 'MX:en' },
];

/**
 * Build Google News RSS URL for a topic + region combination.
 */
function buildGoogleNewsUrl(topicQuery, region) {
  const q = encodeURIComponent(`${topicQuery} when:1d`);
  return `https://news.google.com/rss/search?q=${q}&hl=en&gl=${region.gl}&ceid=${region.ceid}`;
}

module.exports = { WORLD_TOPICS, WORLD_REGIONS, buildGoogleNewsUrl };
```

- [ ] **Step 3: Create `functions/sources/sports.js`**

Each football team gets a Google News RSS query on team name. F1 gets a single query.

```js
// Football teams — mirrors src/services/teams.js
const FOOTBALL_TEAMS = [
  { id: 'PL-ARS', name: 'Arsenal' },
  { id: 'PL-AVL', name: 'Aston Villa' },
  { id: 'PL-CHE', name: 'Chelsea' },
  { id: 'PL-LIV', name: 'Liverpool' },
  { id: 'PL-MCI', name: 'Manchester City' },
  { id: 'PL-MUN', name: 'Manchester United' },
  { id: 'PL-TOT', name: 'Tottenham Hotspur' },
  { id: 'PD-BAR', name: 'Barcelona' },
  { id: 'PD-RMA', name: 'Real Madrid' },
  { id: 'PD-ATM', name: 'Atletico Madrid' },
  { id: 'PD-SEV', name: 'Sevilla' },
  { id: 'SA-JUV', name: 'Juventus' },
  { id: 'SA-INT', name: 'Inter Milan' },
  { id: 'SA-MIL', name: 'AC Milan' },
  { id: 'SA-NAP', name: 'Napoli' },
  { id: 'SA-ROM', name: 'AS Roma' },
  { id: 'BL1-BAY', name: 'Bayern Munich' },
  { id: 'BL1-BVB', name: 'Borussia Dortmund' },
  { id: 'BL1-LEV', name: 'Bayer Leverkusen' },
];

/**
 * Build Google News RSS URL for a football team.
 */
function buildTeamUrl(teamName) {
  const q = encodeURIComponent(`"${teamName}" football`);
  return `https://news.google.com/rss/search?q=${q}&hl=en&gl=US&ceid=US:en`;
}

/**
 * Google News RSS URL for Formula 1 news.
 */
const F1_URL = `https://news.google.com/rss/search?q=${encodeURIComponent('Formula 1 when:1d')}&hl=en&gl=US&ceid=US:en`;

module.exports = { FOOTBALL_TEAMS, buildTeamUrl, F1_URL };
```

- [ ] **Step 4: Commit**

```bash
git add functions/sources/
git commit -m "feat: ingest sources config (Bulgaria, World, Sports)"
```

---

## Task 6: ingestBulgariaNews function

**Files:**
- Create: `functions/ingestBulgaria.js`

- [ ] **Step 1: Create `functions/ingestBulgaria.js`**

```js
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore } = require('firebase-admin/firestore');
const { fetchFeed } = require('./lib/rss');
const { writeArticle } = require('./lib/ingest');
const { BULGARIA_OUTLETS } = require('./sources/bulgaria');

async function runBulgariaIngest(db) {
  let total = 0;
  for (const outlet of BULGARIA_OUTLETS) {
    try {
      const articles = await fetchFeed(outlet.rssUrl, outlet.name);
      for (const article of articles) {
        await writeArticle(db, {
          ...article,
          section: 'bulgaria',
          tags: [`outlet:${outlet.slug}`],
        });
        total++;
      }
    } catch (err) {
      console.error(`Bulgaria ingest failed for ${outlet.slug}:`, err.message);
    }
  }
  console.log(`Bulgaria ingest complete: ${total} articles processed`);
  return total;
}

const ingestBulgariaNews = onSchedule('every 30 minutes', async () => {
  const db = getFirestore();
  await runBulgariaIngest(db);
});

module.exports = { ingestBulgariaNews, runBulgariaIngest };
```

- [ ] **Step 2: Commit**

```bash
git add functions/ingestBulgaria.js
git commit -m "feat: ingestBulgariaNews scheduled function"
```

---

## Task 7: ingestWorldNews function

**Files:**
- Create: `functions/ingestWorld.js`

- [ ] **Step 1: Create `functions/ingestWorld.js`**

Queries every topic × region combination. Each article is tagged with both its topic and region slug. The 6-hour recency filter (`when:1d` is in the URL query) prevents old articles from being written on every run.

```js
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore } = require('firebase-admin/firestore');
const { fetchFeed } = require('./lib/rss');
const { writeArticle } = require('./lib/ingest');
const { WORLD_TOPICS, WORLD_REGIONS, buildGoogleNewsUrl } = require('./sources/world');

async function runWorldIngest(db) {
  let total = 0;
  for (const topic of WORLD_TOPICS) {
    for (const region of WORLD_REGIONS) {
      try {
        const url = buildGoogleNewsUrl(topic.query, region);
        const articles = await fetchFeed(url, 'Google News');
        for (const article of articles) {
          await writeArticle(db, {
            ...article,
            section: 'world',
            tags: [`topic:${topic.slug}`, `region:${region.slug}`],
          });
          total++;
        }
      } catch (err) {
        console.error(`World ingest failed for ${topic.slug}/${region.slug}:`, err.message);
      }
    }
  }
  console.log(`World ingest complete: ${total} articles processed`);
  return total;
}

const ingestWorldNews = onSchedule('every 30 minutes', async () => {
  const db = getFirestore();
  await runWorldIngest(db);
});

module.exports = { ingestWorldNews, runWorldIngest };
```

- [ ] **Step 2: Commit**

```bash
git add functions/ingestWorld.js
git commit -m "feat: ingestWorldNews scheduled function"
```

---

## Task 8: ingestSportsNews function

**Files:**
- Create: `functions/ingestSports.js`

- [ ] **Step 1: Create `functions/ingestSports.js`**

```js
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore } = require('firebase-admin/firestore');
const { fetchFeed } = require('./lib/rss');
const { writeArticle } = require('./lib/ingest');
const { FOOTBALL_TEAMS, buildTeamUrl, F1_URL } = require('./sources/sports');

async function runSportsIngest(db) {
  let total = 0;

  // Football teams
  for (const team of FOOTBALL_TEAMS) {
    try {
      const url = buildTeamUrl(team.name);
      const articles = await fetchFeed(url, 'Google News');
      for (const article of articles) {
        await writeArticle(db, {
          ...article,
          section: 'sports',
          tags: [`team:${team.id}`, 'sport:football'],
        });
        total++;
      }
    } catch (err) {
      console.error(`Sports ingest failed for team ${team.id}:`, err.message);
    }
  }

  // Formula 1
  try {
    const articles = await fetchFeed(F1_URL, 'Google News');
    for (const article of articles) {
      await writeArticle(db, {
        ...article,
        section: 'sports',
        tags: ['sport:f1'],
      });
      total++;
    }
  } catch (err) {
    console.error('Sports ingest failed for F1:', err.message);
  }

  console.log(`Sports ingest complete: ${total} articles processed`);
  return total;
}

const ingestSportsNews = onSchedule('every 30 minutes', async () => {
  const db = getFirestore();
  await runSportsIngest(db);
});

module.exports = { ingestSportsNews, runSportsIngest };
```

- [ ] **Step 2: Commit**

```bash
git add functions/ingestSports.js
git commit -m "feat: ingestSportsNews scheduled function"
```

---

## Task 9: cleanupOldNews function

**Files:**
- Create: `functions/cleanup.js`

- [ ] **Step 1: Create `functions/cleanup.js`**

Deletes all `news` docs where `ingestedAt` is older than 14 days. Uses Firestore batch delete (max 500 docs per batch).

```js
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

async function runCleanup(db) {
  const cutoff = Timestamp.fromMillis(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const snap = await db
    .collection('news')
    .where('ingestedAt', '<', cutoff)
    .get();

  if (snap.empty) {
    console.log('Cleanup: no old articles to delete');
    return 0;
  }

  // Firestore batch max is 500
  const BATCH_SIZE = 500;
  let deleted = 0;
  for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    snap.docs.slice(i, i + BATCH_SIZE).forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += Math.min(BATCH_SIZE, snap.docs.length - i);
  }

  console.log(`Cleanup: deleted ${deleted} old articles`);
  return deleted;
}

const cleanupOldNews = onSchedule('every 24 hours', async () => {
  const db = getFirestore();
  await runCleanup(db);
});

module.exports = { cleanupOldNews, runCleanup };
```

- [ ] **Step 2: Commit**

```bash
git add functions/cleanup.js
git commit -m "feat: cleanupOldNews daily scheduled function"
```

---

## Task 10: ingestNewsHttp manual trigger

**Files:**
- Create: `functions/ingestHttp.js`

- [ ] **Step 1: Create `functions/ingestHttp.js`**

HTTP trigger that runs all three ingest functions sequentially. Gated by optional `INGEST_KEY` env var (if set, request must include `?key=<value>`).

```js
const { onRequest } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const { runBulgariaIngest } = require('./ingestBulgaria');
const { runWorldIngest } = require('./ingestWorld');
const { runSportsIngest } = require('./ingestSports');

const ingestNewsHttp = onRequest(async (req, res) => {
  const ingestKey = process.env.INGEST_KEY;
  if (ingestKey && req.query.key !== ingestKey) {
    res.status(401).send('Unauthorized');
    return;
  }

  const db = getFirestore();
  try {
    const [bulgaria, world, sports] = await Promise.allSettled([
      runBulgariaIngest(db),
      runWorldIngest(db),
      runSportsIngest(db),
    ]);

    res.json({
      ok: true,
      bulgaria: bulgaria.status === 'fulfilled' ? bulgaria.value : bulgaria.reason?.message,
      world: world.status === 'fulfilled' ? world.value : world.reason?.message,
      sports: sports.status === 'fulfilled' ? sports.value : sports.reason?.message,
    });
  } catch (err) {
    console.error('ingestNewsHttp error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = { ingestNewsHttp };
```

- [ ] **Step 2: Commit**

```bash
git add functions/ingestHttp.js
git commit -m "feat: ingestNewsHttp manual trigger"
```

---

## Task 11: Wire everything into functions/index.js

**Files:**
- Modify: `functions/index.js`

- [ ] **Step 1: Initialize Firebase Admin and export all functions**

Replace `functions/index.js` with:

```js
const { initializeApp } = require('firebase-admin/app');

initializeApp();

const { ingestBulgariaNews } = require('./ingestBulgaria');
const { ingestWorldNews } = require('./ingestWorld');
const { ingestSportsNews } = require('./ingestSports');
const { cleanupOldNews } = require('./cleanup');
const { ingestNewsHttp } = require('./ingestHttp');

module.exports = {
  ingestBulgariaNews,
  ingestWorldNews,
  ingestSportsNews,
  cleanupOldNews,
  ingestNewsHttp,
};
```

- [ ] **Step 2: Run functions test suite one final time**

```bash
cd functions && npm run test:run
```

Expected: 9 tests pass. (rss: 4, ingest: 5)

- [ ] **Step 3: Commit**

```bash
cd ..
git add functions/index.js
git commit -m "feat: wire all Cloud Functions into index.js"
```

---

## Task 12: Deploy Cloud Functions

- [ ] **Step 1: Deploy all functions**

```bash
firebase deploy --only functions
```

This will take 3–5 minutes on first deploy. Expected output ends with:
```
✔  functions: Finished running predeploy script.
✔  Deploy complete!
```

If you see "Error: Failed to get Firebase project daily-family-digest", run `firebase use daily-family-digest` first.

If you see "Error: Cloud Functions need Blaze plan", upgrade the Firebase project to Blaze (pay-as-you-go) at Firebase console → Project settings → Billing.

- [ ] **Step 2: Verify functions are deployed**

In Firebase console → Functions, you should see 5 functions:
- `ingestBulgariaNews` (scheduled)
- `ingestWorldNews` (scheduled)
- `ingestSportsNews` (scheduled)
- `cleanupOldNews` (scheduled)
- `ingestNewsHttp` (HTTP)

- [ ] **Step 3: Commit deploy marker**

```bash
git tag plan-2-deployed
```

---

## Task 13: Manual verification

No code changes — verify the pipeline works end-to-end.

- [ ] **Step 1: Trigger manual ingest**

```bash
curl "https://us-central1-daily-family-digest.cloudfunctions.net/ingestNewsHttp"
```

Expected JSON response:
```json
{
  "ok": true,
  "bulgaria": <number>,
  "world": <number>,
  "sports": <number>
}
```

The numbers are article counts processed (not necessarily written — duplicates are skipped). On first run, all three should be > 0.

If any section returns an error string instead of a number, check Firebase console → Functions → Logs for details.

- [ ] **Step 2: Verify Firestore has news docs**

In Firebase console → Firestore → `news` collection, you should see documents with:
- `section`: `"bulgaria"`, `"world"`, or `"sports"`
- `headline`: non-empty string
- `tags`: array with `outlet:*` / `topic:*` + `region:*` / `team:*` entries
- `publishedAt`: timestamp
- `ingestedAt`: timestamp

If the collection is empty, check Function logs for fetch errors (some RSS feeds may be temporarily down — that's expected; retry in 30 min or check the next scheduled run).

- [ ] **Step 3: Check Cloud Logging for errors**

```bash
firebase functions:log --limit 50
```

Expected: `"Bulgaria ingest complete"`, `"World ingest complete"`, `"Sports ingest complete"` lines. Any `ERROR` lines indicate a specific feed failed — note them but don't block on individual feed failures (the scheduler will retry in 30 min).

- [ ] **Step 4: Tag final commit**

```bash
git tag plan-2-complete
```

---

## Dependencies between tasks

```
1 (project setup)
  └─ 3 (rss utility)
  └─ 4 (ingest utility)
       └─ 5 (sources config)
            └─ 6 (ingestBulgaria)
            └─ 7 (ingestWorld)
            └─ 8 (ingestSports)
                 └─ 9 (cleanup)
                 └─ 10 (ingestHttp)
                      └─ 11 (index.js)
                           └─ 12 (deploy)
                                └─ 13 (verify)
2 (indexes) — independent, can run any time before task 12
```
