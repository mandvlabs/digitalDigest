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
