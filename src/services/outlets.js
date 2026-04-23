export const BULGARIA_OUTLETS = [
  { slug: 'dnevnik',   name: 'Dnevnik',      rssUrl: 'https://www.dnevnik.bg/rss' },
  { slug: 'mediapool', name: 'Mediapool',    rssUrl: 'https://www.mediapool.bg/rss' },
  { slug: 'bnr',       name: 'BNR',          rssUrl: 'https://bnr.bg/post/rss' },
  { slug: 'sega',      name: 'Sega',         rssUrl: 'https://www.segabg.com/rss.xml' },
  { slug: 'offnews',   name: 'Offnews',      rssUrl: 'https://offnews.bg/rss.xml' },
  { slug: 'darik',     name: 'Darik News',   rssUrl: 'https://dariknews.bg/rss' },
  { slug: 'nova',      name: 'Nova',         rssUrl: 'https://nova.bg/rss' },
  { slug: 'btv',       name: 'bTV Novinite', rssUrl: 'https://btvnovinite.bg/rss/' },
  { slug: 'clubz',     name: 'Club Z',       rssUrl: 'https://clubz.bg/feed' },
  { slug: 'capital',   name: 'Capital',      rssUrl: 'https://www.capital.bg/rss' },
];

export function outletBySlug(slug) {
  return BULGARIA_OUTLETS.find((o) => o.slug === slug);
}
