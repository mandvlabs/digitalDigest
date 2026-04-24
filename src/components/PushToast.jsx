export default function PushToast({ toast, onDismiss, onArticleOpen }) {
  if (!toast) return null;
  const canOpenInApp = Boolean(toast.articleId && onArticleOpen);
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 72,
        background: '#111',
        color: '#fff',
        borderRadius: 8,
        padding: '12px 14px',
        boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <strong>{toast.title}</strong>
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{ background: 'transparent', color: '#fff', border: 0, cursor: 'pointer' }}
        >
          ×
        </button>
      </div>
      <div style={{ fontSize: 20 }}>{toast.body}</div>
      {canOpenInApp ? (
        <button
          onClick={() => onArticleOpen(toast.articleId)}
          style={{
            alignSelf: 'flex-start',
            background: 'transparent',
            color: '#9ecbff',
            border: 0,
            padding: 0,
            fontSize: 19,
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Read →
        </button>
      ) : toast.url ? (
        <a
          href={toast.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#9ecbff', fontSize: 19 }}
        >
          Read →
        </a>
      ) : null}
    </div>
  );
}
