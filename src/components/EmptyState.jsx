export default function EmptyState({ title, message, actionLabel, onAction }) {
  return (
    <div style={{ padding: 32, textAlign: 'center', color: '#666' }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 16, color: '#333' }}>{title}</h3>
      <p style={{ margin: '0 0 16px', fontSize: 14 }}>{message}</p>
      {actionLabel && (
        <button onClick={onAction}>{actionLabel}</button>
      )}
    </div>
  );
}
