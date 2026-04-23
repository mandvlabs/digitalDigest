export const BULGARIA_OUTLETS = [
  { slug: 'dnevnik',   name: 'Dnevnik',      rssUrl: 'https://www.dnevnik.bg/rss' },
  { slug: 'mediapool', name: 'Mediapool',    rssUrl: 'https://www.mediapool.bg/rss' },
  { slug: 'bnr',       name: 'BNR',          rssUrl: 'https://bnr.bg/radiobulgaria/rss/program/horizont' },
  { slug: 'sega',      name: 'Sega',         rssUrl: 'https://www.segabg.com/rss' },
  { slug: 'offnews',   name: 'Offnews',      rssUrl: 'https://offnews.bg/feed' },
  { slug: 'darik',     name: 'Darik News',   rssUrl: 'https://dariknews.bg/feed' },
  { slug: 'nova',      name: 'Nova',         rssUrl: 'https://nova.bg/news/rss' },
  { slug: 'btv',       name: 'bTV Novinite', rssUrl: 'https://btvnovinite.bg/feed/rss' },
  { slug: 'clubz',     name: 'Club Z',       rssUrl: 'https://clubz.bg/rss' },
  { slug: 'capital',   name: 'Capital',      rssUrl: 'https://www.capital.bg/rss' },
];

export function outletBySlug(slug) {
  return BULGARIA_OUTLETS.find((o) => o.slug === slug);
}
