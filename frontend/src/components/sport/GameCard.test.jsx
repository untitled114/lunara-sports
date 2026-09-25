import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
vi.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ playGlassClick: vi.fn(), playThud: vi.fn() }) }))
import { GameCard } from './GameCard'

// Captured from the live API on 2026-09-25: game 401902644 (MIA at TOR, /games/?game_date=
// 2026-10-03) and the 2025-26 final standings rows for MIA (43-39, seed 10) and TOR (46-36,
// seed 5) from /standings, conf as stamped by buildStandingsLookup().
const game = { id: '401902644', away_team: 'MIA', home_team: 'TOR', status: 'scheduled', start_time: '2026-10-03T23:00:00Z', venue: 'Videotron Centre', away_score: 0, home_score: 0 }
const st = (w, l, seed, conf) => ({ w, l, seed, conf, pct: (w / (w + l)).toFixed(3) })
const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('GameCard', () => {
  it('preseason: last-season seeds, records and captioned win probability', () => {
    wrap(<GameCard game={game} standings={{ MIA: st(43, 39, 10, 'East'), TOR: st(46, 36, 5, 'East') }} standingsMeta={{ seasonLabel: '2025–26 final', isPrev: true }} />)
    expect(screen.getByText('Play-in')).toBeInTheDocument()
    expect(screen.getByText('East #5')).toBeInTheDocument()
    expect(screen.getByText('2025–26: 43-39')).toBeInTheDocument()
    expect(screen.getByText(/Based on 2025–26 records/)).toBeInTheDocument()
    expect(screen.queryByText('100%')).toBeNull()
  })
  it('no standings data: no badge, no win probability', () => {
    wrap(<GameCard game={game} standings={{}} standingsMeta={{ seasonLabel: '', isPrev: false }} />)
    expect(screen.queryByText(/Play-in|#\d/)).toBeNull()
    expect(screen.queryByText(/win prob/i)).toBeNull()
  })
  it('live game uses the live card', () => {
    const { container } = wrap(<GameCard game={{ ...game, status: 'live', home_score: 50, away_score: 48 }} standings={{}} standingsMeta={{ seasonLabel: '', isPrev: false }} />)
    expect(container.querySelector('.card-live')).not.toBeNull()
  })
})
