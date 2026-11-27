import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { getLogoUrl } from '@/utils/teamColors';
import { useFormatTime } from '@/utils/formatTime';
import { gameStatusText } from '@/lib/gameMath';

function TeamRow({ abbrev, record, score, showScore, dim }) {
  return (
    // Pixel height: the 22px score needs it whatever the text size setting makes a rem.
    <div className="flex items-center gap-2 h-[32px]">
      <img src={getLogoUrl(abbrev)} alt="" width={22} height={22} className="h-[22px] w-[22px] shrink-0" />
      <span className={clsx('t-body font-semibold w-10 shrink-0', dim ? 'text-text-3' : 'text-text-1')}>{abbrev}</span>
      <span className="t-label tnum text-text-2 flex-1 min-w-0 truncate">{record}</span>
      {showScore && <span className={clsx('t-score tnum shrink-0', dim ? 'text-text-3' : 'text-text-1')}>{score}</span>}
    </div>
  );
}

// A compact game box: two team rows (logo, abbreviation, record, score; the
// trailing team dimmed), then the status ("4th 3:19" in green while live) and the arena.
// The whole box is one link to the game; the game page keeps seeds and streaks.
// `records` is a buildStandingsLookup() map for this season, or {} for no records.
export function GameCard({ game, records = {} }) {
  const fmt = useFormatTime();
  const started = game.status !== 'scheduled';
  const live = game.status === 'live' || game.status === 'halftime';
  const away = Number(game.away_score);
  const home = Number(game.home_score);

  return (
    <Link
      to={`/game/${game.id}`}
      className={clsx(
        'block h-full rounded-lg border bg-surface-1 shadow-card px-3 py-2 transition-colors',
        live ? 'border-live' : 'border-border hover:border-border-strong'
      )}
    >
      <TeamRow abbrev={game.away_team} record={records[game.away_team]?.record} score={game.away_score} showScore={started} dim={started && away < home} />
      <TeamRow abbrev={game.home_team} record={records[game.home_team]?.record} score={game.home_score} showScore={started} dim={started && home < away} />
      <div className="mt-1 pt-1.5 border-t border-border flex items-center justify-between gap-3">
        <span className={clsx('t-label font-semibold tnum shrink-0', live ? 'text-live' : 'text-text-2')}>
          {gameStatusText(game, fmt)}
        </span>
        {game.venue && (
          <span className="t-label text-text-3 truncate min-w-0 max-w-[60%]" title={game.venue}>
            {game.venue}
          </span>
        )}
      </div>
    </Link>
  );
}
