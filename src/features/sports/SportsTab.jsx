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
        <h1 style={{ margin: 0, fontSize: 22 }}>Sports</h1>
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
