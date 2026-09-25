import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { fetchPlays, fetchBoxScore } from "@/services/api";
import { Skeleton, Card, DataTable, TeamMark } from "@/components/ui";
import { useTheme } from "@/context/ThemeContext";
import { getLogoUrl } from "@/utils/teamColors";

/* ─── On-Court Tracking ─── */

function getOnCourtNames(plays, boxData, homeTeam, awayTeam) {
  // Start with starters from box score
  const homeSet = new Set();
  const awaySet = new Set();

  if (boxData) {
    for (const p of boxData.home?.players || []) {
      if (p.starter) homeSet.add(p.name);
    }
    for (const p of boxData.away?.players || []) {
      if (p.starter) awaySet.add(p.name);
    }
  }

  // Process plays chronologically to track subs
  const sorted = [...plays].sort((a, b) => a.sequence_number - b.sequence_number);

  for (const play of sorted) {
    const desc = play.description || "";
    const m = desc.match(/^(.+?)\s+enters the game for\s+(.+?)$/i);
    if (!m) continue;

    const entering = m[1].trim();
    const leaving = m[2].trim();
    const team = play.team;

    if (team === homeTeam || homeSet.has(leaving)) {
      homeSet.delete(leaving);
      homeSet.add(entering);
    } else if (team === awayTeam || awaySet.has(leaving)) {
      awaySet.delete(leaving);
      awaySet.add(entering);
    }
  }

  return { homeOnCourt: homeSet, awayOnCourt: awaySet };
}

/* ─── Components ─── */

function StatBlock({ label, value, isPrimary = false }) {
  return (
    <div className="flex flex-col items-center min-w-[32px]">
      <span className={`tnum leading-none mb-1 ${isPrimary ? 't-body font-semibold text-text-1' : 't-small text-text-2'}`}>
        {value}
      </span>
      <span className="t-label text-text-3">{label}</span>
    </div>
  );
}

function PlayerRow({ player }) {
  const { playGlassClick } = useTheme();

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <Link
            to={`/player/${player.id || '1'}`}
            onClick={playGlassClick}
            className="t-small font-semibold text-text-1 truncate hover:text-accent transition-colors"
          >
            {player.name}
          </Link>
          {player.jersey && (
            <span className="t-label text-text-3">
              #{player.jersey}{player.position ? ` · ${player.position}` : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 sm:gap-5">
          <StatBlock label="PTS" value={player.points ?? 0} isPrimary />
          <StatBlock label="FG" value={player.fg || "0-0"} />
          <StatBlock label="REB" value={player.rebounds ?? 0} />
          <StatBlock label="AST" value={player.assists ?? 0} />
          <StatBlock label="PF" value={player.fouls ?? 0} />
        </div>
      </div>
    </div>
  );
}

function TeamSection({ teamAbbrev, players }) {
  const logo = getLogoUrl(teamAbbrev);

  return (
    <Card className="mb-4 last:mb-0">
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-border">
        <TeamMark abbrev={teamAbbrev} logoUrl={logo} size="sm" />
        <span className="t-label text-text-3">On court</span>
      </div>

      {players.length === 0 ? (
        <p className="py-8 text-center t-small text-text-3">Waiting for tip-off.</p>
      ) : (
        <div className="divide-y divide-border">
          {players.map((p, i) => (
            <PlayerRow key={p.name || i} player={p} />
          ))}
        </div>
      )}
    </Card>
  );
}

/* ─── Full Box Score Table ─── */

const STAT_COLUMNS = [
  { key: 'minutes', label: 'MIN', numeric: true },
  { key: 'fg', label: 'FG', numeric: true },
  { key: 'three_pt', label: '3PT', numeric: true },
  { key: 'ft', label: 'FT', numeric: true },
  { key: 'rebounds', label: 'REB', numeric: true },
  { key: 'assists', label: 'AST', numeric: true },
  { key: 'steals', label: 'STL', numeric: true },
  { key: 'blocks', label: 'BLK', numeric: true },
  { key: 'turnovers', label: 'TO', numeric: true },
  { key: 'fouls', label: 'PF', numeric: true },
  {
    key: 'plus_minus',
    label: '+/-',
    numeric: true,
    render: (p) => {
      const val = p.plus_minus;
      const n = parseInt(val, 10);
      if (Number.isNaN(n)) return val ?? '';
      return <span className={n > 0 ? 'text-live' : n < 0 ? 'text-loss' : ''}>{n > 0 ? `+${val}` : val}</span>;
    },
  },
  { key: 'points', label: 'PTS', numeric: true },
];

function FullTeamTable({ teamAbbrev, players, totals }) {
  const logo = getLogoUrl(teamAbbrev);
  const { playGlassClick } = useTheme();
  const totalPts = totals?.PTS ?? totals?.points;

  const rows = [...players.filter((p) => p.starter), ...players.filter((p) => !p.starter)];

  const columns = [
    {
      key: 'player',
      label: 'Player',
      render: (p) => (
        <Link to={`/player/${p.id || '1'}`} onClick={playGlassClick} className="text-text-1 hover:text-accent transition-colors">
          {p.name}
        </Link>
      ),
    },
    ...STAT_COLUMNS,
  ];

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <TeamMark abbrev={teamAbbrev} logoUrl={logo} size="sm" />
        {totalPts != null && (
          <span className="t-label text-text-3">
            Total <span className="tnum text-text-2">{totalPts}</span>
          </span>
        )}
      </div>
      <DataTable columns={columns} rows={rows} getKey={(r) => r.name} />
    </Card>
  );
}

export function FullBoxScore({ gameId, homeTeam, awayTeam, status, boxData: boxDataProp }) {
  const [boxData, setBoxData] = useState(boxDataProp || null);
  const [loading, setLoading] = useState(!boxDataProp);

  // Sync from prop when provided (from GameDetailPage)
  useEffect(() => {
    if (boxDataProp) {
      setBoxData(boxDataProp);
      setLoading(false);
    }
  }, [boxDataProp]);

  const refresh = useCallback(() => {
    return fetchBoxScore(gameId).catch(() => null).then(box => {
      if (box) setBoxData(box);
    });
  }, [gameId]);

  // Only fetch independently when no prop provided
  useEffect(() => {
    if (boxDataProp) return;
    refresh().finally(() => setLoading(false));
  }, [refresh, boxDataProp]);

  const isLive = status === "live" || status === "halftime";
  useEffect(() => {
    if (!isLive || boxDataProp) return;
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, [isLive, refresh, boxDataProp]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton variant="rectangle" height="h-64" className="rounded-lg" />
        <Skeleton variant="rectangle" height="h-64" className="rounded-lg" />
      </div>
    );
  }

  if (!boxData) return null;

  return (
    <div className="space-y-4">
      <FullTeamTable teamAbbrev={awayTeam} players={boxData.away?.players || []} totals={boxData.away?.totals} />
      <FullTeamTable teamAbbrev={homeTeam} players={boxData.home?.players || []} totals={boxData.home?.totals} />
    </div>
  );
}

/* ─── On-Court (Sidebar) ─── */

export function BoxScore({ gameId, homeTeam, awayTeam, status, side, plays: playsProp, boxData: boxDataProp }) {
  const hasProps = playsProp !== undefined && boxDataProp !== undefined;
  const [boxData, setBoxData] = useState(boxDataProp || null);
  const [plays, setPlays] = useState(playsProp || []);
  const [loading, setLoading] = useState(!hasProps);

  // Sync from props when provided (from GameDetailPage)
  useEffect(() => {
    if (playsProp !== undefined) setPlays(playsProp);
  }, [playsProp]);
  useEffect(() => {
    if (boxDataProp) {
      setBoxData(boxDataProp);
      setLoading(false);
    }
  }, [boxDataProp]);

  const refresh = useCallback(() => {
    return Promise.all([
      fetchBoxScore(gameId).catch(() => null),
      fetchPlays(gameId).catch(() => []),
    ]).then(([box, playsData]) => {
      if (box) setBoxData(box);
      if (Array.isArray(playsData)) setPlays(playsData);
    });
  }, [gameId]);

  // Only fetch independently when no props provided
  useEffect(() => {
    if (hasProps) return;
    refresh().finally(() => setLoading(false));
  }, [refresh, hasProps]);

  // Poll only when standalone (no props) and game is live
  const isLive = status === "live" || status === "halftime";
  useEffect(() => {
    if (!isLive || hasProps) return;
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, [isLive, refresh, hasProps]);

  // Compute on-court players
  const { homeOnCourt, awayOnCourt } = getOnCourtNames(plays, boxData, homeTeam, awayTeam);

  // Filter box score players to on-court only, always return exactly 5
  const filterOnCourt = (teamPlayers, onCourtSet) => {
    if (!teamPlayers) return [];
    if (onCourtSet.size === 0) return teamPlayers.slice(0, 5);
    const onCourt = teamPlayers.filter(p => onCourtSet.has(p.name));
    // Pad to 5 if name mismatches caused drops
    if (onCourt.length < 5) {
      const onCourtNames = new Set(onCourt.map(p => p.name));
      for (const p of teamPlayers) {
        if (onCourt.length >= 5) break;
        if (!onCourtNames.has(p.name)) onCourt.push(p);
      }
    }
    return onCourt.slice(0, 5);
  };

  const homePlayers = filterOnCourt(boxData?.home?.players, homeOnCourt);
  const awayPlayers = filterOnCourt(boxData?.away?.players, awayOnCourt);

  // If side is specified, render only that team
  if (side === "away") {
    return loading ? (
      <Skeleton variant="rectangle" height="h-48" className="rounded-lg" />
    ) : (
      <TeamSection teamAbbrev={awayTeam} players={awayPlayers} />
    );
  }
  if (side === "home") {
    return loading ? (
      <Skeleton variant="rectangle" height="h-48" className="rounded-lg" />
    ) : (
      <TeamSection teamAbbrev={homeTeam} players={homePlayers} />
    );
  }

  // Default: render both teams stacked
  return (
    <div className="space-y-4">
      {loading ? (
        <div className="space-y-4">
          <Skeleton variant="rectangle" height="h-48" className="rounded-lg" />
          <Skeleton variant="rectangle" height="h-48" className="rounded-lg" />
        </div>
      ) : (
        <>
          <TeamSection teamAbbrev={awayTeam} players={awayPlayers} />
          <TeamSection teamAbbrev={homeTeam} players={homePlayers} />
        </>
      )}
    </div>
  );
}
