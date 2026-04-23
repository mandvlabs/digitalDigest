export const LEAGUES = [
  { id: 'PL',  name: 'Premier League' },
  { id: 'PD',  name: 'La Liga' },
  { id: 'SA',  name: 'Serie A' },
  { id: 'BL1', name: 'Bundesliga' },
  { id: 'CL',  name: 'Champions League' },
];

export const TEAMS = [
  { id: 'PL-ARS', leagueId: 'PL', name: 'Arsenal' },
  { id: 'PL-AVL', leagueId: 'PL', name: 'Aston Villa' },
  { id: 'PL-CHE', leagueId: 'PL', name: 'Chelsea' },
  { id: 'PL-LIV', leagueId: 'PL', name: 'Liverpool' },
  { id: 'PL-MCI', leagueId: 'PL', name: 'Manchester City' },
  { id: 'PL-MUN', leagueId: 'PL', name: 'Manchester United' },
  { id: 'PL-TOT', leagueId: 'PL', name: 'Tottenham Hotspur' },
  { id: 'PD-BAR', leagueId: 'PD', name: 'Barcelona' },
  { id: 'PD-RMA', leagueId: 'PD', name: 'Real Madrid' },
  { id: 'PD-ATM', leagueId: 'PD', name: 'Atlético Madrid' },
  { id: 'PD-SEV', leagueId: 'PD', name: 'Sevilla' },
  { id: 'SA-JUV', leagueId: 'SA', name: 'Juventus' },
  { id: 'SA-INT', leagueId: 'SA', name: 'Inter' },
  { id: 'SA-MIL', leagueId: 'SA', name: 'Milan' },
  { id: 'SA-NAP', leagueId: 'SA', name: 'Napoli' },
  { id: 'SA-ROM', leagueId: 'SA', name: 'Roma' },
  { id: 'BL1-BAY', leagueId: 'BL1', name: 'Bayern Munich' },
  { id: 'BL1-BVB', leagueId: 'BL1', name: 'Borussia Dortmund' },
  { id: 'BL1-LEV', leagueId: 'BL1', name: 'Bayer Leverkusen' },
  { id: 'CL-GEN', leagueId: 'CL', name: 'Champions League (all)' },
];

export function teamsByLeague(leagueId) {
  return TEAMS.filter((t) => t.leagueId === leagueId);
}

export function teamById(id) {
  return TEAMS.find((t) => t.id === id);
}
