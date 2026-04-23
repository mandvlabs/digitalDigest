import { usePrefs } from '../../hooks/usePrefs.js';
import { BULGARIA_OUTLETS } from '../../services/outlets.js';

export default function EditBulgariaOutlets() {
  const { prefs, update } = usePrefs();
  const selected = new Set(prefs?.bulgariaOutlets || []);

  async function toggle(slug) {
    const next = new Set(selected);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    await update({ bulgariaOutlets: [...next] });
  }

  return (
    <details>
      <summary style={{ cursor: 'pointer', padding: '8px 0' }}>
        Bulgaria outlets ({selected.size})
      </summary>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0' }}>
        {BULGARIA_OUTLETS.map((o) => (
          <label key={o.slug} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={selected.has(o.slug)}
              onChange={() => toggle(o.slug)}
            />
            <span>{o.name}</span>
          </label>
        ))}
      </div>
    </details>
  );
}
