import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Signal } from 'lucide-react';
import clsx from 'clsx';
import { getLogoUrl } from '@/utils/teamColors';
import { useTheme } from '@/context/ThemeContext';
import { useScoreboard } from '@/hooks/useScoreboard';
import { useFormatTime } from '@/utils/formatTime';
import { Badge, Skeleton } from '@/components/ui';
import { todayET, formatLongDay } from '@/lib/et';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Mirrors the api.js fetch* convention (read-only GET, tolerant of failure).
// Lives here rather than in services/api.js because that file is owned by
// another task in this rollout; once it lands its own fetchNextGameDate this
// local copy can be swapped out.
async function fetchNextGameDate(afterIso) {
  try {
    const res = await fetch(`${API_URL}/games/next?after=${afterIso}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.date ?? null;
  } catch {
    return null;
  }
}

function TickerItem({ game }) {
  const isLive = game.status === 'live' || game.status === 'halftime';
  const isFinal = game.status === 'final';
  const isScheduled = game.status === 'scheduled';
  const homeLogo = getLogoUrl(game.home_team);
  const awayLogo = getLogoUrl(game.away_team);
  const { playGlassClick } = useTheme();
  const fmt = useFormatTime();

  const homeWin = isFinal && game.home_score > game.away_score;
  const awayWin = isFinal && game.away_score > game.home_score;

  const tipoff = fmt.parts(game.start_time);

  return (
    <Link
      to={`/game/${game.id}`}
      onClick={() => playGlassClick()}
      className={clsx(
        'relative flex items-stretch px-6 sm:px-8 border-r border-border hover:bg-surface-2 transition-colors min-w-[280px] h-full group',
        isLive && 'bg-accent/5'
      )}
    >
      {/* Live state accent */}
      {isLive && <div className="absolute top-0 left-0 right-0 h-[3px] bg-accent z-20" />}

      {/* Teams */}
      <div className="flex flex-col justify-center gap-4 py-5 relative z-10 flex-1">
        {/* Away team */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="h-9 w-9 rounded-md bg-surface-2 border border-border flex items-center justify-center p-1.5 shrink-0 group-hover:scale-110 transition-transform">
              <img src={awayLogo} alt="" width={24} height={24} className="h-full w-full object-contain" />
            </div>
            <div className="flex flex-col">
              <span className={clsx('t-small font-semibold truncate', isFinal && !awayWin ? 'text-text-3' : 'text-text-1')}>
                {game.away_team}
              </span>
              <span className="t-label text-text-3 leading-none mt-1">Away</span>
            </div>
          </div>
          {!isScheduled && (
            <span className={clsx('t-score tnum shrink-0', isFinal && !awayWin ? 'text-text-3' : 'text-text-1')}>
              {game.away_score}
            </span>
          )}
        </div>

        {/* Home team */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="h-9 w-9 rounded-md bg-surface-2 border border-border flex items-center justify-center p-1.5 shrink-0 group-hover:scale-110 transition-transform">
              <img src={homeLogo} alt="" width={24} height={24} className="h-full w-full object-contain" />
            </div>
            <div className="flex flex-col">
              <span className={clsx('t-small font-semibold truncate', isFinal && !homeWin ? 'text-text-3' : 'text-text-1')}>
                {game.home_team}
              </span>
              <span className="t-label text-text-3 leading-none mt-1">Home</span>
            </div>
          </div>
          {!isScheduled && (
            <span className={clsx('t-score tnum shrink-0', isFinal && !homeWin ? 'text-text-3' : 'text-text-1')}>
              {game.home_score}
            </span>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center mx-4">
        <div className="h-16 w-px bg-border" />
      </div>

      {/* Status */}
      <div className="flex flex-col items-center justify-center min-w-[100px] py-5 relative z-10 gap-1.5">
        {isLive ? (
          <>
            <Badge variant="live" dot>
              Live
            </Badge>
            <span className="t-small tnum text-text-1">{game.status === 'halftime' ? 'Halftime' : `Q${game.quarter}`}</span>
            {game.clock && <span className="t-label tnum text-text-3">{game.clock}</span>}
          </>
        ) : isFinal ? (
          <>
            <span className="t-label text-text-3">Final</span>
            {game.quarter > 4 && (
              <span className="t-label text-text-3">{game.quarter === 5 ? 'OT' : `${game.quarter - 4}OT`}</span>
            )}
          </>
        ) : (
          <>
            <span className="text-xl font-semibold tnum text-text-1 leading-none group-hover:text-accent transition-colors">
              {tipoff.time}
            </span>
            <span className="t-label text-text-3">
              {tipoff.period}
              {tipoff.tz ? ` ${tipoff.tz}` : ''}
            </span>
            <span className="t-label text-text-3">{fmt.day(game.start_time)}</span>
          </>
        )}
      </div>
    </Link>
  );
}

// Loaded, no games today: plain text plus a link to the next game day when
// the read-only lookup resolves one.
function EmptyTicker() {
  const [next, setNext] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchNextGameDate(todayET()).then((date) => {
      if (!cancelled) setNext(date);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="h-[120px] flex items-center justify-center gap-3 border-b border-border bg-surface-1 px-8">
      <span className="t-small text-text-2">No games today</span>
      {next && (
        <Link to={`/scoreboard?date=${next}`} className="t-small text-accent hover:text-accent-hover transition-colors">
          Next game: {formatLongDay(next)} →
        </Link>
      )}
    </div>
  );
}

export function ScoreTicker() {
  const { playGlassClick } = useTheme();
  const todayStr = todayET();
  const { games, loading } = useScoreboard(todayStr);

  if (loading) {
    return (
      <div className="h-[120px] flex items-center border-b border-border bg-surface-1 px-8">
        <Skeleton variant="rectangle" height="h-12" className="w-full max-w-sm rounded-md" />
      </div>
    );
  }

  if (games.length === 0) {
    return <EmptyTicker />;
  }

  // Sort: live first, then scheduled, then final
  const sorted = [...games].sort((a, b) => {
    const order = { live: 0, halftime: 0, scheduled: 1, final: 2 };
    return (order[a.status] ?? 1) - (order[b.status] ?? 1);
  });

  const liveCount = games.filter((g) => g.status === 'live' || g.status === 'halftime').length;
  const allFinal = games.every((g) => g.status === 'final');
  const statusLabel = liveCount > 0 ? `${liveCount} live` : allFinal ? 'Final scores' : `${games.length} games today`;

  return (
    <div className="h-[120px] flex items-stretch overflow-hidden relative bg-surface-1 border-b border-border">
      {/* Today's games */}
      <div className="hidden sm:flex flex-shrink-0 px-8 flex-col items-center justify-center border-r border-border min-w-[200px] bg-surface-2">
        <div className="flex flex-col items-start gap-2">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-accent/10 flex items-center justify-center border border-accent/20">
              <Signal className={clsx('h-4 w-4', liveCount > 0 ? 'text-accent animate-pulse' : 'text-text-3')} />
            </div>
            <span className="t-body font-semibold text-text-1">Today&rsquo;s games</span>
          </div>

          <div className="flex items-center gap-2 mt-1">
            {liveCount > 0 && <span className="h-2 w-2 rounded-sm bg-live animate-pulse" />}
            <span className="t-label tnum text-text-3">{statusLabel}</span>
          </div>
        </div>
      </div>

      {/* Ticker track */}
      <div className="flex-1 overflow-x-auto scrollbar-hide flex items-stretch">
        {sorted.map((game) => (
          <TickerItem key={game.id} game={game} />
        ))}
      </div>

      {/* Full board link */}
      <Link
        to="/scoreboard"
        onClick={() => playGlassClick()}
        className="hidden sm:flex flex-shrink-0 px-8 flex-col items-center justify-center border-l border-border hover:bg-surface-2 transition-colors min-w-[160px] bg-surface-2/60 group"
      >
        <div className="flex flex-col items-center gap-2">
          <div className="h-10 w-10 rounded-md bg-surface-1 border border-border flex items-center justify-center group-hover:border-accent transition-colors">
            <ChevronRight className="h-5 w-5 text-accent" />
          </div>
          <div className="flex flex-col items-center">
            <span className="t-label text-text-2 group-hover:text-text-1 transition-colors">Full board</span>
            <span className="t-label text-text-3 mt-0.5">See all games</span>
          </div>
        </div>
      </Link>
    </div>
  );
}
