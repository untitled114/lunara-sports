import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { getLogoUrl } from '@/utils/teamColors';
import { useScoreboard } from '@/hooks/useScoreboard';
import { useFormatTime } from '@/utils/formatTime';
import { Skeleton } from '@/components/ui';
import { todayET } from '@/lib/et';
import { gameStatusText } from '@/lib/gameMath';
import { fetchStandings, buildStandingsLookup } from '@/services/api';
import { NextGameLink } from '@/components/sport/NextGameLink';

const BOX = 'rounded-lg border border-border bg-surface-1 shadow-card';

// This season's records by team, or {} while they load, when they fail, or when the
// standings are still last season's (a 2025-26 record next to a 2026-27 game misleads).
function useCurrentRecords(enabled) {
  const [records, setRecords] = useState({});
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    fetchStandings()
      .then((data) => {
        if (!cancelled && data && !data.is_previous_season) setRecords(buildStandingsLookup(data));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return records;
}

function TeamRow({ abbrev, record, score, showScore, dim }) {
  return (
    // Pixel height for the 18px score, whatever the text size setting makes a rem.
    <div className="flex items-center gap-1.5 h-[26px]">
      <img src={getLogoUrl(abbrev)} alt="" width={18} height={18} className="h-[18px] w-[18px] shrink-0" />
      <span className={clsx('t-small font-semibold w-8 shrink-0', dim ? 'text-text-3' : 'text-text-1')}>{abbrev}</span>
      <span className="t-label tnum text-text-2 flex-1 min-w-0 truncate">{record}</span>
      {showScore && (
        <span className={clsx('t-score-sm tnum shrink-0', dim ? 'text-text-3' : 'text-text-1')}>{score}</span>
      )}
    </div>
  );
}

// One game: one link to its game page (the game page links the teams). The trailing team
// is dimmed; the status is one plain line.
function TickerTile({ game, records, fmt }) {
  const started = game.status !== 'scheduled';
  const live = game.status === 'live' || game.status === 'halftime';
  const away = Number(game.away_score);
  const home = Number(game.home_score);
  const status = gameStatusText(game, fmt.when);
  const line = game.status === 'live' ? `Live, ${status}` : status;

  return (
    <Link
      to={`/game/${game.id}`}
      className={clsx(
        'block w-[160px] sm:w-[200px] shrink-0 snap-start rounded-lg border bg-surface-1 shadow-card px-2.5 py-1.5 transition-colors',
        live ? 'border-live' : 'border-border hover:border-border-strong'
      )}
    >
      <TeamRow abbrev={game.away_team} record={records[game.away_team]?.record} score={game.away_score} showScore={started} dim={started && away < home} />
      <TeamRow abbrev={game.home_team} record={records[game.home_team]?.record} score={game.home_score} showScore={started} dim={started && home < away} />
      <div className={clsx('t-label font-semibold truncate mt-0.5', live ? 'text-live' : 'text-text-2')}>{line}</div>
    </Link>
  );
}

// Loaded, no games today: plain text plus the shared next-game link (the same lookup,
// copy and fallbacks as the scoreboard's empty state).
function EmptyTicker({ today }) {
  return (
    <div className={clsx(BOX, 'h-[82px] flex items-center justify-center gap-3 px-6')}>
      <span className="t-small text-text-2">No games today.</span>
      {/* inline-flex + items-center: on mobile every link gets a 36px tap-target
          min-height, and this keeps its text centred on the "No games today" line. */}
      <NextGameLink after={today} className="inline-flex items-center" />
    </div>
  );
}

// The games couldn't be loaded: say so (never "No games today") and offer a retry.
function ErrorTicker({ onRetry }) {
  return (
    <div className={clsx(BOX, 'h-[82px] flex items-center justify-center gap-3 px-6')}>
      <span className="t-small text-text-2">Couldn&rsquo;t load today&rsquo;s games.</span>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center min-h-[44px] t-small text-accent hover:text-accent-hover transition-colors"
      >
        Try again
      </button>
    </div>
  );
}

const ORDER = { live: 0, halftime: 0, scheduled: 1, final: 2 };

export function ScoreTicker() {
  const todayStr = todayET();
  const { games, loading, error, retry } = useScoreboard(todayStr);
  const records = useCurrentRecords(games.length > 0);
  const fmt = useFormatTime();

  if (loading) {
    return (
      <div className={clsx(BOX, 'h-[82px] flex items-center px-6')}>
        <Skeleton variant="rectangle" height="h-12" className="w-full max-w-sm rounded-md" />
      </div>
    );
  }

  if (error) {
    return <ErrorTicker onRetry={retry} />;
  }

  if (games.length === 0) {
    return <EmptyTicker today={todayStr} />;
  }

  // Live first, then upcoming, then finals.
  const sorted = [...games].sort((a, b) => (ORDER[a.status] ?? 1) - (ORDER[b.status] ?? 1));

  return (
    <div data-testid="ticker-track" className="flex gap-2 overflow-x-auto scrollbar-hide snap-x">
      {sorted.map((game) => (
        <TickerTile key={game.id} game={game} records={records} fmt={fmt} />
      ))}
    </div>
  );
}
