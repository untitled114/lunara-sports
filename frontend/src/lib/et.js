// Pure date helpers pinned to America/New_York (ET). No wall-clock reads outside
// `todayET`'s default arg — every other helper takes an ISO date string and is
// timezone-independent so tests pass under any machine TZ.

const TZ = 'America/New_York'

/** Today's date in ET as 'YYYY-MM-DD', regardless of the machine's local timezone. */
export function todayET(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** Add `n` calendar days to an ISO date. Calendar-safe: uses UTC arithmetic so it
 * never drifts across DST transitions (no local-time day ever gets skipped or
 * repeated). */
export function addDaysISO(iso, n) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return dt.toISOString().slice(0, 10)
}

/** `count` consecutive ISO dates starting at `startIso` (default 7, a week strip). */
export function stripDays(startIso, count = 7) {
  return Array.from({ length: count }, (_, i) => addDaysISO(startIso, i))
}

// Anchor at UTC noon so formatting in the 'UTC' timeZone below reproduces the
// ISO date's own weekday/day/month without any local-timezone reinterpretation.
const utcNoon = (iso) => new Date(`${iso}T12:00:00Z`)

/** `{ weekday: 'Sat', day: '3', month: 'Oct' }` for an ISO date. */
export function formatDayLabel(iso) {
  const d = utcNoon(iso)
  const f = (o) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...o }).format(d)
  return { weekday: f({ weekday: 'short' }), day: f({ day: 'numeric' }), month: f({ month: 'short' }) }
}

/** `'Sat, Oct 3'` for an ISO date. */
export function formatLongDay(iso) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(utcNoon(iso))
}
