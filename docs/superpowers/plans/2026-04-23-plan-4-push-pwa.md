# Plan 4: Push Notifications + PWA Polish

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship end-to-end breaking-news push (client subscribe → server fan-out → targeted FCM delivery) plus the PWA polish required for iOS install-to-home-screen.

**Architecture:** Client gets an FCM token after permission grant and appends it to `users/{uid}/private/preferences.fcmTokens[]`; a service worker handles background push. A new `onNewsArticle` Firestore trigger runs a pure `pushMatch` function against each eligible user (via `collectionGroup('private')`), sends FCM per remaining token, rate-limits per section via `users/{uid}/private/pushState.lastPushAt[section]`, and prunes dead tokens. A GitHub Actions workflow deploys hosting + functions + rules + indexes on push to `main`.

**Tech Stack:** Firebase Web SDK v12 messaging, firebase-admin v13 messaging, Cloud Functions v2 Firestore triggers, Web Push manifest, Vitest (client + node).

---

## File Structure

**Created:**
- `public/manifest.webmanifest` — PWA manifest (name, icons, display, theme)
- `public/icon-192.png`, `public/icon-512.png` — PWA icons (generated from existing `public/favicon.svg`)
- `public/firebase-messaging-sw.js` — background FCM service worker
- `src/services/messaging.js` — `subscribeToken(uid)`, `onForegroundMessage(cb)`
- `src/services/messaging.test.js`
- `src/hooks/useMessaging.js` — wires foreground messages to app toast state
- `src/hooks/useMessaging.test.jsx`
- `src/components/PushToast.jsx` — in-app toast shown on foreground FCM
- `src/components/PushToast.test.jsx`
- `src/features/settings/InstallHint.jsx` — iOS add-to-home-screen hint
- `src/features/settings/InstallHint.test.jsx`
- `src/utils/standalone.js` — detect PWA-installed state
- `src/utils/standalone.test.js`
- `functions/lib/pushMatch.js` — pure match logic
- `functions/lib/pushMatch.test.js`
- `functions/onNewsArticle.js` — Firestore trigger + FCM send
- `functions/onNewsArticle.test.js`
- `.github/workflows/deploy.yml` — CI deploy on push to `main`

**Modified:**
- `index.html` — link manifest + iOS meta tags
- `src/services/prefs.js` — `addFcmToken(uid, token)`, `removeFcmToken(uid, token)`
- `src/services/prefs.test.js` — cover token helpers
- `src/features/onboarding/NotificationsStep.jsx` — subscribe FCM on permission grant
- `src/features/settings/NotificationsSection.jsx` — "Enable notifications" action wired
- `src/App.jsx` — mount `PushToast` + wire `useMessaging`
- `functions/index.js` — export `onNewsArticle`
- `CLAUDE.md` — update Plan 4 status once complete

---

## Task 1: PWA manifest + iOS meta tags

**Files:**
- Create: `public/manifest.webmanifest`
- Create: `public/icon-192.png`, `public/icon-512.png`
- Modify: `index.html`

- [ ] **Step 1: Generate PNG icons from the existing SVG**

Run from the project root:

```bash
cd "/Users/vladislavgeorgiev/Daily Family Digest"
# Using built-in macOS tooling — no new deps
sips -s format png -Z 192 public/favicon.svg --out public/icon-192.png
sips -s format png -Z 512 public/favicon.svg --out public/icon-512.png
ls -la public/icon-*.png
```

Expected: both files created, non-zero size. If `sips` cannot read SVG, fall back to ImageMagick (`convert -density 384 public/favicon.svg -resize 192x192 public/icon-192.png`) or produce them in Figma and drop them in.

- [ ] **Step 2: Write `public/manifest.webmanifest`**

```json
{
  "name": "Daily Family Digest",
  "short_name": "DFD",
  "description": "Your daily digest: Bulgaria, World, Sports.",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#111111",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 3: Update `index.html`**

Replace the current `<head>` contents with:

```html
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<title>Daily Family Digest</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="manifest" href="/manifest.webmanifest" />
<meta name="theme-color" content="#111111" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="apple-mobile-web-app-title" content="DFD" />
<link rel="apple-touch-icon" href="/icon-192.png" />
```

- [ ] **Step 4: Verify the manifest parses and is served**

Run:

```bash
npm run build
```

Expected: build succeeds with no warnings about manifest/icons. Then inspect `dist/manifest.webmanifest` exists and `dist/icon-192.png` / `dist/icon-512.png` are present.

- [ ] **Step 5: Commit**

```bash
git add public/manifest.webmanifest public/icon-192.png public/icon-512.png index.html
git commit -m "feat(pwa): add manifest, icons, and iOS meta tags"
```

---

## Task 2: Prefs — FCM token helpers

**Files:**
- Modify: `src/services/prefs.js`
- Test: `src/services/prefs.test.js`

- [ ] **Step 1: Write failing tests**

Append to `src/services/prefs.test.js`:

```js
describe('addFcmToken / removeFcmToken', () => {
  it('addFcmToken calls updateDoc with arrayUnion', async () => {
    const { addFcmToken } = await import('./prefs.js');
    await addFcmToken('user-1', 'tok-abc');
    expect(mockUpdateDoc).toHaveBeenCalledOnce();
    const patch = mockUpdateDoc.mock.calls[0][1];
    expect(patch.fcmTokens).toBeDefined();
    expect(mockArrayUnion).toHaveBeenCalledWith('tok-abc');
  });

  it('removeFcmToken calls updateDoc with arrayRemove', async () => {
    const { removeFcmToken } = await import('./prefs.js');
    await removeFcmToken('user-1', 'tok-abc');
    expect(mockUpdateDoc).toHaveBeenCalledOnce();
    expect(mockArrayRemove).toHaveBeenCalledWith('tok-abc');
  });
});
```

Also update the top of `prefs.test.js` to mock `arrayUnion` and `arrayRemove`. Add these alongside the other mocks:

```js
const mockArrayUnion = vi.fn((v) => ({ __arrayUnion: v }));
const mockArrayRemove = vi.fn((v) => ({ __arrayRemove: v }));
```

And extend the `vi.mock('firebase/firestore', ...)` factory to include:

```js
arrayUnion: (...args) => mockArrayUnion(...args),
arrayRemove: (...args) => mockArrayRemove(...args),
```

If `prefs.test.js` does not already export `mockUpdateDoc`, reuse whatever existing `updateDoc` mock is defined there (use Grep to confirm) and assert via that name.

- [ ] **Step 2: Run the tests — expect FAIL**

```bash
cd "/Users/vladislavgeorgiev/Daily Family Digest"
npm run test:run -- src/services/prefs.test.js
```

Expected: the new `addFcmToken`/`removeFcmToken` tests fail with `ReferenceError` or "is not a function".

- [ ] **Step 3: Implement helpers**

Edit `src/services/prefs.js`. Extend the firestore import:

```js
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
```

Then append to the file (after `subscribePrefs`):

```js
export async function addFcmToken(uid, token) {
  await updateDoc(prefsRef(uid), {
    fcmTokens: arrayUnion(token),
    updatedAt: serverTimestamp(),
  });
}

export async function removeFcmToken(uid, token) {
  await updateDoc(prefsRef(uid), {
    fcmTokens: arrayRemove(token),
    updatedAt: serverTimestamp(),
  });
}
```

- [ ] **Step 4: Run the tests — expect PASS**

```bash
npm run test:run -- src/services/prefs.test.js
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/services/prefs.js src/services/prefs.test.js
git commit -m "feat(prefs): add addFcmToken/removeFcmToken helpers"
```

---

## Task 3: Client messaging service

**Files:**
- Create: `src/services/messaging.js`
- Test: `src/services/messaging.test.js`

Background: Firebase `getMessaging()` requires the browser to support service workers and the Notifications API. We wrap `getToken` and `onMessage` so callers don't touch `firebase/messaging` directly. The service worker file at `public/firebase-messaging-sw.js` is registered by `getToken` automatically when we pass the `serviceWorkerRegistration` option; we register it manually to control scope.

- [ ] **Step 1: Write failing tests**

Create `src/services/messaging.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetToken = vi.fn();
const mockOnMessage = vi.fn();
const mockIsSupported = vi.fn();
const mockGetMessaging = vi.fn(() => ({ __messaging: true }));

vi.mock('firebase/messaging', () => ({
  getMessaging: (...args) => mockGetMessaging(...args),
  getToken: (...args) => mockGetToken(...args),
  onMessage: (...args) => mockOnMessage(...args),
  isSupported: (...args) => mockIsSupported(...args),
}));

vi.mock('./firebase.js', () => ({
  app: { __app: true },
  db: {},
}));

const mockAddFcmToken = vi.fn();
vi.mock('./prefs.js', () => ({
  addFcmToken: (...args) => mockAddFcmToken(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.navigator = {
    ...globalThis.navigator,
    serviceWorker: {
      register: vi.fn().mockResolvedValue({ __swReg: true }),
    },
  };
  globalThis.Notification = { permission: 'granted' };
  import.meta.env.VITE_FCM_VAPID_KEY = 'test-vapid';
});

describe('subscribeToken', () => {
  it('returns null when messaging is unsupported', async () => {
    mockIsSupported.mockResolvedValue(false);
    const { subscribeToken } = await import('./messaging.js');
    const result = await subscribeToken('user-1');
    expect(result).toBeNull();
    expect(mockGetToken).not.toHaveBeenCalled();
  });

  it('returns null when permission not granted', async () => {
    mockIsSupported.mockResolvedValue(true);
    globalThis.Notification.permission = 'default';
    const { subscribeToken } = await import('./messaging.js');
    const result = await subscribeToken('user-1');
    expect(result).toBeNull();
    expect(mockGetToken).not.toHaveBeenCalled();
  });

  it('registers SW, fetches token, saves to prefs', async () => {
    mockIsSupported.mockResolvedValue(true);
    mockGetToken.mockResolvedValue('tok-xyz');
    const { subscribeToken } = await import('./messaging.js');
    const result = await subscribeToken('user-1');
    expect(globalThis.navigator.serviceWorker.register).toHaveBeenCalledWith(
      '/firebase-messaging-sw.js',
      { scope: '/firebase-cloud-messaging-push-scope' },
    );
    expect(mockGetToken).toHaveBeenCalledOnce();
    const opts = mockGetToken.mock.calls[0][1];
    expect(opts.vapidKey).toBe('test-vapid');
    expect(opts.serviceWorkerRegistration).toEqual({ __swReg: true });
    expect(mockAddFcmToken).toHaveBeenCalledWith('user-1', 'tok-xyz');
    expect(result).toBe('tok-xyz');
  });

  it('returns null if getToken returns empty string', async () => {
    mockIsSupported.mockResolvedValue(true);
    mockGetToken.mockResolvedValue('');
    const { subscribeToken } = await import('./messaging.js');
    const result = await subscribeToken('user-1');
    expect(result).toBeNull();
    expect(mockAddFcmToken).not.toHaveBeenCalled();
  });
});

describe('onForegroundMessage', () => {
  it('wires onMessage and returns unsubscribe', async () => {
    mockIsSupported.mockResolvedValue(true);
    const unsub = vi.fn();
    mockOnMessage.mockReturnValue(unsub);
    const cb = vi.fn();
    const { onForegroundMessage } = await import('./messaging.js');
    const off = await onForegroundMessage(cb);
    expect(mockOnMessage).toHaveBeenCalledOnce();
    expect(typeof off).toBe('function');
    off();
    expect(unsub).toHaveBeenCalled();
  });

  it('returns noop if messaging unsupported', async () => {
    mockIsSupported.mockResolvedValue(false);
    const { onForegroundMessage } = await import('./messaging.js');
    const off = await onForegroundMessage(() => {});
    expect(mockOnMessage).not.toHaveBeenCalled();
    off();
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm run test:run -- src/services/messaging.test.js
```

Expected: fail ("Cannot find module './messaging.js'").

- [ ] **Step 3: Export `app` from `firebase.js`**

Edit `src/services/firebase.js` so `app` is exported (the test mock depends on it, and `getMessaging(app)` needs it):

```js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
```

- [ ] **Step 4: Write `src/services/messaging.js`**

```js
import {
  getMessaging,
  getToken,
  onMessage,
  isSupported,
} from 'firebase/messaging';
import { app } from './firebase.js';
import { addFcmToken } from './prefs.js';

const SW_URL = '/firebase-messaging-sw.js';
const SW_SCOPE = '/firebase-cloud-messaging-push-scope';

async function ensureReady() {
  if (!(await isSupported())) return null;
  if (typeof Notification === 'undefined') return null;
  return getMessaging(app);
}

export async function subscribeToken(uid) {
  const messaging = await ensureReady();
  if (!messaging) return null;
  if (Notification.permission !== 'granted') return null;

  const reg = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
  const token = await getToken(messaging, {
    vapidKey: import.meta.env.VITE_FCM_VAPID_KEY,
    serviceWorkerRegistration: reg,
  });
  if (!token) return null;
  await addFcmToken(uid, token);
  return token;
}

export async function onForegroundMessage(callback) {
  const messaging = await ensureReady();
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
npm run test:run -- src/services/messaging.test.js src/services/firebase.test.js
```

Expected: all pass. If `firebase.test.js` expected `app` not to be exported, update it — exporting `app` is harmless.

- [ ] **Step 6: Commit**

```bash
git add src/services/messaging.js src/services/messaging.test.js src/services/firebase.js
git commit -m "feat(messaging): add FCM subscribeToken/onForegroundMessage"
```

---

## Task 4: Background service worker

**Files:**
- Create: `public/firebase-messaging-sw.js`

Background: the background SW must be at origin root (`/firebase-messaging-sw.js`) per Firebase; it uses the compat SDK loaded from the Firebase CDN because Vite cannot bundle a service worker written against the modular SDK without extra config. Because `import.meta.env` is not available inside a service worker, we pass the Firebase config as query-string params on the SW URL at registration time (values are already public — they ship in the main bundle).

- [ ] **Step 1: Write the service worker**

Create `public/firebase-messaging-sw.js`:

```js
/* global importScripts, firebase, clients */

importScripts('https://www.gstatic.com/firebasejs/12.12.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.12.1/firebase-messaging-compat.js');

const params = new URL(self.location).searchParams;
firebase.initializeApp({
  apiKey: params.get('apiKey'),
  authDomain: params.get('authDomain'),
  projectId: params.get('projectId'),
  storageBucket: params.get('storageBucket'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || payload?.data?.title || 'Daily Family Digest';
  const options = {
    body: payload?.notification?.body || payload?.data?.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: payload?.data?.url || '/' },
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ('focus' in w) return w.focus().then(() => w.navigate(url));
      }
      if (clients.openWindow) return clients.openWindow(url);
      return null;
    }),
  );
});
```

- [ ] **Step 2: Update `messaging.js` to pass the config through the SW URL**

In `src/services/messaging.js`, add a `buildSwUrl()` helper and use it when registering the SW. The full file should now read:

```js
import {
  getMessaging,
  getToken,
  onMessage,
  isSupported,
} from 'firebase/messaging';
import { app } from './firebase.js';
import { addFcmToken } from './prefs.js';

const SW_URL = '/firebase-messaging-sw.js';
const SW_SCOPE = '/firebase-cloud-messaging-push-scope';

function buildSwUrl() {
  const url = new URL(SW_URL, window.location.origin);
  url.searchParams.set('apiKey', import.meta.env.VITE_FIREBASE_API_KEY || '');
  url.searchParams.set('authDomain', import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '');
  url.searchParams.set('projectId', import.meta.env.VITE_FIREBASE_PROJECT_ID || '');
  url.searchParams.set('storageBucket', import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '');
  url.searchParams.set('messagingSenderId', import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '');
  url.searchParams.set('appId', import.meta.env.VITE_FIREBASE_APP_ID || '');
  return url.toString();
}

async function ensureReady() {
  if (!(await isSupported())) return null;
  if (typeof Notification === 'undefined') return null;
  return getMessaging(app);
}

export async function subscribeToken(uid) {
  const messaging = await ensureReady();
  if (!messaging) return null;
  if (Notification.permission !== 'granted') return null;

  const reg = await navigator.serviceWorker.register(buildSwUrl(), { scope: SW_SCOPE });
  const token = await getToken(messaging, {
    vapidKey: import.meta.env.VITE_FCM_VAPID_KEY,
    serviceWorkerRegistration: reg,
  });
  if (!token) return null;
  await addFcmToken(uid, token);
  return token;
}

export async function onForegroundMessage(callback) {
  const messaging = await ensureReady();
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
}
```

- [ ] **Step 3: Update the "registers SW" test in `messaging.test.js`**

Replace the exact `register` assertion in the "registers SW, fetches token, saves to prefs" test with a regex match so we don't couple to the param order:

```js
expect(globalThis.navigator.serviceWorker.register).toHaveBeenCalledOnce();
const swArg = globalThis.navigator.serviceWorker.register.mock.calls[0][0];
expect(swArg).toMatch(/\/firebase-messaging-sw\.js\?/);
const scopeArg = globalThis.navigator.serviceWorker.register.mock.calls[0][1];
expect(scopeArg).toEqual({ scope: '/firebase-cloud-messaging-push-scope' });
```

Also, because `buildSwUrl()` uses `window.location.origin`, stub it in the test's `beforeEach`:

```js
globalThis.window = globalThis.window || {};
globalThis.window.location = { origin: 'http://localhost' };
```

- [ ] **Step 4: Re-run messaging tests**

```bash
npm run test:run -- src/services/messaging.test.js
```

Expected: all pass.

- [ ] **Step 5: Verify the SW ships to `dist/`**

```bash
npm run build
ls dist/firebase-messaging-sw.js
```

Expected: file present, copied from `public/` by Vite.

- [ ] **Step 6: Commit**

```bash
git add public/firebase-messaging-sw.js src/services/messaging.js src/services/messaging.test.js
git commit -m "feat(messaging): add background service worker and config injection"
```

---

## Task 5: `useMessaging` hook

**Files:**
- Create: `src/hooks/useMessaging.js`
- Test: `src/hooks/useMessaging.test.jsx`

- [ ] **Step 1: Write failing tests**

Create `src/hooks/useMessaging.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockOnForegroundMessage = vi.fn();
vi.mock('../services/messaging.js', () => ({
  onForegroundMessage: (...args) => mockOnForegroundMessage(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useMessaging', () => {
  it('subscribes on mount and returns latest payload', async () => {
    let capturedCb;
    const unsub = vi.fn();
    mockOnForegroundMessage.mockImplementation(async (cb) => {
      capturedCb = cb;
      return unsub;
    });
    const { useMessaging } = await import('./useMessaging.js');
    const { result, unmount } = renderHook(() => useMessaging());
    expect(result.current.toast).toBeNull();

    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      capturedCb({
        notification: { title: 'BBC', body: 'Headline here' },
        data: { url: 'https://example.com/a' },
      });
    });

    expect(result.current.toast).toEqual({
      title: 'BBC',
      body: 'Headline here',
      url: 'https://example.com/a',
    });

    act(() => result.current.dismiss());
    expect(result.current.toast).toBeNull();

    unmount();
    expect(unsub).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm run test:run -- src/hooks/useMessaging.test.jsx
```

- [ ] **Step 3: Implement `useMessaging`**

Create `src/hooks/useMessaging.js`:

```js
import { useEffect, useState, useCallback } from 'react';
import { onForegroundMessage } from '../services/messaging.js';

export function useMessaging() {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let unsub = () => {};
    let cancelled = false;
    onForegroundMessage((payload) => {
      const t = {
        title: payload?.notification?.title || payload?.data?.title || 'Update',
        body: payload?.notification?.body || payload?.data?.body || '',
        url: payload?.data?.url || null,
      };
      setToast(t);
    }).then((fn) => {
      if (cancelled) fn();
      else unsub = fn;
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const dismiss = useCallback(() => setToast(null), []);
  return { toast, dismiss };
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npm run test:run -- src/hooks/useMessaging.test.jsx
```

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useMessaging.js src/hooks/useMessaging.test.jsx
git commit -m "feat(messaging): add useMessaging hook"
```

---

## Task 6: `PushToast` component + mount in `App.jsx`

**Files:**
- Create: `src/components/PushToast.jsx`
- Create: `src/components/PushToast.test.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/PushToast.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PushToast from './PushToast.jsx';

describe('PushToast', () => {
  it('renders nothing when toast is null', () => {
    const { container } = render(<PushToast toast={null} onDismiss={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows title, body, link and dismiss button', () => {
    render(
      <PushToast
        toast={{ title: 'BBC', body: 'Breaking headline', url: 'https://example.com' }}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByText('BBC')).toBeInTheDocument();
    expect(screen.getByText('Breaking headline')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /read/i });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('calls onDismiss when close is clicked', () => {
    const onDismiss = vi.fn();
    render(
      <PushToast
        toast={{ title: 'X', body: 'Y', url: null }}
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm run test:run -- src/components/PushToast.test.jsx
```

- [ ] **Step 3: Implement**

Create `src/components/PushToast.jsx`:

```jsx
export default function PushToast({ toast, onDismiss }) {
  if (!toast) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 72,
        background: '#111',
        color: '#fff',
        borderRadius: 8,
        padding: '12px 14px',
        boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <strong>{toast.title}</strong>
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{ background: 'transparent', color: '#fff', border: 0, cursor: 'pointer' }}
        >
          ×
        </button>
      </div>
      <div style={{ fontSize: 14 }}>{toast.body}</div>
      {toast.url && (
        <a
          href={toast.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#9ecbff', fontSize: 13 }}
        >
          Read →
        </a>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Mount in `App.jsx`**

Use Grep to find the existing `App.jsx` structure. Import `useMessaging` and `PushToast`, and render `<PushToast toast={toast} onDismiss={dismiss} />` at the top level of the authenticated app tree (alongside the tab content). Example insertion:

```jsx
import { useMessaging } from './hooks/useMessaging.js';
import PushToast from './components/PushToast.jsx';

// inside the authenticated return:
const { toast, dismiss } = useMessaging();
// ...
return (
  <>
    {/* existing tab content */}
    <PushToast toast={toast} onDismiss={dismiss} />
  </>
);
```

Only render `useMessaging`/`PushToast` when the user is signed in (the hook safely no-ops if unsupported, but we avoid running the effect pre-auth).

- [ ] **Step 5: Run all tests**

```bash
npm run test:run
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/PushToast.jsx src/components/PushToast.test.jsx src/App.jsx
git commit -m "feat(messaging): add PushToast and mount in App"
```

---

## Task 7: Wire onboarding NotificationsStep to subscribe token

**Files:**
- Modify: `src/features/onboarding/NotificationsStep.jsx`
- Modify: `src/features/onboarding/OnboardingWizard.test.jsx` (if present; extend coverage)

Keep the UI identical; change `requestPermission` to also call `subscribeToken(uid)` on `granted`. The wizard already knows the uid via its parent — if `NotificationsStep` doesn't currently receive a `uid` prop, thread it through.

- [ ] **Step 1: Accept `uid` prop and call `subscribeToken` on permission grant**

Replace the contents of `src/features/onboarding/NotificationsStep.jsx`:

```jsx
import { useState } from 'react';
import { subscribeToken } from '../../services/messaging.js';

export default function NotificationsStep({
  uid,
  notifications,
  onChange,
  onBack,
  onFinish,
}) {
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied',
  );
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState(null);

  async function requestPermission() {
    setError(null);
    if (typeof Notification === 'undefined') {
      setPermission('denied');
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted' && uid) {
      setSubscribing(true);
      try {
        await subscribeToken(uid);
      } catch (err) {
        setError(err.message || 'Could not subscribe to notifications');
      } finally {
        setSubscribing(false);
      }
    }
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
          <button onClick={requestPermission} disabled={subscribing}>
            {subscribing ? 'Subscribing…' : 'Enable notifications'}
          </button>
        )}
        {error && <div style={{ color: '#b00', fontSize: 13 }}>{error}</div>}
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
```

- [ ] **Step 2: Pass `uid` from `OnboardingWizard`**

Grep `OnboardingWizard.jsx` for `<NotificationsStep` and add `uid={uid}`. If `OnboardingWizard` doesn't already receive `uid`, take it from `useAuth()` or whatever prop its parent passes (check `App.jsx`).

- [ ] **Step 3: Run existing onboarding tests**

```bash
npm run test:run -- src/features/onboarding
```

Expected: passes. Fix any tests that construct `NotificationsStep` without `uid` — add a dummy `uid="test"` to the props.

- [ ] **Step 4: Commit**

```bash
git add src/features/onboarding/NotificationsStep.jsx src/features/onboarding/OnboardingWizard.jsx src/features/onboarding/OnboardingWizard.test.jsx
git commit -m "feat(onboarding): subscribe FCM token on permission grant"
```

---

## Task 8: Wire settings NotificationsSection button

**Files:**
- Modify: `src/features/settings/NotificationsSection.jsx`

- [ ] **Step 1: Add "Enable notifications" action and re-subscribe button**

Replace `src/features/settings/NotificationsSection.jsx`:

```jsx
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
      <div style={{ fontSize: 13, color: '#666' }}>
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
      {error && <div style={{ color: '#b00', fontSize: 13 }}>{error}</div>}
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
```

- [ ] **Step 2: Run tests**

```bash
npm run test:run
```

- [ ] **Step 3: Commit**

```bash
git add src/features/settings/NotificationsSection.jsx
git commit -m "feat(settings): add Enable notifications button"
```

---

## Task 9: Install-to-home-screen hint

**Files:**
- Create: `src/utils/standalone.js`
- Create: `src/utils/standalone.test.js`
- Create: `src/features/settings/InstallHint.jsx`
- Create: `src/features/settings/InstallHint.test.jsx`
- Modify: `src/features/settings/SettingsTab.jsx`

- [ ] **Step 1: Write failing tests for `standalone.js`**

Create `src/utils/standalone.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';

describe('isStandalone / isIos', () => {
  beforeEach(() => {
    globalThis.window = globalThis.window || {};
  });

  it('isStandalone true when navigator.standalone is true', async () => {
    globalThis.navigator = { ...globalThis.navigator, standalone: true };
    globalThis.window.matchMedia = () => ({ matches: false });
    const { isStandalone } = await import('./standalone.js');
    expect(isStandalone()).toBe(true);
  });

  it('isStandalone true when display-mode is standalone', async () => {
    globalThis.navigator = { ...globalThis.navigator, standalone: false };
    globalThis.window.matchMedia = (q) => ({
      matches: q === '(display-mode: standalone)',
    });
    const { isStandalone } = await import('./standalone.js');
    expect(isStandalone()).toBe(true);
  });

  it('isStandalone false otherwise', async () => {
    globalThis.navigator = { ...globalThis.navigator, standalone: false };
    globalThis.window.matchMedia = () => ({ matches: false });
    const { isStandalone } = await import('./standalone.js');
    expect(isStandalone()).toBe(false);
  });

  it('isIos detects iPhone/iPad user-agent', async () => {
    globalThis.navigator = {
      ...globalThis.navigator,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    };
    const { isIos } = await import('./standalone.js');
    expect(isIos()).toBe(true);
  });

  it('isIos false on desktop Chrome', async () => {
    globalThis.navigator = {
      ...globalThis.navigator,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/120',
    };
    const { isIos } = await import('./standalone.js');
    expect(isIos()).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm run test:run -- src/utils/standalone.test.js
```

- [ ] **Step 3: Implement**

Create `src/utils/standalone.js`:

```js
export function isStandalone() {
  if (typeof navigator !== 'undefined' && navigator.standalone === true) return true;
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(display-mode: standalone)').matches;
  }
  return false;
}

export function isIos() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod/i.test(ua);
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npm run test:run -- src/utils/standalone.test.js
```

- [ ] **Step 5: Write InstallHint tests**

Create `src/features/settings/InstallHint.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../utils/standalone.js', () => ({
  isStandalone: vi.fn(),
  isIos: vi.fn(),
}));

import { isStandalone, isIos } from '../../utils/standalone.js';
import InstallHint from './InstallHint.jsx';

describe('InstallHint', () => {
  it('renders nothing when app is already standalone', () => {
    isStandalone.mockReturnValue(true);
    isIos.mockReturnValue(true);
    const { container } = render(<InstallHint />);
    expect(container.firstChild).toBeNull();
  });

  it('renders iOS-specific copy on iOS Safari tab', () => {
    isStandalone.mockReturnValue(false);
    isIos.mockReturnValue(true);
    render(<InstallHint />);
    expect(screen.getByText(/home screen/i)).toBeInTheDocument();
    expect(screen.getByText(/share/i)).toBeInTheDocument();
  });

  it('renders generic hint on non-iOS browsers', () => {
    isStandalone.mockReturnValue(false);
    isIos.mockReturnValue(false);
    render(<InstallHint />);
    expect(screen.getByText(/install/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run — expect FAIL**

```bash
npm run test:run -- src/features/settings/InstallHint.test.jsx
```

- [ ] **Step 7: Implement InstallHint**

Create `src/features/settings/InstallHint.jsx`:

```jsx
import { isStandalone, isIos } from '../../utils/standalone.js';

export default function InstallHint() {
  if (isStandalone()) return null;
  const ios = isIos();
  return (
    <div
      style={{
        border: '1px solid #e3e3e3',
        background: '#fafafa',
        padding: 12,
        borderRadius: 8,
        fontSize: 14,
        color: '#333',
      }}
    >
      {ios ? (
        <>
          <strong>Install to home screen</strong>
          <div style={{ marginTop: 4 }}>
            Tap <span aria-label="share icon">⎘</span> Share, then <em>Add to Home Screen</em>.
            Push notifications on iOS only work from the installed app.
          </div>
        </>
      ) : (
        <>
          <strong>Install Daily Family Digest</strong>
          <div style={{ marginTop: 4 }}>
            Use your browser's install option for the best experience.
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Run — expect PASS**

```bash
npm run test:run -- src/features/settings/InstallHint.test.jsx
```

- [ ] **Step 9: Mount in `SettingsTab`**

Open `src/features/settings/SettingsTab.jsx`, import `InstallHint`, and place `<InstallHint />` above `NotificationsSection` (or at the top of the settings list — reader's choice, but above notifications is most contextual).

```jsx
import InstallHint from './InstallHint.jsx';
// ...
<InstallHint />
<NotificationsSection />
```

- [ ] **Step 10: Commit**

```bash
git add src/utils/standalone.js src/utils/standalone.test.js src/features/settings/InstallHint.jsx src/features/settings/InstallHint.test.jsx src/features/settings/SettingsTab.jsx
git commit -m "feat(settings): add install-to-home-screen hint"
```

---

## Task 10: `pushMatch` pure function (server)

**Files:**
- Create: `functions/lib/pushMatch.js`
- Create: `functions/lib/pushMatch.test.js`

Background: This is the heart of the fan-out. `pushMatch({ article, user, now, cooldownMs })` returns `{ shouldPush: boolean, reason: string, tokens: string[] }`. All matching logic from spec Section 8 lives here and is tested in isolation.

- [ ] **Step 1: Write failing tests**

Create `functions/lib/pushMatch.test.js`:

```js
const { describe, it, expect } = require('vitest');
const { pushMatch } = require('./pushMatch');

const COOLDOWN = 30 * 60 * 1000;

function mkNow() {
  return new Date('2026-04-23T12:00:00Z');
}

function mkArticle(overrides = {}) {
  return {
    section: 'bulgaria',
    tags: ['outlet:dnevnik'],
    publishedAt: new Date('2026-04-23T11:30:00Z'),
    ...overrides,
  };
}

function mkUser(overrides = {}) {
  return {
    prefs: {
      bulgariaOutlets: ['dnevnik'],
      worldTopics: ['tech'],
      worldRegions: ['us', 'eu'],
      footballTeams: ['PL-ARS'],
      f1Follow: false,
      notifications: {
        bulgariaBreaking: true,
        worldBreaking: true,
        sportsBreaking: true,
      },
      fcmTokens: ['tok-1', 'tok-2'],
    },
    pushState: { lastPushAt: {} },
    ...overrides,
  };
}

describe('pushMatch', () => {
  it('skips when article older than 6h', () => {
    const result = pushMatch({
      article: mkArticle({ publishedAt: new Date('2026-04-23T05:00:00Z') }),
      user: mkUser(),
      now: mkNow(),
      cooldownMs: COOLDOWN,
    });
    expect(result.shouldPush).toBe(false);
    expect(result.reason).toBe('stale');
  });

  it('skips when section toggle off', () => {
    const user = mkUser();
    user.prefs.notifications.bulgariaBreaking = false;
    const result = pushMatch({
      article: mkArticle(),
      user,
      now: mkNow(),
      cooldownMs: COOLDOWN,
    });
    expect(result.shouldPush).toBe(false);
    expect(result.reason).toBe('toggle_off');
  });

  it('skips when rate-limited', () => {
    const user = mkUser();
    user.pushState.lastPushAt = { bulgaria: new Date('2026-04-23T11:45:00Z') };
    const result = pushMatch({
      article: mkArticle(),
      user,
      now: mkNow(),
      cooldownMs: COOLDOWN,
    });
    expect(result.shouldPush).toBe(false);
    expect(result.reason).toBe('rate_limited');
  });

  it('allows when last push was more than cooldown ago', () => {
    const user = mkUser();
    user.pushState.lastPushAt = { bulgaria: new Date('2026-04-23T11:00:00Z') };
    const result = pushMatch({
      article: mkArticle(),
      user,
      now: mkNow(),
      cooldownMs: COOLDOWN,
    });
    expect(result.shouldPush).toBe(true);
    expect(result.tokens).toEqual(['tok-1', 'tok-2']);
  });

  it('Bulgaria: matches outlet tag in user outlets', () => {
    const result = pushMatch({
      article: mkArticle({ tags: ['outlet:bnr'] }),
      user: mkUser({ prefs: { ...mkUser().prefs, bulgariaOutlets: ['bnr'] } }),
      now: mkNow(),
      cooldownMs: COOLDOWN,
    });
    expect(result.shouldPush).toBe(true);
  });

  it('Bulgaria: rejects when outlet not in user outlets', () => {
    const result = pushMatch({
      article: mkArticle({ tags: ['outlet:nova'] }),
      user: mkUser(),
      now: mkNow(),
      cooldownMs: COOLDOWN,
    });
    expect(result.shouldPush).toBe(false);
    expect(result.reason).toBe('no_match');
  });

  it('World: requires topic AND region match', () => {
    const article = {
      section: 'world',
      tags: ['topic:tech', 'region:us'],
      publishedAt: new Date('2026-04-23T11:30:00Z'),
    };
    const result = pushMatch({
      article,
      user: mkUser(),
      now: mkNow(),
      cooldownMs: COOLDOWN,
    });
    expect(result.shouldPush).toBe(true);
  });

  it('World: rejects when topic matches but region does not', () => {
    const article = {
      section: 'world',
      tags: ['topic:tech', 'region:asia'],
      publishedAt: new Date('2026-04-23T11:30:00Z'),
    };
    const result = pushMatch({
      article,
      user: mkUser(),
      now: mkNow(),
      cooldownMs: COOLDOWN,
    });
    expect(result.shouldPush).toBe(false);
  });

  it('Sports: matches team tag', () => {
    const article = {
      section: 'sports',
      tags: ['team:PL-ARS'],
      publishedAt: new Date('2026-04-23T11:30:00Z'),
    };
    const result = pushMatch({
      article,
      user: mkUser(),
      now: mkNow(),
      cooldownMs: COOLDOWN,
    });
    expect(result.shouldPush).toBe(true);
  });

  it('Sports: matches F1 when f1Follow=true', () => {
    const article = {
      section: 'sports',
      tags: ['sport:f1'],
      publishedAt: new Date('2026-04-23T11:30:00Z'),
    };
    const result = pushMatch({
      article,
      user: mkUser({
        prefs: { ...mkUser().prefs, f1Follow: true, footballTeams: [] },
      }),
      now: mkNow(),
      cooldownMs: COOLDOWN,
    });
    expect(result.shouldPush).toBe(true);
  });

  it('Sports: rejects F1 when f1Follow=false', () => {
    const article = {
      section: 'sports',
      tags: ['sport:f1'],
      publishedAt: new Date('2026-04-23T11:30:00Z'),
    };
    const result = pushMatch({
      article,
      user: mkUser({ prefs: { ...mkUser().prefs, footballTeams: [] } }),
      now: mkNow(),
      cooldownMs: COOLDOWN,
    });
    expect(result.shouldPush).toBe(false);
  });

  it('returns empty tokens when user has none', () => {
    const user = mkUser({ prefs: { ...mkUser().prefs, fcmTokens: [] } });
    const result = pushMatch({
      article: mkArticle(),
      user,
      now: mkNow(),
      cooldownMs: COOLDOWN,
    });
    expect(result.shouldPush).toBe(false);
    expect(result.reason).toBe('no_tokens');
    expect(result.tokens).toEqual([]);
  });

  it('accepts Firestore Timestamp-like objects with toDate()', () => {
    const result = pushMatch({
      article: mkArticle({
        publishedAt: { toDate: () => new Date('2026-04-23T11:30:00Z') },
      }),
      user: mkUser({
        pushState: {
          lastPushAt: { bulgaria: { toDate: () => new Date('2026-04-23T10:00:00Z') } },
        },
      }),
      now: mkNow(),
      cooldownMs: COOLDOWN,
    });
    expect(result.shouldPush).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd "/Users/vladislavgeorgiev/Daily Family Digest/functions"
npx vitest run lib/pushMatch.test.js
```

Expected: module not found.

- [ ] **Step 3: Implement**

Create `functions/lib/pushMatch.js`:

```js
const FRESHNESS_MS = 6 * 60 * 60 * 1000;

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  const d = new Date(value);
  const n = d.getTime();
  return Number.isFinite(n) ? n : 0;
}

function hasTagWithPrefix(tags, prefix, allowed) {
  const allowedSet = new Set(allowed);
  for (const tag of tags || []) {
    if (!tag.startsWith(prefix)) continue;
    const value = tag.slice(prefix.length);
    if (allowedSet.has(value)) return true;
  }
  return false;
}

function sectionToggle(notifications, section) {
  if (!notifications) return false;
  if (section === 'bulgaria') return !!notifications.bulgariaBreaking;
  if (section === 'world') return !!notifications.worldBreaking;
  if (section === 'sports') return !!notifications.sportsBreaking;
  return false;
}

function contentMatches(article, prefs) {
  const tags = article.tags || [];
  if (article.section === 'bulgaria') {
    return hasTagWithPrefix(tags, 'outlet:', prefs.bulgariaOutlets || []);
  }
  if (article.section === 'world') {
    const topicOk = hasTagWithPrefix(tags, 'topic:', prefs.worldTopics || []);
    const regionOk = hasTagWithPrefix(tags, 'region:', prefs.worldRegions || []);
    return topicOk && regionOk;
  }
  if (article.section === 'sports') {
    const teamOk = hasTagWithPrefix(tags, 'team:', prefs.footballTeams || []);
    const f1Ok = prefs.f1Follow === true && (tags || []).includes('sport:f1');
    return teamOk || f1Ok;
  }
  return false;
}

function pushMatch({ article, user, now, cooldownMs }) {
  const prefs = user?.prefs || {};
  const tokens = Array.isArray(prefs.fcmTokens) ? prefs.fcmTokens : [];

  const publishedMs = toMillis(article.publishedAt);
  if (!publishedMs || now.getTime() - publishedMs > FRESHNESS_MS) {
    return { shouldPush: false, reason: 'stale', tokens: [] };
  }

  if (!sectionToggle(prefs.notifications, article.section)) {
    return { shouldPush: false, reason: 'toggle_off', tokens: [] };
  }

  const lastPushAt = user?.pushState?.lastPushAt?.[article.section];
  const lastMs = toMillis(lastPushAt);
  if (lastMs && now.getTime() - lastMs < cooldownMs) {
    return { shouldPush: false, reason: 'rate_limited', tokens: [] };
  }

  if (!contentMatches(article, prefs)) {
    return { shouldPush: false, reason: 'no_match', tokens: [] };
  }

  if (tokens.length === 0) {
    return { shouldPush: false, reason: 'no_tokens', tokens: [] };
  }

  return { shouldPush: true, reason: 'match', tokens: [...tokens] };
}

module.exports = { pushMatch, FRESHNESS_MS };
```

- [ ] **Step 4: Run — expect PASS**

```bash
npx vitest run lib/pushMatch.test.js
```

- [ ] **Step 5: Commit**

```bash
cd "/Users/vladislavgeorgiev/Daily Family Digest"
git add functions/lib/pushMatch.js functions/lib/pushMatch.test.js
git commit -m "feat(functions): add pure pushMatch logic for fan-out"
```

---

## Task 11: `onNewsArticle` Firestore trigger

**Files:**
- Create: `functions/onNewsArticle.js`
- Create: `functions/onNewsArticle.test.js`
- Modify: `functions/index.js`

Background: Triggered on any `news/{id}` create. We query `collectionGroup('private')` filtered by `section`-specific notification flag to narrow the user set, then run `pushMatch` per candidate, send FCM via admin, write `pushState.lastPushAt[section]`, and prune tokens that come back dead.

- [ ] **Step 1: Write tests**

Create `functions/onNewsArticle.test.js`:

```js
const { describe, it, expect, vi, beforeEach } = require('vitest');

const mockCollectionGroup = vi.fn();
const mockDocRefs = new Map();
const mockSendEachForMulticast = vi.fn();

const mockFirestore = {
  collectionGroup: (...args) => mockCollectionGroup(...args),
  doc: vi.fn((path) => {
    if (!mockDocRefs.has(path)) {
      mockDocRefs.set(path, {
        set: vi.fn(),
        update: vi.fn(),
        path,
      });
    }
    return mockDocRefs.get(path);
  }),
  FieldValue: {
    serverTimestamp: () => ({ __server: true }),
    arrayRemove: (v) => ({ __arrayRemove: v }),
  },
};

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => mockFirestore,
  FieldValue: mockFirestore.FieldValue,
}));

vi.mock('firebase-admin/messaging', () => ({
  getMessaging: () => ({
    sendEachForMulticast: (...args) => mockSendEachForMulticast(...args),
  }),
}));

const { handleNewsArticle } = require('./onNewsArticle');

function mkQuerySnap(users) {
  return {
    empty: users.length === 0,
    forEach: (cb) => users.forEach(cb),
    docs: users.map((u) => ({
      ref: { parent: { parent: { id: u.uid } } },
      data: () => u.data,
    })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDocRefs.clear();
});

describe('handleNewsArticle', () => {
  it('no-ops when article is stale', async () => {
    const article = {
      section: 'bulgaria',
      tags: ['outlet:dnevnik'],
      publishedAt: { toDate: () => new Date('2026-04-23T00:00:00Z') },
    };
    await handleNewsArticle({
      data: article,
      now: new Date('2026-04-23T12:00:00Z'),
    });
    expect(mockCollectionGroup).not.toHaveBeenCalled();
  });

  it('sends FCM to matching user and writes pushState', async () => {
    mockCollectionGroup.mockReturnValue({
      where: () => ({
        get: async () =>
          mkQuerySnap([
            {
              uid: 'user-1',
              data: {
                bulgariaOutlets: ['dnevnik'],
                notifications: { bulgariaBreaking: true },
                fcmTokens: ['tok-a', 'tok-b'],
              },
            },
          ]),
      }),
    });
    mockSendEachForMulticast.mockResolvedValue({
      successCount: 2,
      failureCount: 0,
      responses: [{ success: true }, { success: true }],
    });

    await handleNewsArticle({
      data: {
        section: 'bulgaria',
        tags: ['outlet:dnevnik'],
        publishedAt: { toDate: () => new Date('2026-04-23T11:30:00Z') },
        headline: 'H',
        source: 'Dnevnik',
        url: 'https://example.com/a',
      },
      now: new Date('2026-04-23T12:00:00Z'),
    });

    expect(mockSendEachForMulticast).toHaveBeenCalledOnce();
    const payload = mockSendEachForMulticast.mock.calls[0][0];
    expect(payload.tokens).toEqual(['tok-a', 'tok-b']);
    expect(payload.notification.title).toBe('Dnevnik');
    expect(payload.notification.body).toBe('H');
    expect(payload.data.url).toBe('https://example.com/a');
    const stateRef = mockFirestore.doc.mock.results
      .map((r) => r.value)
      .find((r) => r.path === 'users/user-1/private/pushState');
    expect(stateRef.set).toHaveBeenCalledOnce();
  });

  it('prunes dead tokens', async () => {
    mockCollectionGroup.mockReturnValue({
      where: () => ({
        get: async () =>
          mkQuerySnap([
            {
              uid: 'user-1',
              data: {
                bulgariaOutlets: ['dnevnik'],
                notifications: { bulgariaBreaking: true },
                fcmTokens: ['tok-a', 'tok-dead'],
              },
            },
          ]),
      }),
    });
    mockSendEachForMulticast.mockResolvedValue({
      successCount: 1,
      failureCount: 1,
      responses: [
        { success: true },
        {
          success: false,
          error: { code: 'messaging/registration-token-not-registered' },
        },
      ],
    });

    await handleNewsArticle({
      data: {
        section: 'bulgaria',
        tags: ['outlet:dnevnik'],
        publishedAt: { toDate: () => new Date('2026-04-23T11:30:00Z') },
        headline: 'H',
        source: 'Dnevnik',
        url: 'https://example.com/a',
      },
      now: new Date('2026-04-23T12:00:00Z'),
    });

    const prefsRef = mockFirestore.doc.mock.results
      .map((r) => r.value)
      .find((r) => r.path === 'users/user-1/private/preferences');
    expect(prefsRef.update).toHaveBeenCalledOnce();
    const patch = prefsRef.update.mock.calls[0][0];
    expect(patch.fcmTokens).toEqual({ __arrayRemove: 'tok-dead' });
  });

  it('skips users whose notifications flag is off (none returned)', async () => {
    mockCollectionGroup.mockReturnValue({
      where: () => ({ get: async () => mkQuerySnap([]) }),
    });
    await handleNewsArticle({
      data: {
        section: 'bulgaria',
        tags: ['outlet:dnevnik'],
        publishedAt: { toDate: () => new Date('2026-04-23T11:30:00Z') },
      },
      now: new Date('2026-04-23T12:00:00Z'),
    });
    expect(mockSendEachForMulticast).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd "/Users/vladislavgeorgiev/Daily Family Digest/functions"
npx vitest run onNewsArticle.test.js
```

Expected: module not found.

- [ ] **Step 3: Implement `onNewsArticle.js`**

Create `functions/onNewsArticle.js`:

```js
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions/v2');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { pushMatch } = require('./lib/pushMatch');

const COOLDOWN_MS = 30 * 60 * 1000;

const SECTION_FLAG = {
  bulgaria: 'notifications.bulgariaBreaking',
  world: 'notifications.worldBreaking',
  sports: 'notifications.sportsBreaking',
};

const DEAD_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

async function loadPushState(db, uid) {
  const ref = db.doc(`users/${uid}/private/pushState`);
  const snap = await ref.get?.();
  return snap?.exists ? snap.data() : {};
}

async function handleNewsArticle({ data, now }) {
  const article = data;
  if (!article || !article.section) return;
  const section = article.section;
  const flag = SECTION_FLAG[section];
  if (!flag) return;

  const publishedAt = article.publishedAt;
  const publishedMs =
    publishedAt && typeof publishedAt.toDate === 'function'
      ? publishedAt.toDate().getTime()
      : new Date(publishedAt || 0).getTime();
  if (!publishedMs || now.getTime() - publishedMs > 6 * 60 * 60 * 1000) {
    logger.info('onNewsArticle: stale, skipping', { section });
    return;
  }

  const db = getFirestore();
  const snap = await db
    .collectionGroup('private')
    .where(flag, '==', true)
    .get();

  if (snap.empty) return;

  const sends = [];
  snap.forEach((userDoc) => {
    const uid = userDoc.ref.parent.parent.id;
    sends.push(processUser(db, uid, userDoc.data(), article, now));
  });

  await Promise.all(sends);
}

async function processUser(db, uid, prefsData, article, now) {
  const pushState = await loadPushState(db, uid);
  const match = pushMatch({
    article,
    user: { prefs: prefsData, pushState },
    now,
    cooldownMs: COOLDOWN_MS,
  });
  if (!match.shouldPush) return;

  const messaging = getMessaging();
  const payload = {
    tokens: match.tokens,
    notification: {
      title: article.source || 'Daily Family Digest',
      body: article.headline || '',
    },
    data: {
      url: article.url || '/',
      title: article.source || 'Daily Family Digest',
      body: article.headline || '',
    },
  };

  let response;
  try {
    response = await messaging.sendEachForMulticast(payload);
  } catch (err) {
    logger.error('sendEachForMulticast failed', { uid, err: err.message });
    return;
  }

  const deadTokens = [];
  response.responses.forEach((r, i) => {
    if (r.success) return;
    const code = r.error?.code;
    if (code && DEAD_CODES.has(code)) {
      deadTokens.push(match.tokens[i]);
    } else {
      logger.warn('FCM send failed (non-dead)', { uid, code });
    }
  });

  const prefsRef = db.doc(`users/${uid}/private/preferences`);
  for (const tok of deadTokens) {
    await prefsRef.update({ fcmTokens: FieldValue.arrayRemove(tok) });
  }

  if (response.successCount > 0) {
    const stateRef = db.doc(`users/${uid}/private/pushState`);
    await stateRef.set(
      {
        lastPushAt: { [article.section]: FieldValue.serverTimestamp() },
      },
      { merge: true },
    );
  }
}

const onNewsArticle = onDocumentCreated('news/{id}', async (event) => {
  const data = event.data?.data();
  if (!data) return;
  await handleNewsArticle({ data, now: new Date() });
});

module.exports = { onNewsArticle, handleNewsArticle };
```

- [ ] **Step 4: Run — expect PASS**

```bash
npx vitest run onNewsArticle.test.js lib/pushMatch.test.js
```

Expected: all pass.

- [ ] **Step 5: Register the function in `functions/index.js`**

```js
const { initializeApp } = require('firebase-admin/app');

initializeApp();

const { ingestBulgariaNews } = require('./ingestBulgaria');
const { ingestWorldNews } = require('./ingestWorld');
const { ingestSportsNews } = require('./ingestSports');
const { cleanupOldNews } = require('./cleanup');
const { ingestNewsHttp } = require('./ingestHttp');
const { onNewsArticle } = require('./onNewsArticle');

module.exports = {
  ingestBulgariaNews,
  ingestWorldNews,
  ingestSportsNews,
  cleanupOldNews,
  ingestNewsHttp,
  onNewsArticle,
};
```

- [ ] **Step 6: Commit**

```bash
cd "/Users/vladislavgeorgiev/Daily Family Digest"
git add functions/onNewsArticle.js functions/onNewsArticle.test.js functions/index.js
git commit -m "feat(functions): add onNewsArticle fan-out with dead-token pruning"
```

---

## Task 12: Firestore index updates + deploy smoke test

**Files:**
- Modify: `firestore.indexes.json` (if the `collectionGroup` query needs a composite)
- Deploy: functions + indexes

Background: `collectionGroup('private').where('notifications.bulgariaBreaking','==',true)` is a single-field query on a nested field; Firestore auto-indexes these for collection group queries **only if you enable it in the console or declare it**. Declaring it keeps behaviour portable.

- [ ] **Step 1: Check current `firestore.indexes.json`**

```bash
cd "/Users/vladislavgeorgiev/Daily Family Digest"
cat firestore.indexes.json
```

If `fieldOverrides` is absent, add the collection group single-field index overrides:

- [ ] **Step 2: Add field overrides**

Edit `firestore.indexes.json` so it contains (merge with existing `indexes` array):

```json
{
  "indexes": [],
  "fieldOverrides": [
    {
      "collectionGroup": "private",
      "fieldPath": "notifications.bulgariaBreaking",
      "indexes": [
        { "order": "ASCENDING", "queryScope": "COLLECTION_GROUP" }
      ]
    },
    {
      "collectionGroup": "private",
      "fieldPath": "notifications.worldBreaking",
      "indexes": [
        { "order": "ASCENDING", "queryScope": "COLLECTION_GROUP" }
      ]
    },
    {
      "collectionGroup": "private",
      "fieldPath": "notifications.sportsBreaking",
      "indexes": [
        { "order": "ASCENDING", "queryScope": "COLLECTION_GROUP" }
      ]
    }
  ]
}
```

If `indexes` already has entries, keep them. Only add `fieldOverrides`.

- [ ] **Step 3: Deploy indexes + new function**

**Confirm with the user before this step** — deployment is a shared-system action:

```bash
firebase deploy --only firestore:indexes,functions:onNewsArticle
```

Expected output: "Deploy complete!" with the function URL listed. Wait for index build to complete (visible in the Firebase Console → Firestore → Indexes tab).

- [ ] **Step 4: Trigger manual ingest to smoke-test**

```bash
curl -fsSL "https://us-central1-daily-family-digest.cloudfunctions.net/ingestNewsHttp?key=$INGEST_KEY"
```

Check Cloud Logging for `onNewsArticle` entries. Expected log lines: "stale, skipping" for backfill items, real sends for fresh items. If you're signed in on device with push enabled, a notification should arrive.

- [ ] **Step 5: Commit the index file**

```bash
git add firestore.indexes.json
git commit -m "feat(firestore): index notification flags for collectionGroup queries"
```

---

## Task 13: GitHub Actions CI/CD

**Files:**
- Create: `.github/workflows/deploy.yml`

Background: Requires a `FIREBASE_SERVICE_ACCOUNT_DAILY_FAMILY_DIGEST` secret in the GitHub repo (JSON of a service account with Firebase Admin + Cloud Functions Developer). Optional: `VITE_FIREBASE_*` + `VITE_FCM_VAPID_KEY` secrets for the client build.

- [ ] **Step 1: Write the workflow**

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  test-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install client deps
        run: npm ci

      - name: Install functions deps
        run: npm ci --prefix functions

      - name: Client tests
        run: npm run test:run

      - name: Functions tests
        run: npm run test:run --prefix functions

      - name: Build client
        env:
          VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
          VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
          VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
          VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.VITE_FIREBASE_STORAGE_BUCKET }}
          VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
          VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}
          VITE_FCM_VAPID_KEY: ${{ secrets.VITE_FCM_VAPID_KEY }}
        run: npm run build

      - name: Deploy
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT_DAILY_FAMILY_DIGEST }}
          projectId: daily-family-digest
          channelId: live

      - name: Deploy functions + rules + indexes
        env:
          GOOGLE_APPLICATION_CREDENTIALS_JSON: ${{ secrets.FIREBASE_SERVICE_ACCOUNT_DAILY_FAMILY_DIGEST }}
        run: |
          echo "$GOOGLE_APPLICATION_CREDENTIALS_JSON" > /tmp/sa.json
          export GOOGLE_APPLICATION_CREDENTIALS=/tmp/sa.json
          npx firebase-tools deploy \
            --only functions,firestore:rules,firestore:indexes \
            --project daily-family-digest \
            --non-interactive
```

- [ ] **Step 2: Validate YAML locally**

```bash
cd "/Users/vladislavgeorgiev/Daily Family Digest"
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/deploy.yml'))" && echo OK
```

Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add GitHub Actions deploy workflow"
```

**User action required before this takes effect:** Add the secrets to the repo: Settings → Secrets and variables → Actions → New repository secret for each of `FIREBASE_SERVICE_ACCOUNT_DAILY_FAMILY_DIGEST`, `VITE_FIREBASE_*`, `VITE_FCM_VAPID_KEY`. Document this in Plan 4 status when closing out.

---

## Task 14: End-to-end manual smoke test + CLAUDE.md update

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Run all tests**

```bash
cd "/Users/vladislavgeorgiev/Daily Family Digest"
npm run test:run && npm run test:run --prefix functions
```

Expected: all green.

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: no errors; `dist/manifest.webmanifest`, `dist/firebase-messaging-sw.js`, `dist/icon-192.png`, `dist/icon-512.png` all present.

- [ ] **Step 3: Manual smoke (requires user)**

Ask the user to:
1. Deploy hosting (`firebase deploy --only hosting`) and open the production URL on a phone.
2. Install to home screen (iOS: Share → Add to Home Screen).
3. Launch from the home-screen icon, sign in, walk through onboarding, tap "Enable notifications" and grant.
4. Trigger `ingestNewsHttp` (or wait for the next scheduled run).
5. Confirm a push arrives for a matching section within the cooldown window.

- [ ] **Step 4: Update `CLAUDE.md`**

In the "What's done" section, mark Plan 4 items complete. In "Roadmap" / status, replace the Plan 4 block with `✅ Plan 4 — Push + PWA` and list completed commits.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: mark Plan 4 complete"
```

---
