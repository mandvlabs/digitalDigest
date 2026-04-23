const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions/v2');
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

async function getDb() {
  const { getFirestore } = await import('firebase-admin/firestore');
  return getFirestore();
}

async function getFieldValue() {
  const { FieldValue } = await import('firebase-admin/firestore');
  return FieldValue;
}

async function getMsg() {
  const { getMessaging } = await import('firebase-admin/messaging');
  return getMessaging();
}

async function loadPushState(db, uid) {
  const ref = db.doc(`users/${uid}/private/pushState`);
  const snap = typeof ref.get === 'function' ? await ref.get() : { exists: false };
  return snap?.exists ? (typeof snap.data === 'function' ? snap.data() : snap.data) : {};
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

  const db = await getDb();
  const snap = await db
    .collectionGroup('private')
    .where(flag, '==', true)
    .get();

  if (snap.empty) return;

  const sends = [];
  for (const userDoc of snap.docs) {
    const uid = userDoc.ref.parent.parent.id;
    sends.push(processUser(db, uid, userDoc.data(), article, now));
  }

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

  const messaging = await getMsg();
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

  const FieldValue = await getFieldValue();
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
