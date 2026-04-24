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
        <div style={{ padding: 16, textAlign: 'center', color: '#aaa', fontSize: 14 }}>
          — end —
        </div>
      )}
    </div>
  );
}
