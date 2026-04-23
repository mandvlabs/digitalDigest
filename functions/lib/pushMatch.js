const FRESHNESS_MS = 6 * 60 * 60 * 1000;

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  const d = new Date(value);
  const n = d.getTime();
  return Number.isFinite(n) ? n : 0;
}

function hasTagWithPrefix(tags, prefix, allowed) {
  const allowedSet = new Set(allowed);
  for (const tag of tags || []) {
    if (!tag.startsWith(prefix)) continue;
    const value = tag.slice(prefix.length);
    if (allowedSet.has(value)) return true;
  }
  return false;
}

function sectionToggle(notifications, section) {
  if (!notifications) return false;
  if (section === 'bulgaria') return !!notifications.bulgariaBreaking;
  if (section === 'world') return !!notifications.worldBreaking;
  if (section === 'sports') return !!notifications.sportsBreaking;
  return false;
}

function contentMatches(article, prefs) {
  const tags = article.tags || [];
  if (article.section === 'bulgaria') {
    return hasTagWithPrefix(tags, 'outlet:', prefs.bulgariaOutlets || []);
  }
  if (article.section === 'world') {
    const topicOk = hasTagWithPrefix(tags, 'topic:', prefs.worldTopics || []);
    const regionOk = hasTagWithPrefix(tags, 'region:', prefs.worldRegions || []);
    return topicOk && regionOk;
  }
  if (article.section === 'sports') {
    const teamOk = hasTagWithPrefix(tags, 'team:', prefs.footballTeams || []);
    const f1Ok = prefs.f1Follow === true && (tags || []).includes('sport:f1');
    return teamOk || f1Ok;
  }
  return false;
}

function pushMatch({ article, user, now, cooldownMs }) {
  const prefs = user?.prefs || {};
  const tokens = Array.isArray(prefs.fcmTokens) ? prefs.fcmTokens : [];

  const publishedMs = toMillis(article.publishedAt);
  if (!publishedMs || now.getTime() - publishedMs > FRESHNESS_MS) {
    return { shouldPush: false, reason: 'stale', tokens: [] };
  }

  if (!sectionToggle(prefs.notifications, article.section)) {
    return { shouldPush: false, reason: 'toggle_off', tokens: [] };
  }

  const lastPushAt = user?.pushState?.lastPushAt?.[article.section];
  const lastMs = toMillis(lastPushAt);
  if (lastMs && now.getTime() - lastMs < cooldownMs) {
    return { shouldPush: false, reason: 'rate_limited', tokens: [] };
  }

  if (!contentMatches(article, prefs)) {
    return { shouldPush: false, reason: 'no_match', tokens: [] };
  }

  if (tokens.length === 0) {
    return { shouldPush: false, reason: 'no_tokens', tokens: [] };
  }

  return { shouldPush: true, reason: 'match', tokens: [...tokens] };
}

module.exports = { pushMatch, FRESHNESS_MS };
