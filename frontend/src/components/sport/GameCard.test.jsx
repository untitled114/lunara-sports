import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
vi.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ playGlassClick: vi.fn(), playThud: vi.fn() }) }))
import { GameCard } from './GameCard'
import gamesJan15Final from '@/test/fixtures/gamesJan15Final.json'

// Real captures, imported unmodified: GET /games/?game_date=2026-10-03 (MIA at TOR,
// 401902644) and GET /standings (2025–26 final), both e2e fixtures (provenance in
// e2e/fixtures/README.md), turned into the page's lookup by the real buildStandingsLookup.
import REAL_OCT3 from '../../../e2e/fixtures/api/games__game_date_2026-10-03.json'
import REAL_STANDINGS from '../../../e2e/fixtures/api/standings.json'
import { buildStandingsLookup } from '@/services/api'
const game = REAL_OCT3[0]
const standings = buildStandingsLookup(REAL_STANDINGS)
const meta = { seasonLabel: REAL_STANDINGS.season_label, isPrev: REAL_STANDINGS.is_previous_season }
const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('GameCard', () => {
  it('preseason: last-season seeds, records and captioned win probability', () => {
    wrap(<GameCard game={game} standings={standings} standingsMeta={meta} />)
    expect(screen.getByText('Play-in')).toBeInTheDocument()
    expect(screen.getByText('East #5')).toBeInTheDocument()
    expect(screen.getByText('2025–26: 43-39')).toBeInTheDocument()
    expect(screen.getByText(/Based on 2025–26 records/)).toBeInTheDocument()
    expect(screen.queryByText('100%')).toBeNull()
  })
  it('win probability: bars hidden from assistive tech, each percentage names its team', () => {
    const { container } = wrap(<GameCard game={game} standings={standings} standingsMeta={meta} />)
    const exact = (text) => (_, el) => el?.tagName === 'SPAN' && el.textContent === text
    expect(screen.getByText(exact('MIA 48%'))).toBeInTheDocument()
    expect(screen.getByText(exact('TOR 52%'))).toBeInTheDocument()
    const bar = container.querySelector('[aria-hidden="true"] .bg-accent-fill')
    expect(bar).not.toBeNull()
    expect(bar).toHaveStyle({ width: '52%' })
  })
  it('no standings data: no badge, no win probability', () => {
    wrap(<GameCard game={game} standings={{}} standingsMeta={{ seasonLabel: '', isPrev: false }} />)
    expect(screen.queryByText(/Play-in|#\d/)).toBeNull()
    expect(screen.queryByText(/win prob/i)).toBeNull()
  })
  it('live game uses the live card', () => {
    // A real completed game (MEM 111 at ORL 118, GET /games/?game_date=2026-01-15) with
    // only its status overridden to 'live' (D21): no game is live at capture time, and
    // its scores stay the real final scores.
    const real = gamesJan15Final.data[0]
    const { container } = wrap(<GameCard game={{ ...real, status: 'live' }} standings={{}} standingsMeta={{ seasonLabel: '', isPrev: false }} />)
    expect(container.querySelector('.card-live')).not.toBeNull()
    expect(screen.getByText(String(real.home_score))).toBeInTheDocument()
    expect(screen.getByText(String(real.away_score))).toBeInTheDocument()
  })
})
