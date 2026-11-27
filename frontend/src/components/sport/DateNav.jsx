import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { todayET, addDaysISO, stripDays, formatDayLabel, formatLongDay } from '@/lib/et';

// Whole calendar days from ISO date `a` to ISO date `b` (negative when b is earlier).
function daysBetween(a, b) {
  const utc = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(b) - utc(a)) / 86400000);
}

// `count`: the day's number of games, shown after the date once the games have loaded.
export function DateNav({ current, count }) {

  // The strip pages through 7-day windows anchored on today (ET): page 0 is
  // today..today+6, and the page is chosen so the selected day is always visible.
  const today = todayET();
  const offset = current ? Math.floor(daysBetween(today, current) / 7) : 0;
  const start = addDaysISO(today, 7 * offset);
  const dates = stripDays(start);

  return (
    <div className="flex flex-col gap-4 mb-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="t-title text-text-1">Scoreboard</h1>
          {current && (
            <p className="t-small text-text-2">
              {formatLongDay(current)}
              {count > 0 && `, ${count} ${count === 1 ? 'game' : 'games'}`}
            </p>
          )}
        </div>
        <Link
          to={`/scoreboard?date=${today}`}
          className="t-small shrink-0 inline-flex items-center min-h-[44px] sm:min-h-0 rounded-md border border-border bg-surface-1 px-4 py-2 text-text-1 hover:border-border-strong transition-colors"
        >
          Today
        </Link>
      </div>

      <div className="flex items-center gap-1 sm:gap-1.5">
        <Link
          to={`/scoreboard?date=${addDaysISO(start, -7)}`}
          aria-label="Previous week"
          className="p-2 sm:p-3 text-text-2 hover:text-text-1 hover:bg-surface-2 rounded-md transition-all active:scale-90 shrink-0"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>

        <div className="flex-1 sm:flex-none flex gap-1 sm:gap-1.5 min-w-0">
          {dates.map((date) => {
            const isActive = date === current;
            const { weekday, day, month } = formatDayLabel(date);
            return (
              <Link
                key={date}
                to={`/scoreboard?date=${date}`}
                aria-label={`${weekday} ${day} ${month}`}
                aria-current={isActive ? 'date' : undefined}
                className={clsx(
                  'flex flex-col items-center flex-1 min-w-0 sm:w-[84px] sm:flex-none py-1.5 rounded-lg border shadow-card transition-colors',
                  isActive
                    ? 'bg-accent-fill text-accent-ink border-transparent'
                    : 'bg-surface-1 border-border text-text-2 hover:text-text-1 hover:border-border-strong'
                )}
              >
                <span className="t-label">{weekday}</span>
                <span className={clsx('t-score-sm tnum', !isActive && 'text-text-1')}>{day}</span>
              </Link>
            );
          })}
        </div>

        <Link
          to={`/scoreboard?date=${addDaysISO(start, 7)}`}
          aria-label="Next week"
          className="p-2 sm:p-3 text-text-2 hover:text-text-1 hover:bg-surface-2 rounded-md transition-all active:scale-90 shrink-0"
        >
          <ChevronRight className="h-5 w-5" />
        </Link>
      </div>
    </div>
  );
}
