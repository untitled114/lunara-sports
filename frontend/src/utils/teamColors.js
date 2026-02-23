export const TEAM_COLORS = {
  ATL: { primary: '#E03A3E', secondary: '#C1D32F', text: '#FFFFFF' },
  BOS: { primary: '#007A33', secondary: '#BA9653', text: '#FFFFFF' },
  BKN: { primary: '#000000', secondary: '#FFFFFF', text: '#FFFFFF' },
  CHA: { primary: '#1D1160', secondary: '#00788C', text: '#FFFFFF' },
  CHI: { primary: '#CE1141', secondary: '#000000', text: '#FFFFFF' },
  CLE: { primary: '#860038', secondary: '#FDBB30', text: '#FFFFFF' },
  DAL: { primary: '#00538C', secondary: '#002B5E', text: '#FFFFFF' },
  DEN: { primary: '#0E2240', secondary: '#FEC524', text: '#FFFFFF' },
  DET: { primary: '#C8102E', secondary: '#1D428A', text: '#FFFFFF' },
  GS:  { primary: '#1D428A', secondary: '#FFC72C', text: '#FFFFFF' },
  HOU: { primary: '#CE1141', secondary: '#000000', text: '#FFFFFF' },
  IND: { primary: '#002D62', secondary: '#FDBB30', text: '#FFFFFF' },
  LAC: { primary: '#C8102E', secondary: '#1D428A', text: '#FFFFFF' },
  LAL: { primary: '#552583', secondary: '#FDB927', text: '#FFFFFF' },
  MEM: { primary: '#5D76A9', secondary: '#12173F', text: '#FFFFFF' },
  MIA: { primary: '#98002E', secondary: '#F9A01B', text: '#FFFFFF' },
  MIL: { primary: '#00471B', secondary: '#EEE1C6', text: '#FFFFFF' },
  MIN: { primary: '#0C2340', secondary: '#236192', text: '#FFFFFF' },
  NO:  { primary: '#0C2340', secondary: '#C8102E', text: '#FFFFFF' },
  NY:  { primary: '#006BB6', secondary: '#F58426', text: '#FFFFFF' },
  OKC: { primary: '#007AC1', secondary: '#EF3B24', text: '#FFFFFF' },
  ORL: { primary: '#0077C0', secondary: '#C4CED4', text: '#FFFFFF' },
  PHI: { primary: '#006BB6', secondary: '#ED174C', text: '#FFFFFF' },
  PHX: { primary: '#1D1160', secondary: '#E56020', text: '#FFFFFF' },
  POR: { primary: '#E03A3E', secondary: '#000000', text: '#FFFFFF' },
  SAC: { primary: '#5A2D81', secondary: '#63727A', text: '#FFFFFF' },
  SA:  { primary: '#C4CED4', secondary: '#000000', text: '#000000' },
  TOR: { primary: '#CE1141', secondary: '#000000', text: '#FFFFFF' },
  UTA: { primary: '#002B5E', secondary: '#F9A01B', text: '#FFFFFF' },
  WSH: { primary: '#002B5C', secondary: '#E31837', text: '#FFFFFF' },
};

export const getTeamColor = (abbrev) => {
  return TEAM_COLORS[abbrev] || { primary: '#6366f1', secondary: '#1e293b', text: '#FFFFFF' };
};

export const getLogoUrl = (abbrev) => {
  const map = {
    'WSH': 'was',
    'GS': 'gs',
    'SA': 'sa',
    'NY': 'ny',
    'NO': 'no',
    'UTA': 'utah'
  };
  const code = (map[abbrev] || abbrev).toLowerCase();
  return `https://a.espncdn.com/i/teamlogos/nba/500/${code}.png`;
};
