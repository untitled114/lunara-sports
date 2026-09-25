import { describe, it, expect } from 'vitest'
import { seedBadge, winProbability, recordLine, periodLabel } from './gameMath'
import { buildStandingsLookup } from '@/services/api'
// Real rows only, nothing hand-built:
// - GET /standings capture (2025–26 final, e2e/fixtures/README.md);
// - the real 2026-27 preseason standings (every team 0-0), ESPN's capture run through
//   the API's own parser (see the fixture's _source).
import REAL_STANDINGS from '../../e2e/fixtures/api/standings.json'
import PRESEASON from '@/test/fixtures/standings-2026-27-preseason.json'

// The shape the pages pass in: buildStandingsLookup stamps conf "East"/"West".
const LAST = buildStandingsLookup(REAL_STANDINGS)
const NOW = buildStandingsLookup(PRESEASON.data)
const raw = (abbrev) => [...REAL_STANDINGS.eastern, ...REAL_STANDINGS.western].find((t) => t.abbrev === abbrev)

describe('seedBadge (real 2025–26 rows)', () => {
  it('1-6 conference seed, 7-10 play-in, 11+ none', () => {
    expect([LAST.DET.seed, LAST.OKC.seed, LAST.PHI.seed, LAST.MIA.seed, LAST.MIL.seed]).toEqual([1, 1, 7, 10, 11])
    expect(seedBadge(LAST.DET, false)).toEqual({ text: 'East #1', variant: 'accent', prev: false })
    expect(seedBadge(LAST.OKC, true)).toEqual({ text: 'West #1', variant: 'accent', prev: true })
    expect(seedBadge(LAST.PHI, true)).toEqual({ text: 'Play-in', variant: 'warn', prev: true })
    expect(seedBadge(LAST.MIA, true)).toEqual({ text: 'Play-in', variant: 'warn', prev: true })
    expect(seedBadge(LAST.MIL, true)).toBeNull()
  })

  it('uses the seed, not the rank, where they differ (ATL rank 5 / seed 6, TOR rank 6 / seed 5)', () => {
    expect(seedBadge(LAST.ATL, true).text).toBe('East #6')
    expect(seedBadge(LAST.TOR, true).text).toBe('East #5')
  })

  it('no team, or a 0-0 team with no seed (the real preseason) → none', () => {
    expect(seedBadge(undefined, false)).toBeNull()
    expect(NOW.ATL.w + NOW.ATL.l).toBe(0)
    for (const team of Object.values(NOW)) expect(seedBadge(team, false)).toBeNull()
  })

  it('a raw API row (its conf field is the vs-conference record, "" here) keeps the seed, drops the tag', () => {
    expect(raw('DET').conf).toBe('')
    expect(seedBadge(raw('DET'), false)).toEqual({ text: '#1', variant: 'accent', prev: false })
  })
})

describe('winProbability (real rows)', () => {
  it('ratio of Laplace-smoothed win strength, integer percents summing to 100', () => {
    // TOR 46-36 home vs MIA 43-39: 47/84 vs 44/84 → round(100*47/91) = 52.
    expect(winProbability(LAST.TOR, LAST.MIA)).toEqual({ home: 52, away: 48 })
  })

  it('never an extreme split, even for the best vs the worst real record', () => {
    expect(`${LAST.OKC.w}-${LAST.OKC.l}`).toBe('64-18')
    expect(`${LAST.WSH.w}-${LAST.WSH.l}`).toBe('17-65')
    for (const [h, a] of [[LAST.OKC, LAST.WSH], [LAST.WSH, LAST.OKC]]) {
      const r = winProbability(h, a)
      expect(r.home).toBeGreaterThanOrEqual(1)
      expect(r.home).toBeLessThanOrEqual(99)
      expect(r.home + r.away).toBe(100)
    }
  })

  it('null when either team has no games played (the real preseason) or no row', () => {
    expect(winProbability(NOW.MIA, LAST.TOR)).toBeNull()
    expect(winProbability(NOW.MIA, NOW.TOR)).toBeNull()
    expect(winProbability(undefined, LAST.TOR)).toBeNull()
  })

  it('every pairing of the 30 real records gives an integer split in 1..99 summing to 100', () => {
    const teams = Object.values(LAST)
    expect(teams).toHaveLength(30)
    for (const h of teams) {
      for (const a of teams) {
        const r = winProbability(h, a)
        expect(Number.isInteger(r.home) && Number.isInteger(r.away)).toBe(true)
        expect(r.home).toBeGreaterThanOrEqual(1)
        expect(r.home).toBeLessThanOrEqual(99)
        expect(r.home + r.away).toBe(100)
      }
    }
  })
})

describe('recordLine (real rows)', () => {
  it('labels the previous season; the current season is the bare record', () => {
    expect(recordLine(LAST.MIA, REAL_STANDINGS.season_label, true)).toBe('2025–26: 43-39')
    expect(recordLine(NOW.MIA, PRESEASON.data.season_label, false)).toBe('0-0')
    expect(recordLine(undefined, '', false)).toBeNull()
  })

  it('tolerates a missing season label when isPrev is true — falls back to the record', () => {
    expect(recordLine(LAST.MIA, null, true)).toBe('43-39')
    expect(recordLine(LAST.MIA, undefined, true)).toBe('43-39')
    expect(recordLine(LAST.MIA, '', true)).toBe('43-39')
  })
})

describe('periodLabel', () => {
  it('Q1-Q4, then OT, 2OT…; empty when unknown', () => {
    expect(periodLabel(1)).toBe('Q1')
    expect(periodLabel(4)).toBe('Q4')
    expect(periodLabel(5)).toBe('OT')
    expect(periodLabel(6)).toBe('2OT')
    expect(periodLabel(7)).toBe('3OT')
    expect(periodLabel(null)).toBe('')
    expect(periodLabel(undefined)).toBe('')
    expect(periodLabel(0)).toBe('')
  })
})
