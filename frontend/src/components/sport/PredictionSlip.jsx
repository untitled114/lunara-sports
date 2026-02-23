import React, { useState } from 'react';
import { Target, Lock, ChevronRight, TrendingUp } from 'lucide-react';
import { getTeamColor } from '@/utils/teamColors';
import { useTheme } from '@/context/ThemeContext';

export function PredictionSlip({ game, standings = {} }) {
  const [pick, setPick] = useState(null); // 'away' | 'home'
  const [locked, setLocked] = useState(false);
  const { playGlassClick, playThud } = useTheme();

  const homeColors = getTeamColor(game.home_team);
  const awayColors = getTeamColor(game.away_team);

  // Derive win probability from standings win percentages
  const homeSt = standings[game.home_team];
  const awaySt = standings[game.away_team];
  const homePct = homeSt ? parseFloat(homeSt.pct) : 0.5;
  const awayPct = awaySt ? parseFloat(awaySt.pct) : 0.5;
  const total = homePct + awayPct || 1;
  const homeProb = Math.round((homePct / total) * 100);
  const awayProb = 100 - homeProb;

  // Determine favorite/underdog labels
  const homeFav = homeProb >= 50;

  const handlePick = (side) => {
    if (locked) return;
    setPick(side);
    playGlassClick();
  };

  const handleLock = () => {
    if (!pick) return;
    setLocked(true);
    playThud();
  };

  // Points scale with confidence — higher edge = more points
  const edge = Math.abs(homeProb - 50);
  const basePoints = 100;
  const rewardPoints = basePoints + Math.round(edge * 10);

  return (
    <div className="liquid-glass rounded-[2rem] border-white/5 shadow-2xl overflow-hidden mb-6">
      <div className="px-6 py-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]" />
          <span className="text-[13px] font-black uppercase tracking-[0.2em] text-white">Prediction Slip</span>
        </div>
        {locked ? (
          <div className="flex items-center gap-1.5 text-[13px] font-black text-[var(--green)] uppercase tracking-widest">
            <Lock className="h-3 w-3" />
            Locked In
          </div>
        ) : (
          <div className="text-[13px] font-black text-orange-500 uppercase tracking-widest animate-pulse">
            Awaiting Pick
          </div>
        )}
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 gap-3">
          {/* Away Team Pick */}
          <button
            onClick={() => handlePick('away')}
            disabled={locked}
            className={`relative p-5 rounded-2xl border transition-all duration-300 group ${
              pick === 'away'
                ? 'bg-white/10 border-[var(--accent)] shadow-[0_0_30px_rgba(99,102,241,0.3)]'
                : 'bg-[#050a18] border-white/5 hover:border-white/20'
            } ${locked && pick !== 'away' ? 'grayscale opacity-20' : ''}`}
          >
            <div
              className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full shadow-[0_0_10px_rgba(255,255,255,0.2)]"
              style={{ backgroundColor: awayColors.primary }}
            />
            <p className="text-[13px] font-black text-white/40 uppercase mb-1.5 tracking-wider">{game.away_team}</p>
            <p className="text-base font-black text-white uppercase tracking-tight">{homeFav ? 'Underdog' : 'Favorite'}</p>
            {pick === 'away' && (
              <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[var(--accent)] shadow-[0_0_10px_var(--accent)]" />
            )}
          </button>

          {/* Home Team Pick */}
          <button
            onClick={() => handlePick('home')}
            disabled={locked}
            className={`relative p-5 rounded-2xl border transition-all duration-300 group ${
              pick === 'home'
                ? 'bg-white/10 border-[var(--accent)] shadow-[0_0_30px_rgba(99,102,241,0.3)]'
                : 'bg-[#050a18] border-white/5 hover:border-white/20'
            } ${locked && pick !== 'home' ? 'grayscale opacity-20' : ''}`}
          >
            <div
              className="absolute right-0 top-2 bottom-2 w-1 rounded-l-full shadow-[0_0_10px_rgba(255,255,255,0.2)]"
              style={{ backgroundColor: homeColors.primary }}
            />
            <p className="text-[13px] font-black text-white/40 uppercase mb-1.5 text-right tracking-wider">{game.home_team}</p>
            <p className="text-base font-black text-white uppercase tracking-tight text-right">{homeFav ? 'Favorite' : 'Underdog'}</p>
            {pick === 'home' && (
              <div className="absolute top-2 left-2 h-2 w-2 rounded-full bg-[var(--accent)] shadow-[0_0_10px_var(--accent)]" />
            )}
          </button>
        </div>

        <div className="deboss p-5 rounded-2xl space-y-4">
           <div className="flex justify-between items-center text-sm font-black uppercase tracking-[0.2em] text-white/60">
              <span>Forecast</span>
              <span className="text-white">{homeProb}% Win Prob</span>
           </div>
           <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex shadow-inner">
              <div className="h-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]" style={{ width: `${awayProb}%` }} />
              <div className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" style={{ width: `${homeProb}%` }} />
           </div>
        </div>

        <button
          onClick={handleLock}
          disabled={locked || !pick}
          className={`w-full py-5 rounded-2xl font-black uppercase tracking-[0.4em] text-[13px] transition-all duration-500 flex items-center justify-center gap-4 ${
            locked
              ? 'bg-[var(--green)]/10 text-[var(--green)] border border-[var(--green)]/20 cursor-default shadow-lg'
              : pick
                ? 'bg-white text-black hover:bg-indigo-500 hover:text-white shadow-2xl scale-[1.02]'
                : 'bg-white/5 text-white/50 border border-white/5 cursor-not-allowed'
          }`}
        >
          {locked ? (
            <>
              <Lock className="h-3.5 w-3.5" />
              Locked In
            </>
          ) : (
            <>
              Confirm Analysis
              <ChevronRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>

      <div className="p-3 bg-white/5 text-center border-t border-white/5">
         <div className="flex items-center justify-center gap-2 text-[13px] font-black text-white/40 uppercase tracking-widest">
            <TrendingUp className="h-3 w-3" />
            Potential Reward: {rewardPoints} PBP Points
         </div>
      </div>
    </div>
  );
}
