const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore } = require('firebase-admin/firestore');
const { fetchFeed } = require('./lib/rss');
const { writeArticle } = require('./lib/ingest');
const { BULGARIA_OUTLETS } = require('./sources/bulgaria');

async function runBulgariaIngest(db) {
  let total = 0;
  for (const outlet of BULGARIA_OUTLETS) {
    try {
      const articles = await fetchFeed(outlet.rssUrl, outlet.name);
      for (const article of articles) {
        await writeArticle(db, {
          ...article,
          section: 'bulgaria',
          tags: [`outlet:${outlet.slug}`],
        });
        total++;
      }
    } catch (err) {
      console.error(`Bulgaria ingest failed for ${outlet.slug}:`, err.message);
    }
  }
  console.log(`Bulgaria ingest complete: ${total} articles processed`);
  return total;
}

const ingestBulgariaNews = onSchedule('every 30 minutes', async () => {
  const db = getFirestore();
  await runBulgariaIngest(db);
});

module.exports = { ingestBulgariaNews, runBulgariaIngest };
