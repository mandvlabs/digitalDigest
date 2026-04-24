import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase.js';
import { formatRelativeTime } from '../../utils/time.js';
import Spinner from '../../components/Spinner.jsx';

export default function ArticleReader({ articleId, onBack }) {
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setArticle(null);
    setImgFailed(false);
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'news', articleId));
        if (cancelled) return;
        if (!snap.exists()) {
          setError('Article not found');
        } else {
          setArticle({ id: snap.id, ...snap.data() });
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load article');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [articleId]);

  if (loading) return <Spinner label="Loading article…" />;

  if (error) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#444' }}>
        <p style={{ fontSize: 18 }}>{error}</p>
        <button
          onClick={onBack}
          style={{
            marginTop: 12,
            padding: '10px 18px',
            fontSize: 16,
            background: '#5b1a9e',
            color: '#fff',
            border: 0,
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          ← Back
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        background: '#fff',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '12px 16px',
          borderBottom: '1px solid #eee',
          flexShrink: 0,
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 0,
            color: '#5b1a9e',
            fontSize: 17,
            fontWeight: 600,
            cursor: 'pointer',
            padding: '6px 8px',
          }}
        >
          ← Back
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16, minHeight: 0 }}>
        {article.imageUrl && !imgFailed && (
          <img
            src={article.imageUrl}
            alt={article.headline || ''}
            onError={() => setImgFailed(true)}
            style={{
              width: '100%',
              borderRadius: 8,
              marginBottom: 16,
              maxHeight: 260,
              objectFit: 'cover',
            }}
          />
        )}
        <div style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>
          {article.source || 'Unknown source'} ·{' '}
          {formatRelativeTime(article.publishedAt)}
        </div>
        <h1 style={{ fontSize: 22, margin: '0 0 12px', lineHeight: 1.3 }}>
          {article.headline}
        </h1>
        {article.excerpt && (
          <p
            style={{
              fontSize: 17,
              lineHeight: 1.55,
              color: '#333',
              margin: '0 0 24px',
            }}
          >
            {article.excerpt}
          </p>
        )}

        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block',
            textAlign: 'center',
            padding: '14px 24px',
            background: '#5b1a9e',
            color: '#fff',
            borderRadius: 8,
            textDecoration: 'none',
            fontSize: 17,
            fontWeight: 600,
          }}
        >
          Open article →
        </a>
      </div>
    </div>
  );
}
