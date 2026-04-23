import { WORLD_TOPICS, WORLD_REGIONS } from '../../services/worldConfig.js';

function toggle(list, value) {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

export default function WorldStep({
  selectedTopics,
  selectedRegions,
  onChangeTopics,
  onChangeRegions,
  onBack,
  onNext,
}) {
  const canContinue = selectedTopics.length > 0 && selectedRegions.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h1 style={{ margin: 0 }}>World news</h1>

      <section>
        <h2 style={{ fontSize: 16, margin: '0 0 4px' }}>Topics</h2>
        <p style={{ color: '#666', margin: '0 0 8px' }}>Pick at least one.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {WORLD_TOPICS.map((t) => (
            <label key={t.slug} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={selectedTopics.includes(t.slug)}
                onChange={() => onChangeTopics(toggle(selectedTopics, t.slug))}
              />
              {t.name}
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 16, margin: '0 0 4px' }}>Regions</h2>
        <p style={{ color: '#666', margin: '0 0 8px' }}>Pick at least one.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {WORLD_REGIONS.map((r) => (
            <label key={r.slug} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={selectedRegions.includes(r.slug)}
                onChange={() => onChangeRegions(toggle(selectedRegions, r.slug))}
              />
              {r.name}
            </label>
          ))}
        </div>
      </section>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
        <button onClick={onBack}>Back</button>
        <button disabled={!canContinue} onClick={onNext}>Next</button>
      </div>
    </div>
  );
}
