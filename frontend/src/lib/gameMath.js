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
 * than guessing. A team that hasn't played gets no badge.
 */
export function seedBadge(team, isPrev) {
  // A seed on a team with no games (ESPN can assign playoffSeed at 0-0) isn't backed
  // by any result, so no badge (spec goal 5), the same rule as winProbability.
  if (!team || !team.seed || !played(team)) return null
  if (team.seed <= 6) {
    const conf = normConf(team.conf)
    const text = conf ? `${conf} #${team.seed}` : `#${team.seed}`
    return { text, variant: 'accent', prev: !!isPrev }
  }
  if (team.seed <= 10) return { text: 'Play-in', variant: 'warn', prev: !!isPrev }
  return null
}

// Laplace-smoothed win pct: (w + 1) / (w + l + 2). Always strictly between 0
// and 1, so the ratio below never collapses to an exact 0 or 1 — a 0-10 team
// still has *some* modeled chance, it's just heavily discounted. Uses raw
// w/l, not the pct string (which is itself unsmoothed and can be exactly
// "0.000").
const strength = (t) => (Number(t.w) + 1) / (Number(t.w) + Number(t.l) + 2)

/**
 * `{ home, away }` integer percents (summing to 100) from each team's
 * Laplace-smoothed win strength, or `null` when either team hasn't played
 * any games. Clamped to 1..99 so it never renders a misleading 100/0, even
 * for extreme records.
 */
export function winProbability(home, away) {
  if (!played(home) || !played(away)) return null
  const pH = strength(home)
  const pA = strength(away)
  const hp = Math.min(99, Math.max(1, Math.round((100 * pH) / (pH + pA))))
  return { home: hp, away: 100 - hp }
}

/**
 * `'W-L'` record line, prefixed with the season label when `isPrev` is true
 * (e.g. `'2025–26: 37-45'`). `null` when there's no team. Tolerates a
 * missing/null/undefined `seasonLabel` — falls back to just the record
 * rather than throwing or printing "undefined:".
 */
export function recordLine(team, seasonLabel, isPrev) {
  if (!team) return null
  const rec = `${team.w}-${team.l}`
  if (!isPrev) return rec
  const label = String(seasonLabel ?? '').replace(/ final$/, '')
  return label ? `${label}: ${rec}` : rec
}

/**
 * The period a game (or play) is in, the same short form everywhere: 'Q1'..'Q4', then
 * 'OT', '2OT', '3OT'… for overtimes (the API counts them on as quarter 5, 6…).
 * '' when the quarter is unknown.
 */
export function periodLabel(quarter) {
  const q = Number(quarter)
  if (!Number.isInteger(q) || q < 1) return ''
  if (q <= 4) return `Q${q}`
  return q === 5 ? 'OT' : `${q - 4}OT`
}
