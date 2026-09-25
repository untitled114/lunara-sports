import { describe, it, expect } from 'vitest'
import { todayET, addDaysISO, stripDays, formatDayLabel, formatLongDay } from './et'

describe('et', () => {
  it('today in New York, not UTC', () => {
    expect(todayET(new Date('2026-09-26T02:30:00Z'))).toBe('2026-09-25') // 22:30 EDT
    expect(todayET(new Date('2026-12-01T04:59:00Z'))).toBe('2026-11-30') // 23:59 EST
  })

  it('adds calendar days across DST end without skipping', () => {
    expect(stripDays('2026-10-29')).toEqual([
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
    ])
    expect(addDaysISO('2026-03-07', 1)).toBe('2026-03-08')
    expect(addDaysISO('2026-10-03', -3)).toBe('2026-09-30')
  })

  it('labels', () => {
    expect(formatDayLabel('2026-10-03')).toEqual({ weekday: 'Sat', day: '3', month: 'Oct' })
    expect(formatLongDay('2026-10-03')).toBe('Sat, Oct 3')
  })

  it('stripDays defaults to a 7-day strip', () => {
    expect(stripDays('2026-01-01')).toHaveLength(7)
  })
})
