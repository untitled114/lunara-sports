import React, { useState } from 'react';
import { Target, Lock, ChevronRight, TrendingUp } from 'lucide-react';
import clsx from 'clsx';
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
    <div className="bg-surface-1 rounded-lg border border-border shadow-2xl overflow-hidden mb-6">
      <div className="px-6 py-4 border-b border-border bg-surface-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-warn" />
          <span className="t-label text-text-1">Prediction slip</span>
        </div>
        {locked ? (
          <div className="flex items-center gap-1.5 t-label text-live">
            <Lock className="h-3 w-3" />
            Locked in
          </div>
        ) : (
          <div className="t-label text-warn animate-pulse">Awaiting pick</div>
        )}
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 gap-3">
          {/* Away Team Pick */}
          <button
            onClick={() => handlePick('away')}
            disabled={locked}
            className={clsx(
              'relative p-5 rounded-lg border transition-all duration-300 group',
              pick === 'away' ? 'bg-accent/10 border-accent' : 'bg-surface-2 border-border hover:border-border-strong',
              locked && pick !== 'away' && 'grayscale opacity-20'
            )}
          >
            <div className="absolute left-0 top-2 bottom-2 w-1 rounded-sm" style={{ backgroundColor: awayColors.primary }} />
            <p className="t-label text-text-3 mb-1.5">{game.away_team}</p>
            <p className="t-body font-semibold text-text-1">{homeFav ? 'Underdog' : 'Favorite'}</p>
            {pick === 'away' && <div className="absolute top-2 right-2 h-2 w-2 rounded-sm bg-accent" />}
          </button>

          {/* Home Team Pick */}
          <button
            onClick={() => handlePick('home')}
            disabled={locked}
            className={clsx(
              'relative p-5 rounded-lg border transition-all duration-300 group text-right',
              pick === 'home' ? 'bg-accent/10 border-accent' : 'bg-surface-2 border-border hover:border-border-strong',
              locked && pick !== 'home' && 'grayscale opacity-20'
            )}
          >
            <div className="absolute right-0 top-2 bottom-2 w-1 rounded-sm" style={{ backgroundColor: homeColors.primary }} />
            <p className="t-label text-text-3 mb-1.5">{game.home_team}</p>
            <p className="t-body font-semibold text-text-1">{homeFav ? 'Favorite' : 'Underdog'}</p>
            {pick === 'home' && <div className="absolute top-2 left-2 h-2 w-2 rounded-sm bg-accent" />}
          </button>
        </div>

        <div className="bg-surface-2 p-5 rounded-lg space-y-4">
          <div className="flex justify-between items-center">
            <span className="t-label text-text-3">Forecast</span>
            <span className="t-small tnum font-semibold text-text-1">{homeProb}% win probability</span>
          </div>
          <div className="h-1.5 w-full bg-surface-1 rounded-sm overflow-hidden flex">
            <div className="h-full bg-warn" style={{ width: `${awayProb}%` }} />
            <div className="h-full bg-accent" style={{ width: `${homeProb}%` }} />
          </div>
        </div>

        <button
          onClick={handleLock}
          disabled={locked || !pick}
          className={clsx(
            'w-full py-5 rounded-lg t-small font-semibold transition-all duration-500 flex items-center justify-center gap-4',
            locked
              ? 'bg-live/10 text-live border border-live/20 cursor-default shadow-lg'
              : pick
                ? 'bg-accent-fill text-white hover:bg-accent-fill-hover shadow-2xl'
                : 'bg-surface-2 text-text-3 border border-border cursor-not-allowed'
          )}
        >
          {locked ? (
            <>
              <Lock className="h-3.5 w-3.5" />
              Locked in
            </>
          ) : (
            <>
              Confirm pick
              <ChevronRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>

      <div className="p-3 bg-surface-2 text-center border-t border-border">
        <div className="flex items-center justify-center gap-2 t-label text-text-3">
          <TrendingUp className="h-3 w-3" />
          Potential reward: {rewardPoints} PBP points
        </div>
      </div>
    </div>
  );
}
