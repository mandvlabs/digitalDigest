import { formatRelativeTime } from '../utils/time.js';

const CARD_STYLE = {
  display: 'flex',
  gap: 12,
  padding: '12px 16px',
  borderBottom: '1px solid #eee',
  textDecoration: 'none',
  color: 'inherit',
};

const IMG_STYLE = {
  width: 88,
  height: 66,
  objectFit: 'cover',
  borderRadius: 6,
  flexShrink: 0,
};

const META_STYLE = {
  fontSize: 12,
  color: '#666',
  display: 'flex',
  gap: 6,
  marginBottom: 4,
};

const HEADLINE_STYLE = {
  margin: 0,
  fontSize: 15,
  lineHeight: 1.3,
  fontWeight: 600,
};

const EXCERPT_STYLE = {
  margin: '4px 0 0',
  fontSize: 13,
  color: '#444',
  lineHeight: 1.4,
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
};

export default function ArticleCard({ article }) {
  const { headline, excerpt, source, url, imageUrl, publishedAt } = article;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={CARD_STYLE}
    >
      {imageUrl && (
        <img src={imageUrl} alt={headline} loading="lazy" style={IMG_STYLE} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={META_STYLE}>
          <span>{source || 'Unknown source'}</span>
          <span>·</span>
          <span>{formatRelativeTime(publishedAt)}</span>
        </div>
        <h3 style={HEADLINE_STYLE}>{headline}</h3>
        {excerpt && <p style={EXCERPT_STYLE}>{excerpt}</p>}
      </div>
    </a>
  );
}
