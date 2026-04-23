const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

async function runCleanup(db) {
  const cutoff = Timestamp.fromMillis(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const snap = await db
    .collection('news')
    .where('ingestedAt', '<', cutoff)
    .get();

  if (snap.empty) {
    console.log('Cleanup: no old articles to delete');
    return 0;
  }

  const BATCH_SIZE = 500;
  let deleted = 0;
  for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    snap.docs.slice(i, i + BATCH_SIZE).forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += Math.min(BATCH_SIZE, snap.docs.length - i);
  }

  console.log(`Cleanup: deleted ${deleted} old articles`);
  return deleted;
}

const cleanupOldNews = onSchedule('every 24 hours', async () => {
  const db = getFirestore();
  await runCleanup(db);
});

module.exports = { cleanupOldNews, runCleanup };
