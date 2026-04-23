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
