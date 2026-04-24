import { useNews } from '../../hooks/useNews.js';
import Feed from '../../components/Feed.jsx';

export default function BulgariaTab() {
  const news = useNews('bulgaria');
  return (
    <section style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <header style={{ padding: '16px 16px 8px', borderBottom: '1px solid #eee' }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Bulgaria</h1>
      </header>
      <Feed
        {...news}
        emptyTitle="No Bulgaria articles yet"
        emptyMessage="Your selected outlets haven't published anything in the last 14 days, or ingest is still warming up."
      />
    </section>
  );
}
