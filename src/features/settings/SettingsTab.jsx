import ProfileSection from './ProfileSection.jsx';
import EditBulgariaOutlets from './EditBulgariaOutlets.jsx';
import EditWorldPrefs from './EditWorldPrefs.jsx';
import EditSportsPrefs from './EditSportsPrefs.jsx';
import NotificationsSection from './NotificationsSection.jsx';

export default function SettingsTab({ onRestartOnboarding }) {
  return (
    <section
      style={{
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        overflowY: 'auto',
        flex: 1,
        minHeight: 0,
      }}
    >
      <h1 style={{ margin: 0, fontSize: 20 }}>Settings</h1>

      <section>
        <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>Profile</h2>
        <ProfileSection />
      </section>

      <section>
        <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>Preferences</h2>
        <EditBulgariaOutlets />
        <EditWorldPrefs />
        <EditSportsPrefs />
        <button
          onClick={onRestartOnboarding}
          style={{ marginTop: 12 }}
        >
          Re-run setup wizard
        </button>
      </section>

      <section>
        <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>Notifications</h2>
        <NotificationsSection />
      </section>

      <section>
        <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>About</h2>
        <div style={{ color: '#666' }}>Daily Family Digest — v1</div>
      </section>
    </section>
  );
}
