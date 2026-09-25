#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Derived via node:path.dirname (not `new URL('..', import.meta.url)`): under
// vitest's jsdom test environment, the global `URL` constructor is jsdom's
// polyfill, which mis-resolves a relative reference against a `file:` base
// (it falls back to jsdom's default http://localhost origin). fileURLToPath
// on a plain string is unaffected since it doesn't go through globalThis.URL.
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const HEX_OK = ['src/styles/tokens.css', 'src/utils/teamColors.js']
// glass on top bar/bottom tabs; grain on page background; live glow in GameCard
const EFFECT_OK = ['src/components/layout/AppLayout.jsx', 'src/styles/tokens.css', 'src/components/sport/GameCard.jsx']
const BANNED = /\b(telemetry|uplink|protocol|decrypt\w*|sector|nodes?|matrix|console|neural|quantum|synthesi\w*|intelligence station|arena console|sync failure|re-establish)\b/gi
const RULES = {
  hex: /#[0-9a-fA-F]{6}\b/g,
  heavy: /\bfont-(black|extrabold)\b/g,
  italic: /\bitalic\b/g,
  tracking: /tracking-(\[(0\.(0[9]|[1-9]\d*)|[1-9]\d*(\.\d+)?)em\]|widest|wider)/g,
  radius: /rounded-(\[(1[7-9]|[2-9]\d|\d{3,})px\]|\[\d+(\.\d+)?rem\]|2xl|3xl|full)/g,
  // `blur-\[\w+\]` is pulled out of the trailing-`\b` group: that match always
  // ends on `]` (non-word), so a trailing `\b` right after it can never be a
  // real word boundary and the alternative would never match anything (e.g.
  // "blur-[2px]"). It keeps its own leading `\b` (before "blur") instead.
  effect:
    /\bblur-\[\w+\]|\b(bg-gradient-to-\w+|bg-linear-\w+|backdrop-blur(-\w+)?|radial-gradient|linear-gradient|liquid-mirror|gloss-sweep|rim-glow[\w-]*)\b/g,
}

export function scan(text, path) {
  const out = {}
  const add = (k, n) => { if (n) out[k] = (out[k] || 0) + n }
  for (const line of text.split('\n')) {
    if (line.includes('design-check-allow')) continue
    for (const [k, re] of Object.entries(RULES)) {
      if (k === 'hex' && HEX_OK.includes(path)) continue
      if (k === 'effect' && EFFECT_OK.includes(path)) continue
      add(k, (line.match(re) || []).length)
    }
    const scrubbed = line.replace(/\bconsole\.(log|error|warn|info|debug)\b/g, '').replace(/PropTypes\.node/g, '')
    add('banned', (scrubbed.match(BANNED) || []).length)
  }
  return out
}

function files(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) return f === 'test' ? [] : files(p)
    return /\.(jsx?|css)$/.test(f) && !/\.test\.jsx?$/.test(f) ? [p] : []
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const baseFile = join(ROOT, 'design-check-baseline.json')
  const base = existsSync(baseFile) ? JSON.parse(readFileSync(baseFile, 'utf8')) : {}
  const now = {}
  for (const f of files(join(ROOT, 'src'))) {
    const rel = relative(ROOT, f)
    const r = scan(readFileSync(f, 'utf8'), rel)
    if (Object.keys(r).length) now[rel] = r
  }
  if (process.argv.includes('--update-baseline')) {
    writeFileSync(baseFile, JSON.stringify(now, null, 2) + '\n')
    console.log(`baseline written: ${Object.keys(now).length} files`)
    process.exit(0)
  }
  const strict = process.argv.includes('--strict')
  const errors = []
  for (const [f, r] of Object.entries(now)) {
    for (const [k, n] of Object.entries(r)) {
      const allowed = strict ? 0 : (base[f]?.[k] ?? 0)
      if (n > allowed) errors.push(`${f}: ${k} ${n} > ${allowed}`)
    }
  }
  for (const f of Object.keys(base)) if (!now[f]) errors.push(`${f}: clean now — remove it from design-check-baseline.json`)
  if (errors.length) { console.error(errors.join('\n')); process.exit(1) }
  console.log(`design check OK (${Object.keys(now).length} files still on baseline)`)
}
