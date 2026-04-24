import { useNews } from '../../hooks/useNews.js';
import Feed from '../../components/Feed.jsx';

export default function WorldTab() {
  const news = useNews('world');
  return (
    <section style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <header style={{ padding: '16px 16px 8px', borderBottom: '1px solid #eee' }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>World</h1>
      </header>
      <Feed
        {...news}
        emptyTitle="No world articles yet"
        emptyMessage="No matches for your topic + region combos right now."
      />
    </section>
  );
}
