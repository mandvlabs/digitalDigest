import { useEffect, useState } from 'react';
import { useAuth } from './hooks/useAuth.js';
import { usePrefs } from './hooks/usePrefs.js';
import { useMessaging } from './hooks/useMessaging.js';
import { signInWithGoogle } from './services/auth.js';
import { registerMessagingSW } from './services/messaging.js';
import Spinner from './components/Spinner.jsx';
import AppLayout from './components/AppLayout.jsx';
import PushToast from './components/PushToast.jsx';
import OnboardingWizard from './features/onboarding/OnboardingWizard.jsx';
import HomeTab from './features/home/HomeTab.jsx';
import BulgariaTab from './features/bulgaria/BulgariaTab.jsx';
import WorldTab from './features/world/WorldTab.jsx';
import SportsTab from './features/sports/SportsTab.jsx';
import SettingsTab from './features/settings/SettingsTab.jsx';
import ArticleReader from './features/reader/ArticleReader.jsx';

const VALID_TABS = new Set(['home', 'bulgaria', 'world', 'sports', 'settings']);

function readInitialTab() {
  try {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab && VALID_TABS.has(tab)) {
      params.delete('tab');
      const search = params.toString();
      const next = window.location.pathname + (search ? `?${search}` : '') + window.location.hash;
      window.history.replaceState({}, '', next);
      return tab;
    }
  } catch {}
  return 'home';
}

function readInitialArticle() {
  try {
    const params = new URLSearchParams(window.location.search);
    const article = params.get('article');
    if (article) {
      params.delete('article');
      const search = params.toString();
      const next = window.location.pathname + (search ? `?${search}` : '') + window.location.hash;
      window.history.replaceState({}, '', next);
      return article;
    }
  } catch {}
  return null;
}

function extractArticleFromRoute(route) {
  if (!route) return null;
  try {
    const url = new URL(route, window.location.origin);
    return url.searchParams.get('article') || null;
  } catch {
    return null;
  }
}

function AuthenticatedApp() {
  const { prefs, loading: prefsLoading } = usePrefs();
  const [articleId, setArticleId] = useState(readInitialArticle);
  const { toast, dismiss } = useMessaging();
  const [activeTab, setActiveTab] = useState(readInitialTab);
  const [rerunOnboarding, setRerunOnboarding] = useState(false);

  // Deep-link recovery path 2: Launch Handler API (Chromium)
  useEffect(() => {
    if (!('launchQueue' in window)) return;
    try {
      window.launchQueue.setConsumer((launchParams) => {
        if (!launchParams?.targetURL) return;
        try {
          const url = new URL(launchParams.targetURL);
          const article = url.searchParams.get('article');
          if (article) setArticleId(article);
        } catch {}
      });
    } catch {}
  }, []);

  // Deep-link recovery path 3: postMessage from SW
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = (event) => {
      if (event.data?.type !== 'NOTIFICATION_CLICK') return;
      const article = extractArticleFromRoute(event.data.targetRoute);
      if (article) setArticleId(article);
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, []);

  if (prefsLoading) return <Spinner label="Loading your preferences…" />;

  if (!prefs?.onboardingComplete || rerunOnboarding) {
    return (
      <OnboardingWizard
        onFinish={() => setRerunOnboarding(false)}
      />
    );
  }

  if (articleId) {
    return (
      <ArticleReader
        articleId={articleId}
        onBack={() => setArticleId(null)}
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
      <PushToast
        toast={toast}
        onDismiss={dismiss}
        onArticleOpen={(id) => {
          dismiss();
          setArticleId(id);
        }}
      />
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

  useEffect(() => {
    registerMessagingSW();
  }, []);

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
    return <Spinner label="Loading your news…" />;
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
