import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageState } from '@/components/ui';
import { fetchPlayers } from '@/services/api';
import { useTheme } from '@/context/ThemeContext';

export default function PlayersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const debounceRef = useRef(null);
  const { playGlassClick } = useTheme();

  const loadPlayers = (search = '') => {
    setLoading(true);
    setError(false);
    fetchPlayers(search)
      .then(setTeams)
      .catch(() => setError(true))
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
    <div className="max-w-[1400px] mx-auto space-y-8 pb-32">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-8">
        <div>
          <h1 className="t-title text-text-1">Players</h1>
          <p className="t-label text-text-3 mt-2">Active rosters</p>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-3" />
          <input
            type="text"
            placeholder="Find a player"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-surface-1 border border-border rounded-sm py-2.5 pl-10 pr-4 t-small text-text-1 focus:outline-none focus:border-accent transition-colors placeholder:text-text-3"
          />
        </div>
      </div>

      {loading ? (
        <PageState kind="loading" />
      ) : error ? (
        <PageState kind="error" title="Couldn't load players." onRetry={() => loadPlayers(searchTerm)} />
      ) : teams.length === 0 ? (
        <PageState
          kind="empty"
          title={searchTerm ? `No players match "${searchTerm}".` : 'No player data available.'}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map((teamData) => (
            <div key={teamData.abbrev} className="space-y-3">
              <div className="flex items-center gap-3 border-b border-border pb-2 px-1">
                <div className="h-7 w-7 rounded-sm bg-surface-2 flex items-center justify-center t-small text-text-1 border border-border">
                  {teamData.abbrev}
                </div>
                <h2 className="t-label text-text-2">{teamData.team}</h2>
              </div>

              <div className="space-y-1">
                {teamData.players.map((p) => (
                  <div
                    key={`${teamData.abbrev}-${p.jersey}-${p.name}`}
                    className="group flex items-center justify-between p-3 rounded-md hover:bg-surface-1 transition-colors border border-transparent hover:border-border"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-11 w-11 rounded-lg bg-surface-2 border border-border flex items-center justify-center overflow-hidden shrink-0">
                        {p.headshot_url ? (
                          <img
                            src={p.headshot_url}
                            alt={p.name}
                            width={88}
                            height={64}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="t-small text-text-2 uppercase">{p.name[0]}</div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="t-small tnum text-text-3 w-5">#{p.jersey}</span>
                          <Link
                            to={`/player/${p.id}`}
                            onClick={() => playGlassClick()}
                            className="t-small text-text-1 hover:text-accent transition-colors"
                          >
                            {p.name}
                          </Link>
                        </div>
                        <p className="t-small text-text-2 mt-0.5">
                          {p.position}{p.height ? ` • ${p.height}` : ''}{p.weight ? ` • ${p.weight} lbs` : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Link
                to={`/team/${teamData.abbrev}?tab=roster`}
                className="block w-full py-2 t-label text-text-3 hover:text-text-1 hover:bg-surface-1 rounded-md transition-colors border border-dashed border-border text-center"
              >
                View full roster
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
