import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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
    this.sent = []
    FakeSocket.instances.push(this)
  }
  send(msg) {
    this.sent.push(msg)
  }
  close() {
    this.closed = true
    this.readyState = 3
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
  vi.unstubAllGlobals()
})

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
})
