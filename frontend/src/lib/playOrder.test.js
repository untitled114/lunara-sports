import { describe, it, expect } from 'vitest'
import { mergePlays, newestFirst, oldestFirst, playTime } from './playOrder'

describe('play order', () => {
  it("uses ESPN's list position when a play has one, else the sequence number", () => {
    expect(playTime({ espn_order: 5, sequence_number: 9 })).toBe(5)
    expect(playTime({ espn_order: null, sequence_number: 9 })).toBe(9)
    expect(playTime({ sequence_number: 9 })).toBe(9)
  })

  it('sorts oldest or newest first', () => {
    const plays = [{ espn_order: 2 }, { espn_order: 0 }, { espn_order: 1 }]
    expect([...plays].sort(oldestFirst).map(playTime)).toEqual([0, 1, 2])
    expect([...plays].sort(newestFirst).map(playTime)).toEqual([2, 1, 0])
  })

  it('keeps a late play that took over a shown play\'s number, and the shown play too', () => {
    const shown = [
      { id: 11, sequence_number: 3, espn_order: 3 },
      { id: 10, sequence_number: 2, espn_order: 2 },
    ]
    // ESPN inserted play 12 before play 10 and gave it play 10's old number
    const late = { id: 12, sequence_number: 2, espn_order: 1 }
    expect(mergePlays(shown, [late]).map((p) => p.id)).toEqual([11, 10, 12])
  })

  it('a renumbered copy of a play replaces the old one', () => {
    const merged = mergePlays([{ id: 10, sequence_number: 2, espn_order: 1 }], [
      { id: 10, sequence_number: 3, espn_order: 2 },
    ])
    expect(merged).toEqual([{ id: 10, sequence_number: 3, espn_order: 2 }])
  })
})
