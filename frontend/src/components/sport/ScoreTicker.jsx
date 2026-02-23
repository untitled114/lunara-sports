import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Activity, Zap, Radio, Signal, Database, Cpu } from 'lucide-react';
import { fetchGames } from '@/services/api';
import { getTeamColor, getLogoUrl } from '@/utils/teamColors';
import { useTheme } from '@/context/ThemeContext';
import { usePolling } from '@/hooks/usePolling';
import { useFormatTime } from '@/utils/formatTime';

function TickerItem({ game }) {
  const isLive = game.status === "live" || game.status === "halftime";
  const isFinal = game.status === "final";
  const isScheduled = game.status === "scheduled";
  const homeLogo = getLogoUrl(game.home_team);
  const awayLogo = getLogoUrl(game.away_team);
  const { playGlassClick } = useTheme();
  const fmt = useFormatTime();

  const homeWin = isFinal && game.home_score > game.away_score;
  const awayWin = isFinal && game.away_score > game.home_score;

  const homeColors = getTeamColor(game.home_team);
  const awayColors = getTeamColor(game.away_team);

  const tipoff = fmt.parts(game.start_time);

  return (
    <Link
      to={`/game/${game.id}`}
      onClick={() => playGlassClick()}
      className={`relative flex items-stretch px-8 border-r border-white/5 hover:bg-white/5 transition-all min-w-[300px] group/tick h-full ${isLive ? 'bg-indigo-500/[0.03]' : ''}`}
    >
      {/* Hardware Link Detail */}
      <div className="absolute top-0 left-0 bottom-0 w-px bg-gradient-to-b from-white/10 via-transparent to-white/10" />

      {/* Dynamic Hover Glow */}
      <div
        className="absolute inset-0 opacity-0 group-hover/tick:opacity-10 transition-opacity pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${homeColors.primary} 0%, transparent 70%)`
        }}
      />

      {/* Live State Accent */}
      {isLive && (
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.8)] z-20" />
      )}

      {/* Teams Track */}
      <div className="flex flex-col justify-center gap-4 py-5 relative z-10 flex-1">
        {/* Away team Node */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-[#0a0f1e] border border-white/10 flex items-center justify-center p-1.5 shadow-2xl shrink-0 group-hover/tick:scale-110 transition-transform ring-1 ring-white/5">
               <img src={awayLogo} alt="" className="h-full w-full object-contain drop-shadow-md" />
            </div>
            <div className="flex flex-col">
              <span className={`text-sm font-black uppercase tracking-tight truncate ${
                isFinal ? (awayWin ? 'text-white' : 'text-white/40') : 'text-white/90'
              }`}>
                {game.away_team}
              </span>
              {/* INCREASED OPACITY FROM 40% TO 70% */}
              <span className="text-[8px] font-black text-white/70 uppercase tracking-widest leading-none mt-1">Away Node</span>
            </div>
          </div>
          {!isScheduled && (
            <span className={`text-2xl font-black tabular-nums shrink-0 leading-none italic ${
              isFinal ? (awayWin ? 'text-white' : 'text-white/20') : 'text-white'
            }`}>
              {game.away_score}
            </span>
          )}
        </div>

        {/* Home team Node */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-[#0a0f1e] border border-white/10 flex items-center justify-center p-1.5 shadow-2xl shrink-0 group-hover/tick:scale-110 transition-transform ring-1 ring-white/5">
               <img src={homeLogo} alt="" className="h-full w-full object-contain drop-shadow-md" />
            </div>
            <div className="flex flex-col">
              <span className={`text-sm font-black uppercase tracking-tight truncate ${
                isFinal ? (homeWin ? 'text-white' : 'text-white/40') : 'text-white/90'
              }`}>
                {game.home_team}
              </span>
              {/* INCREASED OPACITY FROM 40% TO 70% */}
              <span className="text-[8px] font-black text-white/70 uppercase tracking-widest leading-none mt-1">Home Node</span>
            </div>
          </div>
          {!isScheduled && (
            <span className={`text-2xl font-black tabular-nums shrink-0 leading-none italic ${
              isFinal ? (homeWin ? 'text-white' : 'text-white/20') : 'text-white'
            }`}>
              {game.home_score}
            </span>
          )}
        </div>
      </div>

      {/* Internal Hardware Divider */}
      <div className="flex items-center mx-4">
         <div className="h-16 w-px bg-white/10 shadow-[0_0_10px_rgba(255,255,255,0.1)]" />
      </div>

      {/* Status Module */}
      <div className="flex flex-col items-center justify-center min-w-[110px] py-5 relative z-10">
        {isLive ? (
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2.5 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/30">
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-400"></span>
              </div>
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Active</span>
            </div>
            <div className="bg-black/60 border border-white/10 px-4 py-1.5 rounded-xl shadow-inner">
               <span className="text-[11px] font-black text-white tabular-nums uppercase tracking-widest">
                 {game.status === "halftime" ? "HALFTIME" : `QUARTER ${game.quarter}`}
               </span>
            </div>
            {game.clock && (
              <span className="text-[10px] font-mono font-bold text-indigo-400/70 tabular-nums mt-1">{game.clock}</span>
            )}
          </div>
        ) : isFinal ? (
          <div className="flex flex-col items-center gap-2 opacity-70 group-hover/tick:opacity-100 transition-all duration-500">
            <Database className="h-4 w-4 text-white/70" />
            <span className="text-[10px] font-black text-white/70 uppercase tracking-[0.3em]">Archived</span>
            <div className="bg-white/5 border border-white/10 px-2 py-0.5 rounded text-[9px] font-black text-white/90">
              {game.quarter > 4 ? (game.quarter === 5 ? 'F/OT' : `F/${game.quarter - 4}OT`) : 'FINAL'}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Cpu className="h-4 w-4 text-white/60" />
            <div className="text-xl font-black text-white tabular-nums tracking-tighter leading-none italic group-hover/tick:text-indigo-400 transition-colors">
              {tipoff.time}
            </div>
            <div className="flex items-center gap-2">
               <span className="text-[9px] font-black text-white/80 uppercase tracking-[0.2em]">
                 {tipoff.period}{tipoff.tz ? ` ${tipoff.tz}` : ''}
               </span>
               <div className="h-0.5 w-0.5 rounded-full bg-white/40" />
               <span className="text-[9px] font-black text-white/80 uppercase tracking-[0.2em]">
                 {fmt.day(game.start_time)}
               </span>
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}

export function ScoreTicker() {
  const [games, setGames] = useState([]);
  const { playGlassClick } = useTheme();

  const loadGames = () => fetchGames().then(setGames).catch(() => {});
  useEffect(() => { loadGames(); }, []);
  usePolling(loadGames);

  if (games.length === 0) return null;

  // Sort: live first, then scheduled, then final
  const sorted = [...games].sort((a, b) => {
    const order = { live: 0, halftime: 0, scheduled: 1, final: 2 };
    return (order[a.status] ?? 1) - (order[b.status] ?? 1);
  });

  const liveCount = games.filter(g => g.status === "live" || g.status === "halftime").length;

  return (
    <div className="h-[120px] flex items-stretch overflow-hidden relative">
      {/* Main Container Shell */}
      <div className="absolute inset-0 bg-[#050a18]/95 backdrop-blur-3xl border-b border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.5)] overflow-hidden">
        <div className="absolute inset-0 texture-mesh opacity-[0.03] pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-white/5" />
      </div>

      {/* Primary Control Hub Module */}
      <div className="flex-shrink-0 px-12 flex flex-col items-center justify-center border-r border-white/10 min-w-[220px] bg-black/40 relative overflow-hidden group/hub">
        <div className="absolute inset-0 bg-indigo-500/[0.03] group-hover/hub:bg-indigo-500/[0.08] transition-colors duration-1000" />
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500/40" />

        <div className="relative z-10 flex flex-col items-start gap-2">
           <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 shadow-inner">
                 <Signal className={`h-4 w-4 ${liveCount > 0 ? 'text-indigo-400 animate-pulse' : 'text-white/60'}`} />
              </div>
              <div className="flex flex-col">
                 <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/70">Protocol</span>
                 <span className="text-sm font-black uppercase tracking-[0.2em] text-white">Telemetry</span>
              </div>
           </div>

           <div className="flex items-center gap-3 mt-2">
              <div className="h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_10px_indigo] animate-pulse" />
              <span className="text-[11px] font-black uppercase tracking-[0.3em] text-indigo-400">
                {liveCount > 0 ? `${liveCount} UPLINKS ACTIVE` : 'SLATE LOADED'}
              </span>
           </div>
        </div>
      </div>

      {/* Dynamic Data Track */}
      <div className="flex-1 overflow-x-auto scrollbar-hide flex items-stretch">
        {sorted.map(game => (
          <TickerItem key={game.id} game={game} />
        ))}
      </div>

      {/* Archive Uplink Station */}
      <Link
        to="/scoreboard"
        onClick={() => playGlassClick()}
        className="flex-shrink-0 px-12 flex flex-col items-center justify-center border-l border-white/10 hover:bg-white/[0.05] transition-all min-w-[180px] group/archive bg-black/40 relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-indigo-500/[0.02] group-hover/archive:bg-indigo-500/[0.08] transition-colors duration-1000" />
        <div className="flex flex-col items-center gap-3 relative z-10">
           <div className="h-10 w-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-2xl group-hover/archive:scale-110 transition-transform group-hover/archive:border-indigo-500/50">
              <Zap className="h-5 w-5 text-indigo-400 opacity-70 group-hover/archive:opacity-100 group-hover/archive:animate-pulse" />
           </div>
           <div className="flex flex-col items-center">
              <span className="text-[11px] font-black uppercase tracking-[0.4em] text-white/70 group-hover:text-white transition-colors">Full Board</span>
              <span className="text-[8px] font-bold text-white/30 uppercase tracking-[0.2em] mt-1 group-hover:text-indigo-400/80 transition-colors">Access Archive</span>
           </div>
        </div>
      </Link>
    </div>
  );
}
