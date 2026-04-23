import {
  collection,
  query,
  where,
  orderBy,
  limit as limitFn,
  startAfter,
  getDocs,
} from 'firebase/firestore';
import { db } from './firebase.js';

const MAX_IN = 30;

export function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function docToArticle(doc) {
  const data = doc.data();
  return { id: doc.id, ...data };
}

function publishedMillis(article) {
  const pa = article.publishedAt;
  if (!pa) return 0;
  if (typeof pa.toDate === 'function') return pa.toDate().getTime();
  if (pa instanceof Date) return pa.getTime();
  return new Date(pa).getTime();
}

async function runTagQuery({ section, tags, pageSize, cursor }) {
  const parts = [
    collection(db, 'news'),
    where('section', '==', section),
    where('tags', 'array-contains-any', tags),
    orderBy('publishedAt', 'desc'),
  ];
  if (cursor) parts.push(startAfter(cursor));
  parts.push(limitFn(pageSize));
  const q = query(...parts);
  const snap = await getDocs(q);
  return {
    articles: snap.docs.map(docToArticle),
    lastDoc: snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null,
  };
}

async function runChunkedTagQuery({ section, tags, pageSize, cursor }) {
  if (tags.length === 0) {
    return { articles: [], lastDoc: null };
  }
  const chunks = chunk(tags, MAX_IN);
  if (chunks.length === 1) {
    return runTagQuery({ section, tags: chunks[0], pageSize, cursor });
  }
  const pages = await Promise.all(
    chunks.map((c) => runTagQuery({ section, tags: c, pageSize, cursor: null })),
  );
  const all = pages.flatMap((p) => p.articles);
  const merged = all.sort(
    (a, b) => publishedMillis(b) - publishedMillis(a),
  );
  return {
    articles: merged.slice(0, pageSize),
    lastDoc: null,
  };
}

export async function fetchBulgariaNews({ outlets, limit = 30, cursor = null }) {
  const tags = outlets.map((slug) => `outlet:${slug}`);
  return runChunkedTagQuery({
    section: 'bulgaria',
    tags,
    pageSize: limit,
    cursor,
  });
}

export async function fetchWorldNews({ topics, regions, limit = 30, cursor = null }) {
  if (topics.length === 0 || regions.length === 0) {
    return { articles: [], lastDoc: null };
  }
  const topicTags = topics.map((t) => `topic:${t}`);
  const regionSet = new Set(regions.map((r) => `region:${r}`));
  const raw = await runChunkedTagQuery({
    section: 'world',
    tags: topicTags,
    pageSize: limit * 3,
    cursor,
  });
  const filtered = raw.articles.filter((a) =>
    (a.tags || []).some((t) => regionSet.has(t)),
  );
  return {
    articles: filtered.slice(0, limit),
    lastDoc: raw.lastDoc,
  };
}

export async function fetchSportsNews({ teams, f1, limit = 30, cursor = null }) {
  const tags = [...teams.map((id) => `team:${id}`)];
  if (f1) tags.push('sport:f1');
  if (tags.length === 0) {
    return { articles: [], lastDoc: null };
  }
  return runChunkedTagQuery({
    section: 'sports',
    tags,
    pageSize: limit,
    cursor,
  });
}
