// scripts/check-design.test.js
import { describe, it, expect } from 'vitest'
import { scan } from './check-design.mjs'
describe('design check', () => {
  it('flags each rule', () => {
    const t = `<div className="font-black italic tracking-[0.3em] rounded-[2.5rem] bg-[#050a18] bg-gradient-to-r backdrop-blur-xl">Telemetry node</div>`
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

  it('design-check-allow marker only suppresses its own line', () => {
    const t = `telemetry\ntelemetry // design-check-allow`
    expect(scan(t, 'src/pages/Z.jsx')).toEqual({ banned: 1 })
  })
})
