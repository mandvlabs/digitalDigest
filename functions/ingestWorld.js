const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore } = require('firebase-admin/firestore');
const { fetchFeed } = require('./lib/rss');
const { writeArticle } = require('./lib/ingest');
const { WORLD_TOPICS, WORLD_REGIONS, buildGoogleNewsUrl } = require('./sources/world');

async function runWorldIngest(db) {
  let total = 0;
  for (const topic of WORLD_TOPICS) {
    for (const region of WORLD_REGIONS) {
      try {
        const url = buildGoogleNewsUrl(topic.query, region);
        const articles = await fetchFeed(url, 'Google News');
        for (const article of articles) {
          await writeArticle(db, {
            ...article,
            section: 'world',
            tags: [`topic:${topic.slug}`, `region:${region.slug}`],
          });
          total++;
        }
      } catch (err) {
        console.error(`World ingest failed for ${topic.slug}/${region.slug}:`, err.message);
      }
    }
  }
  console.log(`World ingest complete: ${total} articles processed`);
  return total;
}

const ingestWorldNews = onSchedule('every 30 minutes', async () => {
  const db = getFirestore();
  await runWorldIngest(db);
});

module.exports = { ingestWorldNews, runWorldIngest };
