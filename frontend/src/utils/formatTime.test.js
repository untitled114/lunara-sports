import { describe, it, expect } from 'vitest'
import { formatTipWhen } from './formatTime'
import gamesOct03 from '@/test/fixtures/gamesOct03.json'
import gamesJan15Final from '@/test/fixtures/gamesJan15Final.json'

// Real tips: MIA @ TOR, Sat Oct 3 2026 at 7:00 PM ET; MEM @ ORL, Thu Jan 15 2026 at 2:00 PM ET.
const evening = gamesOct03.data[0].start_time
const afternoon = gamesJan15Final.data[0].start_time

describe('formatTipWhen', () => {
  it('"Tonight" for an evening game today, "Today" for an afternoon one', () => {
    expect(formatTipWhen(evening, 'ET', new Date('2026-10-03T16:00:00Z'))).toBe('Tonight, 7:00 PM ET')
    expect(formatTipWhen(afternoon, 'ET', new Date('2026-01-15T15:00:00Z'))).toBe('Today, 2:00 PM ET')
  })

  it('the weekday on any other day', () => {
    expect(formatTipWhen(evening, 'ET', new Date('2026-10-02T16:00:00Z'))).toBe('Sat, 7:00 PM ET')
  })

  it('uses the chosen time zone for both the day and the time', () => {
    // 7:00 PM ET is 4:00 PM PT: an afternoon game on the west coast.
    expect(formatTipWhen(evening, 'PT', new Date('2026-10-03T16:00:00Z'))).toBe('Today, 4:00 PM PT')
  })

  it('"Local" shows no zone label: the time is the visitor\'s own', () => {
    expect(formatTipWhen(evening, 'local', new Date('2026-10-03T16:00:00Z'))).toMatch(/^(Tonight|Today|Sat), \d{1,2}:\d{2} [AP]M$/)
  })

  it('"TBD" with no start time', () => {
    expect(formatTipWhen(null, 'ET')).toBe('TBD')
  })
})
