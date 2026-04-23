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

function mockSnapshot(items, prefix = 'id') {
  const docs = items.map((data, i) => ({
    id: `${prefix}-${i}`,
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
        ], 'c1'))
        .mockResolvedValueOnce(mockSnapshot([
          { section: 'bulgaria', headline: 'B', publishedAt: { toDate: () => new Date('2026-04-23T13:00Z') } },
        ], 'c2'));
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
