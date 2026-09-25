import { describe, it, expect } from 'vitest'
import { seedBadge, winProbability, recordLine, periodLabel } from './gameMath'

// Real standings-row shape: the API's own StandingsTeam.conf field is actually
// the team's conference W-L record (see api/src/services/standings_service.py
// _parse_conference), not a conference label — the "East"/"West" tag consumed
// here is stamped by buildStandingsLookup() in frontend/src/services/api.js.
// The default below reflects that real value.
const t = (w, l, seed, conf = 'East') => ({ w, l, seed, conf, pct: (w + l ? w / (w + l) : 0).toFixed(3) })

describe('seedBadge', () => {
  it('1-6 conf seed, 7-10 play-in, else none', () => {
    expect(seedBadge(t(60, 22, 1), false)).toEqual({ text: 'East #1', variant: 'accent', prev: false })
    expect(seedBadge(t(40, 42, 8, 'West'), true)).toEqual({ text: 'Play-in', variant: 'warn', prev: true })
    expect(seedBadge(t(20, 62, 13), false)).toBeNull()
  })

  it('missing team or seed → none', () => {
    expect(seedBadge(undefined, false)).toBeNull()
    expect(seedBadge(t(0, 0, null), false)).toBeNull()
  })

  it('a seed on a team with no games played → none', () => {
    expect(seedBadge(t(0, 0, 4), false)).toBeNull()
    expect(seedBadge(t(0, 0, 8, 'West'), false)).toBeNull()
    expect(seedBadge(t(1, 0, 4), false)).toEqual({ text: 'East #4', variant: 'accent', prev: false })
  })

  it('normalizes real-world conf shapes to East/West', () => {
    expect(seedBadge(t(50, 32, 3, 'West'), false)).toEqual({ text: 'West #3', variant: 'accent', prev: false })
    expect(seedBadge(t(50, 32, 3, 'Eastern'), false)).toEqual({ text: 'East #3', variant: 'accent', prev: false })
    expect(seedBadge(t(50, 32, 3, 'Western'), false)).toEqual({ text: 'West #3', variant: 'accent', prev: false })
    expect(seedBadge(t(50, 32, 3, 'E'), false)).toEqual({ text: 'East #3', variant: 'accent', prev: false })
    expect(seedBadge(t(50, 32, 3, 'W'), false)).toEqual({ text: 'West #3', variant: 'accent', prev: false })
  })

  it('empty or unrecognized conf drops the conference tag, keeping the seed', () => {
    expect(seedBadge(t(50, 32, 3, ''), false)).toEqual({ text: '#3', variant: 'accent', prev: false })
    expect(seedBadge({ w: 50, l: 32, seed: 3, pct: '0.610' }, false)).toEqual({
      text: '#3',
      variant: 'accent',
      prev: false,
    })
  })
})

describe('winProbability', () => {
  it('ratio of Laplace-smoothed win strength, integer percents summing to 100', () => {
    // (45+1)/(84) = 46/84 vs (37+1)/(84) = 38/84 → round(100*46/84) = 55.
    expect(winProbability(t(45, 37, 5), t(37, 45, 9))).toEqual({ home: 55, away: 45 })
  })

  it('never an extreme split, even for a winless team vs a .500 team', () => {
    // Regression for the bug: a raw-pct ratio made 0-10 vs 5-5 come out {home:0, away:100}.
    const result = winProbability(t(0, 10, 15), t(5, 5, 3))
    expect(result).not.toBeNull()
    expect(result.home).toBeGreaterThanOrEqual(1)
    expect(result.home).toBeLessThanOrEqual(99)
    expect(result.away).toBeGreaterThanOrEqual(1)
    expect(result.away).toBeLessThanOrEqual(99)
    expect(result.home + result.away).toBe(100)
  })

  it('null when either team has no games played', () => {
    expect(winProbability(t(0, 0, null), t(10, 5, 3))).toBeNull()
    expect(winProbability(undefined, t(10, 5, 3))).toBeNull()
  })

  it('property: every record pair over an 82-game season yields an integer split in 1..99 summing to 100', () => {
    for (let hw = 0; hw <= 82; hw++) {
      for (let aw = 0; aw <= 82; aw++) {
        const result = winProbability(t(hw, 82 - hw, 1), t(aw, 82 - aw, 1))
        expect(Number.isInteger(result.home)).toBe(true)
        expect(Number.isInteger(result.away)).toBe(true)
        expect(result.home).toBeGreaterThanOrEqual(1)
        expect(result.home).toBeLessThanOrEqual(99)
        expect(result.away).toBeGreaterThanOrEqual(1)
        expect(result.away).toBeLessThanOrEqual(99)
        expect(result.home + result.away).toBe(100)
      }
    }
  })
})

describe('recordLine', () => {
  it('labels previous season', () => {
    expect(recordLine(t(37, 45, 9), '2025–26 final', true)).toBe('2025–26: 37-45')
    expect(recordLine(t(3, 1, 2), '2026–27', false)).toBe('3-1')
    expect(recordLine(undefined, '', false)).toBeNull()
  })

  it('tolerates a missing season label when isPrev is true — falls back to the record', () => {
    expect(recordLine(t(3, 1, 2), null, true)).toBe('3-1')
    expect(recordLine(t(3, 1, 2), undefined, true)).toBe('3-1')
    expect(recordLine(t(3, 1, 2), '', true)).toBe('3-1')
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
