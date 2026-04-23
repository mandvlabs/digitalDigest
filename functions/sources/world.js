const WORLD_TOPICS = [
  { slug: 'politics',      query: 'politics' },
  { slug: 'business',      query: 'business' },
  { slug: 'tech',          query: 'technology' },
  { slug: 'science',       query: 'science' },
  { slug: 'health',        query: 'health' },
  { slug: 'entertainment', query: 'entertainment' },
  { slug: 'sports',        query: 'sports' },
];

const WORLD_REGIONS = [
  { slug: 'us',          gl: 'US', ceid: 'US:en' },
  { slug: 'uk',          gl: 'GB', ceid: 'GB:en' },
  { slug: 'eu',          gl: 'DE', ceid: 'DE:en' },
  { slug: 'asia',        gl: 'IN', ceid: 'IN:en' },
  { slug: 'middle-east', gl: 'AE', ceid: 'AE:en' },
  { slug: 'africa',      gl: 'ZA', ceid: 'ZA:en' },
  { slug: 'latam',       gl: 'MX', ceid: 'MX:en' },
];

function buildGoogleNewsUrl(topicQuery, region) {
  const q = encodeURIComponent(`${topicQuery} when:1d`);
  return `https://news.google.com/rss/search?q=${q}&hl=en&gl=${region.gl}&ceid=${region.ceid}`;
}

module.exports = { WORLD_TOPICS, WORLD_REGIONS, buildGoogleNewsUrl };
