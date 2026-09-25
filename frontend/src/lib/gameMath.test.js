import { describe, it, expect } from 'vitest'
import { seedBadge, winProbability, recordLine } from './gameMath'

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
  it('ratio of win pcts, integer percents summing to 100', () => {
    expect(winProbability(t(45, 37, 5), t(37, 45, 9))).toEqual({ home: 55, away: 45 })
  })

  it('hidden without data — never 100/0', () => {
    expect(winProbability(t(0, 0, null), t(10, 5, 3))).toBeNull()
    expect(winProbability(undefined, t(10, 5, 3))).toBeNull()
    expect(winProbability(t(0, 10, 15), t(0, 10, 15))).toBeNull() // both 0% → no basis
  })
})

describe('recordLine', () => {
  it('labels previous season', () => {
    expect(recordLine(t(37, 45, 9), '2025–26 final', true)).toBe('2025–26: 37-45')
    expect(recordLine(t(3, 1, 2), '2026–27', false)).toBe('3-1')
    expect(recordLine(undefined, '', false)).toBeNull()
  })
})
