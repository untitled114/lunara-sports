import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { fetchPlays, fetchBoxScore } from "@/services/api";
import { Skeleton } from "@/components/ui";
import { useTheme } from "@/context/ThemeContext";
import { getLogoUrl, getHeadshotUrl } from "@/utils/teamColors";

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
      <span className={`tabular-nums leading-none mb-1.5 ${isPrimary ? 'text-[15px] sm:text-[16px] lg:text-[18px] font-black text-white' : 'text-[12px] sm:text-[13px] lg:text-[15px] font-bold text-white/80'}`}>
        {value}
      </span>
      <span className="text-[8px] font-black text-white/40 uppercase tracking-tighter">
        {label}
      </span>
    </div>
  );
}

function PlayerRow({ player, teamAbbrev }) {
  const { playGlassClick } = useTheme();
  const teamLogo = getLogoUrl(teamAbbrev);

  return (
    <div className="group relative py-3 px-4 sm:py-4 sm:px-5 lg:py-5 lg:px-6 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
      <div className="flex items-center gap-4 sm:gap-5">
        <div className="h-10 w-10 sm:h-12 sm:w-12 lg:h-14 lg:w-14 rounded-full border border-white/10 bg-[#050a18] flex items-center justify-center overflow-hidden shadow-inner shrink-0">
          {player.headshot_url ? (
            <img src={getHeadshotUrl(player.headshot_url)} alt="" width={56} height={56} loading="lazy" className="w-full h-full object-cover scale-110" />
          ) : teamLogo ? (
            <img src={teamLogo} alt="" width={32} height={32} loading="lazy" className="w-8 h-8 object-contain opacity-30" />
          ) : (
            <span className="text-sm font-black text-white/10">{player.name?.[0]}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2.5">
            <Link
              to={`/player/${player.id || '1'}`}
              onClick={playGlassClick}
              className="text-[14px] sm:text-[15px] lg:text-[17px] font-black text-white uppercase tracking-tight truncate hover:text-indigo-400 transition-colors"
            >
              {player.name}
            </Link>
            {player.jersey && (
              <span className="text-[12px] font-bold text-white/40 uppercase">
                #{player.jersey} {player.position ? `· ${player.position}` : ""}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 sm:gap-5 lg:gap-6">
            <StatBlock label="PTS" value={player.points ?? 0} isPrimary={true} />
            <StatBlock label="FG" value={player.fg || "0-0"} />
            <StatBlock label="REB" value={player.rebounds ?? 0} />
            <StatBlock label="AST" value={player.assists ?? 0} />
            <StatBlock label="PF" value={player.fouls ?? 0} />
          </div>
        </div>

        <div className="shrink-0 pl-4 self-center">
          <span className="text-[24px] font-black text-white/15 tabular-nums italic">
            {player.jersey || "0"}
          </span>
        </div>
      </div>
    </div>
  );
}

function TeamSection({ teamAbbrev, players }) {
  const logo = getLogoUrl(teamAbbrev);

  return (
    <div className="mb-6 last:mb-0 rounded-[2.5rem] bg-[#111624] border border-white/5 overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4 lg:px-6 lg:py-5 bg-white/[0.02] border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-full bg-[#050a18] border border-white/10 flex items-center justify-center p-1.5 overflow-hidden">
            <img src={logo} alt="" width={28} height={28} loading="lazy" className="w-full h-full object-contain" />
          </div>
          <span className="text-[15px] font-black text-white uppercase tracking-widest">{teamAbbrev}</span>
        </div>
        <span className="text-[11px] font-black text-white/40 uppercase tracking-[0.3em]">On Court</span>
      </div>

      <div className="divide-y divide-white/[0.02]">
        {players.length === 0 ? (
          <div className="py-16 text-center text-[12px] font-black uppercase tracking-widest text-white/10">
            Waiting for game start...
          </div>
        ) : (
          players.map((p, i) => (
            <PlayerRow key={p.name || i} player={p} teamAbbrev={teamAbbrev} />
          ))
        )}
      </div>
    </div>
  );
}

/* ─── Full Box Score Table ─── */

function FullTeamTable({ teamAbbrev, players, totals }) {
  const logo = getLogoUrl(teamAbbrev);
  const { playGlassClick } = useTheme();

  const statCols = [
    { key: 'minutes', label: 'MIN' },
    { key: 'fg', label: 'FG' },
    { key: 'three_pt', label: '3PT' },
    { key: 'ft', label: 'FT' },
    { key: 'rebounds', label: 'REB' },
    { key: 'assists', label: 'AST' },
    { key: 'steals', label: 'STL' },
    { key: 'blocks', label: 'BLK' },
    { key: 'turnovers', label: 'TO' },
    { key: 'fouls', label: 'PF' },
    { key: 'plus_minus', label: '+/-' },
    { key: 'points', label: 'PTS', primary: true },
  ];

  const starters = players.filter(p => p.starter);
  const bench = players.filter(p => !p.starter);

  const renderRow = (p, i) => (
    <tr key={p.name || i} className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors group/row">
      <td className="py-2 sm:py-2.5 pl-3 pr-2 sm:pl-4 sm:pr-3 whitespace-nowrap">
        <div className="flex items-center gap-2.5">
          <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-full border border-white/10 bg-[#050a18] flex items-center justify-center overflow-hidden shrink-0">
            {p.headshot_url ? (
              <img src={getHeadshotUrl(p.headshot_url, 56)} alt="" width={28} height={28} loading="lazy" className="w-full h-full object-cover scale-110" />
            ) : (
              <span className="text-[8px] font-black text-white/10">{p.name?.[0]}</span>
            )}
          </div>
          <Link
            to={`/player/${p.id || '1'}`}
            onClick={playGlassClick}
            className="text-[12px] font-black text-white uppercase tracking-tight hover:text-indigo-400 transition-colors"
          >
            {p.name}
          </Link>
          <span className="text-[10px] font-bold text-white/15">{p.position}</span>
        </div>
      </td>
      {statCols.map(col => {
        const val = p[col.key] ?? 0;
        const isPM = col.key === 'plus_minus';
        const num = isPM ? parseInt(val) : null;
        return (
          <td key={col.key} className="py-2 sm:py-2.5 px-1.5 text-center whitespace-nowrap">
            <span className={`text-[12px] tabular-nums ${
              col.primary ? 'font-black text-white' :
              isPM && num > 0 ? 'font-bold text-emerald-400' :
              isPM && num < 0 ? 'font-bold text-red-400' :
              'font-medium text-white/150'
            }`}>
              {isPM && num > 0 ? `+${val}` : val}
            </span>
          </td>
        );
      })}
    </tr>
  );

  const renderLabel = (label) => (
    <tr>
      <td colSpan={statCols.length + 1} className="py-1.5 px-4 bg-white/[0.015]">
        <span className="text-[9px] font-black text-white/15 uppercase tracking-[0.3em]">{label}</span>
      </td>
    </tr>
  );

  const totalLabelMap = { minutes: 'MIN', fg: 'FG', three_pt: '3PT', ft: 'FT', rebounds: 'REB', assists: 'AST', steals: 'STL', blocks: 'BLK', turnovers: 'TO', fouls: 'PF', plus_minus: '+/-', points: 'PTS' };

  return (
    <div className="rounded-[2rem] bg-[#111624] border border-white/5 overflow-hidden shadow-2xl">
      {/* Team header */}
      <div className="flex items-center justify-between px-4 py-2.5 sm:px-5 sm:py-3 bg-white/[0.02] border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-full bg-[#050a18] border border-white/10 flex items-center justify-center p-1 overflow-hidden">
            <img src={logo} alt="" width={28} height={28} loading="lazy" className="w-full h-full object-contain" />
          </div>
          <span className="text-[13px] font-black text-white uppercase tracking-widest">{teamAbbrev}</span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto scrollbar-thin">
        <table style={{ width: '100%', tableLayout: 'auto', borderCollapse: 'collapse' }}>
          <thead>
            <tr className="border-b border-white/5">
              <th className="py-1.5 sm:py-2 pl-3 pr-2 sm:pl-4 sm:pr-3 text-left">
                <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Player</span>
              </th>
              {statCols.map(col => (
                <th key={col.key} className="py-1.5 sm:py-2 px-1.5 text-center">
                  <span className={`text-[9px] font-black uppercase tracking-wider ${col.primary ? 'text-white/40' : 'text-white/40'}`}>
                    {col.label}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {starters.length > 0 && renderLabel('Starters')}
            {starters.map(renderRow)}
            {bench.length > 0 && renderLabel('Bench')}
            {bench.map(renderRow)}
            {totals && Object.keys(totals).length > 0 && (
              <tr className="border-t border-white/10 bg-white/[0.03]">
                <td className="py-2.5 pl-4 pr-3">
                  <span className="text-[11px] font-black text-white/30 uppercase tracking-widest">Totals</span>
                </td>
                {statCols.map(col => (
                  <td key={col.key} className="py-2 sm:py-2.5 px-1.5 text-center whitespace-nowrap">
                    <span className={`text-[12px] tabular-nums ${col.primary ? 'font-black text-white' : 'font-bold text-white/30'}`}>
                      {totals[totalLabelMap[col.key]] || ''}
                    </span>
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
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
      <div className="space-y-6">
        <Skeleton variant="rectangle" height="h-64" className="w-full rounded-[2rem] bg-white/5 opacity-5" />
        <Skeleton variant="rectangle" height="h-64" className="w-full rounded-[2rem] bg-white/5 opacity-5" />
      </div>
    );
  }

  if (!boxData) return null;

  return (
    <div className="space-y-6">
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
      <Skeleton variant="rectangle" height="h-48" className="w-full rounded-[2.5rem] bg-white/5 opacity-5" />
    ) : (
      <TeamSection teamAbbrev={awayTeam} players={awayPlayers} />
    );
  }
  if (side === "home") {
    return loading ? (
      <Skeleton variant="rectangle" height="h-48" className="w-full rounded-[2.5rem] bg-white/5 opacity-5" />
    ) : (
      <TeamSection teamAbbrev={homeTeam} players={homePlayers} />
    );
  }

  // Default: render both teams stacked
  return (
    <div className="space-y-5">
      {loading ? (
        <div className="space-y-6">
          <Skeleton variant="rectangle" height="h-48" className="w-full rounded-[2.5rem] bg-white/5 opacity-5" />
          <Skeleton variant="rectangle" height="h-48" className="w-full rounded-[2.5rem] bg-white/5 opacity-5" />
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
