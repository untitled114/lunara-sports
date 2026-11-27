import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, renderHook, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
vi.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ timezone: 'ET', refreshInterval: 30 }) }))
vi.mock('@/services/api', async () => ({
  ...(await vi.importActual('@/services/api')),
  fetchBoxScore: vi.fn(() => Promise.resolve(null)),
  fetchPlays: vi.fn(() => Promise.resolve([])),
}))
import { fetchBoxScore, fetchPlays } from '@/services/api'
import { useGameFeed } from '@/hooks/useGameFeed'
import { BoxScore, FullBoxScore } from './BoxScore'
import { LiveFeed } from './LiveFeed'
// Real captures (e2e/fixtures/README.md): the scheduled MIA @ TOR opener and the final
// OKC @ DEN game. The site asked for box scores of unstarted games 256 times in 14 days
// before this fix; the API answers 404 until tip.
import SCHEDULED from '../../../e2e/fixtures/api/games_401902644.json'
import FINAL from '../../../e2e/fixtures/api/games_401811037.json'

const props = (g) => ({ gameId: g.id, homeTeam: g.home_team, awayTeam: g.away_team, status: g.status })
const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)
// Effects have run and any promise callbacks they queued have settled.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('no box score request before tip-off', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fixtures: one scheduled game and one final game', () => {
    expect(SCHEDULED.status).toBe('scheduled')
    expect(FINAL.status).toBe('final')
  })

  it('useGameFeed: none while scheduled or while the status is still unknown; one once final', async () => {
    renderHook(() => useGameFeed(SCHEDULED.id, SCHEDULED.status))
    renderHook(() => useGameFeed(SCHEDULED.id, undefined))
    await waitFor(() => expect(fetchPlays).toHaveBeenCalled())
    expect(fetchBoxScore).not.toHaveBeenCalled()
    renderHook(() => useGameFeed(FINAL.id, FINAL.status))
    await waitFor(() => expect(fetchBoxScore).toHaveBeenCalledWith(FINAL.id))
  })

  it('useGameFeed: the box score is fetched when a scheduled game tips off', async () => {
    const { rerender } = renderHook(({ status }) => useGameFeed(SCHEDULED.id, status), { initialProps: { status: 'scheduled' } })
    await settle()
    expect(fetchBoxScore).not.toHaveBeenCalled()
    rerender({ status: 'live' })
    await waitFor(() => expect(fetchBoxScore).toHaveBeenCalledWith(SCHEDULED.id))
  })

  it('FullBoxScore on its own: none for a scheduled game, one for a final game', async () => {
    wrap(<FullBoxScore {...props(SCHEDULED)} />)
    await settle()
    expect(fetchBoxScore).not.toHaveBeenCalled()
    wrap(<FullBoxScore {...props(FINAL)} />)
    await waitFor(() => expect(fetchBoxScore).toHaveBeenCalledWith(FINAL.id))
  })

  it('the on-court panel on its own: plays yes, box score no, for a scheduled game', async () => {
    wrap(<BoxScore {...props(SCHEDULED)} />)
    await waitFor(() => expect(fetchPlays).toHaveBeenCalledWith(SCHEDULED.id))
    expect(fetchBoxScore).not.toHaveBeenCalled()
  })

  it('LiveFeed on its own: no box score for headshots before tip', async () => {
    wrap(<LiveFeed {...props(SCHEDULED)} />)
    await waitFor(() => expect(fetchPlays).toHaveBeenCalledWith(SCHEDULED.id))
    expect(fetchBoxScore).not.toHaveBeenCalled()
  })
})

describe('feed name lookup', () => {
  it('a last name two players share in the game links nobody by last name alone (MIN @ OKC: Kenrich and Cody Williams)', async () => {
    const { buildIdMap, findByName } = await import('./LiveFeed')
    const OKC = (await import('@/test/fixtures/boxscore-401909320.json')).default
    const ids = buildIdMap(OKC.data)
    const players = [...OKC.data.home.players, ...OKC.data.away.players]
    const kenrich = players.find((p) => p.name === 'Kenrich Williams')
    const cody = players.find((p) => p.name === 'Cody Williams')
    // Full names still find each player.
    expect(findByName('Kenrich Williams', ids)).toBe(kenrich.id || kenrich.headshot_url.match(/full\/(\d+)\.png/)[1])
    expect(findByName('Cody Williams', ids)).toBe(cody.id || cody.headshot_url.match(/full\/(\d+)\.png/)[1])
    // A name the box score spells differently falls back to the last name only when it is unique.
    expect(findByName('K. Williams', ids)).toBeNull()
  })
})
