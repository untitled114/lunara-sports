import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DateNav } from './DateNav'

const DAY = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d+ [A-Z][a-z]{2}$/
const strip = (current, count) => {
  render(<MemoryRouter><DateNav current={current} count={count} /></MemoryRouter>)
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

  it('the seven days have a fixed width from sm up', () => {
    for (const day of strip('2026-09-25')) expect(day).toHaveClass('sm:w-[84px]', 'sm:flex-none')
  })

  it('under the title: the date and the number of games ("Fri, Sep 25, 9 games")', () => {
    strip('2026-09-25', 9)
    expect(screen.getByText('Fri, Sep 25, 9 games')).toBeInTheDocument()
  })

  it('one game reads "1 game"; with no count only the date', () => {
    strip('2026-09-25', 1)
    expect(screen.getByText('Fri, Sep 25, 1 game')).toBeInTheDocument()
  })
})
