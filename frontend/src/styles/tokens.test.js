import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
const css = readFileSync(resolve(__dirname, 'tokens.css'), 'utf8')
const expected = {
  '--surface-0': '#0B0B0C', '--surface-1': '#19191C', '--surface-2': '#232327',
  '--surface-card': '#19191C', '--border': '#3A3A40', '--border-strong': '#4A4A52',
  '--text-1': '#F2F2F3', '--text-2': '#B0B0B6', '--text-3-surface': '#9A9AA1',
  '--accent': '#F26B1D', '--accent-hover': '#FF8A47', '--accent-fill': '#F26B1D',
  '--accent-fill-hover': '#FF8A47', '--accent-ink': '#111111',
  '--live': '#3DD68C', '--loss': '#F2555A', '--warn': '#F59E0B',
  '--info': '#60A5FA',
  '--glow-1': '#F26B1D', '--glow-2': '#10B981', '--glow-3': '#F59E0B',
}
const hex = (name) => css.match(new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`))[1]
const lum = (h) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}
// The size a utility sets, in px, read from its rule.
const sizeOf = (cls) => Number(css.match(new RegExp(`\\.${cls}\\s*\\{[^}]*font-size:\\s*(\\d+)px`))[1])
describe('tokens.css', () => {
  it.each(Object.entries(expected))('%s is %s', (name, value) => {
    expect(css).toMatch(new RegExp(`${name}:\\s*${value};`, 'i'))
  })
  it('no text style is letter-spaced (labels are normal case now)', () => {
    const tracked = [...css.matchAll(/letter-spacing:\s*([0-9.]+)em/g)].map((m) => m[1])
    expect(tracked).toEqual([])
    const label = css.match(/\.t-label\s*\{([^}]*)\}/)[1]
    expect(label).not.toMatch(/text-transform/)
  })
  it('text and accents are readable on a box (contrast at least 4.5)', () => {
    for (const name of ['--text-1', '--text-2', '--text-3-surface', '--accent', '--live', '--loss']) {
      expect(contrast(hex(name), hex('--surface-card')), name).toBeGreaterThanOrEqual(4.5)
    }
    expect(contrast(hex('--accent-ink'), hex('--accent-fill'))).toBeGreaterThanOrEqual(4.5)
  })
  it('boxes are solid, not see-through', () => {
    expect(css).not.toMatch(/--surface-card:\s*color-mix/)
  })
  it('the fonts are Source Sans 3 for text and Oswald for names, scores and headings', () => {
    expect(css).toMatch(/--font-sans:\s*'Source Sans 3'/)
    expect(css).toMatch(/--font-display:\s*'Oswald'/)
  })
  it('numbers stay within the size limits', () => {
    expect(sizeOf('t-score-sm')).toBeLessThanOrEqual(18)
    expect(sizeOf('t-score')).toBeLessThanOrEqual(22)
    expect(sizeOf('t-num')).toBeLessThanOrEqual(26)
    for (const m of css.matchAll(/\.t-score-display\s*\{[^}]*font-size:\s*(\d+)px/g)) {
      expect(Number(m[1])).toBeLessThanOrEqual(36)
    }
  })
})

describe('legacy styles.css', () => {
  const legacyCss = readFileSync(resolve(__dirname, '../styles.css'), 'utf8')
  const tokenNames = Object.keys(expected)

  it('the skip link on the orange fill uses dark ink and normal case', () => {
    const rule = legacyCss.match(/\.skip-to-content\s*\{([^}]*)\}/)[1]
    expect(rule).toMatch(/color:\s*var\(--accent-ink\)/)
    expect(rule).not.toMatch(/text-transform|letter-spacing/)
  })

  it('declares none of the token custom properties (would shadow/cycle tokens.css)', () => {
    const declared = [...legacyCss.matchAll(/^\s*(--[a-zA-Z0-9-]+)\s*:/gm)].map((m) => m[1])
    const collisions = declared.filter((name) => tokenNames.includes(name))
    expect(collisions).toEqual([])
  })
})
