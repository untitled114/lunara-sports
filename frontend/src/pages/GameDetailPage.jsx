import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchGame, fetchStandings, fetchPlays, fetchBoxScore, buildStandingsLookup } from '@/services/api';
import { LiveFeed } from '@/components/sport/LiveFeed';
import { BoxScore, FullBoxScore } from '@/components/sport/BoxScore';
import { Skeleton, Badge } from '@/components/ui';
import { getTeamColor, getLogoUrl } from '@/utils/teamColors';
import { useTheme } from '@/context/ThemeContext';
import { usePolling } from '@/hooks/usePolling';
import { useGameFeed } from '@/hooks/useGameFeed';
import { useFormatTime } from '@/utils/formatTime';
import { PickTracker } from '@/components/sport/PickTracker';
import { ChevronLeft, MapPin, Tv, Shield, Info, TrendingUp, BarChart3 } from 'lucide-react';

/* ─── Team Header (inside Scoreboard) ─── */

function TeamHeader({ name, abbrev, score, record, isWinner, isAway, seed, conf }) {
  const colors = getTeamColor(abbrev);
  const logoUrl = getLogoUrl(abbrev);
  const { playGlassClick } = useTheme();

  return (
    <div className={`flex items-center gap-4 sm:gap-6 lg:gap-8 ${isAway ? 'flex-row' : 'flex-row-reverse text-right'}`}>
      <Link
        to={`/team/${abbrev}`}
        onClick={() => playGlassClick()}
        className="relative group"
      >
        <div
          className="absolute -inset-3 sm:-inset-4 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity"
          style={{ backgroundColor: colors.primary }}
        />
        <div className="relative h-14 w-14 sm:h-20 sm:w-20 lg:h-24 lg:w-24 flex items-center justify-center rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] bg-[#050a18] border-t-2 border-white/20 border-x border-white/5 border-b-2 border-black/80 shadow-2xl group-hover:scale-110 transition-transform active:scale-95 p-3 sm:p-4 lg:p-5 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
          <img src={logoUrl} alt={abbrev} className="w-full h-full object-contain relative z-10 drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]" />
        </div>
      </Link>

      <div className="flex flex-col gap-1 min-w-0">
        <div className={`flex items-center gap-3 ${isAway ? 'flex-row' : 'flex-row-reverse'}`}>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tighter text-white leading-none truncate uppercase italic">{abbrev}</h2>
          {seed && (
            <span className="hidden sm:inline text-[11px] font-black bg-white/10 border border-white/20 px-2 py-0.5 rounded text-white/70 uppercase tracking-widest">{conf || 'Conf'} #{seed}</span>
          )}
        </div>
        <p className="hidden sm:block text-[13px] font-black text-white/70 uppercase tracking-[0.3em] truncate max-w-[180px]">
          {name}
        </p>
        {record && (
          <p className="text-sm font-bold text-indigo-400 tabular-nums tracking-[0.2em]">
            {record}
          </p>
        )}
      </div>

      <div className="relative flex items-center justify-center min-w-[50px] sm:min-w-[80px]">
        <div className={`text-5xl sm:text-6xl lg:text-7xl font-black tabular-nums tracking-tighter mix-blend-plus-lighter ${isWinner ? 'text-white' : 'text-white/15'}`}>
          {score}
        </div>
        {isWinner && (
          <div className="absolute -right-4 top-0 h-2 w-2 rounded-full bg-white animate-ping" />
        )}
      </div>
    </div>
  );
}

/* ─── Scoreboard Header ─── */

function ScoreboardHeader({ game, standings }) {
  const fmt = useFormatTime();
  const isFinal = game.status === "final";
  const isLive = game.status === "live" || game.status === "halftime";
  const awayWin = isFinal && game.away_score > game.home_score;
  const homeWin = isFinal && game.home_score > game.away_score;

  const homeColors = getTeamColor(game.home_team);
  const awayColors = getTeamColor(game.away_team);

  const awaySeed = standings[game.away_team]?.rank;
  const homeSeed = standings[game.home_team]?.rank;

  return (
    <div className="relative overflow-hidden rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[3rem] liquid-mirror border-white/10 shadow-2xl luxury-edge group/sb">
      {/* Dynamic Stadium Background */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none blur-[120px] transition-all duration-1000"
        style={{
          background: `
            radial-gradient(circle at 20% 50%, ${awayColors.primary} 0%, transparent 60%),
            radial-gradient(circle at 80% 50%, ${homeColors.primary} 0%, transparent 60%),
            radial-gradient(at 50% 0%, white 0%, transparent 40%)
          `
        }}
      />

      {/* Hardware Accents */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      <div className="absolute inset-0 texture-mesh opacity-5 pointer-events-none" />
      <div className="scanline opacity-10 pointer-events-none" />

      <div className="relative p-5 sm:p-8 lg:p-12 xl:p-16">
        {/* Telemetry Bar Top */}
        <div className="hidden sm:flex justify-between items-center mb-4 sm:mb-8 lg:mb-12 px-4">
          <div className="flex items-center gap-4 text-[13px] font-black text-white/70 uppercase tracking-[0.4em]">
            <span className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_indigo]" /> Signal: Stable</span>
            <span className="hidden sm:inline">Sector: {game.venue?.split(' ')[0].toUpperCase() || 'NBA'}</span>
          </div>

          <div className="flex flex-col items-center">
            {isLive ? (
              <div className="deboss px-5 py-2 sm:px-10 sm:py-4 rounded-3xl flex flex-col items-center shadow-2xl border-white/10 relative overflow-hidden group/clock">
                <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover/clock:opacity-100 transition-opacity" />
                <Badge variant="success" size="sm" dot className="mb-1 animate-pulse border-none bg-transparent text-[var(--green)] font-black tracking-[0.3em]">
                  {game.status === "halftime" ? "HALFTIME" : `QUARTER ${game.quarter}`}
                </Badge>
                <span className="text-2xl sm:text-3xl lg:text-4xl font-black tabular-nums text-white tracking-[0.2em] drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">{game.clock || "12:00"}</span>
              </div>
            ) : isFinal ? (
              <div className="deboss px-5 py-2 sm:px-10 sm:py-4 rounded-full border-white/10 shadow-xl bg-black/20">
                <span className="text-[13px] font-black text-white/60 tracking-[0.5em] uppercase italic">Final</span>
              </div>
            ) : (
              <div className="deboss px-5 py-2 sm:px-10 sm:py-4 rounded-3xl border-white/10 flex flex-col items-center shadow-xl bg-black/20">
                <span className="text-[11px] font-black text-white/40 tracking-[0.4em] uppercase mb-1">Commencing</span>
                <span className="text-2xl sm:text-3xl font-black text-white tracking-widest tabular-nums">
                  {fmt(game.start_time)}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 text-[13px] font-black text-white/70 uppercase tracking-[0.4em] text-right">
            <span className="hidden sm:inline">Node: #{game.id?.slice(-6)}</span>
            <span className="flex items-center gap-2">Sync: Online <div className="h-1.5 w-1.5 rounded-full bg-[var(--green)] shadow-[0_0_8px_var(--green)]" /></span>
          </div>
        </div>

        {/* Mobile-only status pill */}
        <div className="flex sm:hidden justify-center mb-4">
          {isLive ? (
            <div className="deboss px-5 py-2 rounded-2xl flex flex-col items-center border-white/10 relative overflow-hidden">
              <Badge variant="success" size="sm" dot className="mb-1 animate-pulse border-none bg-transparent text-[var(--green)] font-black tracking-[0.3em]">
                {game.status === "halftime" ? "HALFTIME" : `Q${game.quarter}`}
              </Badge>
              <span className="text-2xl font-black tabular-nums text-white tracking-[0.2em]">{game.clock || "12:00"}</span>
            </div>
          ) : isFinal ? (
            <div className="deboss px-5 py-2 rounded-full border-white/10 bg-black/20">
              <span className="text-[13px] font-black text-white/60 tracking-[0.5em] uppercase italic">Final</span>
            </div>
          ) : (
            <div className="deboss px-5 py-2 rounded-2xl border-white/10 flex flex-col items-center bg-black/20">
              <span className="text-[10px] font-black text-white/40 tracking-[0.4em] uppercase mb-0.5">Commencing</span>
              <span className="text-xl font-black text-white tracking-widest tabular-nums">{fmt(game.start_time)}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-10 lg:gap-16 items-center max-w-6xl mx-auto">
          <TeamHeader
            name={game.away_team_full || game.away_team}
            abbrev={game.away_team}
            score={game.away_score}
            record={standings[game.away_team]?.record || game.away_record}
            isWinner={awayWin}
            isAway={true}
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

        <div className="hidden sm:flex mt-12 pt-8 border-t border-white/5 flex-wrap items-center justify-center gap-12 text-[11px] font-black text-white/50 uppercase tracking-[0.3em]">
          <div className="flex items-center gap-3 group/info">
            <MapPin className="h-4 w-4 transition-colors group-hover/info:text-white" style={{ color: homeColors.primary }} />
            <span className="group-hover/info:text-white transition-colors">{game.venue || "NBA Arena"}</span>
          </div>
          <div className="flex items-center gap-3 group/info">
            <Tv className="h-4 w-4 transition-colors group-hover/info:text-white" style={{ color: awayColors.primary }} />
            <span className="group-hover/info:text-white transition-colors">Broadcast: Local / NBA League Pass</span>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <Shield className="h-4 w-4 text-indigo-500/60" />
            <span className="text-white/40">Referees: Verified</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */

export default function GameDetailPage() {
  const { id } = useParams();
  const [game, setGame] = useState(null);
  const [standings, setStandings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { setArenaTheme, playGlassClick } = useTheme();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
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
      .catch(() => { if (!cancelled) setError("Game not found"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; setArenaTheme(null); };
  }, [id, setArenaTheme]);

  const { gameUpdate, pickUpdates } = useGameFeed(id, game?.status);

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
        <Skeleton variant="rectangle" width="w-full" height="h-64" className="rounded-[3rem] mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-3"><Skeleton variant="rectangle" height="h-[400px]" className="rounded-[2rem]" /></div>
          <div className="lg:col-span-6"><Skeleton variant="rectangle" height="h-[600px]" className="rounded-[2rem]" /></div>
          <div className="lg:col-span-3 space-y-6"><Skeleton variant="rectangle" height="h-48" className="rounded-[2rem]" /><Skeleton variant="rectangle" height="h-32" className="rounded-[2rem]" /></div>
        </div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="flex flex-col items-center justify-center py-40 px-6 text-center animate-fadeIn">
        <div className="h-16 w-16 rounded-full bg-[var(--red)]/10 flex items-center justify-center mb-4 border border-[var(--red)]/20">
          <Info className="h-8 w-8 text-[var(--red)]" />
        </div>
        <h2 className="text-2xl font-black text-white mb-3">{error || "Game not found"}</h2>
        <Link to="/scoreboard" onClick={() => playGlassClick()} className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black rounded-xl text-[12px] font-black uppercase tracking-widest hover:scale-105 transition">
          <ChevronLeft className="h-4 w-4" /> Back to Scores
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn pb-24 sm:pb-20 max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
      {/* Back link */}
      <div className="mb-3 sm:mb-4 lg:mb-6">
        <Link
          to="/scoreboard"
          onClick={() => playGlassClick()}
          className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-white/30 hover:text-white transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Back to Scores
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
          <BoxScore gameId={game.id} homeTeam={game.home_team} awayTeam={game.away_team} status={game.status} side="away" />
        </div>

        {/* CENTER: Live Feed */}
        <div className="lg:col-span-6">
          <LiveFeed gameId={game.id} status={game.status} homeTeam={game.home_team} awayTeam={game.away_team} />
        </div>

        {/* RIGHT: Home Team On Court */}
        <div className="lg:col-span-3 hidden lg:block">
          <BoxScore gameId={game.id} homeTeam={game.home_team} awayTeam={game.away_team} status={game.status} side="home" />
        </div>

      </div>

      {/* Mobile: Both Teams (On Court) */}
      <div className="lg:hidden mt-4 sm:mt-5 lg:mt-6">
        <BoxScore gameId={game.id} homeTeam={game.home_team} awayTeam={game.away_team} status={game.status} />
      </div>

      {/* Full Box Score */}
      <div className="mt-6 sm:mt-8 lg:mt-10">
        <div className="flex items-center gap-4 mb-6">
          <BarChart3 className="h-5 w-5 text-indigo-400/60" />
          <h2 className="text-[13px] font-black text-white/40 uppercase tracking-[0.4em]">Full Box Score</h2>
        </div>
        <FullBoxScore gameId={game.id} homeTeam={game.home_team} awayTeam={game.away_team} status={game.status} />
      </div>
    </div>
  );
}
