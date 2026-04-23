const { initializeApp } = require('firebase-admin/app');

initializeApp();

const { ingestBulgariaNews } = require('./ingestBulgaria');
const { ingestWorldNews } = require('./ingestWorld');
const { ingestSportsNews } = require('./ingestSports');
const { cleanupOldNews } = require('./cleanup');
const { ingestNewsHttp } = require('./ingestHttp');
const { onNewsArticle } = require('./onNewsArticle');

module.exports = {
  ingestBulgariaNews,
  ingestWorldNews,
  ingestSportsNews,
  cleanupOldNews,
  ingestNewsHttp,
  onNewsArticle,
};
