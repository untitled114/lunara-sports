import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchGame, fetchStandings, buildStandingsLookup } from '@/services/api';
import { LiveFeed } from '@/components/sport/LiveFeed';
import { BoxScore, FullBoxScore } from '@/components/sport/BoxScore';
import { Card, Badge, PageState, TeamMark, SectionHeader } from '@/components/ui';
import { getLogoUrl } from '@/utils/teamColors';
import { useTheme } from '@/context/ThemeContext';
import { usePolling } from '@/hooks/usePolling';
import { useGameFeed } from '@/hooks/useGameFeed';
import { useFormatTime } from '@/utils/formatTime';
import { PickTracker } from '@/components/sport/PickTracker';
import { ChevronLeft } from 'lucide-react';
import { seedBadge, recordLine, periodLabel } from '@/lib/gameMath';
import { formatLongDay, todayET } from '@/lib/et';

/* ─── Scheduled → live ─── */

// How long before tip-off a scheduled game's page starts checking for the switch to live.
export const PRE_TIP_WINDOW_MS = 30 * 60 * 1000;

/**
 * For a scheduled game: 0 when the page should poll for the switch to live now (tip-off
 * is within PRE_TIP_WINDOW_MS, or has passed), else the ms until that window opens.
 * null when there is nothing to wait for (not scheduled, or no tip-off time).
 */
export function tipOffPollDelay(game, nowMs) {
  if (game?.status !== 'scheduled' || !game.start_time) return null;
  const tip = Date.parse(game.start_time);
  if (Number.isNaN(tip)) return null;
  return Math.max(0, tip - PRE_TIP_WINDOW_MS - nowMs);
}

// True once a scheduled game is near (or past) tip-off. A game opened hours early flips
// at the right moment through one timer, with no reload.
function useNearTipOff(game) {
  const [near, setNear] = useState(false);
  const status = game?.status;
  const start = game?.start_time;
  useEffect(() => {
    const delay = tipOffPollDelay({ status, start_time: start }, Date.now());
    if (delay === null) {
      setNear(false);
      return undefined;
    }
    if (delay === 0) {
      setNear(true);
      return undefined;
    }
    setNear(false);
    // setTimeout can't wait longer than 2^31-1 ms (~24.8 days); a tip-off that far out
    // gets no timer (the page will have been reloaded long before).
    if (delay > 2 ** 31 - 1) return undefined;
    const id = setTimeout(() => setNear(true), delay);
    return () => clearTimeout(id);
  }, [status, start]);
  return near;
}

/* ─── Team Header (inside Scoreboard) ─── */

// The full team name, only when the API sent one that differs from the abbreviation
// (the TeamMark already shows the abbreviation; never render the same string twice).
export function teamNameLine(fullName, abbrev) {
  return fullName && fullName !== abbrev ? fullName : null;
}

function TeamHeader({ name, abbrev, score, isWinner, isAway, standing, standingsMeta, fallbackRecord, showScore = true }) {
  const logoUrl = getLogoUrl(abbrev);
  const { playGlassClick } = useTheme();
  // Same seed badge and record line as GameCard (lib/gameMath), so a team shows one
  // badge everywhere.
  const badge = seedBadge(standing, standingsMeta.isPrev);
  const record = standing
    ? recordLine(standing, standingsMeta.seasonLabel, standingsMeta.isPrev)
    : fallbackRecord;
  const nameLine = teamNameLine(name, abbrev);

  return (
    <div className={`flex flex-col gap-1.5 min-w-0 ${isAway ? '' : 'items-end text-right'}`}>
      {/* Row 1: logo+abbrev and score — the two things that must never crowd each other */}
      <div className={`flex items-center justify-between gap-2 sm:gap-4 w-full min-w-0 ${isAway ? '' : 'flex-row-reverse'}`}>
        <Link to={`/team/${abbrev}`} onClick={() => playGlassClick()} className="shrink-0">
          <TeamMark abbrev={abbrev} logoUrl={logoUrl} size="lg" />
        </Link>

        {showScore && (
          <span className="relative shrink-0">
            <span className={`t-score tnum ${isWinner ? 'text-text-1' : 'text-text-3'}`}>{score}</span>
            {isWinner && (
              <span className="absolute -right-2 -top-1 h-2 w-2 rounded-sm bg-live animate-ping" aria-hidden="true" />
            )}
          </span>
        )}
      </div>

      {/* Row 2: seed, full name (sm+) and record — never competes with the score for width */}
      <div className={`flex flex-col gap-1 min-w-0 ${isAway ? '' : 'items-end'}`}>
        {badge && (
          <span className="hidden sm:inline-flex">
            <Badge
              variant={badge.variant}
              title={badge.prev ? `${standingsMeta.seasonLabel} seeding` : undefined}
            >
              {badge.text}
            </Badge>
          </span>
        )}
        {nameLine && <p className="hidden sm:block t-small text-text-2 truncate max-w-[160px]">{nameLine}</p>}
        {record && <p className="t-small tnum text-text-3 whitespace-nowrap">{record}</p>}
      </div>
    </div>
  );
}

/* ─── Scoreboard Header ─── */

// "Sat, Oct 3 · 7:00 PM": the ET calendar day of tip-off, then the time in the same
// format GameCard uses (useFormatTime). No start time means nothing to show but "TBD".
export function tipOffLabel(startTime, fmt) {
  if (!startTime) return 'TBD';
  return `${formatLongDay(todayET(new Date(startTime)))} · ${fmt(startTime)}`;
}

function ScoreboardHeader({ game, standings, standingsMeta }) {
  const fmt = useFormatTime();
  const isFinal = game.status === 'final';
  const isLive = game.status === 'live' || game.status === 'halftime';
  // Before tip-off there is no score yet: show the tip-off date and time, never "0 0".
  const isScheduled = !isFinal && !isLive;
  const awayWin = isFinal && game.away_score > game.home_score;
  const homeWin = isFinal && game.home_score > game.away_score;


  return (
    <Card className="mb-4 sm:mb-6" data-testid="scoreboard-header">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <span className="t-small text-text-2">{game.venue || 'NBA Arena'}</span>

        {isLive ? (
          <div className="flex items-center gap-2">
            <Badge variant="live" dot>
              {game.status === 'halftime' ? 'Halftime' : periodLabel(game.quarter) || 'Live'}
            </Badge>
            {/* Only the clock the API sent: no made-up 12:00 when it has none. */}
            {game.clock && <span className="t-score tnum text-text-1">{game.clock}</span>}
          </div>
        ) : isFinal ? (
          <span className="t-label text-text-3">Final</span>
        ) : (
          <span className="t-small tnum text-text-1" data-testid="tip-off">
            {tipOffLabel(game.start_time, fmt)}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:gap-8 items-center">
        <TeamHeader
          name={game.away_team_full}
          abbrev={game.away_team}
          score={game.away_score}
          standing={standings[game.away_team]}
          standingsMeta={standingsMeta}
          fallbackRecord={game.away_record}
          isWinner={awayWin}
          isAway
          showScore={!isScheduled}
        />
        <TeamHeader
          name={game.home_team_full}
          abbrev={game.home_team}
          score={game.home_score}
          standing={standings[game.home_team]}
          standingsMeta={standingsMeta}
          fallbackRecord={game.home_record}
          isWinner={homeWin}
          isAway={false}
          showScore={!isScheduled}
        />
      </div>
    </Card>
  );
}

/* ─── Main Page ─── */

export default function GameDetailPage() {
  const { id } = useParams();
  const [game, setGame] = useState(null);
  const [standings, setStandings] = useState({});
  const [standingsMeta, setStandingsMeta] = useState({ seasonLabel: '', isPrev: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const { setArenaTheme, playGlassClick } = useTheme();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    Promise.all([
      fetchGame(id),
      fetchStandings().catch(() => null),
    ])
      .then(([gameData, standingsData]) => {
        if (!cancelled) {
          setGame(gameData);
          setStandings(buildStandingsLookup(standingsData));
          setStandingsMeta({
            seasonLabel: standingsData?.season_label || '',
            isPrev: !!standingsData?.is_previous_season,
          });
          setArenaTheme(gameData.home_team);
        }
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; setArenaTheme(null); };
  }, [id, setArenaTheme, reloadKey]);

  const { plays, connected, gameUpdate, pickUpdates, boxData } = useGameFeed(id, game?.status);

  useEffect(() => {
    if (gameUpdate && game) {
      setGame(prev => ({
        ...prev,
        home_score: gameUpdate.home_score ?? prev.home_score,
        away_score: gameUpdate.away_score ?? prev.away_score,
        status: gameUpdate.status ?? prev.status,
        quarter: gameUpdate.quarter ?? prev.quarter,
        clock: gameUpdate.clock ?? prev.clock,
      }));
    }
  }, [gameUpdate]);

  const isLive = game?.status === 'live' || game?.status === 'halftime';
  // A scheduled game polls too once tip-off is near, so the page flips to live (and
  // useGameFeed opens the live feed) without a reload.
  const nearTipOff = useNearTipOff(game);
  usePolling(() => {
    fetchGame(id).then(data => {
      setGame(prev => ({ ...prev, ...data }));
    }).catch(() => {});
  }, { enabled: isLive || nearTipOff, intervalOverride: 15 });

  if (loading) {
    return (
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 pt-8">
        <PageState kind="loading" />
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 pt-8">
        <PageState
          kind="error"
          title="Couldn't load this game."
          onRetry={() => setReloadKey((k) => k + 1)}
          action={
            <Link to="/scoreboard" onClick={() => playGlassClick()} className="t-small text-accent hover:text-accent-hover">
              Back to scores
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="pb-24 sm:pb-20 max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
      <h1 className="sr-only">{game.away_team} vs {game.home_team} — Game details</h1>

      {/* Back link */}
      <div className="mb-3 sm:mb-4 lg:mb-6">
        <Link
          to="/scoreboard"
          onClick={() => playGlassClick()}
          className="inline-flex items-center gap-1 t-label text-text-3 hover:text-text-1 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Back to scores
        </Link>
      </div>

      {/* Scoreboard Header */}
      <ScoreboardHeader game={game} standings={standings} standingsMeta={standingsMeta} />

      {/* AI Pick Tracker */}
      <PickTracker gameId={game.id} pickUpdates={pickUpdates} />

      {/* 3-column layout: Away | Feed | Home */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 lg:gap-6 mt-4 sm:mt-5 lg:mt-6 items-start">
        {/* LEFT: Away Team On Court */}
        <div className="lg:col-span-3 hidden lg:block">
          <BoxScore gameId={game.id} homeTeam={game.home_team} awayTeam={game.away_team} status={game.status} side="away" plays={plays} boxData={boxData} />
        </div>

        {/* CENTER: Live Feed */}
        <div className="lg:col-span-6">
          <LiveFeed gameId={game.id} status={game.status} homeTeam={game.home_team} awayTeam={game.away_team} plays={plays} connected={connected} boxData={boxData} />
        </div>

        {/* RIGHT: Home Team On Court */}
        <div className="lg:col-span-3 hidden lg:block">
          <BoxScore gameId={game.id} homeTeam={game.home_team} awayTeam={game.away_team} status={game.status} side="home" plays={plays} boxData={boxData} />
        </div>
      </div>

      {/* Mobile: Both Teams (On Court) */}
      <div className="lg:hidden mt-4 sm:mt-5 lg:mt-6">
        <BoxScore gameId={game.id} homeTeam={game.home_team} awayTeam={game.away_team} status={game.status} plays={plays} boxData={boxData} />
      </div>

      {/* Full Box Score */}
      <div className="mt-6 sm:mt-8 lg:mt-10">
        <SectionHeader title="Full box score" />
        <FullBoxScore gameId={game.id} homeTeam={game.home_team} awayTeam={game.away_team} status={game.status} boxData={boxData} />
      </div>
    </div>
  );
}
