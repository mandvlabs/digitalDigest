const { createHash } = require('crypto');

function sha1(str) {
  return createHash('sha1').update(str).digest('hex');
}

async function writeArticle(db, article) {
  if (!article.url) return;
  const id = sha1(article.url);
  const ref = db.collection('news').doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({ ...article, ingestedAt: new Date() });
  }
}

module.exports = { sha1, writeArticle };
