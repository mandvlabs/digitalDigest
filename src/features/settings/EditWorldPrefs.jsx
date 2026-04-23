import { usePrefs } from '../../hooks/usePrefs.js';
import { WORLD_TOPICS, WORLD_REGIONS } from '../../services/worldConfig.js';

export default function EditWorldPrefs() {
  const { prefs, update } = usePrefs();
  const topics = new Set(prefs?.worldTopics || []);
  const regions = new Set(prefs?.worldRegions || []);

  async function toggleTopic(slug) {
    const next = new Set(topics);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    await update({ worldTopics: [...next] });
  }
  async function toggleRegion(slug) {
    const next = new Set(regions);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    await update({ worldRegions: [...next] });
  }

  return (
    <details>
      <summary style={{ cursor: 'pointer', padding: '8px 0' }}>
        World preferences ({topics.size} topics, {regions.size} regions)
      </summary>
      <div style={{ padding: '8px 0' }}>
        <h4 style={{ margin: '0 0 6px', fontSize: 13 }}>Topics</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {WORLD_TOPICS.map((t) => (
            <label key={t.slug} style={{ display: 'flex', gap: 8 }}>
              <input
                type="checkbox"
                checked={topics.has(t.slug)}
                onChange={() => toggleTopic(t.slug)}
              />
              <span>{t.name || t.slug}</span>
            </label>
          ))}
        </div>
        <h4 style={{ margin: '12px 0 6px', fontSize: 13 }}>Regions</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {WORLD_REGIONS.map((r) => (
            <label key={r.slug} style={{ display: 'flex', gap: 8 }}>
              <input
                type="checkbox"
                checked={regions.has(r.slug)}
                onChange={() => toggleRegion(r.slug)}
              />
              <span>{r.name || r.slug}</span>
            </label>
          ))}
        </div>
      </div>
    </details>
  );
}
