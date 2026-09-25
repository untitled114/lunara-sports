import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { todayET, addDaysISO, stripDays, formatDayLabel, formatLongDay } from '@/lib/et';

// Whole calendar days from ISO date `a` to ISO date `b` (negative when b is earlier).
function daysBetween(a, b) {
  const utc = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(b) - utc(a)) / 86400000);
}

export function DateNav({ current }) {
  const { playGlassClick, playThud } = useTheme();

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
          {current && <p className="t-small text-text-2">{formatLongDay(current)}</p>}
        </div>
        <Link
          to={`/scoreboard?date=${today}`}
          onClick={() => playThud()}
          className="t-small shrink-0 rounded-md border border-border bg-surface-1 px-4 py-2 text-text-1 hover:border-border-strong transition-all active:scale-95"
        >
          Today
        </Link>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 rounded-lg border border-border bg-surface-card p-1 sm:p-2">
        <Link
          to={`/scoreboard?date=${addDaysISO(start, -7)}`}
          onClick={() => playGlassClick()}
          aria-label="Previous week"
          className="p-2 sm:p-3 text-text-2 hover:text-text-1 hover:bg-surface-2 rounded-md transition-all active:scale-90 shrink-0"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>

        <div className="flex-1 flex justify-between gap-1 min-w-0">
          {dates.map((date) => {
            const isActive = date === current;
            const { weekday, day, month } = formatDayLabel(date);
            return (
              <Link
                key={date}
                to={`/scoreboard?date=${date}`}
                onClick={() => { if (!isActive) playGlassClick(); }}
                aria-label={`${weekday} ${day} ${month}`}
                aria-current={isActive ? 'date' : undefined}
                className={clsx(
                  'flex flex-col items-center flex-1 min-w-0 py-2 sm:py-3 px-1 rounded-md transition-all duration-500',
                  isActive
                    ? 'bg-accent-fill text-white'
                    : 'text-text-2 hover:text-text-1 hover:bg-surface-2'
                )}
              >
                <span className="t-label">{weekday}</span>
                <span className="t-section tnum">{day}</span>
                <span className="t-label">{month}</span>
              </Link>
            );
          })}
        </div>

        <Link
          to={`/scoreboard?date=${addDaysISO(start, 7)}`}
          onClick={() => playGlassClick()}
          aria-label="Next week"
          className="p-2 sm:p-3 text-text-2 hover:text-text-1 hover:bg-surface-2 rounded-md transition-all active:scale-90 shrink-0"
        >
          <ChevronRight className="h-5 w-5" />
        </Link>
      </div>
    </div>
  );
}
