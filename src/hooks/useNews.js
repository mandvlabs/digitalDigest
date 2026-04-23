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
