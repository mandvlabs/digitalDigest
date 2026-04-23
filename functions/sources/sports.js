const FOOTBALL_TEAMS = [
  { id: 'PL-ARS', name: 'Arsenal' },
  { id: 'PL-AVL', name: 'Aston Villa' },
  { id: 'PL-CHE', name: 'Chelsea' },
  { id: 'PL-LIV', name: 'Liverpool' },
  { id: 'PL-MCI', name: 'Manchester City' },
  { id: 'PL-MUN', name: 'Manchester United' },
  { id: 'PL-TOT', name: 'Tottenham Hotspur' },
  { id: 'PD-BAR', name: 'Barcelona' },
  { id: 'PD-RMA', name: 'Real Madrid' },
  { id: 'PD-ATM', name: 'Atletico Madrid' },
  { id: 'PD-SEV', name: 'Sevilla' },
  { id: 'SA-JUV', name: 'Juventus' },
  { id: 'SA-INT', name: 'Inter Milan' },
  { id: 'SA-MIL', name: 'AC Milan' },
  { id: 'SA-NAP', name: 'Napoli' },
  { id: 'SA-ROM', name: 'AS Roma' },
  { id: 'BL1-BAY', name: 'Bayern Munich' },
  { id: 'BL1-BVB', name: 'Borussia Dortmund' },
  { id: 'BL1-LEV', name: 'Bayer Leverkusen' },
];

function buildTeamUrl(teamName) {
  const q = encodeURIComponent(`"${teamName}" football when:1d`);
  return `https://news.google.com/rss/search?q=${q}&hl=en&gl=US&ceid=US:en`;
}

const F1_URL = `https://news.google.com/rss/search?q=${encodeURIComponent('Formula 1 when:1d')}&hl=en&gl=US&ceid=US:en`;

module.exports = { FOOTBALL_TEAMS, buildTeamUrl, F1_URL };
