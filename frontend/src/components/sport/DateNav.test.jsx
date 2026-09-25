import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
vi.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ playGlassClick: vi.fn(), playThud: vi.fn() }) }))
import { DateNav } from './DateNav'

const DAY = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d+ [A-Z][a-z]{2}$/
const strip = (current) => {
  render(<MemoryRouter><DateNav current={current} /></MemoryRouter>)
  return screen.getAllByRole('link', { name: DAY })
}
const selected = (days) => days.filter((d) => d.getAttribute('aria-current') === 'date')

describe('DateNav', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-25T14:00:00Z')) })
  afterEach(() => vi.useRealTimers())

  it('today: starts on today (ET) and runs forward 7 days', () => {
    const days = strip('2026-09-25')
    expect(days).toHaveLength(7)
    expect(days[0]).toHaveAccessibleName('Fri 25 Sep')
    expect(days[6]).toHaveAccessibleName('Thu 1 Oct')
    expect(selected(days).map((d) => d.getAttribute('aria-label'))).toEqual(['Fri 25 Sep'])
  })

  it('a date beyond this week pages forward so the selected day is visible', () => {
    const days = strip('2026-10-03')
    expect(days).toHaveLength(7)
    expect(days[0]).toHaveAccessibleName('Fri 2 Oct')
    expect(days[6]).toHaveAccessibleName('Thu 8 Oct')
    expect(selected(days).map((d) => d.getAttribute('aria-label'))).toEqual(['Sat 3 Oct'])
    expect(screen.getByRole('link', { name: 'Previous week' })).toHaveAttribute('href', '/scoreboard?date=2026-09-25')
    expect(screen.getByRole('link', { name: 'Next week' })).toHaveAttribute('href', '/scoreboard?date=2026-10-09')
    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute('href', '/scoreboard?date=2026-09-25')
  })

  it('a past date pages backward in the same 7-day steps', () => {
    const days = strip('2026-09-20')
    expect(days[0]).toHaveAccessibleName('Fri 18 Sep')
    expect(days[6]).toHaveAccessibleName('Thu 24 Sep')
    expect(selected(days).map((d) => d.getAttribute('aria-label'))).toEqual(['Sun 20 Sep'])
  })
})
