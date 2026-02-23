import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { useGameFeed } from "@/hooks/useGameFeed";
import { addReaction, fetchBoxScore } from "@/services/api";
import { Zap, Clock, MessageSquare } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { getTeamColor, getLogoUrl } from "@/utils/teamColors";

/* ─── Running Stats Snapshots ─── */

function buildStatsSnapshots(plays) {
  const snapshots = new Map();
  const live = {};
  const ensure = (n) => {
    if (!live[n]) live[n] = { pts: 0, threes: 0, ast: 0, reb: 0, fgm: 0, fga: 0 };
  };

  // Must process chronologically (oldest first) for running totals
  const chronological = [...plays].sort((a, b) => a.sequence_number - b.sequence_number);

  for (const play of chronological) {
    const d = (play.description || "").toLowerCase();
    const name = play.player_name;

    if (name) {
      ensure(name);
      if (d.includes("makes")) {
        if (d.includes("free throw")) {
          live[name].pts += 1;
        } else if (d.includes("three point") || d.includes("3-point") || d.includes("3pt")) {
          live[name].pts += 3; live[name].threes += 1; live[name].fgm += 1; live[name].fga += 1;
        } else {
          live[name].pts += 2; live[name].fgm += 1; live[name].fga += 1;
        }
      }
      if (d.includes("misses") && !d.includes("free throw")) { live[name].fga += 1; }
      if (d.includes("rebound")) { live[name].reb += 1; }
    }

    const am = d.match(/\(([^)]+)\s+assists?\)/i);
    if (am) { const a = am[1].trim(); ensure(a); live[a].ast += 1; }

    const snap = {};
    for (const k in live) snap[k] = { ...live[k] };
    snapshots.set(play.sequence_number, snap);
  }

  return snapshots;
}

/* ─── Headshot Lookup ─── */

function buildHeadshotMap(boxData) {
  const map = {};
  if (!boxData) return map;
  const process = (players) => {
    for (const p of players || []) {
      if (p.name && p.headshot_url) {
        map[p.name] = p.headshot_url;
        const parts = p.name.split(" ");
        if (parts.length >= 2) {
          const key = `_L_${parts.slice(1).join(" ").toLowerCase()}`;
          if (!map[key]) map[key] = p.headshot_url;
        }
      }
    }
  };
  process(boxData.home?.players);
  process(boxData.away?.players);
  return map;
}

function findHeadshot(name, map) {
  if (!name || !map) return null;
  if (map[name]) return map[name];
  const parts = name.split(" ");
  if (parts.length >= 2) {
    const key = `_L_${parts.slice(1).join(" ").toLowerCase()}`;
    if (map[key]) return map[key];
  }
  return null;
}

/* ─── Helpers ─── */

function abbr(full) {
  if (!full) return "";
  const p = full.split(" ");
  return p.length < 2 ? full : `${p[0][0]}. ${p.slice(1).join(" ")}`;
}

function parseAssist(desc = "") {
  const m = desc.match(/\(([^)]+)\s+assists?\)/i);
  return m ? m[1].trim() : null;
}

/* ─── Lead Context ─── */

function getLeadCtx(play, prevPlay, homeTeam) {
  const d = (play.description || "").toLowerCase();
  const scoring = d.includes("makes");
  const miss = d.includes("misses");
  if (!scoring && !miss) return "";

  const h = play.home_score ?? 0;
  const a = play.away_score ?? 0;

  if (scoring && prevPlay) {
    const ph = prevPlay.home_score ?? 0;
    const pa = prevPlay.away_score ?? 0;
    if (h > ph && ph <= pa && h > a) return "lead-taking ";
    if (a > pa && pa <= ph && a > h) return "lead-taking ";
  }

  if (miss) {
    if (h === a) return "lead-taking ";
    const isThree = d.includes("three point") || d.includes("3-point");
    const isHome = play.team === homeTeam;
    const deficit = isHome ? a - h : h - a;
    if (deficit > 0 && deficit <= (isThree ? 2 : 1)) return "lead-taking ";
  }

  return "";
}

/* ─── Play Title ─── */

function buildTitle(description = "", ctx = "") {
  const d = description.toLowerCase();

  if (d.includes("enters the game")) return { t: "Substitution", c: "sub" };
  if (d.includes("gains possession") || d.includes("vs.")) return { t: "Jump Ball", c: "sub" };
  if (d.includes("timeout")) return { t: "Timeout", c: "timeout" };

  const dm = d.match(/(\d+)-?foot/);
  const dist = dm ? `${dm[1]}'` : "";
  const distN = dm ? +dm[1] : 0;
  const fb = d.includes("fast break") ? "fastbreak " : "";

  if (d.includes("makes")) {
    if (d.includes("free throw")) {
      const fm = d.match(/free throw (\d) of (\d)/);
      return { t: fm ? `Free throw (${fm[1]}/${fm[2]})` : "Free throw", c: "score" };
    }
    const Cap = ctx ? ctx.charAt(0).toUpperCase() + ctx.slice(1) : "";
    if (d.includes("three point") || d.includes("3-point") || d.includes("3pt")) {
      return { t: distN >= 27 ? `${Cap}${dist} bomb`.trim() : `${Cap}${dist} ${fb}three`.trim(), c: "three" };
    }
    if (d.includes("dunk")) return { t: `${Cap}${d.includes("alley oop") ? "Alley-oop dunk" : "Dunk"}`.trim(), c: "score" };
    if (d.includes("layup")) return { t: `${Cap}${d.includes("driving") ? "Driving layup" : "Layup"}`.trim(), c: "score" };
    if (d.includes("hook")) return { t: `${Cap}${dist} hook shot`.trim(), c: "score" };
    if (d.includes("tip")) return { t: `${Cap}Tip-in`.trim(), c: "score" };
    if (d.includes("pullup")) return { t: `${Cap}${dist} pullup`.trim(), c: "score" };
    if (d.includes("step back")) return { t: `${Cap}${dist} step-back`.trim(), c: "score" };
    if (d.includes("fade")) return { t: `${Cap}${dist} fadeaway`.trim(), c: "score" };
    if (d.includes("float")) return { t: `${Cap}${dist} floater`.trim(), c: "score" };
    return { t: `${Cap}${dist} jumper`.trim() || "Made shot", c: "score" };
  }

  if (d.includes("misses")) {
    if (d.includes("free throw")) return { t: "Missed free throw", c: "miss" };
    if (d.includes("three point") || d.includes("3-point")) {
      return { t: `Missed ${dist} ${ctx}${fb}three`.trim(), c: "miss" };
    }
    if (d.includes("layup")) return { t: `Missed ${ctx}layup`.trim(), c: "miss" };
    if (d.includes("dunk")) return { t: `Missed ${ctx}dunk`.trim(), c: "miss" };
    return { t: `Missed ${dist} ${ctx}two`.trim().replace(/\s+/g, " "), c: "miss" };
  }

  if (d.includes("offensive rebound")) return { t: "Offensive rebound", c: "rebound" };
  if (d.includes("defensive rebound")) return { t: "Defensive rebound", c: "rebound" };
  if (d.includes("rebound")) return { t: "Rebound", c: "rebound" };
  if (d.includes("block")) return { t: "Block", c: "block" };
  if (d.includes("steal")) return { t: "Steal", c: "steal" };
  if (d.includes("turnover")) {
    if (d.includes("lost ball")) return { t: "Lost ball turnover", c: "turnover" };
    if (d.includes("traveling")) return { t: "Traveling", c: "turnover" };
    if (d.includes("bad pass")) return { t: "Bad pass", c: "turnover" };
    return { t: "Turnover", c: "turnover" };
  }
  if (d.includes("foul")) {
    if (d.includes("shooting")) return { t: "Shooting foul", c: "foul" };
    if (d.includes("offensive")) return { t: "Offensive foul", c: "foul" };
    if (d.includes("flagrant")) return { t: "Flagrant foul", c: "foul" };
    if (d.includes("technical")) return { t: "Technical foul", c: "foul" };
    return { t: "Personal foul", c: "foul" };
  }
  return { t: description?.split(" ").slice(1).join(" ") || "Play", c: "other" };
}

/* ─── Play Card ─── */

function PlayCard({ play, prevPlay, homeTeam, awayTeam, statsSnap, headshotMap, playGlassClick }) {
  const ctx = getLeadCtx(play, prevPlay, homeTeam);
  const { t: title, c: cat } = buildTitle(play.description, ctx);
  const assist = parseAssist(play.description);
  const tc = play.team ? getTeamColor(play.team) : null;
  const tl = play.team ? getLogoUrl(play.team) : null;
  const hLogo = homeTeam ? getLogoUrl(homeTeam) : null;
  const aLogo = awayTeam ? getLogoUrl(awayTeam) : null;
  const scoring = cat === "score" || cat === "three";
  const isThree = cat === "three";
  const miss = cat === "miss";
  const muted = cat === "sub" || cat === "other" || cat === "rebound";

  const hs = play.home_score ?? 0;
  const as_ = play.away_score ?? 0;
  const diff = Math.abs(hs - as_);
  const hWin = hs > as_;
  const aWin = as_ > hs;

  const headshot = findHeadshot(play.player_name, headshotMap);
  const pStats = play.player_name && statsSnap ? statsSnap[play.player_name] : null;
  const aStats = assist && statsSnap ? statsSnap[assist] : null;

  const playerMeta = () => {
    if (!pStats) return "";
    if (miss && pStats.fga > 0) return `${pStats.fgm}/${pStats.fga}`;
    const p = [];
    if (pStats.pts > 0) p.push(`${pStats.pts} pt`);
    if (pStats.threes > 0) p.push(`${pStats.threes} three${pStats.threes !== 1 ? "s" : ""}`);
    return p.join(", ");
  };

  const [reactions, setReactions] = useState({});
  const [myReaction, setMyReaction] = useState(null);
  const onReact = useCallback(async (e) => {
    if (myReaction === e) return;
    playGlassClick();
    setReactions((prev) => {
      const n = { ...prev };
      if (myReaction) n[myReaction] = Math.max(0, (n[myReaction] || 1) - 1);
      n[e] = (n[e] || 0) + 1;
      return n;
    });
    setMyReaction(e);
    addReaction(play.id, e).catch(() => {});
  }, [play.id, myReaction, playGlassClick]);

  // Compact but readable row for secondary events (subs, rebounds, jump balls)
  if (muted) {
    return (
      <div className="relative">
        <div className="flex items-center gap-3 px-4 py-2.5 sm:px-6 sm:py-3 lg:px-8 lg:py-3.5">
          {tl && <img src={tl} alt="" className="h-5 w-5 opacity-50" />}
          <span className="text-[13px] sm:text-[14px] lg:text-[15px] font-bold text-white/70">{play.description}</span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-white/[0.12]" />
      </div>
    );
  }

  const meta = playerMeta();

  return (
    <div className="group/play relative">
      {/* ── Team color ambient glow for scoring plays ── */}
      {scoring && (
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none transition-opacity duration-1000 group-hover/play:opacity-[0.1]"
          style={{
            background: `radial-gradient(circle at 15% 50%, ${tc?.primary || "#6366f1"} 0%, transparent 55%)`
          }}
        />
      )}

      {/* ── Team color accent line on scoring plays ── */}
      {scoring && (
        <div
          className="absolute top-0 left-0 w-[3px] h-full rounded-r"
          style={{ backgroundColor: tc?.primary || "#6366f1", opacity: 0.4 }}
        />
      )}

      <div className="relative px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6">
        {/* ── Score Row ── */}
        <div className="flex items-center mb-4">
          <div className="flex items-center gap-2.5">
            {aLogo && <img src={aLogo} alt="" className="h-6 w-6 object-contain drop-shadow-md" />}
            <span className={`text-lg tabular-nums font-black ${aWin ? "text-[var(--green)]" : "text-white/70"}`}>
              {as_}
            </span>
            <span className="text-[12px] text-white/30 font-black">–</span>
            <span className={`text-lg tabular-nums font-black ${hWin ? "text-[var(--green)]" : "text-white/70"}`}>
              {hs}
            </span>
            {hLogo && <img src={hLogo} alt="" className="h-6 w-6 object-contain drop-shadow-md" />}

            <span className="text-[14px] tabular-nums text-white/60 ml-3 font-bold">
              Q{play.quarter} {play.clock ?? ""}
            </span>
          </div>

          {diff > 0 && (
            <span className="text-[14px] tabular-nums font-black text-white/40 ml-auto tracking-wide">
              &#x25BC; {diff}
            </span>
          )}
        </div>

        {/* ── Main Content ── */}
        <div className="flex items-start gap-5">
          {/* Avatar with ambient glow */}
          <div className="relative shrink-0">
            {/* Glow behind avatar */}
            <div
              className="absolute -inset-2 sm:-inset-3 rounded-full blur-xl opacity-20 group-hover/play:opacity-35 transition-opacity duration-500"
              style={{ backgroundColor: tc?.primary || "#6366f1" }}
            />
            <div
              className="relative h-10 w-10 sm:h-12 sm:w-12 lg:h-16 lg:w-16 rounded-full overflow-hidden border-2 bg-[#080c18] shadow-xl"
              style={{
                borderColor: `${tc?.primary || "#444"}50`,
                boxShadow: `0 8px 24px -8px rgba(0,0,0,0.6), inset 0 1px 0 0 rgba(255,255,255,0.1)`
              }}
            >
              {headshot ? (
                <img src={headshot} alt="" className="w-full h-full object-cover scale-110" />
              ) : tl ? (
                <img src={tl} alt="" className="w-full h-full object-contain p-3 drop-shadow-lg" />
              ) : null}
            </div>
            {/* Team logo badge */}
            {tl && (
              <div className="absolute -bottom-1 -right-1 h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-[#080c18] shadow-md flex items-center justify-center"
                style={{ boxShadow: `0 0 0 2px #080c18, 0 2px 6px rgba(0,0,0,0.4)` }}>
                <img src={tl} alt="" className="h-4 w-4 object-contain" />
              </div>
            )}
          </div>

          {/* Play info */}
          <div className="flex-1 min-w-0 pt-1">
            <h4 className={`text-lg sm:text-xl lg:text-2xl font-black leading-tight tracking-[-0.02em] ${
              scoring ? "text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.15)]" : "text-white/80"
            }`}>
              {title}
            </h4>

            {/* Player + running stats */}
            {play.player_name && (
              <p className="text-[14px] sm:text-[15px] lg:text-[16px] text-white/90 mt-2 font-bold">
                {abbr(play.player_name)}
                {meta && (
                  <span className="text-white/55 font-medium"> &middot; {meta}</span>
                )}
              </p>
            )}

            {/* Assist line */}
            {assist && (
              <p className="text-[15px] text-white/55 mt-1 flex items-center gap-2 font-bold">
                {tl && <img src={tl} alt="" className="h-4 w-4 object-contain opacity-70" />}
                {abbr(assist)}
                {aStats && aStats.ast > 0 && (
                  <span className="text-white/40 font-medium"> &middot; {aStats.ast} ast</span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* ── Reactions ── */}
        {(scoring || miss) && (
          <div className="flex items-center gap-4 mt-4 ml-[52px] sm:ml-[64px] lg:ml-[84px]">
            <button
              onClick={() => onReact("fire")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all duration-300 ${
                myReaction === "fire"
                  ? "bg-white/10 shadow-[0_0_10px_rgba(255,255,255,0.05)]"
                  : "opacity-30 hover:opacity-60 hover:bg-white/5"
              }`}
            >
              <span className="text-[16px]">&#128293;</span>
              {(reactions.fire || 0) > 0 && (
                <span className="text-[12px] tabular-nums font-black text-white/60">{reactions.fire}</span>
              )}
            </button>
            <button className="flex items-center gap-1.5 opacity-20 hover:opacity-40 transition-opacity px-2.5 py-1.5 rounded-xl hover:bg-white/5">
              <MessageSquare className="h-4 w-4" />
              <span className="text-[12px] tabular-nums font-bold text-white/40">0</span>
            </button>
            <button className="text-white/15 hover:text-white/30 transition-colors ml-auto text-base">&#10148;</button>
          </div>
        )}
      </div>

      {/* ── Hard divider ── */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-white/[0.12]" />
    </div>
  );
}

/* ─── Timeout ─── */

function TimeoutDivider({ play }) {
  const tl = play.team ? getLogoUrl(play.team) : null;
  return (
    <div className="flex items-center justify-center gap-3 py-3.5 px-8">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent to-white/10" />
      {tl && <img src={tl} alt="" className="h-4 w-4 opacity-40" />}
      <span className="text-[9px] font-black uppercase tracking-[0.4em] text-white/20">Timeout</span>
      <div className="flex-1 h-px bg-gradient-to-l from-transparent to-white/10" />
    </div>
  );
}

/* ─── Live Feed ─── */

export function LiveFeed({ gameId, status = "scheduled", homeTeam, awayTeam }) {
  const { plays, connected, error } = useGameFeed(gameId, status);
  const feedRef = useRef(null);
  const prevCount = useRef(0);
  const { playGlassClick } = useTheme();
  const [headshotMap, setHeadshotMap] = useState({});

  const snapshots = useMemo(() => buildStatsSnapshots(plays), [plays]);

  // Fetch box score for player headshots
  useEffect(() => {
    fetchBoxScore(gameId).then((data) => {
      if (!data) return;
      setHeadshotMap(buildHeadshotMap(data));
    }).catch(() => {});
  }, [gameId]);

  useEffect(() => {
    if (plays.length > prevCount.current && feedRef.current) feedRef.current.scrollTop = 0;
    prevCount.current = plays.length;
  }, [plays.length]);

  if (error) {
    return (
      <div className="liquid-mirror rounded-[2.5rem] p-8 text-center text-sm font-black text-[var(--red)]/60 uppercase tracking-widest">
        {error}
      </div>
    );
  }

  return (
    <div className="liquid-mirror rounded-[2.5rem] overflow-hidden luxury-edge relative">
      {/* Scanline overlay for depth */}
      <div className="scanline opacity-5 pointer-events-none" />

      {/* Live accent bar */}
      {status !== "final" && status !== "scheduled" && (
        <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-[var(--green)] to-transparent opacity-60" />
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 lg:px-8 border-b border-white/[0.08]">
        <div className="flex items-center gap-3">
          <Zap className="h-4 w-4 text-[var(--accent)]" />
          <span className="text-sm font-black uppercase tracking-[0.2em] text-white">
            {status === "final" ? "Recap" : status === "scheduled" ? "Feed" : "Live Feed"}
          </span>
          <span className="text-[11px] font-bold text-white/20 tabular-nums">{plays.length} plays</span>
        </div>
        {status !== "final" && status !== "scheduled" && (
          connected ? (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--green)]/10 border border-[var(--green)]/20">
              <div className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--green)] opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--green)]" />
              </div>
              <span className="text-[10px] font-black text-[var(--green)] uppercase tracking-widest">Live</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/5">
              <div className="h-1.5 w-1.5 rounded-full bg-white/30 animate-pulse" />
              <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Sync</span>
            </div>
          )
        )}
      </div>

      {/* ── Feed ── plays already sorted newest-first from hook */}
      {plays.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 px-8">
          <Clock className="h-6 w-6 text-white/10 mb-3" />
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-white/20">
            {status === "scheduled" ? "Game Has Not Started" : connected ? "Waiting for Tip-Off..." : "Syncing..."}
          </p>
        </div>
      ) : (
        <div ref={feedRef} className="overflow-y-auto scrollbar-hide max-h-[calc(100vh-200px)] sm:max-h-[calc(100vh-280px)] lg:max-h-[calc(100vh-340px)]">
          {plays.map((play, i) => {
            const desc = (play.description ?? "").toLowerCase();
            if (desc.includes("timeout") && !desc.includes("shot clock")) {
              return <TimeoutDivider key={`${play.game_id}-${play.sequence_number}`} play={play} />;
            }
            const prev = i < plays.length - 1 ? plays[i + 1] : null;
            return (
              <PlayCard
                key={`${play.game_id}-${play.sequence_number}`}
                play={play}
                prevPlay={prev}
                homeTeam={homeTeam || ""}
                awayTeam={awayTeam || ""}
                statsSnap={snapshots.get(play.sequence_number)}
                headshotMap={headshotMap}
                playGlassClick={playGlassClick}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
