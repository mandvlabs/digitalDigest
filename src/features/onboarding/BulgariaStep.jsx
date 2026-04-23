import { BULGARIA_OUTLETS } from '../../services/outlets.js';

export default function BulgariaStep({ selected, onChange, onBack, onNext }) {
  function toggle(slug) {
    if (selected.includes(slug)) {
      onChange(selected.filter((s) => s !== slug));
    } else {
      onChange([...selected, slug]);
    }
  }

  const canContinue = selected.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h1 style={{ margin: 0 }}>Which Bulgarian outlets?</h1>
      <p style={{ color: '#666' }}>Pick at least one.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {BULGARIA_OUTLETS.map((o) => (
          <label key={o.slug} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={selected.includes(o.slug)}
              onChange={() => toggle(o.slug)}
            />
            {o.name}
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
        <button onClick={onBack}>Back</button>
        <button disabled={!canContinue} onClick={onNext}>Next</button>
      </div>
    </div>
  );
}
