import { describe, it, expect } from 'vitest';
import { pushMatch } from './pushMatch.js';

const COOLDOWN = 30 * 60 * 1000;

function mkNow() {
  return new Date('2026-04-23T12:00:00Z');
}

function mkArticle(overrides = {}) {
  return {
    section: 'bulgaria',
    tags: ['outlet:dnevnik'],
    publishedAt: new Date('2026-04-23T11:30:00Z'),
    ...overrides,
  };
}

function mkUser(overrides = {}) {
  return {
    prefs: {
      bulgariaOutlets: ['dnevnik'],
      worldTopics: ['tech'],
      worldRegions: ['us', 'eu'],
      footballTeams: ['PL-ARS'],
      f1Follow: false,
      notifications: {
        bulgariaBreaking: true,
        worldBreaking: true,
        sportsBreaking: true,
      },
      fcmTokens: ['tok-1', 'tok-2'],
    },
    pushState: { lastPushAt: {} },
    ...overrides,
  };
}

describe('pushMatch', () => {
  it('skips when article older than 6h', () => {
    const result = pushMatch({
      article: mkArticle({ publishedAt: new Date('2026-04-23T05:00:00Z') }),
      user: mkUser(),
      now: mkNow(),
      cooldownMs: COOLDOWN,
    });
    expect(result.shouldPush).toBe(false);
    expect(result.reason).toBe('stale');
  });

  it('skips when section toggle off', () => {
    const user = mkUser();
    user.prefs.notifications.bulgariaBreaking = false;
    const result = pushMatch({
      article: mkArticle(),
      user,
      now: mkNow(),
      cooldownMs: COOLDOWN,
    });
    expect(result.shouldPush).toBe(false);
    expect(result.reason).toBe('toggle_off');
  });

  it('skips when rate-limited', () => {
    const user = mkUser();
    user.pushState.lastPushAt = { bulgaria: new Date('2026-04-23T11:45:00Z') };
    const result = pushMatch({
      article: mkArticle(),
      user,
      now: mkNow(),
      cooldownMs: COOLDOWN,
    });
    expect(result.shouldPush).toBe(false);
    expect(result.reason).toBe('rate_limited');
  });

  it('allows when last push was more than cooldown ago', () => {
    const user = mkUser();
    user.pushState.lastPushAt = { bulgaria: new Date('2026-04-23T11:00:00Z') };
    const result = pushMatch({
      article: mkArticle(),
      user,
      now: mkNow(),
      cooldownMs: COOLDOWN,
    });
    expect(result.shouldPush).toBe(true);
    expect(result.tokens).toEqual(['tok-1', 'tok-2']);
  });

  it('Bulgaria: matches outlet tag in user outlets', () => {
    const result = pushMatch({
      article: mkArticle({ tags: ['outlet:bnr'] }),
      user: mkUser({ prefs: { ...mkUser().prefs, bulgariaOutlets: ['bnr'] } }),
      now: mkNow(),
      cooldownMs: COOLDOWN,
    });
    expect(result.shouldPush).toBe(true);
  });

  it('Bulgaria: rejects when outlet not in user outlets', () => {
    const result = pushMatch({
      article: mkArticle({ tags: ['outlet:nova'] }),
      user: mkUser(),
      now: mkNow(),
      cooldownMs: COOLDOWN,
    });
    expect(result.shouldPush).toBe(false);
    expect(result.reason).toBe('no_match');
  });

  it('World: requires topic AND region match', () => {
    const article = {
      section: 'world',
      tags: ['topic:tech', 'region:us'],
      publishedAt: new Date('2026-04-23T11:30:00Z'),
    };
    const result = pushMatch({
      article,
      user: mkUser(),
      now: mkNow(),
      cooldownMs: COOLDOWN,
    });
    expect(result.shouldPush).toBe(true);
  });

  it('World: rejects when topic matches but region does not', () => {
    const article = {
      section: 'world',
      tags: ['topic:tech', 'region:asia'],
      publishedAt: new Date('2026-04-23T11:30:00Z'),
    };
    const result = pushMatch({
      article,
      user: mkUser(),
      now: mkNow(),
      cooldownMs: COOLDOWN,
    });
    expect(result.shouldPush).toBe(false);
  });

  it('Sports: matches team tag', () => {
    const article = {
      section: 'sports',
      tags: ['team:PL-ARS'],
      publishedAt: new Date('2026-04-23T11:30:00Z'),
    };
    const result = pushMatch({
      article,
      user: mkUser(),
      now: mkNow(),
      cooldownMs: COOLDOWN,
    });
    expect(result.shouldPush).toBe(true);
  });

  it('Sports: matches F1 when f1Follow=true', () => {
    const article = {
      section: 'sports',
      tags: ['sport:f1'],
      publishedAt: new Date('2026-04-23T11:30:00Z'),
    };
    const result = pushMatch({
      article,
      user: mkUser({
        prefs: { ...mkUser().prefs, f1Follow: true, footballTeams: [] },
      }),
      now: mkNow(),
      cooldownMs: COOLDOWN,
    });
    expect(result.shouldPush).toBe(true);
  });

  it('Sports: rejects F1 when f1Follow=false', () => {
    const article = {
      section: 'sports',
      tags: ['sport:f1'],
      publishedAt: new Date('2026-04-23T11:30:00Z'),
    };
    const result = pushMatch({
      article,
      user: mkUser({ prefs: { ...mkUser().prefs, footballTeams: [] } }),
      now: mkNow(),
      cooldownMs: COOLDOWN,
    });
    expect(result.shouldPush).toBe(false);
  });

  it('returns empty tokens when user has none', () => {
    const user = mkUser({ prefs: { ...mkUser().prefs, fcmTokens: [] } });
    const result = pushMatch({
      article: mkArticle(),
      user,
      now: mkNow(),
      cooldownMs: COOLDOWN,
    });
    expect(result.shouldPush).toBe(false);
    expect(result.reason).toBe('no_tokens');
    expect(result.tokens).toEqual([]);
  });

  it('accepts Firestore Timestamp-like objects with toDate()', () => {
    const result = pushMatch({
      article: mkArticle({
        publishedAt: { toDate: () => new Date('2026-04-23T11:30:00Z') },
      }),
      user: mkUser({
        pushState: {
          lastPushAt: { bulgaria: { toDate: () => new Date('2026-04-23T10:00:00Z') } },
        },
      }),
      now: mkNow(),
      cooldownMs: COOLDOWN,
    });
    expect(result.shouldPush).toBe(true);
  });
});
