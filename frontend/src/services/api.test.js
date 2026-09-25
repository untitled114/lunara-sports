import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchNextGame } from './api'
// Real capture of GET /games/?game_date=2026-09-26 (see e2e/fixtures/README.md).
import GAMES_SEP_26 from '../../e2e/fixtures/api/games__game_date_2026-09-26.json'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('fetchNextGame', () => {
  it("asks for tomorrow in ET, not tomorrow in UTC", async () => {
    // 10:30 PM EDT on Fri Sep 25 is already Sep 26 in UTC: tomorrow (ET) is Sep 26.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-26T02:30:00Z'))
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => GAMES_SEP_26 })
    vi.stubGlobal('fetch', fetchMock)
    await fetchNextGame('MIA')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/games\/\?game_date=2026-09-26$/)
    vi.unstubAllGlobals()
  })
})
