import { useState } from 'react';

export default function NotificationsStep({ notifications, onChange, onBack, onFinish }) {
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );

  async function requestPermission() {
    if (typeof Notification === 'undefined') {
      setPermission('denied');
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
  }

  function toggle(key) {
    onChange({ ...notifications, [key]: !notifications[key] });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h1 style={{ margin: 0 }}>Notifications</h1>
      <p style={{ color: '#666' }}>Optional — you can change these later in Settings.</p>

      <section>
        <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>Browser permission</h2>
        <div style={{ color: '#333', marginBottom: 8 }}>
          Status: <strong>{permission}</strong>
        </div>
        {permission !== 'granted' && (
          <button onClick={requestPermission}>Enable notifications</button>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>What to alert me about</h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={notifications.bulgariaBreaking}
            onChange={() => toggle('bulgariaBreaking')}
          />
          Bulgaria — breaking news
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={notifications.worldBreaking}
            onChange={() => toggle('worldBreaking')}
          />
          World — breaking news
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={notifications.sportsBreaking}
            onChange={() => toggle('sportsBreaking')}
          />
          Sports — breaking news
        </label>
      </section>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
        <button onClick={onBack}>Back</button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onFinish}>Skip</button>
          <button onClick={onFinish}>Finish</button>
        </div>
      </div>
    </div>
  );
}
