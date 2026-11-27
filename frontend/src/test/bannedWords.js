import { expect } from 'vitest'

// The exact wording of check-design.mjs's BANNED regex (single words / phrases,
// case-insensitive), minus `node`/`nodes` which the checker treats specially
// (only capitalized copy forms are banned there) - rendered UI text never
// contains a lowercase JS identifier, so a plain case-insensitive check is fine.
export const BANNED_WORDS = [
  'telemetry',
  'uplink',
  'protocol',
  'decrypt',
  'sector',
  'matrix',
  'console',
  'neural',
  'quantum',
  'synthesi',
  'intelligence station',
  'arena console',
  'sync failure',
  're-establish',
  'node',
]

export function assertNoBannedWords(text, { allow = [] } = {}) {
  const lower = text.toLowerCase()
  for (const word of BANNED_WORDS) {
    if (allow.includes(word)) continue
    expect(lower).not.toContain(word)
  }
}
