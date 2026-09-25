import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
const css = readFileSync(resolve(__dirname, 'tokens.css'), 'utf8')
const expected = {
  '--surface-0': '#0B0D12', '--surface-1': '#12151C', '--surface-2': '#1A1E27',
  '--border': '#262B36', '--border-strong': '#323846', '--text-1': '#E8EAF0',
  '--text-2': '#A3A9B7', '--text-3': '#6B7280', '--accent': '#6366F1',
  '--accent-hover': '#7C7FF3', '--live': '#22C55E', '--loss': '#EF4444', '--warn': '#F59E0B',
}
describe('tokens.css', () => {
  it.each(Object.entries(expected))('%s is %s', (name, value) => {
    expect(css).toMatch(new RegExp(`${name}:\\s*${value};`, 'i'))
  })
  it('label is the only tracked style and uses 0.06em', () => {
    const tracked = [...css.matchAll(/letter-spacing:\s*([0-9.]+)em/g)].map((m) => m[1])
    expect(tracked).toEqual(['0.06'])
  })
})

describe('legacy styles.css', () => {
  const legacyCss = readFileSync(resolve(__dirname, '../styles.css'), 'utf8')
  const tokenNames = Object.keys(expected)

  it('declares none of the token custom properties (would shadow/cycle tokens.css)', () => {
    const declared = [...legacyCss.matchAll(/^\s*(--[a-zA-Z0-9-]+)\s*:/gm)].map((m) => m[1])
    const collisions = declared.filter((name) => tokenNames.includes(name))
    expect(collisions).toEqual([])
  })
})
