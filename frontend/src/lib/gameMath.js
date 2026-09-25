// Pure game-math helpers: seed badge text, win probability, and record line
// formatting. No fetching, no formatting side effects — inputs are plain
// standings-row-shaped objects ({ w, l, seed, conf, pct }).
//
// Conference-tag note: the API's StandingsTeam.conf field (api/src/services/
// standings_service.py _parse_conference) actually holds the team's
// conference win-loss record (ESPN's "vsConf" stat, e.g. "18-9"), not a
// conference label. The literal "East"/"West" tag that reaches this module
// in practice comes from buildStandingsLookup() in
// frontend/src/services/api.js, which stamps it while merging the eastern/
// western arrays. normConf() below is a defensive normalizer that accepts
// any of "East"/"Eastern"/"E" or "West"/"Western"/"W" (any case) and falls
// back to no conference tag for anything else (including "").

const played = (t) => t && Number(t.w) + Number(t.l) > 0

function normConf(raw) {
  const s = String(raw || '').trim()
  if (/^w/i.test(s)) return 'West'
  if (/^e/i.test(s)) return 'East'
  return ''
}

/**
 * `{ text, variant, prev }` for a standings seed, or `null` when there's no
 * seed to show. Seeds 1-6 get the conference tag ('East #3'); 7-10 are
 * play-in territory ('Play-in'); anything else (11+) renders nothing.
 * When the conference can't be determined, the text omits it ('#3') rather
 * than guessing.
 */
export function seedBadge(team, isPrev) {
  if (!team || !team.seed) return null
  if (team.seed <= 6) {
    const conf = normConf(team.conf)
    const text = conf ? `${conf} #${team.seed}` : `#${team.seed}`
    return { text, variant: 'accent', prev: !!isPrev }
  }
  if (team.seed <= 10) return { text: 'Play-in', variant: 'warn', prev: !!isPrev }
  return null
}

/**
 * `{ home, away }` integer percents (summing to 100) from each team's win
 * pct, or `null` when either team hasn't played or both are at 0% (no basis
 * for a ratio) — never renders a misleading 100/0.
 */
export function winProbability(home, away) {
  if (!played(home) || !played(away)) return null
  const h = parseFloat(home.pct)
  const a = parseFloat(away.pct)
  if (!(h + a > 0)) return null
  const hp = Math.round((h / (h + a)) * 100)
  return { home: hp, away: 100 - hp }
}

/**
 * `'W-L'` record line, prefixed with the season label when `isPrev` is true
 * (e.g. `'2025–26: 37-45'`). `null` when there's no team.
 */
export function recordLine(team, seasonLabel, isPrev) {
  if (!team) return null
  const rec = `${team.w}-${team.l}`
  return isPrev ? `${seasonLabel.replace(/ final$/, '')}: ${rec}` : rec
}
