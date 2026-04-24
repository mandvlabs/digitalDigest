/* global importScripts, firebase */

// === notificationclick handler — MUST be registered BEFORE importScripts ===
// FCM's SDK registers its own handler that calls event.stopImmediatePropagation(),
// preventing any later-registered handlers from firing.
self.addEventListener('notificationclick', (event) => {
  event.preventDefault();
  event.notification.close();

  const data = event.notification?.data || {};
  const fcm = data.FCM_MSG || {};
  const targetRoute = data.targetRoute || fcm.data?.targetRoute || '/';
  const urlToOpen = new URL(targetRoute, self.location.origin).href;

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });

    for (const client of allClients) {
      if (new URL(client.url).origin === self.location.origin) {
        try {
          await client.focus();
          if ('navigate' in client) {
            try {
              await client.navigate(urlToOpen);
            } catch {}
          }
          client.postMessage({ type: 'NOTIFICATION_CLICK', targetRoute });
        } catch {}
        return;
      }
    }

    try {
      await self.clients.openWindow(urlToOpen);
    } catch {}
  })());
});

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

// Re-show background notifications with data.targetRoute attached so our
// notificationclick handler can read it.
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || {};
  const targetRoute = payload.data?.targetRoute || '/';
  self.registration.showNotification(title || 'Daily Digest', {
    body: body || '',
    icon: icon || '/icon-192.png',
    badge: '/icon-192.png',
    data: { targetRoute, ...payload.data },
  });
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
