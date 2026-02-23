import { useEffect, useState } from "react";
import { fetchLeaderboard } from "@/services/api";
import { Badge } from "@/components/ui";

export function Leaderboard() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchLeaderboard()
      .then((data) => { if (!cancelled) setEntries(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl bg-[var(--bg-card)] p-4">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-[var(--accent)]">Rankings</h2>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-[var(--bg-card-alt)]" />
          ))}
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-xl bg-[var(--bg-card)] p-4">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-[var(--accent)]">Rankings</h2>
        <p className="text-center text-sm text-[var(--text-muted)]">No predictions yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-[var(--bg-card)] p-4">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-[var(--accent)]">Rankings</h2>
      <div className="space-y-2">
        {entries.map((entry, idx) => {
          const rank = entry.rank ?? idx + 1;
          const winRate =
            entry.total_predictions > 0
              ? Math.round((entry.correct_predictions / entry.total_predictions) * 100)
              : 0;

          return (
            <div key={entry.user_id} className="flex items-center justify-between rounded-lg bg-[var(--bg-card-alt)] p-3">
              <div className="flex items-center gap-3">
                {rank <= 3 ? (
                  <Badge variant="info" size="sm">{rank}</Badge>
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--bg-card)] text-sm font-bold tabular-nums text-[var(--text-muted)]">
                    {rank}
                  </span>
                )}
                <div>
                  <span className="text-sm font-semibold text-[var(--text-primary)]">{entry.username}</span>
                  {entry.streak >= 3 && (
                    <span className="ml-2 text-sm text-orange-400">{entry.streak} streak</span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold tabular-nums text-white">{entry.total_points}</p>
                <p className="text-sm tabular-nums text-[var(--text-muted)]">
                  {entry.correct_predictions}/{entry.total_predictions} ({winRate}%)
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
