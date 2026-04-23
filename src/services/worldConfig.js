export const WORLD_TOPICS = [
  { slug: 'politics',      name: 'Politics',      query: 'politics' },
  { slug: 'business',      name: 'Business',      query: 'business' },
  { slug: 'tech',          name: 'Technology',    query: 'technology' },
  { slug: 'science',       name: 'Science',       query: 'science' },
  { slug: 'health',        name: 'Health',        query: 'health' },
  { slug: 'entertainment', name: 'Entertainment', query: 'entertainment' },
  { slug: 'sports',        name: 'Sports',        query: 'sports' },
];

export const WORLD_REGIONS = [
  { slug: 'us',          name: 'United States',  gl: 'US', ceid: 'US:en' },
  { slug: 'uk',          name: 'United Kingdom', gl: 'GB', ceid: 'GB:en' },
  { slug: 'eu',          name: 'Europe',         gl: 'DE', ceid: 'DE:en' },
  { slug: 'asia',        name: 'Asia',           gl: 'IN', ceid: 'IN:en' },
  { slug: 'middle-east', name: 'Middle East',    gl: 'AE', ceid: 'AE:en' },
  { slug: 'africa',      name: 'Africa',         gl: 'ZA', ceid: 'ZA:en' },
  { slug: 'latam',       name: 'Latin America',  gl: 'MX', ceid: 'MX:en' },
];

export function topicBySlug(slug) {
  return WORLD_TOPICS.find((t) => t.slug === slug);
}

export function regionBySlug(slug) {
  return WORLD_REGIONS.find((r) => r.slug === slug);
}
