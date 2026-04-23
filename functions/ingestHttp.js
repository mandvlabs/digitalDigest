const { onRequest } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const { runBulgariaIngest } = require('./ingestBulgaria');
const { runWorldIngest } = require('./ingestWorld');
const { runSportsIngest } = require('./ingestSports');

const ingestNewsHttp = onRequest(async (req, res) => {
  const ingestKey = process.env.INGEST_KEY;
  if (ingestKey && req.query.key !== ingestKey) {
    res.status(401).send('Unauthorized');
    return;
  }

  const db = getFirestore();
  try {
    const [bulgaria, world, sports] = await Promise.allSettled([
      runBulgariaIngest(db),
      runWorldIngest(db),
      runSportsIngest(db),
    ]);

    res.json({
      ok: true,
      bulgaria: bulgaria.status === 'fulfilled' ? bulgaria.value : bulgaria.reason?.message,
      world: world.status === 'fulfilled' ? world.value : world.reason?.message,
      sports: sports.status === 'fulfilled' ? sports.value : sports.reason?.message,
    });
  } catch (err) {
    console.error('ingestNewsHttp error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = { ingestNewsHttp };
