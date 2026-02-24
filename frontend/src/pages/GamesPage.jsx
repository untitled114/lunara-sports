import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchStandings, buildStandingsLookup } from '@/services/api';
import { GameCard } from '@/components/sport/GameCard';
import { DateNav } from '@/components/sport/DateNav';
import { Skeleton } from '@/components/ui';
import { useTheme } from '@/context/ThemeContext';
import { useScoreboard } from '@/hooks/useScoreboard';

const statusOrder = { live: 0, halftime: 1, scheduled: 2, final: 3 };

export default function GamesPage() {
  const [searchParams] = useSearchParams();
  const [standings, setStandings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all' | 'live' | 'upcoming' | 'final'

  const { playGlassClick } = useTheme();

  // Use Eastern time for "today" default since NBA games are scheduled in ET
  const now = new Date();
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const etYear = et.getFullYear();
  const etMonth = String(et.getMonth() + 1).padStart(2, '0');
  const etDay = String(et.getDate()).padStart(2, '0');
  const dateStr = searchParams.get('date') || `${etYear}-${etMonth}-${etDay}`;

  // Games come from shared WS scoreboard channel (REST fallback when disconnected)
  const { games: rawGames } = useScoreboard(dateStr);
  const games = [...rawGames].sort((a, b) => (statusOrder[a.status] ?? 4) - (statusOrder[b.status] ?? 4));

  // Standings: one-shot fetch (doesn't need WS)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchStandings()
      .then((standingsData) => {
        if (!cancelled) setStandings(buildStandingsLookup(standingsData));
      })
      .catch(() => {
        if (!cancelled) setError("Unable to load standings.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [dateStr]);

  const filteredGames = games.filter(g => {
    if (filter === 'all') return true;
    if (filter === 'live') return g.status === 'live' || g.status === 'halftime';
    if (filter === 'upcoming') return g.status === 'scheduled';
    return g.status === filter;
  });

  const handleFilterChange = (newFilter) => {
    if (newFilter !== filter) {
      playGlassClick();
      setFilter(newFilter);
    }
  };

  return (
    <div className="space-y-12 animate-fadeIn max-w-[1400px] mx-auto pb-32 relative pt-8">
      {/* Background Environment Detail */}
      <div className="absolute inset-0 -top-20 z-0 h-[500px] jumbotron-grid opacity-40 pointer-events-none" />
      <div className="scanline" />

      <div className="relative z-10 space-y-12">
        <div className="animate-boot flex flex-col gap-2">
          <DateNav current={dateStr} />
        </div>

        {/* Interactive Control Strip */}
        <div className="animate-boot flex flex-col md:flex-row items-center justify-between gap-6 bg-[#050a18]/60 p-2 rounded-[2.5rem] border border-white/5 shadow-2xl backdrop-blur-md rim-light" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center gap-2">
            {[
              { id: 'all', label: 'All Telemetry' },
              { id: 'live', label: 'Active Feeds' },
              { id: 'upcoming', label: 'Scheduled' },
              { id: 'final', label: 'Archived' }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => handleFilterChange(f.id)}
                className={`px-8 py-3 rounded-2xl text-sm font-black uppercase tracking-widest transition-all duration-500 ${
                  filter === f.id
                    ? 'bg-white text-black shadow-[0_0_30px_rgba(255,255,255,0.3)] scale-105'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-6 px-8 border-l border-white/5 hidden md:flex">
             <div className="flex flex-col items-end">
                <span className="text-[13px] font-black uppercase tracking-[0.3em] text-white/50">System Status</span>
                <span className="text-sm font-bold text-indigo-400 uppercase tracking-widest">Nominal</span>
             </div>
             <div className="h-10 w-px bg-white/5" />
             <div className="flex flex-col">
                <span className="text-[13px] font-black uppercase tracking-[0.3em] text-white/50">Syncing</span>
                <span className="text-sm font-black text-white tabular-nums tracking-tighter">{filteredGames.length} NODES</span>
             </div>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} variant="rectangle" height="h-[500px]" className="rounded-[3.5rem]" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-[4rem] deboss p-32 text-center border-white/5 shadow-2xl">
             <p className="text-xl font-black uppercase tracking-[0.4em] text-red-500 animate-pulse">{error}</p>
          </div>
        ) : filteredGames.length === 0 ? (
          <div className="rounded-[4rem] deboss py-40 text-center border-white/5 shadow-2xl">
            <p className="text-sm font-black uppercase tracking-[0.5em] text-white/10">No matching telemetry found in local sector</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 relative">
            {/* Ambient Vertical Spotlights */}
            <div className="absolute -left-20 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-indigo-500/20 to-transparent blur-sm" />
            <div className="absolute -right-20 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-indigo-500/20 to-transparent blur-sm" />

            {filteredGames.map((game, idx) => (
              <div
                key={game.id}
                className="animate-boot"
                style={{
                  animationDelay: `${0.4 + (idx * 0.1)}s`
                }}
              >
                <GameCard game={game} standings={standings} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
