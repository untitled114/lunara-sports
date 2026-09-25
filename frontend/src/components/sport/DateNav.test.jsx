import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
vi.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ playGlassClick: vi.fn(), playThud: vi.fn() }) }))
import { DateNav } from './DateNav'

describe('DateNav', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-25T14:00:00Z')) })
  afterEach(() => vi.useRealTimers())
  it('starts on today (ET) and runs forward 7 days', () => {
    render(<MemoryRouter><DateNav current="2026-10-03" /></MemoryRouter>)
    const days = screen.getAllByRole('link', { name: /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d+ [A-Z][a-z]{2}$/ })
    expect(days[0]).toHaveAccessibleName('Fri 25 Sep')
    expect(days).toHaveLength(7)
    expect(screen.getByRole('link', { name: 'Thu 1 Oct' })).toBeInTheDocument()
  })
})
