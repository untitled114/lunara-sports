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

/* ─── Team Header (inside Scoreboard) ─── */

function TeamHeader({ name, abbrev, score, record, isWinner, isAway, seed, conf }) {
  const logoUrl = getLogoUrl(abbrev);
  const { playGlassClick } = useTheme();

  return (
    <div className={`flex flex-col gap-1.5 min-w-0 ${isAway ? '' : 'items-end text-right'}`}>
      {/* Row 1: logo+abbrev and score — the two things that must never crowd each other */}
      <div className={`flex items-center justify-between gap-2 sm:gap-4 w-full min-w-0 ${isAway ? '' : 'flex-row-reverse'}`}>
        <Link to={`/team/${abbrev}`} onClick={() => playGlassClick()} className="shrink-0">
          <TeamMark abbrev={abbrev} logoUrl={logoUrl} size="lg" />
        </Link>

        <span className="relative shrink-0">
          <span className={`t-score tnum ${isWinner ? 'text-text-1' : 'text-text-3'}`}>{score}</span>
          {isWinner && (
            <span className="absolute -right-2 -top-1 h-2 w-2 rounded-sm bg-live animate-ping" aria-hidden="true" />
          )}
        </span>
      </div>

      {/* Row 2: seed, full name (sm+) and record — never competes with the score for width */}
      <div className={`flex flex-col gap-1 min-w-0 ${isAway ? '' : 'items-end'}`}>
        {seed && (
          <span className="hidden sm:inline-flex">
            <Badge>{conf || 'Conf'} #{seed}</Badge>
          </span>
        )}
        <p className="hidden sm:block t-small text-text-2 truncate max-w-[160px]">{name}</p>
        {record && <p className="t-small tnum text-text-3 whitespace-nowrap">{record}</p>}
      </div>
    </div>
  );
}

/* ─── Scoreboard Header ─── */

function ScoreboardHeader({ game, standings }) {
  const fmt = useFormatTime();
  const isFinal = game.status === 'final';
  const isLive = game.status === 'live' || game.status === 'halftime';
  const awayWin = isFinal && game.away_score > game.home_score;
  const homeWin = isFinal && game.home_score > game.away_score;

  const awaySeed = standings[game.away_team]?.rank;
  const homeSeed = standings[game.home_team]?.rank;

  return (
    <Card className="mb-4 sm:mb-6" data-testid="scoreboard-header">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <span className="t-small text-text-2">{game.venue || 'NBA Arena'}</span>

        {isLive ? (
          <div className="flex items-center gap-2">
            <Badge variant="live" dot>
              {game.status === 'halftime' ? 'Halftime' : `Quarter ${game.quarter}`}
            </Badge>
            <span className="t-score tnum text-text-1">{game.clock || '12:00'}</span>
          </div>
        ) : isFinal ? (
          <span className="t-label text-text-3">Final</span>
        ) : (
          <span className="t-small tnum text-text-2">{fmt(game.start_time)}</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:gap-8 items-center">
        <TeamHeader
          name={game.away_team_full || game.away_team}
          abbrev={game.away_team}
          score={game.away_score}
          record={standings[game.away_team]?.record || game.away_record}
          isWinner={awayWin}
          isAway
          seed={awaySeed}
          conf={standings[game.away_team]?.conf}
        />
        <TeamHeader
          name={game.home_team_full || game.home_team}
          abbrev={game.home_team}
          score={game.home_score}
          record={standings[game.home_team]?.record || game.home_record}
          isWinner={homeWin}
          isAway={false}
          seed={homeSeed}
          conf={standings[game.home_team]?.conf}
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
  usePolling(() => {
    fetchGame(id).then(data => {
      setGame(prev => ({ ...prev, ...data }));
    }).catch(() => {});
  }, { enabled: isLive, intervalOverride: 15 });

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
      <ScoreboardHeader game={game} standings={standings} />

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
