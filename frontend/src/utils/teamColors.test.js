import { describe, it, expect } from 'vitest'
import { TEAM_COLORS, teamWash, luminance, WASH_MAX_ALPHA, WASH_MAX_LUMINANCE } from './teamColors'

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
const mix = (top, base, a) => top.map((v, i) => Math.round(base[i] + (v - base[i]) * a))
const SURFACE_1 = rgb('#12151C')
const TEXT_2 = rgb('#A3A9B7')
const TEXT_3 = rgb('#838A97')

describe('teamWash (game header team washes, ruling D31)', () => {
  it('uses the team primary from TEAM_COLORS, and nothing for an unknown team', () => {
    expect(teamWash('TOR').color).toBe(TEAM_COLORS.TOR.primary)
    expect(teamWash('XYZ')).toBeNull()
  })

  it.each(Object.keys(TEAM_COLORS))('%s keeps header text at AA on its wash', (abbrev) => {
    const { color, strength } = teamWash(abbrev)
    const alpha = parseInt(strength, 10) / 100
    expect(alpha).toBeGreaterThanOrEqual(0)
    expect(alpha).toBeLessThanOrEqual(WASH_MAX_ALPHA)
    const bg = mix(rgb(color), SURFACE_1, alpha)
    expect(luminance(bg)).toBeLessThanOrEqual(WASH_MAX_LUMINANCE + 1e-9)
    expect(contrast(TEXT_2, bg)).toBeGreaterThanOrEqual(4.5) // records, venue
    expect(contrast(TEXT_3, bg)).toBeGreaterThanOrEqual(3) // the loser's large score
  })

  it('caps a pale primary (SA silver) well below a dark one (DEN navy)', () => {
    expect(parseInt(teamWash('SA').strength, 10)).toBeLessThan(parseInt(teamWash('DEN').strength, 10))
  })
})
