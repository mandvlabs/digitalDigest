export default function ErrorState({ message = 'Couldn\u2019t load news.', onRetry }) {
  return (
    <div style={{ padding: 32, textAlign: 'center', color: '#b00' }}>
      <p style={{ margin: '0 0 12px' }}>{message}</p>
      {onRetry && <button onClick={onRetry}>Try again</button>}
    </div>
  );
}
