import React from 'react';
import { Zap } from 'lucide-react';
import { getTeamColor } from '@/utils/teamColors';

export function MomentumMeter({ game }) {
  const homeColors = getTeamColor(game.home_team);
  const awayColors = getTeamColor(game.away_team);

  const isLive = game.status === 'live' || game.status === 'halftime';
  const isFinal = game.status === 'final';

  // Derive momentum from score differential: positive = home leading
  const diff = (game.home_score || 0) - (game.away_score || 0);
  // Clamp to [-50, 50] range, scale so a 20-point lead = full meter
  const momentumValue = isLive || isFinal ? Math.max(-50, Math.min(50, diff * 2.5)) : 0;
  const needleRotation = (momentumValue / 50) * 45;

  // Determine leading team and margin
  const margin = Math.abs(diff);
  const leadingTeam = diff > 0 ? game.home_team : diff < 0 ? game.away_team : null;

  // Impact level based on point differential
  let impactLabel = 'Even';
  let impactColor = '#ffffff';
  if (margin >= 15) {
    impactLabel = 'Blowout';
    impactColor = diff > 0 ? homeColors.primary : awayColors.primary;
  } else if (margin >= 8) {
    impactLabel = 'High';
    impactColor = diff > 0 ? homeColors.primary : awayColors.primary;
  } else if (margin >= 3) {
    impactLabel = 'Medium';
    impactColor = diff > 0 ? homeColors.primary : awayColors.primary;
  } else if (margin > 0) {
    impactLabel = 'Low';
    impactColor = diff > 0 ? homeColors.primary : awayColors.primary;
  }

  // Score display
  const scoreDisplay = isLive || isFinal
    ? (leadingTeam ? `${leadingTeam} +${margin}` : 'Tied')
    : '—';

  return (
    <div className={`bg-[var(--bg-card)] rounded-2xl border border-white/5 overflow-hidden shadow-xl mb-6 transition-all duration-500 ${margin > 10 ? 'ring-1 ring-orange-500/20' : ''}`}>
      <div className="px-5 py-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Zap className={`h-4 w-4 text-yellow-500 fill-yellow-500/20 shadow-[0_0_10px_rgba(234,179,8,0.4)] ${isLive ? 'animate-pulse' : ''}`} />
          <span className="text-[13px] font-black uppercase tracking-[0.2em] text-white">Momentum <span className="text-white/50">Telemetry</span></span>
        </div>
        <div className="glass-pill px-3 py-1 rounded text-[13px] font-black uppercase tracking-widest text-white/40">
          {isLive ? 'Active Feed' : isFinal ? 'Final' : 'Pre-game'}
        </div>
      </div>

      <div className="p-10 flex flex-col items-center">
        {/* Skeuomorphic Gauge */}
        <div className="relative w-full max-w-[300px] h-24 overflow-hidden">
          <div className="absolute bottom-0 left-0 right-0 h-[300px] rounded-full border-[14px] border-white/5 shadow-inner" />
          <div
            className="absolute bottom-0 left-0 right-0 h-[300px] rounded-full border-[14px] opacity-20 blur-sm"
            style={{
              borderColor: 'transparent',
              borderLeftColor: awayColors.primary,
              borderRightColor: homeColors.primary,
              transform: 'rotate(-45deg)'
            }}
          />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white border-2 border-slate-900 shadow-2xl z-20" />
          <div
            className="absolute bottom-0 left-1/2 w-1.5 h-24 bg-gradient-to-t from-white to-indigo-500 origin-bottom transition-transform duration-1000 ease-out z-10 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.6)]"
            style={{ transform: `translateX(-50%) rotate(${needleRotation}deg)` }}
          />
          <div className="absolute bottom-2 left-4 text-[13px] font-black uppercase tracking-widest" style={{ color: awayColors.primary }}>{game.away_team}</div>
          <div className="absolute bottom-2 right-4 text-[13px] font-black uppercase tracking-widest" style={{ color: homeColors.primary }}>{game.home_team}</div>
        </div>

        <div className="mt-8 flex gap-16 w-full justify-center">
           <div className="text-center">
              <p className="text-[13px] font-black text-white/40 uppercase tracking-[0.2em] mb-2">Lead</p>
              <p className="text-2xl font-black text-white uppercase tracking-tighter tabular-nums">{scoreDisplay}</p>
           </div>
           <div className="h-12 w-px bg-white/5 self-center mx-4" />
           <div className="text-center">
              <p className="text-[13px] font-black text-white/40 uppercase tracking-[0.2em] mb-2">Impact Level</p>
              <p className="text-2xl font-black uppercase tracking-tighter" style={{ color: impactColor }}>{impactLabel}</p>
           </div>
        </div>
      </div>
    </div>
  );
}
