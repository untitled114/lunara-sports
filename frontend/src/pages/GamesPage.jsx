import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchStandings, buildStandingsLookup } from '@/services/api';
import { GameCard } from '@/components/sport/GameCard';
import { DateNav } from '@/components/sport/DateNav';
import { NextGameLink } from '@/components/sport/NextGameLink';
import { PageState, Segmented } from '@/components/ui';
import { useTheme } from '@/context/ThemeContext';
import { useScoreboard } from '@/hooks/useScoreboard';
import { todayET, addDaysISO } from '@/lib/et';

const statusOrder = { live: 0, halftime: 1, scheduled: 2, final: 3 };

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'live', label: 'Live' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'final', label: 'Final' },
];

const EMPTY_META = { seasonLabel: '', isPrev: false };

// A usable ?date= is YYYY-MM-DD and a real calendar day (2026-02-30 round-trips to 03-02).
function isValidISODate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && addDaysISO(s, 0) === s;
}

export default function GamesPage() {
  const [searchParams] = useSearchParams();
  const [standings, setStandings] = useState({});
  const [standingsMeta, setStandingsMeta] = useState(EMPTY_META);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [filter, setFilter] = useState('all');

  const { playGlassClick } = useTheme();

  // NBA games are scheduled in ET, so "today" is today in America/New_York.
  const today = todayET();
  const rawDate = searchParams.get('date');
  const dateStr = isValidISODate(rawDate) ? rawDate : today;

  // Games come from the shared WS scoreboard channel (REST fallback when disconnected).
  // Until they have loaded the page shows the loading state, never "No games today";
  // a failed load shows the error state with "Try again".
  const {
    games: rawGames,
    loading: gamesLoading,
    error: gamesError,
    retry: retryGames,
  } = useScoreboard(dateStr);
  const games = [...rawGames].sort((a, b) => (statusOrder[a.status] ?? 4) - (statusOrder[b.status] ?? 4));

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  // Standings: one-shot fetch (doesn't need WS). Carries the season context so the cards
  // can say when seeds and records are last season's.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchStandings()
      .then((data) => {
        if (cancelled) return;
        setStandings(buildStandingsLookup(data));
        setStandingsMeta({
          seasonLabel: data?.season_label || '',
          isPrev: !!data?.is_previous_season,
        });
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load standings.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [dateStr, reloadKey]);

  const filteredGames = games.filter((g) => {
    if (filter === 'all') return true;
    if (filter === 'live') return g.status === 'live' || g.status === 'halftime';
    return g.status === filter;
  });

  const handleFilterChange = (newFilter) => {
    if (newFilter !== filter) {
      playGlassClick();
      setFilter(newFilter);
    }
  };

  const count = filteredGames.length;

  let content;
  if (loading || gamesLoading) {
    content = <PageState kind="loading" />;
  } else if (gamesError) {
    content = <PageState kind="error" title="Couldn't load games." onRetry={retryGames} />;
  } else if (games.length === 0) {
    content = (
      <PageState
        kind="empty"
        title={dateStr === today ? 'No games today.' : 'No games on this day.'}
        action={<NextGameLink after={dateStr} />}
      />
    );
  } else if (count === 0) {
    content = <PageState kind="empty" title="No games match this filter." />;
  } else {
    content = (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {filteredGames.map((game, idx) => (
          <div key={game.id} className="animate-boot" style={{ animationDelay: `${0.4 + (idx * 0.1)}s` }}>
            <GameCard game={game} standings={standings} standingsMeta={standingsMeta} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="animate-fadeIn max-w-[1400px] mx-auto pb-24 sm:pb-32 pt-4 sm:pt-8 space-y-6">
      <div className="animate-boot">
        <DateNav current={dateStr} />
      </div>

      <div className="animate-boot flex flex-wrap items-center justify-between gap-3" style={{ animationDelay: '0.2s' }}>
        <Segmented aria-label="Filter games" options={FILTERS} value={filter} onChange={handleFilterChange} />
        <span className="t-label text-text-3 tnum">{count} {count === 1 ? 'game' : 'games'}</span>
      </div>

      {error && <PageState kind="error" title={error} onRetry={reload} />}

      {content}
    </div>
  );
}
