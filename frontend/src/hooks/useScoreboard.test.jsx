import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { StrictMode } from 'react'
import { render, screen, act, waitFor } from '@testing-library/react'
import gamesOct03 from '@/test/fixtures/gamesOct03.json'
import gamesJan15Final from '@/test/fixtures/gamesJan15Final.json'
import { todayET } from '@/lib/et'

const api = vi.hoisted(() => ({ fetchGames: vi.fn() }))
vi.mock('@/services/api', () => api)

import { useScoreboard } from './useScoreboard'

// A stand-in for the browser WebSocket: records every socket the hook opens, so the
// test can count them and drive open/message/close by hand. It carries no game data;
// every game list below is a real captured API response.
class FakeSocket {
  static OPEN = 1
  static instances = []
  constructor(url) {
    this.url = url
    this.readyState = 0
    this.closed = false
    this.closeCalls = 0
    this.sent = []
    FakeSocket.instances.push(this)
  }
  send(msg) {
    this.sent.push(msg)
  }
  close() {
    this.closeCalls++
    this.closed = true
    this.readyState = 3
  }
  // The server or network drops the connection.
  drop() {
    this.readyState = 3
    this.onclose?.()
  }
  open() {
    this.readyState = FakeSocket.OPEN
    this.onopen?.()
  }
  message(obj) {
    this.onmessage?.({ data: JSON.stringify(obj) })
  }
}

function Consumer({ id, date }) {
  const { games, connected, loading } = useScoreboard(date)
  return (
    <div data-testid={id}>
      {loading ? 'loading' : `${games.length} games`} {connected ? 'connected' : 'offline'}
    </div>
  )
}

beforeEach(() => {
  FakeSocket.instances = []
  vi.stubGlobal('WebSocket', FakeSocket)
  api.fetchGames.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

// Timers only: Date stays real so todayET() is the real ET date, and promises resolve
// normally.
const fakeTimers = () =>
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })

// Let the initial REST fetch's promise chain settle inside act().
const flush = () => act(async () => {})

const last = () => FakeSocket.instances[FakeSocket.instances.length - 1]

describe('useScoreboard', () => {
  it('returns { games, connected, loading } from the initial REST fetch', async () => {
    api.fetchGames.mockResolvedValue(gamesOct03.data)
    render(<Consumer id="a" date="2026-10-03" />)
    expect(screen.getByTestId('a')).toHaveTextContent('loading offline')
    await waitFor(() => expect(screen.getByTestId('a')).toHaveTextContent(`${gamesOct03.data.length} games offline`))
    act(() => FakeSocket.instances[0].open())
    expect(screen.getByTestId('a')).toHaveTextContent('connected')
  })

  it('two consumers open one socket and share one REST fetch per date', async () => {
    api.fetchGames.mockResolvedValue(gamesOct03.data)
    const today = todayET()
    const { unmount } = render(
      <>
        <Consumer id="ticker" date={today} />
        <Consumer id="page" date={today} />
      </>
    )
    await waitFor(() => expect(screen.getByTestId('page')).not.toHaveTextContent('loading'))
    expect(FakeSocket.instances).toHaveLength(1)
    expect(FakeSocket.instances[0].url).toMatch(/\/ws\/scoreboard$/)
    expect(api.fetchGames).toHaveBeenCalledTimes(1)

    // One socket message reaches both consumers.
    act(() => {
      FakeSocket.instances[0].open()
      FakeSocket.instances[0].message({ type: 'scoreboard_update', data: gamesJan15Final.data })
    })
    const n = gamesJan15Final.data.length
    expect(screen.getByTestId('ticker')).toHaveTextContent(`${n} games connected`)
    expect(screen.getByTestId('page')).toHaveTextContent(`${n} games connected`)

    unmount()
    expect(FakeSocket.instances[0].closed).toBe(true)
    expect(FakeSocket.instances).toHaveLength(1)
  })

  it('keeps the socket open until the last consumer unmounts', async () => {
    api.fetchGames.mockResolvedValue([])
    const today = todayET()
    const first = render(<Consumer id="one" date={today} />)
    const second = render(<Consumer id="two" date="2026-10-03" />)
    await waitFor(() => expect(screen.getByTestId('two')).not.toHaveTextContent('loading'))
    expect(FakeSocket.instances).toHaveLength(1)

    first.unmount()
    expect(FakeSocket.instances[0].closed).toBe(false)
    second.unmount()
    expect(FakeSocket.instances[0].closed).toBe(true)

    // A later consumer opens a fresh socket and fetches fresh data.
    render(<Consumer id="three" date={today} />)
    expect(FakeSocket.instances).toHaveLength(2)
    await waitFor(() => expect(api.fetchGames).toHaveBeenCalledTimes(3))
  })

  it('applies socket updates only to today, never to another date', async () => {
    api.fetchGames.mockResolvedValue(gamesOct03.data)
    render(<Consumer id="other" date="2026-10-03" />)
    await waitFor(() => expect(screen.getByTestId('other')).not.toHaveTextContent('loading'))
    act(() => {
      FakeSocket.instances[0].open()
      FakeSocket.instances[0].message({ type: 'scoreboard_update', data: gamesJan15Final.data })
    })
    expect(screen.getByTestId('other')).toHaveTextContent(`${gamesOct03.data.length} games connected`)
  })

  it('reopens a socket whose retries ran out when another consumer mounts', async () => {
    fakeTimers()
    api.fetchGames.mockResolvedValue([])
    render(<Consumer id="ticker" date={todayET()} />)
    await flush()
    // The first socket plus MAX_RETRIES (10) reconnects, each dropped: backoff capped at 15s.
    for (let i = 0; i < 11; i++) {
      act(() => last().drop())
      act(() => vi.advanceTimersByTime(15000))
    }
    expect(FakeSocket.instances).toHaveLength(11)
    act(() => vi.advanceTimersByTime(60000))
    expect(FakeSocket.instances).toHaveLength(11) // retries exhausted: nothing pending

    render(<Consumer id="page" date="2026-10-03" />)
    await flush()
    expect(FakeSocket.instances).toHaveLength(12)
    act(() => last().open())
    expect(screen.getByTestId('ticker')).toHaveTextContent('connected')
    expect(screen.getByTestId('page')).toHaveTextContent('connected')
  })

  it('does not open an extra socket for a new consumer while one is open or connecting', async () => {
    api.fetchGames.mockResolvedValue([])
    render(<Consumer id="a" date={todayET()} />)
    render(<Consumer id="b" date={todayET()} />) // first socket still connecting
    act(() => FakeSocket.instances[0].open())
    render(<Consumer id="c" date="2026-10-03" />)
    await flush()
    expect(FakeSocket.instances).toHaveLength(1)
  })

  it('does not open an extra socket while a reconnect is already scheduled', async () => {
    fakeTimers()
    api.fetchGames.mockResolvedValue([])
    render(<Consumer id="a" date={todayET()} />)
    act(() => FakeSocket.instances[0].drop()) // retry pending
    render(<Consumer id="b" date="2026-10-03" />)
    await flush()
    expect(FakeSocket.instances).toHaveLength(1)
    act(() => vi.advanceTimersByTime(1000))
    expect(FakeSocket.instances).toHaveLength(2)
  })

  it('StrictMode double mount: no leak, every socket closed exactly once', async () => {
    api.fetchGames.mockResolvedValue(gamesOct03.data)
    const { unmount } = render(
      <StrictMode>
        <Consumer id="strict" date="2026-10-03" />
      </StrictMode>
    )
    await waitFor(() => expect(screen.getByTestId('strict')).not.toHaveTextContent('loading'))
    const open = FakeSocket.instances.filter((ws) => !ws.closed)
    expect(open).toHaveLength(1)
    unmount()
    for (const ws of FakeSocket.instances) expect(ws.closeCalls).toBe(1)
  })

  it('a late consumer gets the loaded data at once, with no extra fetch', async () => {
    api.fetchGames.mockResolvedValue(gamesOct03.data)
    render(<Consumer id="early" date="2026-10-03" />)
    await waitFor(() => expect(screen.getByTestId('early')).not.toHaveTextContent('loading'))
    render(<Consumer id="late" date="2026-10-03" />)
    expect(screen.getByTestId('late')).toHaveTextContent(`${gamesOct03.data.length} games`)
    expect(screen.getByTestId('late')).not.toHaveTextContent('loading')
    expect(api.fetchGames).toHaveBeenCalledTimes(1)
  })

  it('a date change while mounted keeps the one socket and fetches the new date', async () => {
    api.fetchGames.mockImplementation((d) =>
      Promise.resolve(d === '2026-10-03' ? gamesOct03.data : gamesJan15Final.data)
    )
    const { rerender } = render(<Consumer id="c" date="2026-01-15" />)
    await waitFor(() => expect(screen.getByTestId('c')).toHaveTextContent(`${gamesJan15Final.data.length} games`))
    rerender(<Consumer id="c" date="2026-10-03" />)
    await waitFor(() => expect(screen.getByTestId('c')).toHaveTextContent(`${gamesOct03.data.length} games`))
    expect(FakeSocket.instances).toHaveLength(1)
    expect(FakeSocket.instances[0].closed).toBe(false)
    expect(api.fetchGames.mock.calls.map(([d]) => d)).toEqual(['2026-01-15', '2026-10-03'])
  })

  it('polls REST every 30s for today only while the socket is down', async () => {
    fakeTimers()
    api.fetchGames.mockResolvedValue([])
    render(<Consumer id="today" date={todayET()} />)
    render(<Consumer id="other" date="2026-10-03" />)
    await flush()
    expect(api.fetchGames).toHaveBeenCalledTimes(2) // one initial fetch per date

    // Socket not open yet: today's store polls; the other date never does.
    await act(async () => vi.advanceTimersByTime(30000))
    expect(api.fetchGames).toHaveBeenCalledTimes(3)
    expect(api.fetchGames).toHaveBeenLastCalledWith(todayET())

    // Socket open: no polling.
    act(() => FakeSocket.instances[0].open())
    await act(async () => vi.advanceTimersByTime(90000))
    expect(api.fetchGames).toHaveBeenCalledTimes(3)

    // Socket drops: polling resumes.
    act(() => FakeSocket.instances[0].drop())
    await act(async () => vi.advanceTimersByTime(30000))
    expect(api.fetchGames).toHaveBeenCalledTimes(4)
  })

  it('reconnects with exponential backoff: 1s, then 2s, then 4s', async () => {
    fakeTimers()
    api.fetchGames.mockResolvedValue([])
    render(<Consumer id="a" date="2026-10-03" />)
    act(() => last().drop())
    act(() => vi.advanceTimersByTime(999))
    expect(FakeSocket.instances).toHaveLength(1)
    act(() => vi.advanceTimersByTime(1))
    expect(FakeSocket.instances).toHaveLength(2)
    act(() => last().drop())
    act(() => vi.advanceTimersByTime(1999))
    expect(FakeSocket.instances).toHaveLength(2)
    act(() => vi.advanceTimersByTime(1))
    expect(FakeSocket.instances).toHaveLength(3)
    // A successful open resets the budget: the next drop waits 1s again.
    act(() => last().open())
    act(() => last().drop())
    act(() => vi.advanceTimersByTime(1000))
    expect(FakeSocket.instances).toHaveLength(4)
    await flush()
  })

  it('leaves no timers, sockets or fetches behind after the last consumer unmounts', async () => {
    fakeTimers()
    api.fetchGames.mockResolvedValue([])
    const a = render(<Consumer id="a" date={todayET()} />)
    const b = render(<Consumer id="b" date="2026-10-03" />)
    await flush()
    act(() => FakeSocket.instances[0].drop()) // a reconnect is scheduled, the poll is running
    expect(vi.getTimerCount()).toBeGreaterThan(0)
    a.unmount()
    b.unmount()
    expect(vi.getTimerCount()).toBe(0)
    const calls = api.fetchGames.mock.calls.length
    act(() => vi.advanceTimersByTime(300000))
    expect(api.fetchGames).toHaveBeenCalledTimes(calls)
    expect(FakeSocket.instances).toHaveLength(1)
  })
})
