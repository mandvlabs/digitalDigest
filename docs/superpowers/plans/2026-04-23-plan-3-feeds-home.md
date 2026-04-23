# Plan 3 — Feeds + Home

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [2026-04-23-daily-family-digest-design.md](../specs/2026-04-23-daily-family-digest-design.md)

**Goal:** Render news articles in the app. Build the news service (Firestore query builders with chunking + client-side filters), the `useNews` hook, the `ArticleCard` component, the three section tabs (Bulgaria / World / Sports) with infinite scroll, the Home digest (3/3/3 across sections), and Settings edit flows for each preference group.

**Architecture:** Thin service layer (`src/services/news.js`) that returns query-builder functions per section. A single `useNews(section)` hook wraps cursor pagination. Section tabs render via a shared `<Feed />` component driven by the hook. Home composes three `<Feed />` previews side-by-side with `limit=3`. All reads use Firebase SDK's modular API — no real-time subscriptions (static queries with `getDocs`, refreshed via a manual trigger).

**Tech Stack:** React 18 (the project uses React 19 actually — see package.json), Firebase Web SDK v12 (modular), Vitest + @testing-library/react, Lucide-react icons, inline styles.

**Working directory for all commands:** `/Users/vladislavgeorgiev/Daily Family Digest/`

**Deliverable at end of plan:**
- Each of the 4 reading tabs (Home, Bulgaria, World, Sports) shows live Firestore articles filtered by the signed-in user's preferences
- Infinite scroll works on section tabs (load more on scroll-to-bottom)
- Settings tab can edit each prefs group (Bulgaria outlets, World topics/regions, Sports teams + F1, Notification toggles)
- All unit tests pass: `npm run test:run`
- `npm run dev` renders the full app end-to-end without console errors

---

## File map

```
/Users/vladislavgeorgiev/Daily Family Digest/src/
├─ services/
│  ├─ news.js                          # CREATE — query builders per section
│  └─ news.test.js                     # CREATE — chunking + filter logic tests
├─ utils/
│  ├─ time.js                          # CREATE — relative time formatter
│  └─ time.test.js                     # CREATE — formatter tests
├─ hooks/
│  ├─ useNews.js                       # CREATE — pagination hook
│  └─ useNews.test.jsx                 # CREATE — hook tests
├─ components/
│  ├─ ArticleCard.jsx                  # CREATE — single article row
│  ├─ ArticleCard.test.jsx             # CREATE
│  ├─ EmptyState.jsx                   # CREATE
│  ├─ ErrorState.jsx                   # CREATE
│  └─ Feed.jsx                         # CREATE — shared scroll-paginated feed
├─ features/
│  ├─ home/
│  │  ├─ HomeTab.jsx                   # REPLACE — 3/3/3 digest
│  │  └─ HomeSection.jsx               # CREATE — one section block on Home
│  ├─ bulgaria/
│  │  └─ BulgariaTab.jsx               # REPLACE
│  ├─ world/
│  │  └─ WorldTab.jsx                  # REPLACE
│  ├─ sports/
│  │  └─ SportsTab.jsx                 # REPLACE
│  └─ settings/
│     ├─ SettingsTab.jsx               # MODIFY — add prefs entry points
│     ├─ EditBulgariaOutlets.jsx       # CREATE
│     ├─ EditWorldPrefs.jsx            # CREATE
│     ├─ EditSportsPrefs.jsx           # CREATE
│     └─ NotificationsSection.jsx      # CREATE
```

---

## Prerequisites (verify before starting)

1. Plan 1 (Foundation) and Plan 2 (Ingest Pipeline) are complete.
2. `firestore.rules` allows authenticated reads of `news/{id}`. Confirm by reading `firestore.rules` — it must contain:

```
match /news/{id} {
  allow read: if request.auth != null;
}
```

If the rule is missing, add it and deploy: `firebase deploy --only firestore:rules`.

3. Firestore `news` collection has articles (Plan 2 Task 13 verified this).
4. `functions/` is deployed and running every 30 minutes.

---

## Task 1: Relative-time utility

**Files:**
- Create: `src/utils/time.js`
- Create: `src/utils/time.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/utils/time.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { formatRelativeTime } from './time.js';

const NOW = new Date('2026-04-23T12:00:00Z');

describe('formatRelativeTime', () => {
  it('returns "just now" for <1 min ago', () => {
    const d = new Date(NOW.getTime() - 30 * 1000);
    expect(formatRelativeTime(d, NOW)).toBe('just now');
  });

  it('returns "Nm ago" for minutes', () => {
    const d = new Date(NOW.getTime() - 5 * 60 * 1000);
    expect(formatRelativeTime(d, NOW)).toBe('5m ago');
  });

  it('returns "Nh ago" for hours', () => {
    const d = new Date(NOW.getTime() - 3 * 60 * 60 * 1000);
    expect(formatRelativeTime(d, NOW)).toBe('3h ago');
  });

  it('returns "Nd ago" for days', () => {
    const d = new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(d, NOW)).toBe('2d ago');
  });

  it('returns date string for >7 days ago', () => {
    const d = new Date('2026-04-10T12:00:00Z');
    expect(formatRelativeTime(d, NOW)).toBe('Apr 10');
  });

  it('accepts Firestore Timestamp-like objects (toDate())', () => {
    const d = new Date(NOW.getTime() - 60 * 1000);
    const ts = { toDate: () => d };
    expect(formatRelativeTime(ts, NOW)).toBe('1m ago');
  });

  it('returns empty string for null/undefined', () => {
    expect(formatRelativeTime(null, NOW)).toBe('');
    expect(formatRelativeTime(undefined, NOW)).toBe('');
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm run test:run -- src/utils/time.test.js
```

Expected: FAIL — `./time.js` not found.

- [ ] **Step 3: Implement `src/utils/time.js`**

```js
export function formatRelativeTime(value, now = new Date()) {
  if (!value) return '';
  const date = typeof value?.toDate === 'function' ? value.toDate() : value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return '';

  const diffMs = now.getTime() - date.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npm run test:run -- src/utils/time.test.js
```

Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/time.js src/utils/time.test.js
git commit -m "feat: relative time formatter utility"
```

---

## Task 2: News service

**Files:**
- Create: `src/services/news.js`
- Create: `src/services/news.test.js`

### Context

This service builds Firestore queries for the `news` collection. Since Firestore's `array-contains-any` is capped at 30 elements, the service must chunk larger preference arrays into multiple queries and merge results.

Per-section logic:
- **Bulgaria:** filter on `tags array-contains-any ['outlet:<slug>', ...]`.
- **World:** Firestore cannot AND two `array-contains-any`. Strategy: query by `topic:` tags (since topic count ≤ 7), then filter results client-side by region tags.
- **Sports:** combine team tags and F1 tag into one `array-contains-any`. If user has 0 teams and `f1Follow: false`, return empty (no query).

All queries add `.where('section', '==', <section>)`, `.orderBy('publishedAt', 'desc')`, and `.limit(<limit>)`.

Pagination uses `startAfter(cursor)` where cursor is the last Firestore `DocumentSnapshot` from the previous page.

- [ ] **Step 1: Write the failing test**

Create `src/services/news.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./firebase.js', () => ({
  db: {},
}));

const mockGetDocs = vi.fn();
const mockQuery = vi.fn((...args) => ({ __query: args }));
const mockCollection = vi.fn((_db, name) => ({ __collection: name }));
const mockWhere = vi.fn((...args) => ({ __where: args }));
const mockOrderBy = vi.fn((...args) => ({ __orderBy: args }));
const mockLimit = vi.fn((n) => ({ __limit: n }));
const mockStartAfter = vi.fn((cursor) => ({ __startAfter: cursor }));

vi.mock('firebase/firestore', () => ({
  collection: (...args) => mockCollection(...args),
  query: (...args) => mockQuery(...args),
  where: (...args) => mockWhere(...args),
  orderBy: (...args) => mockOrderBy(...args),
  limit: (...args) => mockLimit(...args),
  startAfter: (...args) => mockStartAfter(...args),
  getDocs: (...args) => mockGetDocs(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function mockSnapshot(items) {
  const docs = items.map((data, i) => ({
    id: `id-${i}`,
    data: () => data,
  }));
  return { docs, empty: docs.length === 0 };
}

describe('news service', () => {
  describe('chunk', () => {
    it('splits array into sub-arrays of max size', async () => {
      const { chunk } = await import('./news.js');
      expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
      expect(chunk([1, 2], 5)).toEqual([[1, 2]]);
      expect(chunk([], 5)).toEqual([]);
    });
  });

  describe('fetchBulgariaNews', () => {
    it('returns empty when no outlets selected', async () => {
      const { fetchBulgariaNews } = await import('./news.js');
      const result = await fetchBulgariaNews({ outlets: [], limit: 30 });
      expect(result.articles).toEqual([]);
      expect(result.lastDoc).toBeNull();
      expect(mockGetDocs).not.toHaveBeenCalled();
    });

    it('builds a query with outlet tags, section, orderBy, limit', async () => {
      mockGetDocs.mockResolvedValue(mockSnapshot([
        { section: 'bulgaria', headline: 'A', publishedAt: new Date('2026-04-23') },
      ]));
      const { fetchBulgariaNews } = await import('./news.js');
      const result = await fetchBulgariaNews({ outlets: ['dnevnik', 'bnr'], limit: 30 });
      expect(mockGetDocs).toHaveBeenCalledOnce();
      expect(result.articles).toHaveLength(1);
      expect(result.articles[0].id).toBe('id-0');
      expect(result.articles[0].headline).toBe('A');
      expect(result.lastDoc).toBeDefined();
    });

    it('chunks outlet lists larger than 30 and merges results', async () => {
      const outlets = Array.from({ length: 45 }, (_, i) => `o${i}`);
      mockGetDocs
        .mockResolvedValueOnce(mockSnapshot([
          { section: 'bulgaria', headline: 'A', publishedAt: { toDate: () => new Date('2026-04-23T12:00Z') } },
        ]))
        .mockResolvedValueOnce(mockSnapshot([
          { section: 'bulgaria', headline: 'B', publishedAt: { toDate: () => new Date('2026-04-23T13:00Z') } },
        ]));
      const { fetchBulgariaNews } = await import('./news.js');
      const result = await fetchBulgariaNews({ outlets, limit: 30 });
      expect(mockGetDocs).toHaveBeenCalledTimes(2);
      expect(result.articles).toHaveLength(2);
      expect(result.articles[0].headline).toBe('B');
      expect(result.articles[1].headline).toBe('A');
    });
  });

  describe('fetchWorldNews', () => {
    it('returns empty when topics or regions missing', async () => {
      const { fetchWorldNews } = await import('./news.js');
      let result = await fetchWorldNews({ topics: [], regions: ['us'], limit: 30 });
      expect(result.articles).toEqual([]);
      result = await fetchWorldNews({ topics: ['tech'], regions: [], limit: 30 });
      expect(result.articles).toEqual([]);
    });

    it('filters client-side by region tag', async () => {
      mockGetDocs.mockResolvedValue(mockSnapshot([
        { section: 'world', headline: 'US', tags: ['topic:tech', 'region:us'], publishedAt: new Date() },
        { section: 'world', headline: 'EU', tags: ['topic:tech', 'region:eu'], publishedAt: new Date() },
        { section: 'world', headline: 'Asia', tags: ['topic:tech', 'region:asia'], publishedAt: new Date() },
      ]));
      const { fetchWorldNews } = await import('./news.js');
      const result = await fetchWorldNews({ topics: ['tech'], regions: ['us', 'eu'], limit: 30 });
      expect(result.articles).toHaveLength(2);
      expect(result.articles.map((a) => a.headline)).toEqual(['US', 'EU']);
    });
  });

  describe('fetchSportsNews', () => {
    it('returns empty when no teams and no f1', async () => {
      const { fetchSportsNews } = await import('./news.js');
      const result = await fetchSportsNews({ teams: [], f1: false, limit: 30 });
      expect(result.articles).toEqual([]);
      expect(mockGetDocs).not.toHaveBeenCalled();
    });

    it('includes sport:f1 tag when f1=true', async () => {
      mockGetDocs.mockResolvedValue(mockSnapshot([
        { section: 'sports', headline: 'F1 race', tags: ['sport:f1'], publishedAt: new Date() },
      ]));
      const { fetchSportsNews } = await import('./news.js');
      const result = await fetchSportsNews({ teams: [], f1: true, limit: 30 });
      expect(mockGetDocs).toHaveBeenCalledOnce();
      // Inspect the call — 'sport:f1' should be in the where args
      const whereCalls = mockWhere.mock.calls;
      const tagCall = whereCalls.find((c) => c[0] === 'tags');
      expect(tagCall[2]).toContain('sport:f1');
      expect(result.articles).toHaveLength(1);
    });

    it('combines team tags and f1 tag', async () => {
      mockGetDocs.mockResolvedValue(mockSnapshot([
        { section: 'sports', headline: 'Arsenal', tags: ['team:PL-ARS', 'sport:football'], publishedAt: new Date() },
      ]));
      const { fetchSportsNews } = await import('./news.js');
      await fetchSportsNews({ teams: ['PL-ARS', 'PL-LIV'], f1: true, limit: 30 });
      const tagCall = mockWhere.mock.calls.find((c) => c[0] === 'tags');
      expect(tagCall[2]).toEqual(['team:PL-ARS', 'team:PL-LIV', 'sport:f1']);
    });
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm run test:run -- src/services/news.test.js
```

Expected: FAIL — `./news.js` not found.

- [ ] **Step 3: Implement `src/services/news.js`**

```js
import {
  collection,
  query,
  where,
  orderBy,
  limit as limitFn,
  startAfter,
  getDocs,
} from 'firebase/firestore';
import { db } from './firebase.js';

const MAX_IN = 30;

export function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function docToArticle(doc) {
  const data = doc.data();
  return { id: doc.id, ...data };
}

function publishedMillis(article) {
  const pa = article.publishedAt;
  if (!pa) return 0;
  if (typeof pa.toDate === 'function') return pa.toDate().getTime();
  if (pa instanceof Date) return pa.getTime();
  return new Date(pa).getTime();
}

async function runTagQuery({ section, tags, pageSize, cursor }) {
  const parts = [
    collection(db, 'news'),
    where('section', '==', section),
    where('tags', 'array-contains-any', tags),
    orderBy('publishedAt', 'desc'),
  ];
  if (cursor) parts.push(startAfter(cursor));
  parts.push(limitFn(pageSize));
  const q = query(...parts);
  const snap = await getDocs(q);
  return {
    articles: snap.docs.map(docToArticle),
    lastDoc: snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null,
  };
}

async function runChunkedTagQuery({ section, tags, pageSize, cursor }) {
  if (tags.length === 0) {
    return { articles: [], lastDoc: null };
  }
  const chunks = chunk(tags, MAX_IN);
  if (chunks.length === 1) {
    return runTagQuery({ section, tags: chunks[0], pageSize, cursor });
  }
  // Chunking doesn't support cursor pagination (cursors are per-query).
  // Fetch pageSize from each chunk, merge by publishedAt desc, take top pageSize.
  const pages = await Promise.all(
    chunks.map((c) => runTagQuery({ section, tags: c, pageSize, cursor: null })),
  );
  const seen = new Map();
  for (const p of pages) {
    for (const a of p.articles) {
      if (!seen.has(a.id)) seen.set(a.id, a);
    }
  }
  const merged = [...seen.values()].sort(
    (a, b) => publishedMillis(b) - publishedMillis(a),
  );
  return {
    articles: merged.slice(0, pageSize),
    lastDoc: null, // chunked queries don't expose a unified cursor
  };
}

export async function fetchBulgariaNews({ outlets, limit = 30, cursor = null }) {
  const tags = outlets.map((slug) => `outlet:${slug}`);
  return runChunkedTagQuery({
    section: 'bulgaria',
    tags,
    pageSize: limit,
    cursor,
  });
}

export async function fetchWorldNews({ topics, regions, limit = 30, cursor = null }) {
  if (topics.length === 0 || regions.length === 0) {
    return { articles: [], lastDoc: null };
  }
  const topicTags = topics.map((t) => `topic:${t}`);
  const regionSet = new Set(regions.map((r) => `region:${r}`));
  // Fetch a larger page so post-filter still has enough items.
  const raw = await runChunkedTagQuery({
    section: 'world',
    tags: topicTags,
    pageSize: limit * 3,
    cursor,
  });
  const filtered = raw.articles.filter((a) =>
    (a.tags || []).some((t) => regionSet.has(t)),
  );
  return {
    articles: filtered.slice(0, limit),
    lastDoc: raw.lastDoc, // cursor still based on raw query
  };
}

export async function fetchSportsNews({ teams, f1, limit = 30, cursor = null }) {
  const tags = [...teams.map((id) => `team:${id}`)];
  if (f1) tags.push('sport:f1');
  if (tags.length === 0) {
    return { articles: [], lastDoc: null };
  }
  return runChunkedTagQuery({
    section: 'sports',
    tags,
    pageSize: limit,
    cursor,
  });
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npm run test:run -- src/services/news.test.js
```

Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/news.js src/services/news.test.js
git commit -m "feat: news service (query builders, chunking, section filters)"
```

---

## Task 3: useNews hook

**Files:**
- Create: `src/hooks/useNews.js`
- Create: `src/hooks/useNews.test.jsx`

### Context

`useNews(section)` wraps pagination for a section. It reads `prefs` from `usePrefs()` and builds the right fetch call based on section. Returns `{ articles, loading, error, hasMore, loadMore, refresh }`.

`loading` = initial load. After that, `loadMore` appends to `articles`. `hasMore` is `true` while the last fetch returned a page of `limit` items. `refresh()` resets pagination from the top.

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useNews.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

vi.mock('./usePrefs.js', () => ({
  usePrefs: vi.fn(),
}));

vi.mock('../services/news.js', () => ({
  fetchBulgariaNews: vi.fn(),
  fetchWorldNews: vi.fn(),
  fetchSportsNews: vi.fn(),
}));

import { usePrefs } from './usePrefs.js';
import { fetchBulgariaNews, fetchWorldNews, fetchSportsNews } from '../services/news.js';
import { useNews } from './useNews.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useNews', () => {
  it('loads Bulgaria articles on mount', async () => {
    usePrefs.mockReturnValue({
      prefs: { bulgariaOutlets: ['dnevnik'], worldTopics: [], worldRegions: [], footballTeams: [], f1Follow: false },
    });
    fetchBulgariaNews.mockResolvedValue({
      articles: [{ id: '1', headline: 'A' }],
      lastDoc: { cursor: true },
    });
    const { result } = renderHook(() => useNews('bulgaria'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.articles).toHaveLength(1);
    expect(fetchBulgariaNews).toHaveBeenCalledWith({
      outlets: ['dnevnik'],
      limit: 30,
      cursor: null,
    });
  });

  it('loads World articles on mount', async () => {
    usePrefs.mockReturnValue({
      prefs: { bulgariaOutlets: [], worldTopics: ['tech'], worldRegions: ['us'], footballTeams: [], f1Follow: false },
    });
    fetchWorldNews.mockResolvedValue({ articles: [{ id: 'w1' }], lastDoc: null });
    const { result } = renderHook(() => useNews('world'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchWorldNews).toHaveBeenCalledWith({
      topics: ['tech'],
      regions: ['us'],
      limit: 30,
      cursor: null,
    });
    expect(result.current.hasMore).toBe(false);
  });

  it('loads Sports articles on mount', async () => {
    usePrefs.mockReturnValue({
      prefs: { bulgariaOutlets: [], worldTopics: [], worldRegions: [], footballTeams: ['PL-ARS'], f1Follow: true },
    });
    fetchSportsNews.mockResolvedValue({ articles: [], lastDoc: null });
    renderHook(() => useNews('sports'));
    await waitFor(() =>
      expect(fetchSportsNews).toHaveBeenCalledWith({
        teams: ['PL-ARS'],
        f1: true,
        limit: 30,
        cursor: null,
      }),
    );
  });

  it('loadMore appends next page and advances cursor', async () => {
    usePrefs.mockReturnValue({
      prefs: { bulgariaOutlets: ['x'], worldTopics: [], worldRegions: [], footballTeams: [], f1Follow: false },
    });
    const page1 = Array.from({ length: 30 }, (_, i) => ({ id: `p1-${i}` }));
    const page2 = [{ id: 'p2-0' }];
    fetchBulgariaNews
      .mockResolvedValueOnce({ articles: page1, lastDoc: { c: 1 } })
      .mockResolvedValueOnce({ articles: page2, lastDoc: null });

    const { result } = renderHook(() => useNews('bulgaria'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasMore).toBe(true);
    expect(result.current.articles).toHaveLength(30);

    await act(async () => {
      await result.current.loadMore();
    });
    expect(result.current.articles).toHaveLength(31);
    expect(result.current.hasMore).toBe(false);
  });

  it('refresh resets pagination from the top', async () => {
    usePrefs.mockReturnValue({
      prefs: { bulgariaOutlets: ['x'], worldTopics: [], worldRegions: [], footballTeams: [], f1Follow: false },
    });
    fetchBulgariaNews
      .mockResolvedValueOnce({ articles: [{ id: '1' }], lastDoc: null })
      .mockResolvedValueOnce({ articles: [{ id: '2' }], lastDoc: null });
    const { result } = renderHook(() => useNews('bulgaria'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.articles).toEqual([{ id: '2' }]);
    expect(fetchBulgariaNews).toHaveBeenCalledTimes(2);
    expect(fetchBulgariaNews.mock.calls[1][0].cursor).toBeNull();
  });

  it('sets error on fetch failure', async () => {
    usePrefs.mockReturnValue({
      prefs: { bulgariaOutlets: ['x'], worldTopics: [], worldRegions: [], footballTeams: [], f1Follow: false },
    });
    fetchBulgariaNews.mockRejectedValue(new Error('Boom'));
    const { result } = renderHook(() => useNews('bulgaria'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.articles).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm run test:run -- src/hooks/useNews.test.jsx
```

Expected: FAIL — `./useNews.js` not found.

- [ ] **Step 3: Implement `src/hooks/useNews.js`**

```js
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePrefs } from './usePrefs.js';
import {
  fetchBulgariaNews,
  fetchWorldNews,
  fetchSportsNews,
} from '../services/news.js';

const PAGE_SIZE = 30;

function buildFetcher(section, prefs) {
  if (section === 'bulgaria') {
    return (cursor) =>
      fetchBulgariaNews({
        outlets: prefs.bulgariaOutlets || [],
        limit: PAGE_SIZE,
        cursor,
      });
  }
  if (section === 'world') {
    return (cursor) =>
      fetchWorldNews({
        topics: prefs.worldTopics || [],
        regions: prefs.worldRegions || [],
        limit: PAGE_SIZE,
        cursor,
      });
  }
  if (section === 'sports') {
    return (cursor) =>
      fetchSportsNews({
        teams: prefs.footballTeams || [],
        f1: !!prefs.f1Follow,
        limit: PAGE_SIZE,
        cursor,
      });
  }
  throw new Error(`Unknown section: ${section}`);
}

export function useNews(section) {
  const { prefs } = usePrefs();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const cursorRef = useRef(null);

  const load = useCallback(
    async ({ reset } = { reset: false }) => {
      if (!prefs) return;
      const fetcher = buildFetcher(section, prefs);
      try {
        if (reset) {
          setLoading(true);
          cursorRef.current = null;
        }
        const { articles: page, lastDoc } = await fetcher(cursorRef.current);
        setArticles((prev) => (reset ? page : [...prev, ...page]));
        cursorRef.current = lastDoc;
        setHasMore(page.length === PAGE_SIZE && !!lastDoc);
        setError(null);
      } catch (err) {
        setError(err);
        if (reset) setArticles([]);
      } finally {
        setLoading(false);
      }
    },
    [section, prefs],
  );

  useEffect(() => {
    load({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, prefs]);

  const loadMore = useCallback(async () => {
    if (!hasMore) return;
    await load({ reset: false });
  }, [hasMore, load]);

  const refresh = useCallback(async () => {
    await load({ reset: true });
  }, [load]);

  return { articles, loading, error, hasMore, loadMore, refresh };
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npm run test:run -- src/hooks/useNews.test.jsx
```

Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useNews.js src/hooks/useNews.test.jsx
git commit -m "feat: useNews pagination hook"
```

---

## Task 4: ArticleCard component

**Files:**
- Create: `src/components/ArticleCard.jsx`
- Create: `src/components/ArticleCard.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/ArticleCard.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ArticleCard from './ArticleCard.jsx';

const ARTICLE = {
  id: 'a1',
  headline: 'Big news today',
  excerpt: 'A short preview of the article body text.',
  source: 'Dnevnik',
  url: 'https://example.com/news/big-news',
  imageUrl: 'https://example.com/img.jpg',
  publishedAt: { toDate: () => new Date(Date.now() - 5 * 60 * 1000) },
};

describe('ArticleCard', () => {
  it('renders headline, source, excerpt', () => {
    render(<ArticleCard article={ARTICLE} />);
    expect(screen.getByText('Big news today')).toBeDefined();
    expect(screen.getByText('Dnevnik')).toBeDefined();
    expect(screen.getByText(/short preview/i)).toBeDefined();
  });

  it('renders a link pointing to the article URL with target=_blank rel=noopener', () => {
    render(<ArticleCard article={ARTICLE} />);
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('https://example.com/news/big-news');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('renders image when imageUrl is present', () => {
    render(<ArticleCard article={ARTICLE} />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('src')).toBe('https://example.com/img.jpg');
    expect(img.getAttribute('loading')).toBe('lazy');
  });

  it('omits image when imageUrl is null', () => {
    const a = { ...ARTICLE, imageUrl: null };
    render(<ArticleCard article={a} />);
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('renders relative time', () => {
    render(<ArticleCard article={ARTICLE} />);
    expect(screen.getByText(/ago|just now/i)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm run test:run -- src/components/ArticleCard.test.jsx
```

Expected: FAIL — `./ArticleCard.jsx` not found.

- [ ] **Step 3: Implement `src/components/ArticleCard.jsx`**

```jsx
import { formatRelativeTime } from '../utils/time.js';

const CARD_STYLE = {
  display: 'flex',
  gap: 12,
  padding: '12px 16px',
  borderBottom: '1px solid #eee',
  textDecoration: 'none',
  color: 'inherit',
};

const IMG_STYLE = {
  width: 88,
  height: 66,
  objectFit: 'cover',
  borderRadius: 6,
  flexShrink: 0,
};

const META_STYLE = {
  fontSize: 12,
  color: '#666',
  display: 'flex',
  gap: 6,
  marginBottom: 4,
};

const HEADLINE_STYLE = {
  margin: 0,
  fontSize: 15,
  lineHeight: 1.3,
  fontWeight: 600,
};

const EXCERPT_STYLE = {
  margin: '4px 0 0',
  fontSize: 13,
  color: '#444',
  lineHeight: 1.4,
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
};

export default function ArticleCard({ article }) {
  const { headline, excerpt, source, url, imageUrl, publishedAt } = article;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={CARD_STYLE}
    >
      {imageUrl && (
        <img src={imageUrl} alt="" loading="lazy" style={IMG_STYLE} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={META_STYLE}>
          <span>{source || 'Unknown source'}</span>
          <span>·</span>
          <span>{formatRelativeTime(publishedAt)}</span>
        </div>
        <h3 style={HEADLINE_STYLE}>{headline}</h3>
        {excerpt && <p style={EXCERPT_STYLE}>{excerpt}</p>}
      </div>
    </a>
  );
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npm run test:run -- src/components/ArticleCard.test.jsx
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ArticleCard.jsx src/components/ArticleCard.test.jsx
git commit -m "feat: ArticleCard component"
```

---

## Task 5: Feed + supporting components

**Files:**
- Create: `src/components/EmptyState.jsx`
- Create: `src/components/ErrorState.jsx`
- Create: `src/components/Feed.jsx`

No tests for these — they are thin presentational wrappers exercised via the section tabs.

- [ ] **Step 1: Create `src/components/EmptyState.jsx`**

```jsx
export default function EmptyState({ title, message, actionLabel, onAction }) {
  return (
    <div style={{ padding: 32, textAlign: 'center', color: '#666' }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 16, color: '#333' }}>{title}</h3>
      <p style={{ margin: '0 0 16px', fontSize: 14 }}>{message}</p>
      {actionLabel && (
        <button onClick={onAction}>{actionLabel}</button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/ErrorState.jsx`**

```jsx
export default function ErrorState({ message = 'Couldn\u2019t load news.', onRetry }) {
  return (
    <div style={{ padding: 32, textAlign: 'center', color: '#b00' }}>
      <p style={{ margin: '0 0 12px' }}>{message}</p>
      {onRetry && <button onClick={onRetry}>Try again</button>}
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/Feed.jsx`**

```jsx
import { useEffect, useRef } from 'react';
import ArticleCard from './ArticleCard.jsx';
import Spinner from './Spinner.jsx';
import EmptyState from './EmptyState.jsx';
import ErrorState from './ErrorState.jsx';

export default function Feed({
  articles,
  loading,
  error,
  hasMore,
  loadMore,
  refresh,
  emptyTitle = 'No articles yet',
  emptyMessage = 'Check back in a bit — new articles arrive every 30 minutes.',
}) {
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!hasMore || !loadMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  if (loading && articles.length === 0) return <Spinner label="Loading…" />;
  if (error && articles.length === 0) {
    return <ErrorState onRetry={refresh} />;
  }
  if (!loading && articles.length === 0) {
    return <EmptyState title={emptyTitle} message={emptyMessage} />;
  }

  return (
    <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
      {articles.map((a) => (
        <ArticleCard key={a.id} article={a} />
      ))}
      {hasMore && (
        <div ref={sentinelRef} style={{ padding: 16, textAlign: 'center', color: '#888' }}>
          Loading more…
        </div>
      )}
      {!hasMore && articles.length > 0 && (
        <div style={{ padding: 16, textAlign: 'center', color: '#aaa', fontSize: 12 }}>
          — end —
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/EmptyState.jsx src/components/ErrorState.jsx src/components/Feed.jsx
git commit -m "feat: Feed, EmptyState, ErrorState components"
```

---

## Task 6: BulgariaTab

**Files:**
- Replace: `src/features/bulgaria/BulgariaTab.jsx`

- [ ] **Step 1: Replace `src/features/bulgaria/BulgariaTab.jsx`**

```jsx
import { useNews } from '../../hooks/useNews.js';
import Feed from '../../components/Feed.jsx';

export default function BulgariaTab() {
  const news = useNews('bulgaria');
  return (
    <section style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <header style={{ padding: '16px 16px 8px', borderBottom: '1px solid #eee' }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Bulgaria</h1>
      </header>
      <Feed
        {...news}
        emptyTitle="No Bulgaria articles yet"
        emptyMessage="Your selected outlets haven't published anything in the last 14 days, or ingest is still warming up."
      />
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/bulgaria/BulgariaTab.jsx
git commit -m "feat: BulgariaTab feed"
```

---

## Task 7: WorldTab

**Files:**
- Replace: `src/features/world/WorldTab.jsx`

- [ ] **Step 1: Replace `src/features/world/WorldTab.jsx`**

```jsx
import { useNews } from '../../hooks/useNews.js';
import Feed from '../../components/Feed.jsx';

export default function WorldTab() {
  const news = useNews('world');
  return (
    <section style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <header style={{ padding: '16px 16px 8px', borderBottom: '1px solid #eee' }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>World</h1>
      </header>
      <Feed
        {...news}
        emptyTitle="No world articles yet"
        emptyMessage="No matches for your topic + region combos right now."
      />
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/world/WorldTab.jsx
git commit -m "feat: WorldTab feed"
```

---

## Task 8: SportsTab

**Files:**
- Replace: `src/features/sports/SportsTab.jsx`

- [ ] **Step 1: Replace `src/features/sports/SportsTab.jsx`**

```jsx
import { useNews } from '../../hooks/useNews.js';
import { usePrefs } from '../../hooks/usePrefs.js';
import Feed from '../../components/Feed.jsx';
import EmptyState from '../../components/EmptyState.jsx';

export default function SportsTab() {
  const { prefs } = usePrefs();
  const news = useNews('sports');

  const hasAnyPrefs =
    (prefs?.footballTeams?.length ?? 0) > 0 || !!prefs?.f1Follow;

  return (
    <section style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <header style={{ padding: '16px 16px 8px', borderBottom: '1px solid #eee' }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Sports</h1>
      </header>
      {!hasAnyPrefs ? (
        <EmptyState
          title="No sports prefs set"
          message="Pick at least one football team or enable Formula 1 in Settings."
        />
      ) : (
        <Feed
          {...news}
          emptyTitle="No sports articles yet"
          emptyMessage="No news for your selected teams or F1 in the last 14 days."
        />
      )}
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/sports/SportsTab.jsx
git commit -m "feat: SportsTab feed"
```

---

## Task 9: HomeTab digest

**Files:**
- Create: `src/features/home/HomeSection.jsx`
- Replace: `src/features/home/HomeTab.jsx`

### Context

Home shows a 3/3/3 digest across Bulgaria / World / Sports. Reuses `useNews(section)` but caps display to 3 items and provides a "See all" link that switches the active tab.

- [ ] **Step 1: Create `src/features/home/HomeSection.jsx`**

```jsx
import { useNews } from '../../hooks/useNews.js';
import ArticleCard from '../../components/ArticleCard.jsx';
import Spinner from '../../components/Spinner.jsx';

export default function HomeSection({ title, section, onSeeAll }) {
  const { articles, loading, error } = useNews(section);
  const top = articles.slice(0, 3);

  return (
    <section style={{ borderBottom: '1px solid #eee' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 16px 8px',
        }}
      >
        <h2 style={{ margin: 0, fontSize: 16 }}>{title}</h2>
        <button
          onClick={onSeeAll}
          style={{
            background: 'none',
            border: 'none',
            color: '#0366d6',
            fontSize: 13,
            cursor: 'pointer',
            padding: 4,
          }}
        >
          See all →
        </button>
      </header>
      {loading && top.length === 0 && <Spinner label="Loading…" />}
      {error && top.length === 0 && (
        <div style={{ padding: 16, color: '#b00', fontSize: 13 }}>
          Couldn’t load — will retry on next view.
        </div>
      )}
      {!loading && !error && top.length === 0 && (
        <div style={{ padding: 16, color: '#888', fontSize: 13 }}>
          Nothing yet in this section.
        </div>
      )}
      {top.map((a) => (
        <ArticleCard key={a.id} article={a} />
      ))}
    </section>
  );
}
```

- [ ] **Step 2: Replace `src/features/home/HomeTab.jsx`**

```jsx
import HomeSection from './HomeSection.jsx';

export default function HomeTab({ onNavigate }) {
  return (
    <section style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
      <header style={{ padding: '16px 16px 8px' }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Today’s digest</h1>
      </header>
      <HomeSection
        title="Top from Bulgaria"
        section="bulgaria"
        onSeeAll={() => onNavigate?.('bulgaria')}
      />
      <HomeSection
        title="Top from the World"
        section="world"
        onSeeAll={() => onNavigate?.('world')}
      />
      <HomeSection
        title="Top from Sports"
        section="sports"
        onSeeAll={() => onNavigate?.('sports')}
      />
    </section>
  );
}
```

- [ ] **Step 3: Wire `onNavigate` in `src/App.jsx`**

Edit `src/App.jsx` — change:

```jsx
{activeTab === 'home' && <HomeTab />}
```

to:

```jsx
{activeTab === 'home' && <HomeTab onNavigate={setActiveTab} />}
```

- [ ] **Step 4: Commit**

```bash
git add src/features/home/HomeTab.jsx src/features/home/HomeSection.jsx src/App.jsx
git commit -m "feat: HomeTab 3/3/3 digest with section navigation"
```

---

## Task 10: Settings edit flows

**Files:**
- Create: `src/features/settings/EditBulgariaOutlets.jsx`
- Create: `src/features/settings/EditWorldPrefs.jsx`
- Create: `src/features/settings/EditSportsPrefs.jsx`
- Create: `src/features/settings/NotificationsSection.jsx`
- Modify: `src/features/settings/SettingsTab.jsx`

### Context

Four simple edit panels, inline on the Settings tab. Each reads current prefs via `usePrefs()` and writes changes via `update(patch)`. No modal — just collapsible `<details>` blocks.

- [ ] **Step 1: Create `src/features/settings/EditBulgariaOutlets.jsx`**

```jsx
import { usePrefs } from '../../hooks/usePrefs.js';
import { BULGARIA_OUTLETS } from '../../services/outlets.js';

export default function EditBulgariaOutlets() {
  const { prefs, update } = usePrefs();
  const selected = new Set(prefs?.bulgariaOutlets || []);

  async function toggle(slug) {
    const next = new Set(selected);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    await update({ bulgariaOutlets: [...next] });
  }

  return (
    <details>
      <summary style={{ cursor: 'pointer', padding: '8px 0' }}>
        Bulgaria outlets ({selected.size})
      </summary>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0' }}>
        {BULGARIA_OUTLETS.map((o) => (
          <label key={o.slug} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={selected.has(o.slug)}
              onChange={() => toggle(o.slug)}
            />
            <span>{o.name}</span>
          </label>
        ))}
      </div>
    </details>
  );
}
```

- [ ] **Step 2: Create `src/features/settings/EditWorldPrefs.jsx`**

```jsx
import { usePrefs } from '../../hooks/usePrefs.js';
import { WORLD_TOPICS, WORLD_REGIONS } from '../../services/worldConfig.js';

export default function EditWorldPrefs() {
  const { prefs, update } = usePrefs();
  const topics = new Set(prefs?.worldTopics || []);
  const regions = new Set(prefs?.worldRegions || []);

  async function toggleTopic(slug) {
    const next = new Set(topics);
    next.has(slug) ? next.delete(slug) : next.add(slug);
    await update({ worldTopics: [...next] });
  }
  async function toggleRegion(slug) {
    const next = new Set(regions);
    next.has(slug) ? next.delete(slug) : next.add(slug);
    await update({ worldRegions: [...next] });
  }

  return (
    <details>
      <summary style={{ cursor: 'pointer', padding: '8px 0' }}>
        World preferences ({topics.size} topics, {regions.size} regions)
      </summary>
      <div style={{ padding: '8px 0' }}>
        <h4 style={{ margin: '0 0 6px', fontSize: 13 }}>Topics</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {WORLD_TOPICS.map((t) => (
            <label key={t.slug} style={{ display: 'flex', gap: 8 }}>
              <input
                type="checkbox"
                checked={topics.has(t.slug)}
                onChange={() => toggleTopic(t.slug)}
              />
              <span>{t.label || t.slug}</span>
            </label>
          ))}
        </div>
        <h4 style={{ margin: '12px 0 6px', fontSize: 13 }}>Regions</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {WORLD_REGIONS.map((r) => (
            <label key={r.slug} style={{ display: 'flex', gap: 8 }}>
              <input
                type="checkbox"
                checked={regions.has(r.slug)}
                onChange={() => toggleRegion(r.slug)}
              />
              <span>{r.label || r.slug}</span>
            </label>
          ))}
        </div>
      </div>
    </details>
  );
}
```

**Note:** If `WORLD_TOPICS`/`WORLD_REGIONS` in `src/services/worldConfig.js` don't have a `label` field, the fallback `t.slug` / `r.slug` displays the slug. To verify, read `src/services/worldConfig.js` first and adjust the JSX to use whichever display field exists.

- [ ] **Step 3: Create `src/features/settings/EditSportsPrefs.jsx`**

```jsx
import { usePrefs } from '../../hooks/usePrefs.js';
import { LEAGUES, TEAMS } from '../../services/teams.js';

export default function EditSportsPrefs() {
  const { prefs, update } = usePrefs();
  const teams = new Set(prefs?.footballTeams || []);
  const f1 = !!prefs?.f1Follow;

  async function toggleTeam(id) {
    const next = new Set(teams);
    next.has(id) ? next.delete(id) : next.add(id);
    await update({ footballTeams: [...next] });
  }
  async function toggleF1() {
    await update({ f1Follow: !f1 });
  }

  return (
    <details>
      <summary style={{ cursor: 'pointer', padding: '8px 0' }}>
        Sports ({teams.size} teams{f1 ? ' + F1' : ''})
      </summary>
      <div style={{ padding: '8px 0' }}>
        <label style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input type="checkbox" checked={f1} onChange={toggleF1} />
          <span>Follow Formula 1</span>
        </label>
        {LEAGUES.map((league) => (
          <div key={league.id} style={{ marginBottom: 10 }}>
            <h4 style={{ margin: '0 0 6px', fontSize: 13 }}>{league.name}</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {TEAMS.filter((t) => t.leagueId === league.id).map((t) => (
                <label key={t.id} style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={teams.has(t.id)}
                    onChange={() => toggleTeam(t.id)}
                  />
                  <span>{t.name}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}
```

**Note:** If the `teams.js` exports use a different field name (e.g. `league` instead of `leagueId`), inspect the file first and adapt the filter accordingly. Acceptable: a single flat map showing all teams without league grouping if `teams.js` has no league field.

- [ ] **Step 4: Create `src/features/settings/NotificationsSection.jsx`**

```jsx
import { usePrefs } from '../../hooks/usePrefs.js';

const TOGGLES = [
  { key: 'bulgariaBreaking', label: 'Bulgaria — breaking news' },
  { key: 'worldBreaking', label: 'World — breaking news' },
  { key: 'sportsBreaking', label: 'Sports — breaking news' },
];

export default function NotificationsSection() {
  const { prefs, update } = usePrefs();
  const current = prefs?.notifications || {
    bulgariaBreaking: false,
    worldBreaking: false,
    sportsBreaking: false,
  };

  async function toggle(key) {
    await update({
      notifications: { ...current, [key]: !current[key] },
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {TOGGLES.map((t) => (
        <label key={t.key} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={!!current[t.key]}
            onChange={() => toggle(t.key)}
          />
          <span>{t.label}</span>
        </label>
      ))}
      <p style={{ fontSize: 12, color: '#888', margin: '4px 0 0' }}>
        Push delivery is wired up in Plan 4. These toggles persist now.
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Replace `src/features/settings/SettingsTab.jsx`**

```jsx
import ProfileSection from './ProfileSection.jsx';
import EditBulgariaOutlets from './EditBulgariaOutlets.jsx';
import EditWorldPrefs from './EditWorldPrefs.jsx';
import EditSportsPrefs from './EditSportsPrefs.jsx';
import NotificationsSection from './NotificationsSection.jsx';

export default function SettingsTab({ onRestartOnboarding }) {
  return (
    <section
      style={{
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        overflowY: 'auto',
        flex: 1,
        minHeight: 0,
      }}
    >
      <h1 style={{ margin: 0, fontSize: 20 }}>Settings</h1>

      <section>
        <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>Profile</h2>
        <ProfileSection />
      </section>

      <section>
        <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>Preferences</h2>
        <EditBulgariaOutlets />
        <EditWorldPrefs />
        <EditSportsPrefs />
        <button
          onClick={onRestartOnboarding}
          style={{ marginTop: 12 }}
        >
          Re-run setup wizard
        </button>
      </section>

      <section>
        <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>Notifications</h2>
        <NotificationsSection />
      </section>

      <section>
        <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>About</h2>
        <div style={{ color: '#666' }}>Daily Family Digest — v1</div>
      </section>
    </section>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/features/settings/
git commit -m "feat: Settings edit flows for all preference groups"
```

---

## Task 11: Final smoke test + regression run

### Context

Manually verify the full app works in the browser against the live Firestore database.

- [ ] **Step 1: Run the full test suite**

```bash
npm run test:run
```

Expected: All tests pass. New tests: time (7), news (8), useNews (6), ArticleCard (5). Plus existing tests from Plan 1.

- [ ] **Step 2: Start the dev server**

```bash
npm run dev
```

The app should serve on `http://localhost:5173` (or another port if 5173 is busy).

- [ ] **Step 3: Smoke test in the browser**

1. Open the app and sign in if needed.
2. Home tab: verify 3/3/3 digest renders. Each section either shows up to 3 articles, a "Nothing yet" message, or an error. No blank screens, no console errors.
3. Click "See all →" on each section — it should switch to the corresponding tab.
4. Bulgaria tab: verify articles list. Scroll to bottom; more articles should load.
5. World tab: verify articles list.
6. Sports tab: verify articles list, or the "No sports prefs set" empty state if user has no teams/F1.
7. Click an article — it should open in a new tab.
8. Settings tab: expand each `<details>` panel, toggle a preference, verify the count updates.
9. Toggle a notification checkbox and reload the page — the state persists.

- [ ] **Step 4: Build for production**

```bash
npm run build
```

Expected: `dist/` created, no errors. Warnings about chunk size are acceptable.

- [ ] **Step 5: Commit + tag**

```bash
git add -A
git status   # verify no unexpected changes
git commit --allow-empty -m "chore: plan 3 smoke test complete"
git tag plan-3-complete
```

---

## Dependencies between tasks

```
1 (time utility)
  └─ 4 (ArticleCard — uses formatRelativeTime)
2 (news service)
  └─ 3 (useNews hook — uses news service)
       └─ 5 (Feed — uses useNews indirectly via tabs)
       └─ 6 (BulgariaTab)
       └─ 7 (WorldTab)
       └─ 8 (SportsTab)
            └─ 9 (HomeTab — uses useNews)
10 (Settings edit flows) — independent of news-reading tasks
11 (smoke test) — after all others
```

Tasks 1, 2, and 10 can be done in parallel if dispatched as separate subagents.

---

## Self-review checklist

**Spec coverage** (Section 7 of the design doc):
- ✅ Bottom 5-tab nav — already in Plan 1, wired in App.jsx
- ✅ Onboarding — already in Plan 1
- ✅ Home digest 3/3/3 — Task 9
- ✅ Bulgaria / World / Sports feeds with infinite scroll — Tasks 6, 7, 8 + Feed in Task 5
- ✅ Pull-to-refresh — deferred (refresh is exposed by the hook but not wired to a gesture in v1; explicit refresh button could be added later)
- ✅ Filter chip row for session narrowing — deferred to a future plan (not called out as v1-critical in success criteria)
- ✅ ArticleCard with image + excerpt + time — Task 4
- ✅ External open — Task 4 (`target=_blank`)
- ✅ Settings edit entry points — Task 10
- ✅ 30-element chunking — Task 2
- ✅ `usePrefs` + `useNews` hooks — Plan 1 + Task 3

**Spec Section 9 error handling:**
- ✅ Empty feed — EmptyState (Task 5)
- ✅ Load error — ErrorState with retry (Task 5)
- ✅ Offline — Firestore SDK handles transparently; no explicit banner in v1 (offline banner is a nice-to-have not in the success criteria)

**Gaps (intentional deferrals, not v1 blockers):**
- Pull-to-refresh gesture — we have `refresh()` ready but no gesture binding yet; can add a simple pull-down detector later
- Filter-chip row — session-only narrowing isn't in the v1 success criteria
- Offline banner — Firestore offers built-in local persistence
