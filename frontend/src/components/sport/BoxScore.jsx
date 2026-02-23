import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { fetchPlays, fetchBoxScore } from "@/services/api";
import { Skeleton } from "@/components/ui";
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
      <span className={`tabular-nums leading-none mb-1.5 ${isPrimary ? 'text-[18px] font-black text-white' : 'text-[15px] font-bold text-white/80'}`}>
        {value}
      </span>
      <span className="text-[8px] font-black text-white/20 uppercase tracking-tighter">
        {label}
      </span>
    </div>
  );
}

function PlayerRow({ player, teamAbbrev }) {
  const { playGlassClick } = useTheme();
  const teamLogo = getLogoUrl(teamAbbrev);

  return (
    <div className="group relative py-5 px-6 border-b border-white/[0.03] hover:bg-white/[0.02] transition-all">
      <div className="flex items-center gap-5">
        <div className="h-14 w-14 rounded-full border border-white/10 bg-[#050a18] flex items-center justify-center overflow-hidden shadow-inner shrink-0">
          {player.headshot_url ? (
            <img src={player.headshot_url} alt="" className="w-full h-full object-cover scale-110" />
          ) : teamLogo ? (
            <img src={teamLogo} alt="" className="w-8 h-8 object-contain opacity-30" />
          ) : (
            <span className="text-sm font-black text-white/10">{player.name?.[0]}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2.5">
            <Link
              to={`/player/${player.id || '1'}`}
              onClick={playGlassClick}
              className="text-[17px] font-black text-white uppercase tracking-tight truncate hover:text-indigo-400 transition-colors"
            >
              {player.name}
            </Link>
            {player.jersey && (
              <span className="text-[12px] font-bold text-white/20 uppercase">
                #{player.jersey} {player.position ? `· ${player.position}` : ""}
              </span>
            )}
          </div>

          <div className="flex items-center gap-6">
            <StatBlock label="PTS" value={player.points ?? 0} isPrimary={true} />
            <StatBlock label="FG" value={player.fg || "0-0"} />
            <StatBlock label="REB" value={player.rebounds ?? 0} />
            <StatBlock label="AST" value={player.assists ?? 0} />
            <StatBlock label="PF" value={player.fouls ?? 0} />
          </div>
        </div>

        <div className="shrink-0 pl-4 self-center">
          <span className="text-[24px] font-black text-white/5 tabular-nums italic">
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
      <div className="flex items-center justify-between px-6 py-5 bg-white/[0.02] border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-full bg-[#050a18] border border-white/10 flex items-center justify-center p-1.5 overflow-hidden">
            <img src={logo} alt="" className="w-full h-full object-contain" />
          </div>
          <span className="text-[15px] font-black text-white uppercase tracking-widest">{teamAbbrev}</span>
        </div>
        <span className="text-[11px] font-black text-white/20 uppercase tracking-[0.3em]">On Court</span>
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

/* ─── Main ─── */

export function BoxScore({ gameId, homeTeam, awayTeam, status, side }) {
  const [boxData, setBoxData] = useState(null);
  const [plays, setPlays] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    return Promise.all([
      fetchBoxScore(gameId).catch(() => null),
      fetchPlays(gameId).catch(() => []),
    ]).then(([box, playsData]) => {
      if (box) setBoxData(box);
      if (Array.isArray(playsData)) setPlays(playsData);
    });
  }, [gameId]);

  // Initial fetch
  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  // Poll every 30s for live games
  const isLive = status === "live" || status === "halftime";
  useEffect(() => {
    if (!isLive) return;
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, [isLive, refresh]);

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
