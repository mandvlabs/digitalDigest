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
