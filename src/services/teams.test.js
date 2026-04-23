import { describe, it, expect } from 'vitest';
import { LEAGUES, TEAMS, teamsByLeague, teamById } from './teams.js';

describe('football teams catalog', () => {
  it('covers at least 5 leagues', () => {
    expect(LEAGUES.length).toBeGreaterThanOrEqual(5);
  });

  it('every team has id, name, and leagueId', () => {
    for (const t of TEAMS) {
      expect(t.id).toMatch(/^[A-Z0-9-]+$/);
      expect(t.name).toBeTruthy();
      expect(LEAGUES.some((l) => l.id === t.leagueId)).toBe(true);
    }
  });

  it('team ids are unique', () => {
    const ids = TEAMS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('teamsByLeague filters correctly', () => {
    const first = LEAGUES[0];
    const sub = teamsByLeague(first.id);
    expect(sub.length).toBeGreaterThan(0);
    for (const t of sub) expect(t.leagueId).toBe(first.id);
  });

  it('teamById round-trips', () => {
    const any = TEAMS[0];
    expect(teamById(any.id)).toBe(any);
  });
});
