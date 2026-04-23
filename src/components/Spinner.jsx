export default function Spinner({ label = 'Loading…' }) {
  return (
    <div style={{ padding: 24, textAlign: 'center', color: '#666' }}>
      {label}
    </div>
  );
}
