/* global importScripts, firebase */

// === Minimal IndexedDB helper to stash the pending article across a cold boot ===
// iOS WebKit Bug 263687 rewrites openWindow(url) to start_url on cold launch,
// losing the ?article= query param. Stashing the article ID in IDB here and
// having the client consume it on mount is the only reliable recovery path.
const PENDING_DB = 'dfd-push';
const PENDING_STORE = 'pending';
const PENDING_KEY = 'article';

function openPendingDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PENDING_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(PENDING_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function stashPendingArticle(articleId) {
  if (!articleId) return;
  try {
    const db = await openPendingDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(PENDING_STORE, 'readwrite');
      tx.objectStore(PENDING_STORE).put({ articleId, ts: Date.now() }, PENDING_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {}
}

function extractArticleId(route) {
  try {
    const url = new URL(route, self.location.origin);
    return url.searchParams.get('article') || null;
  } catch {
    return null;
  }
}

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
  const articleId = extractArticleId(targetRoute);

  event.waitUntil((async () => {
    // Stash first — this is the reliable path that survives WebKit's URL rewrite.
    await stashPendingArticle(articleId);

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

// Keep the FCM messaging instance alive so the SDK's internal handlers run,
// but DO NOT register onBackgroundMessage — FCM's native display path already
// shows the notification from the payload's top-level `notification` block.
// Adding a custom onBackgroundMessage causes duplicate notifications on iOS.
firebase.messaging();

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
