import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Tv, ChevronRight, Clock, ChevronLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui';
import { fetchGames } from '@/services/api';
import { useFormatTime } from '@/utils/formatTime';

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function getDateRange(centerDate, days = 3) {
  const dates = [];
  const center = new Date(centerDate);
  for (let i = -days; i <= days; i++) {
    const d = new Date(center);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

export default function SchedulePage() {
  const fmt = useFormatTime();
  const [schedule, setSchedule] = useState({});
  const [loading, setLoading] = useState(true);
  const [centerDate, setCenterDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const dates = getDateRange(centerDate, 3);
    Promise.all(dates.map(d => fetchGames(d).then(games => ({ date: d, games })).catch(() => ({ date: d, games: [] }))))
      .then((results) => {
        if (cancelled) return;
        const grouped = {};
        for (const { date, games } of results) {
          if (games.length > 0) {
            grouped[date] = games;
          }
        }
        setSchedule(grouped);
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [centerDate]);

  const shiftDate = (days) => {
    const d = new Date(centerDate);
    d.setDate(d.getDate() + days);
    setCenterDate(d.toISOString().split('T')[0]);
  };

  const sortedDates = Object.keys(schedule).sort();

  return (
    <div className="space-y-12 animate-fadeIn max-w-[1400px] mx-auto pb-32">
      <div className="border-b border-white/5 pb-12">
        <h1 className="text-6xl md:text-8xl text-jumbotron tracking-tighter">Schedule</h1>
        <p className="text-[13px] font-black text-white/50 uppercase tracking-[0.4em] mt-4 ml-1">Full Game Slate</p>
      </div>

      {/* Date navigation */}
      <div className="flex items-center justify-center gap-6">
        <button onClick={() => shiftDate(-7)} className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all shadow-lg">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-black text-white uppercase tracking-[0.3em]">{formatDate(centerDate)}</span>
        <button onClick={() => shiftDate(7)} className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all shadow-lg">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <div className="space-y-8">
          {[1, 2].map(i => <Skeleton key={i} variant="rectangle" height="h-48" className="rounded-xl" />)}
        </div>
      ) : sortedDates.length === 0 ? (
        <div className="py-20 text-center text-[var(--text-muted)] text-sm">No games found for this date range.</div>
      ) : (
        <div className="space-y-10">
          {sortedDates.map((date) => (
            <div key={date} className="space-y-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-[var(--accent)]" />
                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white">{formatDate(date)}</h2>
              </div>

              <div className="liquid-mirror rounded-[2rem] border border-white/5 overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="bg-black/20 text-[13px] font-black uppercase tracking-[0.2em] text-white/50 border-b border-white/5">
                        <th className="py-4 px-6">Matchup</th>
                        <th className="py-4 px-6">Time / Score</th>
                        <th className="py-4 px-6 text-center">Status</th>
                        <th className="py-4 px-6 text-right">Links</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {schedule[date].map((game) => (
                        <tr key={game.id} className="group hover:bg-white/[0.03] transition-colors">
                          <td className="py-5 px-6">
                            <span className="text-sm font-black text-white uppercase tracking-tight">
                              {game.away_team_full || game.away_team} <span className="text-[var(--text-muted)] italic mx-1">@</span> {game.home_team_full || game.home_team}
                            </span>
                          </td>
                          <td className="py-5 px-6">
                            {game.status === 'final' ? (
                              <span className="text-sm font-bold text-white tabular-nums">
                                {game.away_score} - {game.home_score}
                              </span>
                            ) : (
                              <div className="flex items-center gap-2 text-sm font-bold text-white tabular-nums">
                                <Clock className="h-3.5 w-3.5 text-[var(--accent)]" />
                                {fmt(game.start_time)}
                              </div>
                            )}
                          </td>
                          <td className="py-5 px-6 text-center">
                            <span className={`text-sm font-black uppercase tracking-widest ${
                              game.status === 'live' ? 'text-[var(--green)]' :
                              game.status === 'final' ? 'text-[var(--text-muted)]' :
                              'text-[var(--accent)]'
                            }`}>
                              {game.status === 'live' ? 'LIVE' : game.status === 'final' ? 'FINAL' : 'SCHEDULED'}
                            </span>
                          </td>
                          <td className="py-5 px-6 text-right">
                            <Link to={`/game/${game.id}`} className="inline-flex items-center gap-1.5 text-sm font-black uppercase tracking-[0.2em] text-[var(--text-muted)] hover:text-white transition group/link">
                              Gamecast
                              <ChevronRight className="h-3.5 w-3.5 group-hover/link:translate-x-0.5 transition-transform" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
