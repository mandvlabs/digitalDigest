// Client-side consumer for the SW's IndexedDB article stash.
// The SW writes { articleId, ts } to `dfd-push.pending['article']` from its
// notificationclick handler. On cold iOS launch, WebKit rewrites the URL to
// start_url and our ?article= query param is lost; reading IDB on mount is
// the recovery path of last resort.

const DB_NAME = 'dfd-push';
const STORE = 'pending';
const KEY = 'article';
const MAX_AGE_MS = 60 * 1000;

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function consumePendingArticle() {
  let db;
  try {
    db = await openDb();
  } catch {
    return null;
  }
  try {
    const entry = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const getReq = store.get(KEY);
      getReq.onsuccess = () => {
        const val = getReq.result;
        store.delete(KEY);
        tx.oncomplete = () => resolve(val || null);
        tx.onerror = () => reject(tx.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
    db.close();
    if (!entry) return null;
    if (Date.now() - entry.ts > MAX_AGE_MS) return null;
    return entry.articleId || null;
  } catch {
    try {
      db.close();
    } catch {}
    return null;
  }
}
