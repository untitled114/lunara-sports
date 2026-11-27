import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
vi.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ timezone: 'ET' }) }))
import { GameCard } from './GameCard'
import { gameStatusText } from '@/lib/gameMath'
import { formatGameTime } from '@/utils/formatTime'
import { buildStandingsLookup } from '@/services/api'
// Real captures: tonight's slate (GET /games/?game_date=2026-11-25, SA @ POR live in the 4th
// at 3:41), the 2026-27 standings of the same night, and a real scheduled game (MIA @ TOR,
// GET /games/?game_date=2026-10-03).
import gamesLive from '@/test/fixtures/games-20261125-live.json'
import STANDINGS from '@/test/fixtures/standings-20261126.json'
import gamesOct03 from '@/test/fixtures/gamesOct03.json'

const records = buildStandingsLookup(STANDINGS.data)
const saPor = gamesLive.data.find((g) => g.away_team === 'SA' && g.home_team === 'POR')
const final = gamesLive.data.find((g) => g.home_team === 'PHI')
const scheduled = gamesOct03.data[0]
const fmt = (iso) => formatGameTime(iso, 'ET')
const box = (game, props = {}) => render(<MemoryRouter><GameCard game={game} records={records} {...props} /></MemoryRouter>)

describe('GameCard (compact)', () => {
  it('no "at" divider, no win probability, no seed badges, no streaks, even with full standings', () => {
    // The lookup carries seeds and streaks; the old box drew them from the standings it was given.
    const { container } = box(scheduled, { standings: records, standingsMeta: { seasonLabel: '2026-27', isPrev: false } })
    expect(screen.queryByText(/^at$/i)).toBeNull()
    expect(screen.queryByText(/win probability|based on/i)).toBeNull()
    expect(screen.queryByText(/#\d/)).toBeNull()
    expect(container.textContent).not.toMatch(/(MIA|TOR) [WL]\d+/)
  })

  it('the whole box is one link to the game', () => {
    const { container } = box(saPor)
    const links = container.querySelectorAll('a')
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', `/game/${saPor.id}`)
  })

  it('the status line is the shared status words, green while live', () => {
    box(saPor)
    const live = screen.getByText(gameStatusText(saPor, fmt))
    expect(live).toHaveTextContent('4th 3:41')
    expect(live).toHaveClass('text-live')
  })

  it('finals read "Final"; scheduled games show the tip time in the time zone setting', () => {
    box(final)
    expect(screen.getByText('Final')).not.toHaveClass('text-live')
    box(scheduled)
    expect(screen.getByText(gameStatusText(scheduled, fmt))).toHaveTextContent('7:00 PM ET')
  })

  it('two team rows with records; scores use t-score; the trailing team is dimmed', () => {
    box(saPor)
    const link = screen.getByRole('link')
    for (const abbrev of ['SA', 'POR']) {
      expect(within(link).getByText(records[abbrev].record)).toBeInTheDocument()
    }
    expect(within(link).getByText(String(saPor.away_score))).toHaveClass('t-score', 'text-text-3')
    expect(within(link).getByText(String(saPor.home_score))).toHaveClass('t-score', 'text-text-1')
    expect(within(link).getByText('SA')).toHaveClass('text-text-3')
  })

  it('no scores before tip-off, and no records when none are given', () => {
    const { container } = box(scheduled, { records: {} })
    expect(container.querySelector('.t-score')).toBeNull()
    expect(container.textContent).not.toMatch(/\d+-\d+/)
  })

  it('the arena is in small type, cut with an ellipsis and its full name on hover', () => {
    box(saPor)
    const venue = screen.getByText(saPor.venue)
    expect(venue).toHaveClass('truncate')
    expect(venue).toHaveAttribute('title', saPor.venue)
  })

  it('a live box is outlined in the live color', () => {
    box(saPor)
    expect(screen.getByRole('link')).toHaveClass('border-live')
  })
})
