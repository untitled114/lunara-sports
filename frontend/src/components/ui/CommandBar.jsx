import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, Trophy, BarChart2, X } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { TEAM_COLORS } from '@/utils/teamColors';
import { fetchPlayers } from '@/services/api';

const ALL_TEAMS = Object.entries(TEAM_COLORS).map(([abbrev, colors]) => ({
  abbrev,
  name: abbrev,
  type: 'team'
}));

const QUICK_LINKS = [
  { name: 'Scoreboard', path: '/scoreboard', icon: Trophy },
  { name: 'Standings', path: '/standings', icon: BarChart2 },
  { name: 'Players', path: '/players', icon: Users },
  { name: 'Stats', path: '/stats', icon: BarChart2 },
];

const ResultItem = memo(function ResultItem({ item, onSelect }) {
  return (
    <button
      onClick={() => onSelect(item)}
      className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-white/[0.03] transition-colors text-left border border-transparent hover:border-white/5 group"
    >
      <div className="h-10 w-10 rounded-xl bg-[#050a18] flex items-center justify-center border border-white/10 font-black text-sm text-white/50 group-hover:text-white group-hover:border-white/20 shadow-lg transition-colors">
        {item.abbrev || item.name[0]}
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-bold text-white uppercase tracking-tight group-hover:text-indigo-400 transition-colors">
          {item.name}
        </span>
        <span className="text-[13px] font-black text-white/50 uppercase tracking-widest">{item.type}</span>
      </div>
    </button>
  );
});

export function CommandBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [players, setPlayers] = useState([]);
  const { playGlassClick, playThud } = useTheme();
  const navigate = useNavigate();
  const inputRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
        if (!isOpen) playGlassClick();
      }
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, playGlassClick]);

  // Defer focus to next animation frame to avoid synchronous layout recalc
  useEffect(() => {
    if (isOpen && inputRef.current) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  // Debounced player search
  useEffect(() => {
    if (!query) {
      setPlayers([]);
      return;
    }
    const timer = setTimeout(() => {
      fetchPlayers(query)
        .then(data => {
          const flatPlayers = data.flatMap(team =>
            team.players.map(p => ({ ...p, type: 'player', abbrev: team.abbrev }))
          );
          setPlayers(flatPlayers.slice(0, 5));
        })
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Memoize filtered results to avoid recomputing on every render
  const results = useMemo(() => {
    if (!query) return [];
    const filtered = [
      ...ALL_TEAMS.filter(t => t.abbrev.toLowerCase().includes(query.toLowerCase())),
      ...players,
      ...QUICK_LINKS.filter(l => l.name.toLowerCase().includes(query.toLowerCase()))
    ];
    return filtered.slice(0, 8);
  }, [query, players]);

  const handleSelect = useCallback((item) => {
    playThud();
    if (item.type === 'team') {
      navigate(`/team/${item.abbrev}`);
    } else if (item.type === 'player') {
      navigate(`/player/${item.id}`);
    } else {
      navigate(item.path);
    }
    setIsOpen(false);
    setQuery('');
  }, [playThud, navigate]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsOpen(false)} />

      <div className="relative w-full max-w-xl liquid-mirror rounded-2xl shadow-2xl border-white/10 animate-scaleIn overflow-hidden">
        <div className="flex items-center p-4 border-b border-white/5 bg-white/5">
          <Search className="h-5 w-5 text-white/50 mr-3" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search teams, standings, or players... (Esc to close)"
            className="flex-1 bg-transparent border-none text-white focus:outline-none text-lg font-medium placeholder:text-white/50"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/5 rounded-lg transition-colors">
            <X className="h-4 w-4 text-white/50" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {query === '' ? (
            <div className="p-4">
              <p className="text-micro mb-4 px-2 opacity-40">Quick Navigation</p>
              <div className="grid grid-cols-1 gap-1">
                {QUICK_LINKS.map(link => (
                  <button
                    key={link.path}
                    onClick={() => handleSelect(link)}
                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors text-left group"
                  >
                    <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 group-hover:border-indigo-500/50 transition-colors">
                      <link.icon className="h-5 w-5 text-white/50 group-hover:text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white uppercase tracking-tight">{link.name}</p>
                      <p className="text-sm font-medium text-white/50 uppercase tracking-widest">Navigation Module</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {results.length > 0 ? (
                results.map((item, idx) => (
                  <ResultItem key={item.id || item.abbrev || item.path || idx} item={item} onSelect={handleSelect} />
                ))
              ) : (
                <div className="p-8 text-center">
                  <p className="text-sm font-medium text-white/50 uppercase tracking-widest">No results found for "{query}"</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-3 bg-white/5 border-t border-white/5 flex items-center justify-between">
           <div className="flex items-center gap-4 text-white/50">
              <div className="flex items-center gap-1.5">
                 <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[13px] font-black border border-white/10 shadow-sm">ENTER</kbd>
                 <span className="text-[13px] font-bold uppercase tracking-widest">to select</span>
              </div>
              <div className="flex items-center gap-1.5">
                 <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[13px] font-black border border-white/10 shadow-sm">ESC</kbd>
                 <span className="text-[13px] font-bold uppercase tracking-widest">to close</span>
              </div>
           </div>
           <span className="text-[13px] font-black text-indigo-400 uppercase tracking-[0.2em] opacity-50">Command Console</span>
        </div>
      </div>
    </div>
  );
}
