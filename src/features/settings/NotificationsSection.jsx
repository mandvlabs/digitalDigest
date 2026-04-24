import { useState } from 'react';
import { usePrefs } from '../../hooks/usePrefs.js';
import { useAuth } from '../../hooks/useAuth.js';
import { subscribeToken } from '../../services/messaging.js';

const TOGGLES = [
  { key: 'bulgariaBreaking', label: 'Bulgaria — breaking news' },
  { key: 'worldBreaking', label: 'World — breaking news' },
  { key: 'sportsBreaking', label: 'Sports — breaking news' },
];

function currentPermission() {
  return typeof Notification !== 'undefined' ? Notification.permission : 'denied';
}

export default function NotificationsSection() {
  const { prefs, update } = usePrefs();
  const { user } = useAuth();
  const [permission, setPermission] = useState(currentPermission());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const current = prefs?.notifications || {
    bulgariaBreaking: false,
    worldBreaking: false,
    sportsBreaking: false,
  };

  async function toggle(key) {
    await update({ notifications: { ...current, [key]: !current[key] } });
  }

  async function enable() {
    setError(null);
    if (typeof Notification === 'undefined') {
      setError('This browser does not support web notifications.');
      return;
    }
    setBusy(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted' && user?.uid) {
        const token = await subscribeToken(user.uid);
        if (!token) setError('Could not get a push token. Try again after reloading.');
      } else if (result === 'denied') {
        setError('Notifications blocked — enable in browser settings.');
      }
    } catch (err) {
      setError(err.message || 'Failed to enable notifications');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 15, color: '#666' }}>
        Permission: <strong>{permission}</strong>
      </div>
      {permission !== 'granted' && (
        <button onClick={enable} disabled={busy} style={{ alignSelf: 'flex-start' }}>
          {busy ? 'Enabling…' : 'Enable notifications'}
        </button>
      )}
      {permission === 'granted' && (
        <button
          onClick={async () => {
            if (!user?.uid) return;
            setBusy(true);
            try {
              await subscribeToken(user.uid);
            } finally {
              setBusy(false);
            }
          }}
          disabled={busy}
          style={{ alignSelf: 'flex-start' }}
        >
          {busy ? 'Refreshing…' : 'Refresh push token'}
        </button>
      )}
      {error && <div style={{ color: '#b00', fontSize: 15 }}>{error}</div>}
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
    </div>
  );
}
