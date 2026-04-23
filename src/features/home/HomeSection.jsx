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
          Couldn't load — will retry on next view.
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
