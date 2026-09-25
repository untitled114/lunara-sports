import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchNextGameDate } from '@/services/api';
import { formatLongDay } from '@/lib/et';

/**
 * The next game day strictly after `after` (YYYY-MM-DD, ET), from the same
 * /games/next lookup the scoreboard and ticker use.
 * `status` is 'loading' | 'ok' | 'error'; `date` is null when nothing is scheduled.
 */
export function useNextGameDate(after) {
  const [next, setNext] = useState({ status: 'loading', date: null });

  useEffect(() => {
    let cancelled = false;
    setNext({ status: 'loading', date: null });
    fetchNextGameDate(after)
      .then((d) => {
        if (!cancelled) setNext({ status: 'ok', date: d || null });
      })
      .catch(() => {
        if (!cancelled) setNext({ status: 'error', date: null });
      });
    return () => {
      cancelled = true;
    };
  }, [after]);

  return next;
}

/**
 * The empty-state next step: "Next game: Sat, Oct 3 →" linking to that scoreboard day,
 * the same copy and style as the scoreboard's empty state. Renders nothing while the
 * lookup is pending or when it fails (the link is optional), and "No games scheduled yet."
 * when the lookup succeeds with no date. It adds no tap sound (sounds stay exactly as-is).
 */
export function NextGameLink({ after }) {
  const next = useNextGameDate(after);

  if (next.date) {
    return (
      <Link
        to={`/scoreboard?date=${next.date}`}
        className="t-small text-accent hover:text-accent-hover"
      >
        Next game: {formatLongDay(next.date)} →
      </Link>
    );
  }
  if (next.status === 'ok') return <span className="t-small text-text-2">No games scheduled yet.</span>;
  return null;
}
