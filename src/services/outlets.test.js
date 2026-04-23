import { describe, it, expect } from 'vitest';
import { BULGARIA_OUTLETS, outletBySlug } from './outlets.js';

describe('Bulgaria outlets config', () => {
  it('exposes at least 8 outlets', () => {
    expect(BULGARIA_OUTLETS.length).toBeGreaterThanOrEqual(8);
  });

  it('every outlet has slug, name, and rssUrl', () => {
    for (const o of BULGARIA_OUTLETS) {
      expect(o.slug).toMatch(/^[a-z0-9-]+$/);
      expect(o.name).toBeTruthy();
      expect(o.rssUrl).toMatch(/^https?:\/\//);
    }
  });

  it('slugs are unique', () => {
    const slugs = BULGARIA_OUTLETS.map((o) => o.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('outletBySlug returns the right outlet', () => {
    const any = BULGARIA_OUTLETS[0];
    expect(outletBySlug(any.slug)).toBe(any);
  });

  it('outletBySlug returns undefined for unknown slug', () => {
    expect(outletBySlug('nope-nope')).toBeUndefined();
  });
});
