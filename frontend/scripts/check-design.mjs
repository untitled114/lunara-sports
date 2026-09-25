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
const EFFECT_OK = [
  'src/components/layout/AppLayout.jsx',
  'src/styles/tokens.css',
  'src/components/sport/GameCard.jsx',
  'src/components/sport/BottomNav.jsx',
]
// rgb()/rgba()/hsl()/hsla() literals: only the token file gets to define raw
// color functions; everywhere else should reference a --token instead.
const COLORFN_OK = ['src/styles/tokens.css']
// color-mix(...) calls that don't reference a --token (ruling D16): only the token
// file gets to mix colors from anything other than a --token (its color-mix calls
// already reference --tokens as-is, so this is a defensive allowlist, not a live gap).
const COLORMIX_OK = ['src/styles/tokens.css']
// "text-white" is only allowed when it's paired with "bg-accent-fill" (the
// filled-button token, #4F46E5 / --accent-fill) on the same line — that
// button needs white text for contrast. Plain "bg-accent" does NOT grant the
// exception: --accent is no longer a fill color, so a line pairing
// text-white with bare bg-accent is stale and should still be flagged.
// Every other white-on-something case should use a --text token instead.
const PALETTE_WHITE_ON_ACCENT = /^text-white(\/\d+)?$/
const ACCENT_FILL_LINE = 'bg-accent-fill'
const PALETTE_PREFIX =
  'text|bg|border|ring|fill|stroke|from|via|to|outline|shadow|decoration|divide|placeholder'
const PALETTE_COLOR =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'
// Everything except `nodes?`/`Nodes?`, which moved to BANNED_NODE below so it
// can be case-sensitive instead of riding the shared `gi` flag.
const BANNED =
  /\b(telemetry|uplink|protocol|decrypt\w*|sector|matrix|console|neural|quantum|synthesi\w*|intelligence station|arena console|sync failure|re-establish)\b/gi
// Only the capitalized/all-caps copy forms are banned ("Node", "Nodes",
// "NODE", "NODES") — never the lowercase JS identifier ("const node",
// "node.contains", "PropTypes.node"), which is why this is a separate,
// case-sensitive regex instead of folding into BANNED's `gi` flag.
const BANNED_NODE = /\b(Node|Nodes|NODE|NODES)\b/g
const RULES = {
  // Exact CSS hex lengths only (3/4/6/8 digits), tried longest-first so an
  // 8-digit run isn't swallowed as a 6-digit run plus 2 leftover chars. The
  // trailing `(?!-)` keeps this off things like an anchor id `#123abc-id`:
  // without it, the 6-digit alt would match "#123abc" and stop at the `-`,
  // which is a real `\b` transition but not a color literal.
  hex: /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b(?!-)/g,
  heavy: /\bfont-(black|extrabold)\b|\bfont-\[(?:800|900)\]/g,
  italic: /\bitalic\b/g,
  tracking: /tracking-(\[(0\.(0[9]|[1-9]\d*)|[1-9]\d*(\.\d+)?)em\]|widest|wider)/g,
  radius: /rounded-(\[(1[7-9]|[2-9]\d|\d{3,})px\]|\[\d+(\.\d+)?rem\]|2xl|3xl|full)/g,
  // `blur-\[\w+\]` is pulled out of the trailing-`\b` group: that match always
  // ends on `]` (non-word), so a trailing `\b` right after it can never be a
  // real word boundary and the alternative would never match anything (e.g.
  // "blur-[2px]"). It keeps its own leading `\b` (before "blur") instead.
  effect:
    /\bblur-\[\w+\]|\b(bg-gradient-to-\w+|bg-linear-\w+|backdrop-blur(-\w+)?|radial-gradient|linear-gradient|liquid-mirror|gloss-sweep|rim-glow[\w-]*)\b/g,
  colorFn: /\b(rgba?|hsla?)\(/gi,
  // Raw Tailwind palette utilities: `text-white`/`bg-black` (+ optional
  // /opacity), or `bg-red-500`-style `prefix-color-shade` (+ optional
  // /opacity). Tokens (surface/border/text/accent/live/loss/warn) own colors
  // instead — these are all migration debt.
  palette: new RegExp(
    `\\b(?:${PALETTE_PREFIX})-(?:(?:white|black)(?:/\\d+)?|(?:${PALETTE_COLOR})-\\d{2,3}(?:/\\d+)?)\\b`,
    'g'
  ),
  // Ruling D16: CSS named colors inside inline style values (e.g. `style={{
  // backgroundColor: 'white' }}`) are the same raw-color debt as the `palette` rule's
  // Tailwind classes, just written where that rule can't see it. Property name is
  // whatever the coordinator specified; deliberately narrow (doesn't try to catch every
  // CSS color keyword) — this closes the specific gap that showed up in review, not a
  // general inline-style linter.
  namedColor:
    /\b(color|background|backgroundColor|borderColor|fill|stroke)\s*:\s*['"](white|black|red|blue|green|yellow|gray|grey|orange|purple|pink)['"]/g,
  // Ruling D16: color-mix(...) that doesn't reference a --token anywhere in its
  // arguments (e.g. `color-mix(in srgb, black 60%, transparent)`) is the same raw-color
  // debt as a literal hex or rgba() — it just evades the `hex`/`colorFn` rules because
  // it's neither. The negative-lookahead repetition matches a whole `color-mix(...)`
  // call only when `var(--` never appears inside it; if it does, the lookahead blocks
  // consuming that position and the match can never reach the closing `)`, so the call
  // is (correctly) not counted. Doesn't handle a call with its own nested, non-token
  // parens (e.g. a bare `rgba(...)` mixed in) — not a pattern used in this codebase.
  colorMix: /color-mix\((?:(?!var\(--)[^)])*\)/g,
}

export function scan(text, path) {
  const out = {}
  const add = (k, n) => { if (n) out[k] = (out[k] || 0) + n }
  for (const line of text.split('\n')) {
    if (line.includes('design-check-allow')) continue
    for (const [k, re] of Object.entries(RULES)) {
      if (k === 'hex' && HEX_OK.includes(path)) continue
      if (k === 'effect' && EFFECT_OK.includes(path)) continue
      if (k === 'colorFn' && COLORFN_OK.includes(path)) continue
      if (k === 'colorMix' && COLORMIX_OK.includes(path)) continue
      const matches = line.match(re) || []
      const n =
        k === 'palette'
          ? matches.filter((m) => !(PALETTE_WHITE_ON_ACCENT.test(m) && line.includes(ACCENT_FILL_LINE))).length
          : matches.length
      add(k, n)
    }
    // console.<anything> (not just log/error/warn/info/debug) and
    // PropTypes.node are code identifiers, not banned copy — scrub them
    // before matching. BANNED_NODE never matches lowercase "node" anyway
    // (see comment above), so this scrub only still matters for `console`.
    const scrubbed = line.replace(/\bconsole\.\w+\b/g, '').replace(/PropTypes\.node/g, '')
    add('banned', (scrubbed.match(BANNED) || []).length + (scrubbed.match(BANNED_NODE) || []).length)
  }
  return out
}

export function files(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) return ['test', 'tests', '__tests__'].includes(f) ? [] : files(p)
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
