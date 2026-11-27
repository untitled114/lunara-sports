import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { getHeadshotUrl, getLogoUrl } from '@/utils/teamColors';
import { useFormatTime } from '@/utils/formatTime';
import { gameStatusText } from '@/lib/gameMath';
import { fetchPlays } from '@/services/api';
import { PlayerLink } from '@/components/sport/PlayerLink';
import { TeamLink } from '@/components/sport/TeamLink';

// Small real pieces of the live site for the home page: no stock icons.

const CHIP =
  'inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 py-1 t-small font-semibold text-text-1';

const isLive = (g) => g.status === 'live' || g.status === 'halftime';
const PERIOD_MARKER = /^(Start|End) of /;
const byStart = (a, b) => new Date(a.start_time) - new Date(b.start_time);

/** The first live game, else the latest final, else the next scheduled game; null for none. */
export function pickGame(games = []) {
  const live = games.find(isLive);
  if (live) return live;
  const finals = games.filter((g) => g.status === 'final').sort(byStart);
  if (finals.length) return finals[finals.length - 1];
  return games.filter((g) => g.status === 'scheduled').sort(byStart)[0] || null;
}

function Logo({ abbrev }) {
  return <img src={getLogoUrl(abbrev)} alt="" width={18} height={18} className="h-[18px] w-[18px] shrink-0" />;
}

/** A score chip for pickGame(games): logos, scores and the status, one link to the game. */
export function LiveGameChip({ games }) {
  const fmt = useFormatTime();
  const game = pickGame(games);
  if (!game) return null;
  const started = game.status !== 'scheduled';
  return (
    <Link to={`/game/${game.id}`} className={clsx(CHIP, 'hover:border-border-strong transition-colors')}>
      <Logo abbrev={game.away_team} />
      <span className="tnum">{started ? `${game.away_team} ${game.away_score}` : game.away_team}</span>
      <Logo abbrev={game.home_team} />
      <span className="tnum">{started ? `${game.home_team} ${game.home_score}` : game.home_team}</span>
      <span className={clsx('t-label tnum', isLive(game) ? 'text-live' : 'text-text-2')}>{gameStatusText(game, fmt.when)}</span>
    </Link>
  );
}

/** The newest play of the live game (else the latest final), with the score after it. */
export function NewestPlayChip({ games }) {
  const live = games?.find(isLive);
  const game = live || pickGame((games || []).filter((g) => g.status === 'final'));
  const gameId = game?.id;
  const [play, setPlay] = useState(null);

  useEffect(() => {
    if (!gameId) return undefined;
    let cancelled = false;
    fetchPlays(gameId)
      .then((plays) => {
        // The newest actual play: "End of Game" and the period markers are not plays.
        const real = Array.isArray(plays) ? plays.filter((p) => !PERIOD_MARKER.test(p.description || '')) : [];
        if (cancelled || real.length === 0) return;
        setPlay(real.reduce((a, b) => ((b.espn_order ?? b.sequence_number) > (a.espn_order ?? a.sequence_number) ? b : a)));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  if (!game || !play) return null;
  // The score first, never cut short; a long description truncates with the full text on hover.
  return (
    <Link to={`/game/${game.id}`} className={clsx(CHIP, 'hover:border-border-strong transition-colors')}>
      {live && <span className="t-label text-live shrink-0">Live</span>}
      <span className="tnum shrink-0">{`${play.away_score}-${play.home_score}`}</span>
      <span className="truncate font-normal" title={play.description}>{play.description}</span>
    </Link>
  );
}

/** The five points leaders' faces, each a link to the player. */
export function LeaderFaces({ leaders = [] }) {
  if (!leaders.length) return null;
  return (
    <div className="flex">
      {leaders.slice(0, 5).map((l) => (
        <PlayerLink key={l.player_id} id={l.player_id} className="-mr-2 shrink-0" aria-label={l.player}>
          <img
            src={getHeadshotUrl(l.headshot_url, 92)}
            alt={l.player}
            width={46}
            height={34}
            loading="lazy"
            className="h-[34px] w-[46px] rounded-md border-2 border-surface-1 bg-surface-2 object-cover object-top"
          />
        </PlayerLink>
      ))}
    </div>
  );
}

/** The points leader's face and line, one link to the player. */
export function LeaderChip({ leader }) {
  if (!leader) return null;
  return (
    <PlayerLink id={leader.player_id} className={clsx(CHIP, 'hover:border-border-strong transition-colors')}>
      <img
        src={getHeadshotUrl(leader.headshot_url, 44)}
        alt=""
        width={26}
        height={19}
        className="h-[19px] w-[26px] rounded-sm object-cover object-top"
      />
      <span className="truncate">{`${leader.player} ${leader.value} PTS`}</span>
    </PlayerLink>
  );
}

const winPct = (t) => Number(t.w) / Math.max(1, Number(t.w) + Number(t.l));
const byRecord = (teams = []) => [...teams].sort((a, b) => winPct(b) - winPct(a));

/** Each conference's leader with this season's record, one link to the standings. */
export function StandingsLine({ standings }) {
  if (!standings || standings.is_previous_season) return null;
  const east = byRecord(standings.eastern)[0];
  const west = byRecord(standings.western)[0];
  if (!east || !west) return null;
  return (
    <Link to="/standings" className={clsx(CHIP, 'hover:border-border-strong transition-colors')}>
      <span className="t-label text-text-2">East</span>
      <Logo abbrev={east.abbrev} />
      <span className="tnum">{`${east.abbrev} ${east.w}-${east.l}`}</span>
      <span className="t-label text-text-2 ml-1">West</span>
      <Logo abbrev={west.abbrev} />
      <span className="tnum">{`${west.abbrev} ${west.w}-${west.l}`}</span>
    </Link>
  );
}

/** A row of team logos, best records first, each a link to its team. */
export function TeamLogos({ standings, count = 10 }) {
  const teams = byRecord([...(standings?.eastern || []), ...(standings?.western || [])]).slice(0, count);
  if (!teams.length) return null;
  return (
    <div data-testid="team-logos" className="flex flex-wrap gap-1.5">
      {teams.map((t) => (
        <TeamLink key={t.abbrev} abbrev={t.abbrev} className="rounded-md border border-border bg-surface-2 p-1 hover:border-border-strong transition-colors">
          <img src={getLogoUrl(t.abbrev)} alt={t.name} width={24} height={24} loading="lazy" className="h-6 w-6" />
        </TeamLink>
      ))}
    </div>
  );
}

export function FanLine() {
  return <span className={CHIP}>No account. No paywall. No ads.</span>;
}

// "Everything on Lunara". Only items marked `live` are shown.
export const OFFER_ITEMS = [
  { key: 'scoreboard', title: 'Live scoreboard', text: 'Every game today, with live scores, the clock and tip times.', live: true },
  { key: 'game', title: 'Game pages', text: 'Play by play you can filter by team, quarter or scoring plays, plus the full box score.', live: false },
  {
    key: 'player',
    title: 'Player pages',
    text: (count) =>
      `${count ? `${count} players` : 'Every player'}, each with his season line, home and road splits, game log and career.`,
    live: false,
  },
  { key: 'team', title: 'Team pages', text: 'All 30 teams, with the roster and per-game numbers, the schedule, and where they rank.', live: true },
  { key: 'stats', title: 'Stats and leaders', text: "Leaders in 9 categories under the NBA's qualifying rules, and every team's numbers.", live: true },
  { key: 'standings', title: 'Standings', text: 'Both conferences side by side, with the playoff and play-in lines.', live: true },
];
