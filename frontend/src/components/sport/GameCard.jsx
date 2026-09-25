import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { ChevronRight, MapPin } from 'lucide-react';
import { getLogoUrl } from '@/utils/teamColors';
import { useTheme } from '@/context/ThemeContext';
import { useFormatTime } from '@/utils/formatTime';
import { Badge, Card, TeamMark } from '@/components/ui';
import { seedBadge, winProbability, recordLine } from '@/lib/gameMath';

function StatusBadge({ game, fmt }) {
  if (game.status === 'live') {
    return (
      <Badge variant="live" dot>
        <span className="tnum">Q{game.quarter} {game.clock}</span>
      </Badge>
    );
  }
  if (game.status === 'halftime') return <Badge variant="warn">Halftime</Badge>;
  if (game.status === 'final') return <Badge variant="neutral">Final</Badge>;
  return (
    <Badge variant="accent">
      <span className="tnum">{fmt(game.start_time)}</span>
    </Badge>
  );
}

function TeamRow({ abbrev, fullName, score, dim, isScheduled, standing, fallbackRecord, standingsMeta }) {
  const badge = seedBadge(standing, standingsMeta.isPrev);
  const record = standing
    ? recordLine(standing, standingsMeta.seasonLabel, standingsMeta.isPrev)
    : fallbackRecord;
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <TeamMark abbrev={abbrev} logoUrl={getLogoUrl(abbrev)} />
          {badge && (
            <Badge
              variant={badge.variant}
              title={badge.prev ? `${standingsMeta.seasonLabel} seeding` : undefined}
            >
              {badge.text}
            </Badge>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2 min-w-0">
          {fullName && fullName !== abbrev && (
            <span className="t-small text-text-2 truncate">{fullName}</span>
          )}
          {record && <span className="t-small text-text-3 tnum shrink-0">{record}</span>}
        </div>
      </div>

      {!isScheduled && (
        <span className={clsx('t-score shrink-0', dim ? 'text-text-3' : 'text-text-1')}>{score}</span>
      )}
    </div>
  );
}

export function GameCard({ game, standings = {}, standingsMeta = { seasonLabel: '', isPrev: false } }) {
  const isFinal = game.status === 'final';
  const isLive = game.status === 'live' || game.status === 'halftime';
  const isScheduled = game.status === 'scheduled';
  const awayWin = isFinal && game.away_score > game.home_score;
  const homeWin = isFinal && game.home_score > game.away_score;
  const { playGlassClick } = useTheme();
  const fmt = useFormatTime();

  const awaySt = standings[game.away_team];
  const homeSt = standings[game.home_team];

  // Standings-based estimate; null (no bar) when either side has no games on record.
  const wp = winProbability(homeSt, awaySt);
  const seasonShort = (standingsMeta.seasonLabel || '').replace(' final', '');

  return (
    <Card live={isLive} className="group h-full p-0 active:scale-[0.98] transition-all duration-700">
      <Link to={`/game/${game.id}`} onClick={() => playGlassClick()} className="flex flex-col h-full p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <StatusBadge game={game} fmt={fmt} />
          {game.venue && (
            <span className="t-small text-text-3 flex items-center gap-1 min-w-0">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{game.venue}</span>
            </span>
          )}
        </div>

        <div className="flex-1 space-y-3 mb-4">
          <TeamRow
            abbrev={game.away_team}
            fullName={game.away_team_full}
            score={game.away_score}
            dim={isFinal && !awayWin}
            isScheduled={isScheduled}
            standing={awaySt}
            fallbackRecord={game.away_record}
            standingsMeta={standingsMeta}
          />
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="t-label text-text-3">at</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <TeamRow
            abbrev={game.home_team}
            fullName={game.home_team_full}
            score={game.home_score}
            dim={isFinal && !homeWin}
            isScheduled={isScheduled}
            standing={homeSt}
            fallbackRecord={game.home_record}
            standingsMeta={standingsMeta}
          />
        </div>

        {wp && (
          <div className="mb-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="t-small text-text-2 tnum">{wp.away}%</span>
              <span className="t-label text-text-3">
                {standingsMeta.isPrev ? `Based on ${seasonShort} records` : 'Win probability'}
              </span>
              <span className="t-small text-text-2 tnum">{wp.home}%</span>
            </div>
            <div className="h-1.5 w-full rounded-sm overflow-hidden flex bg-surface-2">
              <div className="h-full transition-all duration-1000 bg-text-3" style={{ width: `${wp.away}%` }} />
              <div className="h-full transition-all duration-1000 bg-accent" style={{ width: `${wp.home}%` }} />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="flex items-center gap-4 min-w-0">
            {/* Streaks are only meaningful for the season in progress. */}
            {!standingsMeta.isPrev && awaySt?.streak && (
              <span className="t-small text-text-2 tnum">{game.away_team} {awaySt.streak}</span>
            )}
            {!standingsMeta.isPrev && homeSt?.streak && (
              <span className="t-small text-text-2 tnum">{game.home_team} {homeSt.streak}</span>
            )}
            {(standingsMeta.isPrev || (!awaySt?.streak && !homeSt?.streak)) && (
              <span className="t-small text-text-2">Gamecast</span>
            )}
          </div>
          <span className="h-9 w-9 rounded-md border border-border bg-surface-2 flex items-center justify-center text-text-2 group-hover:text-text-1 group-hover:border-border-strong transition-all duration-500">
            <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
          </span>
        </div>
      </Link>
    </Card>
  );
}
