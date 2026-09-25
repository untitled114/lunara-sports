import { useEffect, useState } from 'react';
import { fetchLeaderboard } from '@/services/api';
import { Badge, Card, SectionHeader } from '@/components/ui';

export function Leaderboard() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchLeaderboard()
      .then((data) => {
        if (!cancelled) setEntries(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <Card>
        <SectionHeader title="Rankings" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-md bg-surface-2" />
          ))}
        </div>
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card>
        <SectionHeader title="Rankings" />
        <p className="text-center t-small text-text-3">No predictions yet.</p>
      </Card>
    );
  }

  return (
    <Card>
      <SectionHeader title="Rankings" />
      <div className="space-y-2">
        {entries.map((entry, idx) => {
          const rank = entry.rank ?? idx + 1;
          const winRate =
            entry.total_predictions > 0 ? Math.round((entry.correct_predictions / entry.total_predictions) * 100) : 0;

          return (
            <div key={entry.user_id} className="flex items-center justify-between rounded-md bg-surface-2 p-3">
              <div className="flex items-center gap-3">
                {rank <= 3 ? (
                  <Badge variant="accent">{rank}</Badge>
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-1 t-small tnum font-semibold text-text-3">
                    {rank}
                  </span>
                )}
                <div>
                  <span className="t-small font-semibold text-text-1">{entry.username}</span>
                  {entry.streak >= 3 && <span className="ml-2 t-small text-warn">{entry.streak} streak</span>}
                </div>
              </div>
              <div className="text-right">
                <p className="t-small tnum font-semibold text-text-1">{entry.total_points}</p>
                <p className="t-small tnum text-text-3">
                  {entry.correct_predictions}/{entry.total_predictions} ({winRate}%)
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
