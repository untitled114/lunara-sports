// scripts/check-design.test.js
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { describe, it, expect } from 'vitest'
import { scan, files } from './check-design.mjs'
describe('design check', () => {
  it('flags each rule', () => {
    // "Node" is capitalized here (not "node"): the banned-copy rule for
    // node/nodes only fires on capitalized/all-caps forms (see the
    // "banned node" describe block below), so a lowercase "node" would no
    // longer count toward this rule and this fixture would under-report.
    const t = `<div className="font-black italic tracking-[0.3em] rounded-[2.5rem] bg-[#050a18] bg-gradient-to-r backdrop-blur-xl">Telemetry Node</div>`
    expect(scan(t, 'src/pages/X.jsx')).toEqual({
      hex: 1, heavy: 1, italic: 1, tracking: 1, radius: 1, effect: 2, banned: 2,
    })
  })
  it('allows tokens, small tracking, console calls, PropTypes.node, allow marker', () => {
    const t = `tracking-[0.06em] rounded-lg console.error(x) PropTypes.node\n'telemetry services' // design-check-allow`
    expect(scan(t, 'src/pages/Y.jsx')).toEqual({})
  })
  it('skips hex in token and team-color files', () => {
    expect(scan('#FFFFFF', 'src/utils/teamColors.js')).toEqual({})
    expect(scan('#0B0D12', 'src/styles/tokens.css')).toEqual({})
  })
  it('allows effects in the allow-listed files only', () => {
    expect(scan('backdrop-blur-md', 'src/components/layout/AppLayout.jsx')).toEqual({})
  })

  // Edge cases on the tracking rule: small/negative tracking and Tailwind's
  // built-in tight presets stay allowed; anything at or above 0.1em, or the
  // widest/wider presets, gets flagged.
  it('does not flag tracking-tight or tracking-tighter (not in the ratio table)', () => {
    expect(scan('tracking-tight', 'src/pages/Z.jsx')).toEqual({})
    expect(scan('tracking-tighter', 'src/pages/Z.jsx')).toEqual({})
  })
  it('flags tracking-[0.1em] and tracking-[1em] (at/above the 0.06em label spec)', () => {
    expect(scan('tracking-[0.1em]', 'src/pages/Z.jsx')).toEqual({ tracking: 1 })
    expect(scan('tracking-[1em]', 'src/pages/Z.jsx')).toEqual({ tracking: 1 })
  })
  it('flags tracking-widest', () => {
    expect(scan('tracking-widest', 'src/pages/Z.jsx')).toEqual({ tracking: 1 })
  })

  // Edge case on the effect rule: bare `blur-sm`/`blur-xl` (no brackets) is a
  // common Tailwind utility for images/skeletons and is intentionally not
  // flagged — only the bracketed arbitrary form (`blur-[...]`) and any
  // `backdrop-blur*` variant count as an "effect".
  it('does not flag bare blur-sm/blur-xl (only blur-[..] and backdrop-blur are effects)', () => {
    expect(scan('blur-sm', 'src/pages/Z.jsx')).toEqual({})
    expect(scan('blur-xl', 'src/pages/Z.jsx')).toEqual({})
  })
  it('flags bracketed blur-[..] as an effect', () => {
    expect(scan('blur-[2px]', 'src/pages/Z.jsx')).toEqual({ effect: 1 })
  })

  // Fix-round addition: these four decorative classes weren't in the original
  // effect list (only liquid-mirror/gloss-sweep/rim-glow-* were), even though
  // they're the same kind of glass/bevel/inset-shadow decoration the rule
  // exists to catch.
  it('flags liquid-glass, glass-pill, luxury-edge, and deboss as effects', () => {
    expect(scan('liquid-glass', 'src/pages/Z.jsx')).toEqual({ effect: 1 })
    expect(scan('glass-pill', 'src/pages/Z.jsx')).toEqual({ effect: 1 })
    expect(scan('luxury-edge', 'src/pages/Z.jsx')).toEqual({ effect: 1 })
    expect(scan('deboss', 'src/pages/Z.jsx')).toEqual({ effect: 1 })
    expect(scan('liquid-glass glass-pill luxury-edge deboss', 'src/pages/Z.jsx')).toEqual({ effect: 4 })
  })

  it('design-check-allow marker only suppresses its own line', () => {
    const t = `telemetry\ntelemetry // design-check-allow`
    expect(scan(t, 'src/pages/Z.jsx')).toEqual({ banned: 1 })
  })

  // ── hardening (ruling D6) ────────────────────────────────────────────────

  describe('hex: 3/4/6/8-digit forms', () => {
    it('flags #fff, #ffff, #ffffff, #ffffff80', () => {
      expect(scan('#fff #ffff #ffffff #ffffff80', 'src/pages/Z.jsx')).toEqual({ hex: 4 })
    })
    it('does not flag a hex-looking anchor id like #123abc-id', () => {
      expect(scan('#123abc-id', 'src/pages/Z.jsx')).toEqual({})
    })
  })

  describe('colorFn: rgb()/rgba()/hsl()/hsla()', () => {
    it('flags all four color functions', () => {
      const t = 'rgb(0,0,0) rgba(0,0,0,.5) hsl(210,50%,50%) hsla(210,50%,50%,.5)'
      expect(scan(t, 'src/pages/Z.jsx')).toEqual({ colorFn: 4 })
    })
    it('allows color functions only in tokens.css', () => {
      expect(scan('rgba(0,0,0,.5)', 'src/styles/tokens.css')).toEqual({})
    })
  })

  describe('palette: raw Tailwind palette colors', () => {
    it('flags prefix-color-shade and prefix-white/black forms', () => {
      expect(scan('bg-red-500', 'src/pages/Z.jsx')).toEqual({ palette: 1 })
      expect(scan('border-slate-200/50', 'src/pages/Z.jsx')).toEqual({ palette: 1 })
      expect(scan('bg-black/60', 'src/pages/Z.jsx')).toEqual({ palette: 1 })
    })
    it('flags text-white when nothing pairs it with bg-accent-fill', () => {
      expect(scan('text-white', 'src/pages/Z.jsx')).toEqual({ palette: 1 })
    })
    it('allows text-white only when bg-accent-fill is on the same line (filled-button contrast)', () => {
      expect(scan('className="bg-accent-fill text-white"', 'src/pages/Z.jsx')).toEqual({})
    })
    it('does NOT allow text-white paired with bare bg-accent (stale: --accent is no longer a fill)', () => {
      expect(scan('className="bg-accent text-white"', 'src/pages/Z.jsx')).toEqual({ palette: 1 })
    })
    it('the bg-accent-fill exception only covers text-white, not other palette hits on the same line', () => {
      expect(scan('bg-accent-fill text-white bg-red-500', 'src/pages/Z.jsx')).toEqual({ palette: 1 })
    })
    it('does not flag the accent-fill tokens themselves (bg-accent-fill, hover:bg-accent-fill-hover)', () => {
      expect(scan('bg-accent-fill hover:bg-accent-fill-hover', 'src/pages/Z.jsx')).toEqual({})
    })
  })

  describe('heavy: arbitrary font-weight', () => {
    it('flags font-[800] and font-[900]', () => {
      expect(scan('font-[800] font-[900]', 'src/pages/Z.jsx')).toEqual({ heavy: 2 })
    })
  })

  describe('banned node: capitalized/all-caps copy only', () => {
    it('flags Node, Nodes, NODE, NODES', () => {
      expect(scan('Node Nodes NODE NODES', 'src/pages/Z.jsx')).toEqual({ banned: 4 })
    })
    it('never flags the lowercase JS identifier', () => {
      const t = `const node = ref.current\nnode.contains(x)`
      expect(scan(t, 'src/pages/Z.jsx')).toEqual({})
    })
  })

  describe('banned console: scrub every console.<method>, not just five', () => {
    it('allows console.table/group/dir (and still allows log/error/warn/info/debug)', () => {
      const t = "console.table(x) console.group('a') console.dir(y) console.log(z) console.trace()"
      expect(scan(t, 'src/pages/Z.jsx')).toEqual({})
    })
    it('still flags bare "console" used as prose', () => {
      expect(scan('reopen the console', 'src/pages/Z.jsx')).toEqual({ banned: 1 })
    })
  })

  // ── hardening (ruling D16) ───────────────────────────────────────────────

  describe('namedColor: CSS named colors inside inline style values', () => {
    it('flags backgroundColor/color/borderColor/fill/stroke set to a named color', () => {
      expect(scan(`style={{ backgroundColor: 'white' }}`, 'src/pages/Z.jsx')).toEqual({ namedColor: 1 })
      expect(scan(`style={{ color: 'black' }}`, 'src/pages/Z.jsx')).toEqual({ namedColor: 1 })
      expect(scan(`style={{ borderColor: "red" }}`, 'src/pages/Z.jsx')).toEqual({ namedColor: 1 })
      expect(scan(`style={{ fill: 'blue', stroke: 'green' }}`, 'src/pages/Z.jsx')).toEqual({ namedColor: 2 })
    })
    it('allows a --token or any other CSS value in the same style props', () => {
      expect(scan(`style={{ backgroundColor: 'var(--text-1)', color: 'var(--surface-0)' }}`, 'src/pages/Z.jsx')).toEqual({})
    })
    it('does not flag unrelated uses of the word "color" (prop name, comment)', () => {
      expect(scan(`const color = getTeamColor(abbrev)`, 'src/pages/Z.jsx')).toEqual({})
    })
  })

  describe('colorMix: color-mix(...) that never references a --token', () => {
    it('flags a color-mix() built from named colors only', () => {
      expect(scan(`color-mix(in srgb, black 60%, transparent)`, 'src/pages/Z.jsx')).toEqual({ colorMix: 1 })
    })
    it('allows a color-mix() that references a --token anywhere in its arguments', () => {
      expect(scan(`color-mix(in srgb, var(--surface-0) 60%, transparent)`, 'src/pages/Z.jsx')).toEqual({})
      expect(scan(`color-mix(in srgb, var(--live) 40%, var(--border))`, 'src/pages/Z.jsx')).toEqual({})
    })
    it('allows color-mix in tokens.css regardless', () => {
      expect(scan(`color-mix(in srgb, black 40%, white)`, 'src/styles/tokens.css')).toEqual({})
    })
    it('counts more than one non-token color-mix() call on a line', () => {
      const t = `color-mix(in srgb, black 60%, transparent) color-mix(in srgb, white 20%, transparent)`
      expect(scan(t, 'src/pages/Z.jsx')).toEqual({ colorMix: 2 })
    })
  })

  describe('files(): directory traversal', () => {
    it('skips test/, tests/, and __tests__/ directories', () => {
      const root = mkdtempSync(join(tmpdir(), 'design-check-'))
      try {
        mkdirSync(join(root, 'keep'))
        writeFileSync(join(root, 'keep', 'A.jsx'), 'export default 1\n')
        for (const skipped of ['test', 'tests', '__tests__']) {
          mkdirSync(join(root, skipped))
          writeFileSync(join(root, skipped, 'Skipped.jsx'), 'export default 1\n')
        }
        const found = files(root).map((p) => relative(root, p))
        expect(found).toEqual([join('keep', 'A.jsx')])
      } finally {
        rmSync(root, { recursive: true, force: true })
      }
    })
  })
})
