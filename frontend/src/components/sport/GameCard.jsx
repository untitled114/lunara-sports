import { Link } from 'react-router-dom';
import { ChevronRight, MapPin, Clock, Zap } from 'lucide-react';
import { getTeamColor, getLogoUrl } from '@/utils/teamColors';
import { useTheme } from '@/context/ThemeContext';
import { useFormatTime } from '@/utils/formatTime';

function StatusBadge({ game, fmt }) {
  if (game.status === "live") {
    return (
      <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--green)]/10 border border-[var(--green)]/20">
        <div className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--green)] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--green)]"></span>
        </div>
        <span className="text-sm font-black text-[var(--green)] uppercase tracking-widest">
          Q{game.quarter} {game.clock}
        </span>
      </div>
    );
  }
  if (game.status === "halftime") {
    return (
      <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20">
        <Zap className="h-3 w-3 text-yellow-400 fill-yellow-400/30" />
        <span className="text-sm font-black text-yellow-400 uppercase tracking-widest">Halftime</span>
      </div>
    );
  }
  if (game.status === "final") {
    return (
      <div className="px-4 py-1.5 rounded-full bg-white/5 border border-white/5">
        <span className="text-sm font-black text-white/50 uppercase tracking-widest">Final</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20">
      <Clock className="h-3 w-3 text-[var(--accent)]" />
      <span className="text-sm font-black text-[var(--accent)] uppercase tracking-widest">
        {fmt(game.start_time)}
      </span>
    </div>
  );
}

function TeamStrip({ fullName, abbrev, score, isWinner, isScheduled, record, rank, conf, colors, side }) {
  const logoUrl = getLogoUrl(abbrev);
  return (
    <div className="flex items-center justify-between group/team">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {/* Team badge with color accent */}
        <div className="relative shrink-0">
          <div
            className="h-14 w-14 rounded-2xl flex flex-col items-center justify-center border shadow-lg relative z-10 overflow-hidden bg-[#050a18] p-2"
            style={{
              borderColor: `${colors.primary}40`,
            }}
          >
            {rank && (
              <span className="absolute top-1 left-1.5 text-[13px] font-black uppercase tracking-tight opacity-40" style={{ color: colors.primary }}>
                #{rank}
              </span>
            )}
            <img src={logoUrl} alt={abbrev} className="w-full h-full object-contain drop-shadow-md group-hover/team:scale-110 transition-transform duration-500" />
          </div>
          <div
            className="absolute -inset-2 rounded-2xl blur-xl opacity-15 group-hover/team:opacity-30 transition-opacity"
            style={{ backgroundColor: colors.primary }}
          />
        </div>

        {/* Team info */}
        <div className="min-w-0 flex-1">
          <p className={`text-base font-black uppercase tracking-tight truncate transition-colors ${isWinner || isScheduled ? 'text-white' : 'text-white/40'}`}>
            {fullName || abbrev}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            {record && (
              <span className="text-sm font-bold text-white/50 tabular-nums">{record}</span>
            )}
            {rank && rank <= 10 && (
              <span className={`text-[13px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                rank <= 6 ? 'text-[var(--green)] bg-[var(--green)]/10' : 'text-yellow-500 bg-yellow-500/10'
              }`}>
                {conf ? `${conf} ` : ''}{rank <= 6 ? `#${rank}` : 'Play-In'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Score */}
      {!isScheduled && (
        <div className="shrink-0 ml-3">
          <span className={`text-4xl font-black tabular-nums tracking-tighter ${isWinner ? 'text-white' : 'text-white/15'}`}>
            {score}
          </span>
        </div>
      )}
    </div>
  );
}

export function GameCard({ game, standings = {} }) {
  const isFinal = game.status === "final";
  const isLive = game.status === "live" || game.status === "halftime";
  const awayWin = isFinal && game.away_score > game.home_score;
  const homeWin = isFinal && game.home_score > game.away_score;
  const isScheduled = game.status === "scheduled";
  const { playGlassClick } = useTheme();
  const fmt = useFormatTime();

  const floatDelay = (String(game.id).charCodeAt(0) % 5) * 0.5;

  const awaySt = standings[game.away_team];
  const homeSt = standings[game.home_team];

  const homeColors = getTeamColor(game.home_team);
  const awayColors = getTeamColor(game.away_team);

  // Derive win probability from standings win percentages
  const homePct = homeSt ? parseFloat(homeSt.pct) : 0.5;
  const awayPct = awaySt ? parseFloat(awaySt.pct) : 0.5;
  const total = homePct + awayPct || 1;
  const homeProb = Math.round((homePct / total) * 100);
  const awayProb = 100 - homeProb;

  // Determine point diff for live/final
  const diff = (game.home_score || 0) - (game.away_score || 0);
  const isClose = Math.abs(diff) <= 5 && (isLive || isFinal);

  return (
    <div
      className={`group relative rounded-[2.5rem] liquid-mirror gloss-sweep transition-all duration-700 hover:border-white/20 animate-float active:scale-[0.98] h-full overflow-hidden ${isLive ? 'ring-1 ring-[var(--green)]/20' : ''}`}
      style={{ animationDelay: `${floatDelay}s` }}
    >
      {/* Team color ambient glow — subtle */}
      <div
        className="absolute inset-0 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity duration-1000 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 20% 30%, ${awayColors.primary} 0%, transparent 50%), radial-gradient(circle at 80% 70%, ${homeColors.primary} 0%, transparent 50%)`
        }}
      />

      {/* Live game top accent bar */}
      {isLive && (
        <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-[var(--green)] to-transparent opacity-60" />
      )}

      <Link to={`/game/${game.id}`} onClick={() => playGlassClick()} className="block p-8 relative z-10 flex flex-col h-full">
        {/* Header: Status + Venue */}
        <div className="mb-6 flex items-center justify-between">
          <StatusBadge game={game} fmt={fmt} />
          {game.venue && (
            <div className="flex items-center gap-1.5 text-[13px] font-bold text-white/50 uppercase tracking-wider">
              <MapPin className="h-3 w-3" />
              <span className="truncate max-w-[80px]">{game.venue}</span>
            </div>
          )}
        </div>

        {/* Matchup */}
        <div className="space-y-4 mb-6 flex-1">
          <TeamStrip
            fullName={game.away_team_full || game.away_team}
            abbrev={game.away_team}
            score={game.away_score}
            isWinner={awayWin}
            isScheduled={isScheduled}
            record={awaySt?.record || game.away_record}
            rank={awaySt?.rank}
            conf={awaySt?.conf}
            colors={awayColors}
            side="away"
          />

          {/* Divider with @ */}
          <div className="flex items-center gap-3 px-2 opacity-30">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent to-white/50" />
            <span className="text-[13px] font-black text-white/60 uppercase tracking-[0.3em]">at</span>
            <div className="flex-1 h-px bg-gradient-to-l from-transparent to-white/50" />
          </div>

          <TeamStrip
            fullName={game.home_team_full || game.home_team}
            abbrev={game.home_team}
            score={game.home_score}
            isWinner={homeWin}
            isScheduled={isScheduled}
            record={homeSt?.record || game.home_record}
            rank={homeSt?.rank}
            conf={homeSt?.conf}
            colors={homeColors}
            side="home"
          />
        </div>

        {/* Win Probability Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] font-black text-white/40 uppercase tracking-wider tabular-nums">
              {awayProb}%
            </span>
            <span className="text-[13px] font-black text-white/15 uppercase tracking-[0.3em]">
              {isClose && isLive ? 'Tight Game' : 'Win Prob'}
            </span>
            <span className="text-[13px] font-black text-white/40 uppercase tracking-wider tabular-nums">
              {homeProb}%
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full overflow-hidden flex bg-white/5 border border-white/5 shadow-inner">
            <div
              className="h-full rounded-l-full transition-all duration-1000 bg-white/30"
              style={{ width: `${awayProb}%` }}
            />
            <div
              className="h-full rounded-r-full transition-all duration-1000 bg-[var(--accent)] shadow-[0_0_8px_rgba(99,102,241,0.4)]"
              style={{ width: `${homeProb}%` }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-5 border-t border-white/5">
          <div className="flex items-center gap-4">
            {/* Streaks */}
            {awaySt?.streak && (
              <div className="flex items-center gap-1.5">
                <div className={`h-1 w-1 rounded-full ${awaySt.streak.startsWith('W') ? 'bg-[var(--green)]' : 'bg-[var(--red)]'}`} />
                <span className="text-[13px] font-black text-white/50 uppercase">{game.away_team} {awaySt.streak}</span>
              </div>
            )}
            {homeSt?.streak && (
              <div className="flex items-center gap-1.5">
                <div className={`h-1 w-1 rounded-full ${homeSt.streak.startsWith('W') ? 'bg-[var(--green)]' : 'bg-[var(--red)]'}`} />
                <span className="text-[13px] font-black text-white/50 uppercase">{game.home_team} {homeSt.streak}</span>
              </div>
            )}
            {!awaySt?.streak && !homeSt?.streak && (
              <span className="text-[13px] font-black text-white/15 uppercase tracking-widest">Gamecast</span>
            )}
          </div>

          <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white group-hover:text-black text-white/50 transition-all duration-500 group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]">
            <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
          </div>
        </div>
      </Link>
    </div>
  );
}
