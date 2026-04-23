import { describe, it, expect } from 'vitest';
import { formatRelativeTime } from './time.js';

const NOW = new Date('2026-04-23T12:00:00Z');

describe('formatRelativeTime', () => {
  it('returns "just now" for <1 min ago', () => {
    const d = new Date(NOW.getTime() - 30 * 1000);
    expect(formatRelativeTime(d, NOW)).toBe('just now');
  });

  it('returns "Nm ago" for minutes', () => {
    const d = new Date(NOW.getTime() - 5 * 60 * 1000);
    expect(formatRelativeTime(d, NOW)).toBe('5m ago');
  });

  it('returns "Nh ago" for hours', () => {
    const d = new Date(NOW.getTime() - 3 * 60 * 60 * 1000);
    expect(formatRelativeTime(d, NOW)).toBe('3h ago');
  });

  it('returns "Nd ago" for days', () => {
    const d = new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(d, NOW)).toBe('2d ago');
  });

  it('returns date string for >7 days ago', () => {
    const d = new Date('2026-04-10T12:00:00Z');
    expect(formatRelativeTime(d, NOW)).toBe('Apr 10');
  });

  it('accepts Firestore Timestamp-like objects (toDate())', () => {
    const d = new Date(NOW.getTime() - 60 * 1000);
    const ts = { toDate: () => d };
    expect(formatRelativeTime(ts, NOW)).toBe('1m ago');
  });

  it('returns empty string for null/undefined', () => {
    expect(formatRelativeTime(null, NOW)).toBe('');
    expect(formatRelativeTime(undefined, NOW)).toBe('');
  });
});
