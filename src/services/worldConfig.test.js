import { describe, it, expect } from 'vitest';
import { WORLD_TOPICS, WORLD_REGIONS, topicBySlug, regionBySlug } from './worldConfig.js';

describe('world config', () => {
  it('exposes at least 6 topics', () => {
    expect(WORLD_TOPICS.length).toBeGreaterThanOrEqual(6);
  });

  it('exposes at least 6 regions', () => {
    expect(WORLD_REGIONS.length).toBeGreaterThanOrEqual(6);
  });

  it('topics and regions each have unique slugs', () => {
    const topicSlugs = WORLD_TOPICS.map((t) => t.slug);
    const regionSlugs = WORLD_REGIONS.map((r) => r.slug);
    expect(new Set(topicSlugs).size).toBe(topicSlugs.length);
    expect(new Set(regionSlugs).size).toBe(regionSlugs.length);
  });

  it('regions include a Google News gl/ceid code', () => {
    for (const r of WORLD_REGIONS) {
      expect(r.gl).toMatch(/^[A-Z]{2}$/);
      expect(r.ceid).toMatch(/^[A-Z]{2}:[a-z]{2}$/);
    }
  });

  it('lookup helpers return the right entries', () => {
    const topic = WORLD_TOPICS[0];
    const region = WORLD_REGIONS[0];
    expect(topicBySlug(topic.slug)).toBe(topic);
    expect(regionBySlug(region.slug)).toBe(region);
    expect(topicBySlug('x')).toBeUndefined();
    expect(regionBySlug('x')).toBeUndefined();
  });
});
