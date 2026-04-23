export default function WelcomeStep({ onNext }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h1 style={{ margin: 0 }}>Welcome</h1>
      <p style={{ color: '#666' }}>
        Let's set up your news feed. It'll take about a minute.
      </p>
      <button onClick={onNext}>Continue</button>
    </div>
  );
}
