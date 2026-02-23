import React from 'react';
import { getTeamColor } from '@/utils/teamColors';

import { useTheme } from '@/context/ThemeContext';

export function CourtView({ game, plays = [] }) {
  const { playGlassClick, accentColors } = useTheme();
  const homeColors = getTeamColor(game.home_team);
  const awayColors = getTeamColor(game.away_team);

  const handleZoneClick = (zone) => {
    playGlassClick();
    // In a real app, this would filter the feed state
    console.log(`Filtering by zone: ${zone}`);
  };

  return (
    <div className="liquid-mirror rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl mb-8 relative group transition-all duration-500 hover:border-white/10">
      <div className="px-8 py-5 border-b border-white/5 bg-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
           <div className="h-2 w-2 rounded-full bg-orange-500 animate-pulse shadow-[0_0_10px_orange]" />
           <span className="text-sm font-black uppercase tracking-[0.3em] text-white">Live Court <span className="text-white/50">Telemetry</span></span>
        </div>
        <div className="flex gap-6">
           <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: awayColors.primary }} />
              <span className="text-sm font-black text-white/40 uppercase tracking-widest">{game.away_team}</span>
           </div>
           <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: homeColors.primary }} />
              <span className="text-sm font-black text-white/40 uppercase tracking-widest">{game.home_team}</span>
           </div>
        </div>
      </div>

      <div className="p-10">
        {/* Skeuomorphic Court */}
        <div className="relative aspect-[16/9] w-full bg-[#050a18] rounded-[2rem] border border-white/10 shadow-inner overflow-hidden court-grid group/court">
           {/* Dynamic Territory Glow */}
           <div 
             className="absolute inset-0 opacity-10 transition-opacity duration-1000"
             style={{
               background: `linear-gradient(90deg, ${awayColors.primary} 0%, transparent 50%, ${homeColors.primary} 100%)`
             }}
           />

           {/* Court Markings */}
           <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="h-full w-px bg-white/10" />
              <div className="h-32 w-32 rounded-full border border-white/10" />
           </div>
           
           {/* Interactive Zones */}
           <button 
             onClick={() => handleZoneClick('Left Paint')}
             className="absolute inset-y-0 left-0 w-1/4 bg-white/[0.02] border-r border-white/5 hover:bg-white/5 transition-colors group/zone"
           >
              <span className="absolute top-4 left-4 text-[13px] font-black text-white/10 group-hover/zone:text-white/40 uppercase tracking-widest">Left Paint</span>
           </button>
           
           <button 
             onClick={() => handleZoneClick('Right Paint')}
             className="absolute inset-y-0 right-0 w-1/4 bg-white/[0.02] border-l border-white/5 hover:bg-white/5 transition-colors group/zone"
           >
              <span className="absolute top-4 right-4 text-[13px] font-black text-white/10 group-hover/zone:text-white/40 uppercase tracking-widest text-right">Right Paint</span>
           </button>

           {/* Live Shot Pings */}
           <div 
             className="absolute top-[40%] left-[15%] h-4 w-4 rounded-full border-2 border-white/50 animate-ping cursor-help"
             style={{ backgroundColor: awayColors.primary, boxShadow: `0 0 20px ${awayColors.primary}` }}
             title="Curry: 3PT Made"
           />
           <div 
             className="absolute top-[65%] right-[18%] h-4 w-4 rounded-full border-2 border-white/50 animate-ping cursor-help"
             style={{ backgroundColor: homeColors.primary, boxShadow: `0 0 20px ${homeColors.primary}` }}
             title="James: Layup Made"
           />
           
           <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-2 glass-pill rounded-full border-white/10 shadow-2xl backdrop-blur-xl">
              <span className="text-[13px] font-black text-white uppercase tracking-[0.5em] ml-1">Live Telemetry Active</span>
           </div>
        </div>
      </div>
      
      {/* Precision Detail */}
      <div className="px-10 pb-8 flex justify-between items-center text-[13px] font-black text-white/50 uppercase tracking-widest">
         <div className="flex gap-4">
            <span>Grid: 100px</span>
            <span>Scale: 1:1</span>
         </div>
         <div className="flex items-center gap-2 text-indigo-400">
            <div className="h-1 w-1 rounded-full bg-indigo-400 animate-pulse" />
            Synchronized
         </div>
      </div>
    </div>
  );
}
