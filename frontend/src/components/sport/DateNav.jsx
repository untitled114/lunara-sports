import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

function shiftDate(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(dateStr, format = 'short') {
  const d = new Date(dateStr + "T00:00:00");
  if (format === 'day') return d.getDate();
  if (format === 'weekday') return d.toLocaleDateString("en-US", { weekday: "short" });
  if (format === 'month') return d.toLocaleDateString("en-US", { month: "short" });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Tonight's Slate";
  if (diff === -1) return "Last Night";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function DateNav({ current }) {
  const navigate = useNavigate();
  const { playGlassClick, playThud } = useTheme();

  // Generate a range of dates around the current date
  const dates = [];
  for (let i = -3; i <= 3; i++) {
    dates.push(shiftDate(current, i));
  }

  const _etNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  const todayStr = `${_etNow.getFullYear()}-${String(_etNow.getMonth() + 1).padStart(2, '0')}-${String(_etNow.getDate()).padStart(2, '0')}`;

  return (
    <div className="flex flex-col gap-6 sm:gap-8 mb-8 sm:mb-12">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 sm:gap-8 min-w-0">
          <h2 className="text-3xl sm:text-5xl text-jumbotron tracking-tighter shrink-0">Scoreboard</h2>
          <button
            onClick={() => { playThud(); navigate(`/scoreboard?date=${todayStr}`); }}
            className="hidden sm:block px-6 py-2 text-sm font-black uppercase tracking-[0.4em] bg-white text-black rounded-xl hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]"
          >
            Go Today
          </button>
        </div>
        <div className="flex items-center gap-4 sm:gap-6 shrink-0">
           <button
             onClick={() => { playThud(); navigate(`/scoreboard?date=${todayStr}`); }}
             className="sm:hidden px-4 py-2 text-[11px] font-black uppercase tracking-[0.3em] bg-white text-black rounded-lg active:scale-95 transition-all"
           >
             Today
           </button>
           <div className="hidden md:flex flex-col items-end">
              <span className="text-micro opacity-40 mb-1">Calendar Slate</span>
              <span className="text-sm font-black text-white uppercase tracking-[0.2em]">{formatDate(current)}</span>
           </div>
           <div className="hidden sm:flex h-12 w-12 rounded-2xl bg-white/5 border border-white/10 text-white/40 shadow-2xl items-center justify-center rim-light">
             <Calendar className="h-5 w-5" />
           </div>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 p-1.5 sm:p-2 bg-[#050a18]/60 backdrop-blur-2xl rounded-2xl sm:rounded-[2rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] border border-white/5 deep-occlusion">
        <Link
          to={`/scoreboard?date=${shiftDate(current, -1)}`}
          onClick={() => playGlassClick()}
          className="p-2 sm:p-5 text-white/50 hover:text-white transition-all hover:bg-white/5 rounded-xl sm:rounded-[1.5rem] active:scale-90 shrink-0"
        >
          <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
        </Link>

        <div className="flex-1 flex justify-between overflow-x-auto scrollbar-hide min-w-0">
          {dates.map((date) => {
            const isActive = date === current;
            return (
              <Link
                key={date}
                to={`/scoreboard?date=${date}`}
                onClick={() => { if (!isActive) playGlassClick(); }}
                className={`
                  flex flex-col items-center flex-1 min-w-0 py-2.5 sm:py-4 px-1 sm:px-2 rounded-xl sm:rounded-2xl transition-all duration-500 relative group
                  ${isActive
                    ? 'bg-white text-black shadow-[0_0_30px_rgba(255,255,255,0.3)] scale-105 sm:scale-110 z-10'
                    : 'text-white/50 hover:text-white/60 hover:bg-white/5'
                  }
                `}
              >
                {isActive && (
                  <div className="absolute inset-0 rounded-xl sm:rounded-2xl border-2 border-white/20 animate-pulse pointer-events-none" />
                )}
                <span className={`text-[10px] sm:text-sm font-black uppercase tracking-wider sm:tracking-widest mb-0.5 sm:mb-1 ${isActive ? 'opacity-60' : 'opacity-40'}`}>{formatDate(date, 'weekday')}</span>
                <span className="text-base sm:text-xl font-black tabular-nums tracking-tighter">{formatDate(date, 'day')}</span>
                <span className={`text-[10px] sm:text-[13px] font-black uppercase tracking-wider sm:tracking-[0.2em] mt-0.5 sm:mt-1 ${isActive ? 'opacity-40' : 'opacity-20'}`}>{formatDate(date, 'month')}</span>
              </Link>
            );
          })}
        </div>

        <Link
          to={`/scoreboard?date=${shiftDate(current, 1)}`}
          onClick={() => playGlassClick()}
          className="p-2 sm:p-5 text-white/50 hover:text-white transition-all hover:bg-white/5 rounded-xl sm:rounded-[1.5rem] active:scale-90 shrink-0"
        >
          <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
        </Link>
      </div>
    </div>
  );
}
