export default function OnboardingWizard({ onFinish }) {
  return (
    <div style={{ padding: 24 }}>
      <h1>Setup (coming soon)</h1>
      <button onClick={onFinish}>Skip for now</button>
    </div>
  );
}
