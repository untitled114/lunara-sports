import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import statsLeaders from '@/test/fixtures/statsLeaders.json'
import statsTeams from '@/test/fixtures/statsTeams.json'
// /stats/teams as the API computes it from real ESPN captures (see fixture _source).
import statsTeams2027 from '@/test/fixtures/statsTeams2027.json'
import gamesOct03 from '@/test/fixtures/gamesOct03.json'
import gamesJan15Final from '@/test/fixtures/gamesJan15Final.json'
import gamesNext from '@/test/fixtures/gamesNext.json'
// Tonight's real slate (SA @ POR live), the reconciled MIA @ PHI plays, and the leaders as
// the API computes them (player_count 481), each with its _source.
import gamesLive from '@/test/fixtures/games-20261125-live.json'
import PLAYS_PHI from '@/test/fixtures/plays-401909317.json'
import LEADERS5 from '@/test/fixtures/statsLeaders5-20261126.json'
import { LiveGameChip, NewestPlayChip, pickGame } from '@/components/home/realPieces'
// Friday Nov 27's real slate (all scheduled) and Nov 25 captured after every game was final.
import GAMES_NOV27 from '@/test/fixtures/games-20261127-scheduled.json'
// One category's top 10 as the API computes it from live ESPN (see _source), and
// the teams list for the conference filter.
import STATS_CATEGORY from '@/test/fixtures/statsCategory-20261126.json'
import TEAMS_NOW_STATS from '@/test/fixtures/teams-20261126.json'
import STANDINGS_NOW from '@/test/fixtures/standings-20261126.json'
import NOV25_FINAL from '../../e2e/fixtures/api/games__game_date_2026-11-25.json'
import { todayET, addDaysISO } from '@/lib/et'

vi.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    playGlassClick: vi.fn(),
    playThud: vi.fn(),
    triggerArenaEntry: (cb) => cb && cb(),
    timezone: 'local',
  }),
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: null, token: null }),
}))

const api = vi.hoisted(() => ({
  fetchGames: vi.fn(),
  fetchStatLeaders: vi.fn(),
  fetchTeamStatsList: vi.fn(),
  fetchPlayers: vi.fn(),
  fetchNextGameDate: vi.fn(),
  fetchPlays: vi.fn(),
  fetchCategoryLeaders: vi.fn(),
  fetchTeams: vi.fn(),
  fetchStandings: vi.fn(),
}))
vi.mock('@/services/api', () => api)

// The landing page's "Live now" badge reads the same scoreboard feed as the ticker.
const scoreboard = vi.hoisted(() => ({ useScoreboard: vi.fn() }))
vi.mock('@/hooks/useScoreboard', () => scoreboard)

import PrivacyPage from './PrivacyPage'
import TermsPage from './TermsPage'
import LandingPage from './LandingPage'
import SchedulePage from './SchedulePage'
import StatsPage from './StatsPage'

import { assertNoBannedWords } from '@/test/bannedWords'

const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

beforeEach(() => {
  vi.clearAllMocks()
  // Real GET /games/next?after=2026-09-25 response (see the fixture's _source).
  api.fetchNextGameDate.mockResolvedValue(gamesNext.data.date)
  api.fetchStandings.mockResolvedValue(STANDINGS_NOW.data)
  scoreboard.useScoreboard.mockReturnValue({ games: [], connected: false, loading: false })
})

describe('PrivacyPage', () => {
  it('says what is measured: no analytics of its own, and Cloudflare Web Analytics', () => {
    wrap(<PrivacyPage />)
    assertNoBannedWords(document.body.textContent)
    expect(screen.getByText(/runs no analytics or tracking of its own/)).toBeInTheDocument()
    expect(screen.getByText(/Cloudflare Web Analytics/)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/does not currently use any analytics/)
  })
})

describe('TermsPage', () => {
  it('has no banned words', () => {
    wrap(<TermsPage />)
    assertNoBannedWords(document.body.textContent)
    expect(screen.getByRole('heading', { name: 'Terms & Conditions' })).toBeInTheDocument()
  })
})

describe('LandingPage', () => {
  beforeEach(() => {
    api.fetchStatLeaders.mockResolvedValue(LEADERS5.data)
    api.fetchPlays.mockResolvedValue([])
    api.fetchGames.mockResolvedValue([])
  })

  it('renders the hero and the home boxes with no banned words', () => {
    wrap(<LandingPage />)
    assertNoBannedWords(document.body.textContent)
    expect(screen.getByRole('heading', { name: 'Lunara Sports' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Every NBA game, live' })).toBeInTheDocument()
  })

  it('shows no "Live now" badge when no game is live (the real Oct 3 slate is scheduled)', () => {
    scoreboard.useScoreboard.mockReturnValue({ games: gamesOct03.data, connected: true, loading: false })
    wrap(<LandingPage />)
    expect(screen.queryByText('Live now')).toBeNull()
    expect(scoreboard.useScoreboard).toHaveBeenCalledWith(todayET())
  })

  it('shows "Live now" with its ping only while a game is live or at halftime', () => {
    // Rendering-state override: a real completed game (GET /games/?game_date=
    // 2026-01-15) with only its status changed; no game is live in the API right now.
    for (const status of ['live', 'halftime']) {
      scoreboard.useScoreboard.mockReturnValue({
        games: [{ ...gamesJan15Final.data[0], status }],
        connected: true,
        loading: false,
      })
      const { unmount } = wrap(<LandingPage />)
      const badge = screen.getByText('Live now')
      expect(badge.parentElement.querySelector('.animate-ping')).toBeInTheDocument()
      unmount()
    }
  })

  it('no NFL anywhere on the page, text or image', () => {
    api.fetchStatLeaders.mockResolvedValue(LEADERS5.data)
    wrap(<LandingPage />)
    expect(document.body.textContent).not.toMatch(/NFL|football/i)
    for (const img of document.querySelectorAll('img')) expect(img.getAttribute('src')).not.toMatch(/nfl/i)
  })
})

describe('LandingPage boxes and "Everything on Lunara"', () => {
  const BOXES = [
    ['Every NBA game, live', 'Live scores, play by play and box scores for every game, plus standings and stats for every team and player.'],
    ['Live from tip to end', 'We check every live game with ESPN every second. A new play shows up on your screen within a quarter of a second after that.'],
    ['Free for every fan', 'No account, no paywall, no ads. Just the game.'],
    ['Every player, every team', `All 30 NBA teams and all ${LEADERS5.data.player_count} players who have played this season, each with a page of their own. MLB joins when the 2027 season starts.`],
  ]
  const boxes = () => screen.getAllByTestId('home-box')

  beforeEach(() => {
    api.fetchStatLeaders.mockResolvedValue(LEADERS5.data)
    // Plays only for the game they belong to (MIA @ PHI, 401909317); none captured for others.
    api.fetchPlays.mockImplementation((id) => Promise.resolve(id === PLAYS_PHI.data[0].game_id ? PLAYS_PHI.data : []))
    api.fetchGames.mockResolvedValue([])
    scoreboard.useScoreboard.mockReturnValue({ games: gamesLive.data, connected: true, loading: false })
  })

  it('four boxes with the exact copy; the player count is live (481 from player_count)', async () => {
    expect(LEADERS5.data.player_count).toBe(481)
    wrap(<LandingPage />)
    expect(await screen.findByText(BOXES[3][1])).toBeInTheDocument()
    expect(boxes().map((b) => within(b).getByRole('heading').textContent)).toEqual(BOXES.map(([title]) => title))
    boxes().forEach((b, i) => expect(within(b).getByText(BOXES[i][1])).toBeInTheDocument())
  })

  it('box 4 with no player count says every player, never a made-up number', async () => {
    api.fetchStatLeaders.mockRejectedValue(new Error('down'))
    wrap(<LandingPage />)
    expect(
      await screen.findByText('All 30 NBA teams and every player who has played this season, each with a page of their own. MLB joins when the 2027 season starts.')
    ).toBeInTheDocument()
  })

  it('Explore: boxes 1 and 2 open the scoreboard, box 4 opens Players, box 3 has none', async () => {
    wrap(<LandingPage />)
    await screen.findByText(BOXES[3][1])
    const explore = boxes().map((b) => within(b).queryByRole('link', { name: 'Explore' })?.getAttribute('href') ?? null)
    expect(explore).toEqual(['/scoreboard', '/scoreboard', null, '/players'])
  })

  it('spacing: the boxes sit higher, with more room between them and above the big box', async () => {
    wrap(<LandingPage />)
    await screen.findByText(BOXES[3][1])
    // Exact pixels: the site's root text size is 13px, so rem-based spacing would shrink.
    const grid = boxes()[0].parentElement
    expect(grid).toHaveClass('gap-[56px]')
    expect(grid.parentElement).toHaveClass('space-y-[88px]')
    for (const b of boxes()) expect(b).toHaveClass('p-[28px]')
    const hero = screen.getByRole('heading', { name: 'Lunara Sports' }).closest('.min-h-\\[56vh\\]')
    expect(hero).not.toBeNull()
  })

  it('no icon tiles in the boxes; they keep floating; the column is about 960px', async () => {
    wrap(<LandingPage />)
    await screen.findByText(BOXES[3][1])
    for (const b of boxes()) {
      expect(b.querySelector('svg')).toBeNull()
      expect(b).toHaveClass('animate-float')
    }
    expect(boxes()[0].closest('.max-w-\\[960px\\]')).not.toBeNull()
  })

  it('the real pieces: the live game, its newest play, the fan line and the five points leaders', async () => {
    wrap(<LandingPage />)
    const [live, play, free, faces] = boxes()
    const saPor = gamesLive.data.find((g) => g.status === 'live')
    expect(within(live).getByRole('link', { name: /SA 105.*POR 106.*4th 3:41/ })).toHaveAttribute('href', `/game/${saPor.id}`)
    expect(within(free).getByText('No account. No paywall. No ads.')).toBeInTheDocument()
    const top5 = LEADERS5.data.categories.pts.slice(0, 5)
    await within(faces).findByRole('link', { name: top5[0].player })
    const links = within(faces).getAllByRole('link')
    expect(links.filter((a) => a.querySelector('img')).map((a) => a.getAttribute('href'))).toEqual(top5.map((l) => `/player/${l.player_id}`))
    expect(play).toBeInTheDocument()
    expect(api.fetchPlays).toHaveBeenCalledWith(saPor.id)
  })

  it('"Everything on Lunara" lists what is live today, each with its real piece', async () => {
    api.fetchStandings.mockResolvedValue(STANDINGS_NOW.data)
    wrap(<LandingPage />)
    const offer = screen.getByRole('heading', { name: 'Everything on Lunara' }).closest('section')
    expect(within(offer).getByText(/what we offer/i)).toBeInTheDocument()
    // Game pages and Player pages join when their pages ship (feed filters, splits and career).
    expect(within(offer).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Live scoreboard',
      'Team pages',
      'Stats and leaders',
      'Standings',
    ])
    expect(within(offer).getByText('Every game today, with live scores, the clock and tip times.')).toBeInTheDocument()
    expect(within(offer).getByText('All 30 teams, with the roster and per-game numbers, the schedule, and where they rank.')).toBeInTheDocument()
    expect(within(offer).getByText('Both conferences side by side, with the playoff and play-in lines.')).toBeInTheDocument()
    const lead = LEADERS5.data.categories.pts[0]
    expect(await within(offer).findByText(new RegExp(`${lead.player}.*${lead.value}`))).toBeInTheDocument()
    expect(within(offer).getByRole('link', { name: /SA 105.*POR 106/ })).toBeInTheDocument()
    // Standings: each conference's leader with its record, one link to the standings.
    const best = (conf) => [...conf].sort((a, b) => b.w / (b.w + b.l) - a.w / (a.w + a.l))[0]
    const east = best(STANDINGS_NOW.data.eastern)
    const west = best(STANDINGS_NOW.data.western)
    const line = await within(offer).findByRole('link', { name: new RegExp(`${east.abbrev} ${east.w}-${east.l}.*${west.abbrev} ${west.w}-${west.l}`) })
    expect(line).toHaveAttribute('href', '/standings')
    // Team pages: a row of logos, each opening its team.
    const logos = within(offer).getByTestId('team-logos')
    expect(within(logos).getAllByRole('link').length).toBe(10)
    for (const a of within(logos).getAllByRole('link')) expect(a.getAttribute('href')).toMatch(/^\/team\/[A-Z]{2,3}$/)
    expect(within(offer).getByRole('link', { name: 'Get started' })).toHaveAttribute('href', '/scoreboard')
  })

  it('LiveGameChip with every game final (the real Jan 15 slate) shows the latest final', () => {
    const latest = [...gamesJan15Final.data].sort((a, b) => new Date(a.start_time) - new Date(b.start_time)).at(-1)
    wrap(<LiveGameChip games={gamesJan15Final.data} />)
    const chip = screen.getByRole('link')
    expect(chip).toHaveAttribute('href', `/game/${latest.id}`)
    expect(chip).toHaveTextContent(`${latest.away_team} ${latest.away_score}`)
    expect(chip).toHaveTextContent(`${latest.home_team} ${latest.home_score}`)
    expect(chip).toHaveTextContent('Final')
  })

  it("NewestPlayChip shows the game's newest play with the score, skipping period markers", async () => {
    const phi = gamesLive.data.find((g) => g.home_team === 'PHI')
    // The real list ends with "End of Game" and the end-of-quarter marker; the chip shows
    // the newest actual play.
    const newest = [...PLAYS_PHI.data]
      .sort((a, b) => a.espn_order - b.espn_order)
      .filter((p) => !/^(Start|End) of /.test(p.description))
      .at(-1)
    expect(newest.description).not.toMatch(/^(Start|End) of /)
    wrap(<NewestPlayChip games={[phi]} />)
    // The score comes first and is never cut short; only the description truncates.
    const text = await screen.findByText(newest.description)
    expect(text).toHaveClass('truncate')
    expect(text).toHaveAttribute('title', newest.description)
    const score = screen.getByText(`${newest.away_score}-${newest.home_score}`)
    expect(score).toHaveClass('shrink-0')
    expect(score.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(api.fetchPlays).toHaveBeenCalledWith(phi.id)
  })

  it('before the first tip of a game day the pieces show the latest final, looking back past an empty day', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-27T14:00:00Z')) // 9:00 AM ET Friday: every game scheduled
    scoreboard.useScoreboard.mockReturnValue({ games: GAMES_NOV27.data, connected: true, loading: false })
    api.fetchGames.mockImplementation((date) => Promise.resolve(date === '2026-11-25' ? NOV25_FINAL : []))
    wrap(<LandingPage />)
    const latest = pickGame(NOV25_FINAL)
    expect(latest.status).toBe('final')
    const [first] = screen.getAllByTestId('home-box')
    const chip = await within(first).findByRole('link', { name: new RegExp(`${latest.away_team} ${latest.away_score}`) })
    expect(chip).toHaveAttribute('href', `/game/${latest.id}`)
    expect(api.fetchGames).toHaveBeenCalledWith('2026-11-26')
    expect(api.fetchGames).toHaveBeenCalledWith('2026-11-25')
    vi.useRealTimers()
  })

  it('a day with no games (Thanksgiving: GET /games/?game_date=2026-11-26 is []) looks back to the latest game day', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-26T15:00:00Z'))
    scoreboard.useScoreboard.mockReturnValue({ games: [], connected: true, loading: false })
    api.fetchGames.mockImplementation((date) => Promise.resolve(date === '2026-11-25' ? gamesLive.data : []))
    wrap(<LandingPage />)
    expect(await screen.findAllByRole('link', { name: /SA 105.*POR 106/ })).not.toHaveLength(0)
    expect(api.fetchGames).toHaveBeenCalledWith('2026-11-25')
    vi.useRealTimers()
  })
})

describe('SchedulePage', () => {
  afterEach(() => vi.clearAllMocks())

  it('renders the schedule table with real game data and no banned words', async () => {
    // Real scheduled game from GET /games/?game_date=2026-10-03 (see fixture _source).
    api.fetchGames.mockResolvedValue(gamesOct03.data)
    wrap(<SchedulePage />)
    await waitFor(() => expect(screen.getAllByRole('columnheader', { name: 'Matchup' }).length).toBeGreaterThan(0))
    const [game] = gamesOct03.data
    expect(screen.getAllByText(game.away_team, { exact: false }).length).toBeGreaterThan(0)
    assertNoBannedWords(document.body.textContent)
  })

  it('empty range names the range and links the next game day after it', async () => {
    // [] is the real answer for these preseason days (GET /games/?game_date=2026-09-25
    // returned [] on 2026-09-25, as do the e2e captures for 09-22..09-28).
    api.fetchGames.mockResolvedValue([])
    wrap(<SchedulePage />)
    expect(await screen.findByText(/^No games from \w{3}, \w{3} \d{1,2} to \w{3}, \w{3} \d{1,2}\.$/)).toBeInTheDocument()
    const link = await screen.findByRole('link', { name: 'Next game: Sat, Oct 3 ->' })
    expect(link).toHaveAttribute('href', '/scoreboard?date=2026-10-03')
    expect(api.fetchNextGameDate).toHaveBeenCalledWith(addDaysISO(todayET(), 3))
  })

  it('names the week buttons for assistive tech', async () => {
    api.fetchGames.mockResolvedValue([])
    wrap(<SchedulePage />)
    expect(screen.getByRole('button', { name: 'Previous week' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next week' })).toBeInTheDocument()
    await screen.findByText(/^No games from/)
  })

  it('error path shows PageState with Try again and retries', async () => {
    api.fetchGames.mockRejectedValue(new Error('down'))
    wrap(<SchedulePage />)
    expect(await screen.findByText("Couldn't load the schedule.")).toBeInTheDocument()
    api.fetchGames.mockResolvedValue([])
    const retry = screen.getByRole('button', { name: 'Try again' })
    await userEvent.click(retry)
    await waitFor(() => expect(screen.queryByText("Couldn't load the schedule.")).not.toBeInTheDocument())
  })
})

describe("StatsPage", () => {
  const CAT = STATS_CATEGORY.data
  const TILES = ['Points', 'Rebounds', 'Assists', 'Threes', 'Steals', 'Blocks', 'FG%', '3P%', 'FT%']
  const byQuery = (category, filters = {}) => {
    const key = [category, ...Object.entries(filters).filter(([, v]) => v).map(([k, v]) => `${k}_${v}`)].join('_')
    return CAT[key]
  }
  beforeEach(() => {
    api.fetchStatLeaders.mockResolvedValue(LEADERS5.data)
    api.fetchCategoryLeaders.mockImplementation((category, filters) => {
      const r = byQuery(category, filters)
      return r ? Promise.resolve(r) : Promise.reject(new Error('no capture for this query'))
    })
    api.fetchTeamStatsList.mockResolvedValue(statsTeams2027.data)
    api.fetchTeams.mockResolvedValue(TEAMS_NOW_STATS.data)
  })

  it('nine tiles, each with the leader, value and photo; no banned words, no advanced-stats banner', async () => {
    wrap(<StatsPage />)
    const tiles = await screen.findAllByTestId('leader-tile')
    expect(tiles.map((el) => within(el).getByTestId('tile-label').textContent)).toEqual(TILES)
    const pts = LEADERS5.data.categories.pts[0]
    expect(tiles[0]).toHaveTextContent(pts.player)
    expect(tiles[0]).toHaveTextContent(pts.value)
    expect(tiles[0].querySelector('img')).not.toBeNull()
    assertNoBannedWords(document.body.textContent)
    expect(screen.queryByText(/advanced stats/i)).toBeNull()
    expect(screen.getByRole('heading', { name: 'Stats', level: 1 })).toBeInTheDocument()
    expect(screen.getByText(LEADERS5.data.season_label)).toBeInTheDocument()
  })

  it("points is shown first: its top 10, each row one link, with games played, a bar against the leader and the qualified count", async () => {
    wrap(<StatsPage />)
    const table = await screen.findByRole('table')
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(10)
    const top = CAT.pts.rows
    expect(within(rows[0]).getByRole('link', { name: new RegExp(top[0].player) })).toHaveAttribute('href', `/player/${top[0].player_id}`)
    expect(rows[1]).toHaveTextContent(top[1].team)
    expect(rows[1]).toHaveTextContent(String(top[1].gp))
    expect(rows[1]).toHaveTextContent(top[1].value)
    const bar = rows[1].querySelector('[data-testid="leader-bar"]')
    expect(bar.style.width).toBe(`${((parseFloat(top[1].value) / parseFloat(top[0].value)) * 100).toFixed(1)}%`)
    expect(screen.getByText(`Top 10 of ${CAT.pts.matching} qualified players`)).toBeInTheDocument()
    expect(api.fetchCategoryLeaders).toHaveBeenCalledWith('pts', {})
  })

  it('clicking a tile shows that category below', async () => {
    const user = userEvent.setup()
    wrap(<StatsPage />)
    const tiles = await screen.findAllByTestId('leader-tile')
    await user.click(tiles[6])
    expect(tiles[6]).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByRole('heading', { name: 'Field goal percentage' })).toBeInTheDocument()
    expect(await screen.findByText(`Top 10 of ${CAT.fg_pct.matching} qualified players`)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: new RegExp(CAT.fg_pct.rows[0].player) })).toBeInTheDocument()
  })

  it('team, position and conference filters narrow the list (Miami: 11 qualified scorers)', async () => {
    const user = userEvent.setup()
    wrap(<StatsPage />)
    await screen.findByRole('table')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Team' }), 'MIA')
    expect(api.fetchCategoryLeaders).toHaveBeenLastCalledWith('pts', { team: 'MIA' })
    expect(await screen.findByText('Top 10 of 11 qualified players')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: new RegExp(CAT.pts_team_MIA.rows[0].player) })).toBeInTheDocument()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Team' }), '')
    await user.click(within(screen.getByRole('tablist', { name: 'Conference' })).getByRole('tab', { name: 'West' }))
    expect(api.fetchCategoryLeaders).toHaveBeenLastCalledWith('pts', { conference: 'west' })
  })

  it('position filter on rebounds: centers only', async () => {
    const user = userEvent.setup()
    wrap(<StatsPage />)
    const tiles = await screen.findAllByTestId('leader-tile')
    await user.click(tiles[1])
    await user.click(within(screen.getByRole('tablist', { name: 'Position' })).getByRole('tab', { name: 'C' }))
    expect(api.fetchCategoryLeaders).toHaveBeenLastCalledWith('reb', { position: 'C' })
    expect(await screen.findByText(`Top 10 of ${CAT.reb_position_C.matching} qualified players`)).toBeInTheDocument()
  })

  it('on a phone long names are cut short (full name on hover) so the value column stays in view', async () => {
    wrap(<StatsPage />)
    const top = CAT.pts.rows[2]
    const table = await screen.findByRole('table')
    const name = within(table).getByText(top.player)
    expect(name).toHaveClass('truncate', 'max-w-[110px]', 'sm:max-w-none')
    expect(name).toHaveAttribute('title', top.player)
  })

  it('links to the top 25 of the category in League leaders', async () => {
    wrap(<StatsPage />)
    await screen.findByRole('table')
    expect(screen.getByRole('link', { name: /top 25/i })).toHaveAttribute('href', '/stats/leaders/pts')
  })

  it('Teams: one table of all 30, sortable by any column, with League, East and West', async () => {
    const user = userEvent.setup()
    wrap(<StatsPage />)
    await screen.findAllByTestId('leader-tile')
    await user.click(screen.getByRole('tab', { name: 'Teams' }))
    const table = await screen.findByRole('table')
    expect(within(table).getAllByRole('row').slice(1)).toHaveLength(30)
    await user.click(within(table).getByRole('button', { name: 'PTS' }))
    const ppg = within(table).getAllByRole('row').slice(1).map((r) => parseFloat(within(r).getAllByRole('cell')[3].textContent))
    expect(ppg).toEqual([...ppg].sort((a, b) => b - a))
    await user.click(within(screen.getByRole('tablist', { name: 'Teams conference' })).getByRole('tab', { name: 'East' }))
    const east = TEAMS_NOW_STATS.data.filter((x) => x.conference === 'Eastern').map((x) => x.abbrev)
    const shown = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(shown).toHaveLength(15)
    for (const r of shown) expect(east).toContain(within(r).getAllByRole('link')[0].getAttribute('href').replace('/team/', ''))
  })

  it('error path shows PageState with Try again and retries', async () => {
    api.fetchStatLeaders.mockRejectedValueOnce(new Error('down'))
    wrap(<StatsPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(api.fetchStatLeaders).toHaveBeenCalledTimes(2))
  })
})
