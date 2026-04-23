let _parser = null;

async function getParser() {
  if (_parser) return _parser;
  const _mod = await import('rss-parser');
  const Parser = _mod.default || _mod;
  const options = {
    customFields: {
      item: [
        ['media:content', 'mediaContent'],
        ['media:thumbnail', 'mediaThumbnail'],
      ],
    },
  };
  try {
    _parser = new Parser(options);
  } catch {
    _parser = Parser(options);
  }
  return _parser;
}

async function fetchFeed(url, source = '') {
  try {
    const parser = await getParser();
    const feed = await parser.parseURL(url);
    return feed.items
      .filter((item) => !!(item.link || item.guid))
      .map((item) => ({
        headline: item.title || '',
        url: item.link || item.guid || '',
        excerpt: (item.contentSnippet || item.content || '').slice(0, 200),
        imageUrl:
          item.mediaContent?.$?.url ||
          item.mediaThumbnail?.$?.url ||
          null,
        publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
        source,
      }));
  } catch (err) {
    console.error(`fetchFeed error for ${url}:`, err.message);
    return [];
  }
}

module.exports = { fetchFeed };
