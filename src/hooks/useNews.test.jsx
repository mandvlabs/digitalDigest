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
