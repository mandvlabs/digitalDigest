import { usePrefs } from '../../hooks/usePrefs.js';

const TOGGLES = [
  { key: 'bulgariaBreaking', label: 'Bulgaria — breaking news' },
  { key: 'worldBreaking', label: 'World — breaking news' },
  { key: 'sportsBreaking', label: 'Sports — breaking news' },
];

export default function NotificationsSection() {
  const { prefs, update } = usePrefs();
  const current = prefs?.notifications || {
    bulgariaBreaking: false,
    worldBreaking: false,
    sportsBreaking: false,
  };

  async function toggle(key) {
    await update({
      notifications: { ...current, [key]: !current[key] },
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {TOGGLES.map((t) => (
        <label key={t.key} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={!!current[t.key]}
            onChange={() => toggle(t.key)}
          />
          <span>{t.label}</span>
        </label>
      ))}
      <p style={{ fontSize: 12, color: '#888', margin: '4px 0 0' }}>
        Push delivery is wired up in Plan 4. These toggles persist now.
      </p>
    </div>
  );
}
