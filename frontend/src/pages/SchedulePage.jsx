import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Clock, ChevronLeft } from 'lucide-react';
import { Skeleton, Badge, PageState, SectionHeader, DataTable } from '@/components/ui';
import { fetchGames } from '@/services/api';
import { useFormatTime } from '@/utils/formatTime';
import { todayET, addDaysISO } from '@/lib/et';

// UTC-noon anchored, like lib/et.js's own formatters, so the weekday/month
// never get reinterpreted by the machine's local timezone.
function formatDate(dateStr) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' }).format(d);
}

function getDateRange(centerDate, days = 3) {
  const dates = [];
  for (let i = -days; i <= days; i++) {
    dates.push(addDaysISO(centerDate, i));
  }
  return dates;
}

export default function SchedulePage() {
  const fmt = useFormatTime();
  const [schedule, setSchedule] = useState({});
  const [loading, setLoading] = useState(true);
  const [centerDate, setCenterDate] = useState(() => todayET());
  const [error, setError] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    const dates = getDateRange(centerDate, 3);
    Promise.allSettled(dates.map((d) => fetchGames(d).then((games) => ({ date: d, games }))))
      .then((results) => {
        if (cancelled) return;
        const allFailed = results.every((r) => r.status === 'rejected');
        if (allFailed) {
          setError(true);
          setSchedule({});
          return;
        }
        const grouped = {};
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value.games.length > 0) {
            grouped[r.value.date] = r.value.games;
          }
        }
        setSchedule(grouped);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [centerDate, retryNonce]);

  const shiftDate = (days) => {
    setCenterDate(addDaysISO(centerDate, days));
  };

  const sortedDates = Object.keys(schedule).sort();

  const columns = [
    {
      key: 'matchup',
      label: 'Matchup',
      render: (game) => (
        <span className="t-small font-semibold text-text-1">
          {game.away_team_full || game.away_team} <span className="text-text-3">@</span>{' '}
          {game.home_team_full || game.home_team}
        </span>
      ),
    },
    {
      key: 'time',
      label: 'Time / Score',
      render: (game) =>
        game.status === 'final' ? (
          <span className="t-small tnum font-semibold text-text-1">
            {game.away_score} - {game.home_score}
          </span>
        ) : (
          <span className="flex items-center gap-2 t-small tnum font-semibold text-text-1">
            <Clock className="h-3.5 w-3.5 text-accent" />
            {fmt(game.start_time)}
          </span>
        ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (game) => (
        <Badge variant={game.status === 'live' ? 'live' : game.status === 'final' ? 'neutral' : 'accent'} dot={game.status === 'live'}>
          {game.status === 'live' ? 'Live' : game.status === 'final' ? 'Final' : 'Scheduled'}
        </Badge>
      ),
    },
    {
      key: 'links',
      label: 'Links',
      align: 'right',
      render: (game) => (
        <div className="text-right">
          <Link
            to={`/game/${game.id}`}
            className="inline-flex items-center gap-1.5 t-small font-semibold text-text-3 hover:text-text-1 transition-colors group"
          >
            Gamecast
            <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-12 animate-fadeIn max-w-[1400px] mx-auto pb-32">
      <div className="border-b border-border pb-8">
        <h1 className="t-title text-text-1">Schedule</h1>
        <p className="t-label text-text-3 mt-4">Full schedule</p>
      </div>

      {/* Date navigation */}
      <div className="flex items-center justify-center gap-6">
        <button
          onClick={() => shiftDate(-7)}
          className="h-10 w-10 flex items-center justify-center rounded-md bg-surface-2 border border-border text-text-3 hover:text-text-1 hover:bg-surface-1 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="t-label text-text-1">{formatDate(centerDate)}</span>
        <button
          onClick={() => shiftDate(7)}
          className="h-10 w-10 flex items-center justify-center rounded-md bg-surface-2 border border-border text-text-3 hover:text-text-1 hover:bg-surface-1 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {error ? (
        <PageState kind="error" title="Couldn&apos;t load the schedule." onRetry={() => setRetryNonce((n) => n + 1)} />
      ) : loading ? (
        <div className="space-y-8">
          {[1, 2].map((i) => (
            <Skeleton key={i} variant="rectangle" height="h-48" className="rounded-lg" />
          ))}
        </div>
      ) : sortedDates.length === 0 ? (
        <PageState kind="empty" title="No games found for this date range." />
      ) : (
        <div className="space-y-10">
          {sortedDates.map((date) => (
            <div key={date} className="space-y-4">
              <SectionHeader title={formatDate(date)} />
              <DataTable columns={columns} rows={schedule[date]} getKey={(game) => game.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
