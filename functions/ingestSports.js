const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore } = require('firebase-admin/firestore');
const { fetchFeed } = require('./lib/rss');
const { writeArticle } = require('./lib/ingest');
const { FOOTBALL_TEAMS, buildTeamUrl, F1_URL } = require('./sources/sports');

async function runSportsIngest(db) {
  let total = 0;

  // Football teams
  for (const team of FOOTBALL_TEAMS) {
    try {
      const url = buildTeamUrl(team.name);
      const articles = await fetchFeed(url, 'Google News');
      for (const article of articles) {
        await writeArticle(db, {
          ...article,
          section: 'sports',
          tags: [`team:${team.id}`, 'sport:football'],
        });
        total++;
      }
    } catch (err) {
      console.error(`Sports ingest failed for team ${team.id}:`, err.message);
    }
  }

  // Formula 1
  try {
    const articles = await fetchFeed(F1_URL, 'Google News');
    for (const article of articles) {
      await writeArticle(db, {
        ...article,
        section: 'sports',
        tags: ['sport:f1'],
      });
      total++;
    }
  } catch (err) {
    console.error('Sports ingest failed for F1:', err.message);
  }

  console.log(`Sports ingest complete: ${total} articles processed`);
  return total;
}

const ingestSportsNews = onSchedule('every 30 minutes', async () => {
  const db = getFirestore();
  await runSportsIngest(db);
});

module.exports = { ingestSportsNews, runSportsIngest };
