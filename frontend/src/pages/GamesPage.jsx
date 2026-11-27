import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchStandings, buildStandingsLookup } from '@/services/api';
import { GameCard } from '@/components/sport/GameCard';
import { DateNav } from '@/components/sport/DateNav';
import { NextGameLink } from '@/components/sport/NextGameLink';
import { PageState, Segmented } from '@/components/ui';
import { useScoreboard } from '@/hooks/useScoreboard';
import { todayET, addDaysISO } from '@/lib/et';
import { usePageMeta } from '@/hooks/usePageMeta';

const statusOrder = { live: 0, halftime: 1, scheduled: 2, final: 3 };

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'live', label: 'Live' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'final', label: 'Final' },
];

// A usable ?date= is YYYY-MM-DD and a real calendar day (2026-02-30 round-trips to 03-02).
function isValidISODate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && addDaysISO(s, 0) === s;
}

export default function GamesPage() {
  usePageMeta('Scoreboard', 'Every NBA game today, with live scores, the clock and tip times.');
  const [searchParams] = useSearchParams();
  // This season's records by team; {} while the standings are still last season's.
  const [records, setRecords] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [filter, setFilter] = useState('all');


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

  // Standings: one-shot fetch (doesn't need WS), for the records in the boxes. Last
  // season's records stay out of this season's boxes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchStandings()
      .then((data) => {
        if (cancelled) return;
        setRecords(data && !data.is_previous_season ? buildStandingsLookup(data) : {});
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
      <div data-testid="game-grid" className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2.5">
        {filteredGames.map((game) => (
          <GameCard key={game.id} game={game} records={records} />
        ))}
      </div>
    );
  }

  return (
    <div className="animate-fadeIn pb-24 sm:pb-16 space-y-4">
      <DateNav current={dateStr} count={gamesLoading || gamesError ? 0 : games.length} />

      <Segmented aria-label="Filter games" options={FILTERS} value={filter} onChange={handleFilterChange} />

      {error && <PageState kind="error" title={error} onRetry={reload} />}

      {content}
    </div>
  );
}
