import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, Trophy, BarChart2, X } from 'lucide-react';
import clsx from 'clsx';
import { useTheme } from '@/context/ThemeContext';
import { TEAM_COLORS } from '@/utils/teamColors';
import { fetchPlayers } from '@/services/api';

const ALL_TEAMS = Object.entries(TEAM_COLORS).map(([abbrev]) => ({
  abbrev,
  name: abbrev,
  type: 'team',
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
      className="w-full flex items-center gap-4 p-3 rounded-md hover:bg-surface-2 transition-colors text-left border border-transparent hover:border-border group"
    >
      <div className="h-10 w-10 rounded-md bg-surface-2 flex items-center justify-center border border-border font-semibold t-small text-text-2 group-hover:text-text-1 group-hover:border-border-strong transition-colors">
        {item.abbrev || item.name[0]}
      </div>
      <div className="flex flex-col">
        <span className="t-body font-semibold text-text-1 group-hover:text-accent transition-colors">{item.name}</span>
        <span className="t-label text-text-3">{item.type}</span>
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
        setIsOpen((prev) => !prev);
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
        .then((data) => {
          const flatPlayers = data.flatMap((team) => team.players.map((p) => ({ ...p, type: 'player', abbrev: team.abbrev })));
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
      ...ALL_TEAMS.filter((t) => t.abbrev.toLowerCase().includes(query.toLowerCase())),
      ...players,
      ...QUICK_LINKS.filter((l) => l.name.toLowerCase().includes(query.toLowerCase())),
    ];
    return filtered.slice(0, 8);
  }, [query, players]);

  const handleSelect = useCallback(
    (item) => {
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
    },
    [playThud, navigate]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
      <div className="absolute inset-0 bg-surface-0/80" onClick={() => setIsOpen(false)} />

      <div className="relative w-full max-w-xl bg-surface-card border border-border rounded-lg shadow-2xl animate-scaleIn overflow-hidden">
        <div className="flex items-center p-4 border-b border-border bg-surface-2">
          <Search className="h-5 w-5 text-text-3 mr-3" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search teams, standings, or players... (Esc to close)"
            className="flex-1 bg-transparent border-none t-body text-text-1 placeholder-text-3"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button onClick={() => setIsOpen(false)} aria-label="Close search" className="p-1 hover:bg-surface-1 rounded-md transition-colors">
            <X className="h-4 w-4 text-text-3" aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {query === '' ? (
            <div className="p-4">
              <p className="t-label text-text-3 mb-4 px-2">Quick navigation</p>
              <div className="grid grid-cols-1 gap-1">
                {QUICK_LINKS.map((link) => (
                  <button
                    key={link.path}
                    onClick={() => handleSelect(link)}
                    className="flex items-center gap-4 p-3 rounded-md hover:bg-surface-2 transition-colors text-left group"
                  >
                    <div className="h-10 w-10 rounded-md bg-surface-2 flex items-center justify-center border border-border group-hover:border-accent transition-colors">
                      <link.icon className="h-5 w-5 text-text-3 group-hover:text-accent" />
                    </div>
                    <div>
                      <p className="t-body font-semibold text-text-1">{link.name}</p>
                      <p className="t-label text-text-3">Page</p>
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
                  <p className="t-small text-text-2">No results found for &quot;{query}&quot;</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-3 bg-surface-2 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-4 text-text-3">
            <div className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded-sm bg-surface-1 t-small font-semibold border border-border shadow-sm">Enter</kbd>
              <span className="t-label text-text-3">to select</span>
            </div>
            <div className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded-sm bg-surface-1 t-small font-semibold border border-border shadow-sm">Esc</kbd>
              <span className="t-label text-text-3">to close</span>
            </div>
          </div>
          <span className="t-label text-text-3">Search</span>
        </div>
      </div>
    </div>
  );
}
