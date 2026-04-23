const { initializeApp } = require('firebase-admin/app');

initializeApp();

const { ingestBulgariaNews } = require('./ingestBulgaria');
const { ingestWorldNews } = require('./ingestWorld');
const { ingestSportsNews } = require('./ingestSports');
const { cleanupOldNews } = require('./cleanup');
const { ingestNewsHttp } = require('./ingestHttp');

module.exports = {
  ingestBulgariaNews,
  ingestWorldNews,
  ingestSportsNews,
  cleanupOldNews,
  ingestNewsHttp,
};
