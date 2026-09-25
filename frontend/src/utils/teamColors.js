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
  // Unknown team: the design tokens (as ThemeContext's no-team default), not the retired
  // #6366f1 indigo.
  return TEAM_COLORS[abbrev] || { primary: 'var(--accent)', secondary: 'var(--surface-2)', text: 'var(--text-1)' };
};

// The game header's per-side team wash (ruling D31). The wash is the team's primary mixed
// into the header card, strongest at that team's edge. Its strength is capped per team so
// the mixed background stays dark enough for --text-2 (#A3A9B7) at 4.5:1 and the loser's
// --text-3 score at 3:1 (large text): the mix, taken over --surface-1 (#12151C), keeps a
// relative luminance of at most WASH_MAX_LUMINANCE. A pale primary (SA's silver) gets a
// faint wash; a dark one (DEN's navy) gets the full WASH_MAX_ALPHA. Unknown team: no wash.
export const WASH_MAX_ALPHA = 0.35;
export const WASH_MAX_LUMINANCE = 0.035;
const WASH_BASE = '#12151C';

const hexRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const channel = (v) => {
  const x = v / 255;
  return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};
export const luminance = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const mixRgb = (top, base, a) => top.map((v, i) => Math.round(base[i] + (v - base[i]) * a));

export const teamWash = (abbrev) => {
  const team = TEAM_COLORS[abbrev];
  if (!team) return null;
  const top = hexRgb(team.primary);
  const base = hexRgb(WASH_BASE);
  let alpha = WASH_MAX_ALPHA;
  while (alpha > 0 && luminance(mixRgb(top, base, alpha)) > WASH_MAX_LUMINANCE) {
    alpha = Math.round((alpha - 0.01) * 100) / 100;
  }
  return { color: team.primary, strength: `${Math.round(alpha * 100)}%` };
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
  return `https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/${code}.png&w=100&h=100`;
};

/**
 * The one place a player headshot URL is built. ESPN's full-size headshots are about
 * 1040x760 (~250 KB each); every avatar in the app is a small square, so the image is
 * requested through ESPN's combiner at `size` x `size` px. Pass 2x the rendered CSS size
 * for retina (a 48px avatar asks for 96, the default). A URL that is already a combiner
 * URL is returned unchanged.
 */
export const getHeadshotUrl = (url, size = 96) => {
  if (!url) return null;
  if (url.includes('/combiner/')) return url;
  const path = url.replace('https://a.espncdn.com', '');
  return `https://a.espncdn.com/combiner/i?img=${path}&w=${size}&h=${size}`;
};

/**
 * The ESPN athlete id a headshot URL is named by (".../players/full/6477.png", raw or
 * through the combiner), or null. The box score API sends no player id, and ESPN files
 * every headshot under the athlete id that /players/:id uses, so this is the one
 * reliable id a box-score row carries. No match means no link, never a guessed id.
 */
export const playerIdFromHeadshot = (url) => {
  const m = typeof url === 'string' ? url.match(/\/players\/full\/(\d+)\.png/) : null;
  return m ? m[1] : null;
};
