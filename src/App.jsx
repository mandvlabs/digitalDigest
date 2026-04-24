import { useEffect, useState } from 'react';
import { useAuth } from './hooks/useAuth.js';
import { usePrefs } from './hooks/usePrefs.js';
import { useMessaging } from './hooks/useMessaging.js';
import { signInWithGoogle } from './services/auth.js';
import Spinner from './components/Spinner.jsx';
import AppLayout from './components/AppLayout.jsx';
import PushToast from './components/PushToast.jsx';
import OnboardingWizard from './features/onboarding/OnboardingWizard.jsx';
import HomeTab from './features/home/HomeTab.jsx';
import BulgariaTab from './features/bulgaria/BulgariaTab.jsx';
import WorldTab from './features/world/WorldTab.jsx';
import SportsTab from './features/sports/SportsTab.jsx';
import SettingsTab from './features/settings/SettingsTab.jsx';

function AuthenticatedApp() {
  const { prefs, loading: prefsLoading } = usePrefs();
  const { toast, dismiss } = useMessaging();
  const [activeTab, setActiveTab] = useState('home');
  const [rerunOnboarding, setRerunOnboarding] = useState(false);

  if (prefsLoading) return <Spinner label="Loading your preferences…" />;

  if (!prefs?.onboardingComplete || rerunOnboarding) {
    return (
      <OnboardingWizard
        onFinish={() => setRerunOnboarding(false)}
      />
    );
  }

  return (
    <>
      <AppLayout activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === 'home' && <HomeTab onNavigate={setActiveTab} />}
        {activeTab === 'bulgaria' && <BulgariaTab />}
        {activeTab === 'world' && <WorldTab />}
        {activeTab === 'sports' && <SportsTab />}
        {activeTab === 'settings' && (
          <SettingsTab onRestartOnboarding={() => setRerunOnboarding(true)} />
        )}
      </AppLayout>
      <PushToast toast={toast} onDismiss={dismiss} />
    </>
  );
}

export default function App() {
  const { user, loading: authLoading } = useAuth();
  const [signingIn, setSigningIn] = useState(() => {
    try {
      return sessionStorage.getItem('dfd:signing-in') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (user) setSigningIn(false);
  }, [user]);

  async function handleSignIn() {
    try {
      sessionStorage.setItem('dfd:signing-in', '1');
    } catch {}
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setSigningIn(false);
      try {
        sessionStorage.removeItem('dfd:signing-in');
      } catch {}
      throw err;
    }
  }

  if (authLoading || (signingIn && !user)) {
    return <Spinner label={signingIn ? 'Loading your news…' : 'Starting…'} />;
  }

  if (!user) {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 360, margin: '64px auto' }}>
        <h1 style={{ margin: 0 }}>Daily Family Digest</h1>
        <p style={{ color: '#666' }}>
          Sign in with Google to set up your news feed.
        </p>
        <button onClick={handleSignIn}>Continue with Google</button>
      </div>
    );
  }

  return <AuthenticatedApp />;
}
