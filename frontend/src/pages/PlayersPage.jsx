import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui';
import { fetchPlayers } from '@/services/api';
import { useTheme } from '@/context/ThemeContext';

export default function PlayersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef(null);
  const { playGlassClick } = useTheme();

  const loadPlayers = (search = '') => {
    setLoading(true);
    fetchPlayers(search)
      .then(setTeams)
      .catch(() => setTeams([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPlayers();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadPlayers(searchTerm);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchTerm]);

  return (
    <div className="max-w-[1400px] mx-auto space-y-12 pb-32 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-10 border-b border-white/5 pb-12">
        <div>
          <h1 className="text-6xl md:text-8xl text-jumbotron tracking-tighter uppercase italic">Players</h1>
          <p className="text-[13px] font-black text-white/70 uppercase tracking-[0.4em] mt-4 ml-1">Active Rosters & Player Profiles</p>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/70" />
          <input
            type="text"
            placeholder="Find a player..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-black text-white uppercase tracking-tight focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-white/30 placeholder:tracking-widest shadow-lg"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} variant="rectangle" height="h-64" className="rounded-xl" />)}
        </div>
      ) : teams.length === 0 ? (
        <div className="py-20 text-center text-[var(--text-muted)] text-sm uppercase font-black tracking-widest">
          {searchTerm ? `No nodes matching "${searchTerm}" found in sector` : "No player data available"}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {teams.map((teamData) => (
            <div key={teamData.abbrev} className="space-y-4">
              <div className="flex items-center gap-3 border-b border-white/10 pb-2 px-1">
                <div className="h-7 w-7 rounded bg-[#050a18] flex items-center justify-center text-sm font-black text-white border border-white/10">
                  {teamData.abbrev}
                </div>
                <h2 className="text-[13px] font-black uppercase tracking-[0.2em] text-white/80">{teamData.team}</h2>
              </div>

              <div className="space-y-1">
                {teamData.players.map((p) => (
                  <div
                    key={`${teamData.abbrev}-${p.jersey}-${p.name}`}
                    className="group flex items-center justify-between p-3.5 rounded-xl hover:bg-white/[0.03] transition-all border border-transparent hover:border-white/5"
                  >
                    <div className="flex items-center gap-5">
                      <div className="relative shrink-0">
                        <div className="h-12 w-12 rounded-full bg-[#050a18] border border-white/10 flex items-center justify-center overflow-hidden shadow-xl relative z-10">
                          {p.headshot_url ? (
                            <img src={p.headshot_url} alt={p.name} className="w-full h-full object-cover scale-110 group-hover:scale-125 transition-transform duration-500" />
                          ) : (
                            <div className="text-sm font-black text-white/70 uppercase">{p.name[0]}</div>
                          )}
                        </div>
                        <div className="absolute -inset-1 rounded-full bg-white/5 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          {/* INCREASED OPACITY FROM 50% TO 70% */}
                          <span className="text-[13px] font-black text-white/70 tabular-nums w-5">#{p.jersey}</span>
                          <Link
                            to={`/player/${p.id}`}
                            onClick={() => playGlassClick()}
                            className="text-base font-black text-white uppercase tracking-tight hover:text-indigo-400 transition-colors"
                          >
                            {p.name}
                          </Link>
                        </div>
                        {/* INCREASED OPACITY FROM 40% TO 60% */}
                        <p className="text-sm font-bold text-white/60 uppercase tracking-widest mt-0.5">
                          {p.position}{p.height ? ` \u2022 ${p.height}` : ''}{p.weight ? ` \u2022 ${p.weight} lbs` : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Link
                to={`/team/${teamData.abbrev}?tab=roster`}
                className="block w-full py-2 text-[13px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:bg-indigo-500/10 rounded-lg transition-all border border-dashed border-white/10 text-center"
              >
                View Full Roster
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
