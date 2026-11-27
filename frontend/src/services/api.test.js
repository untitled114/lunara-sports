import { describe, it, expect, vi, afterEach } from 'vitest'
import { addReaction, authHeaders, fetchNextGame, postComment, removeReaction } from './api'
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

describe('writes carry the signed-in token', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('has no auth header when nobody is signed in', () => {
    expect(authHeaders()).toEqual({})
  })

  it('sends the stored token as a Bearer header on reactions and comments', async () => {
    localStorage.setItem('pbp_auth_token', 'tok-123')
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    await addReaction(7, 'fire')
    await removeReaction(7)
    await postComment('401810001', 'Nice', 7)
    for (const [, init] of fetchMock.mock.calls) {
      expect(init.headers.Authorization).toBe('Bearer tok-123')
      expect(init.headers['X-User-Id']).toBeUndefined()
    }
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ body: 'Nice', play_id: 7 })
  })
})
