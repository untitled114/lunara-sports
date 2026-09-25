import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { useGameFeed } from "@/hooks/useGameFeed";
import { addReaction, fetchBoxScore, fetchPlays } from "@/services/api";
import { useTheme } from "@/context/ThemeContext";
import { getLogoUrl, getHeadshotUrl } from "@/utils/teamColors";
import { Card, Badge, PageState } from "@/components/ui";

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
        map[p.name] = getHeadshotUrl(p.headshot_url);
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
  if (d.includes("gains possession") || d.includes("vs.")) return { t: "Jump ball", c: "sub" };
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
  const tl = play.team ? getLogoUrl(play.team) : null;
  const hLogo = homeTeam ? getLogoUrl(homeTeam) : null;
  const aLogo = awayTeam ? getLogoUrl(awayTeam) : null;
  const scoring = cat === "score" || cat === "three";
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

  // Compact row for secondary events (subs, rebounds, jump balls)
  if (muted) {
    return (
      <div className="flex items-center gap-3 py-2.5">
        {tl && <img src={tl} alt="" width={20} height={20} className="h-5 w-5" />}
        <span className="t-small text-text-2">{play.description}</span>
      </div>
    );
  }

  const meta = playerMeta();

  return (
    <div className="py-4">
      {/* Score row */}
      <div className="flex items-center mb-3">
        <div className="flex items-center gap-2">
          {aLogo && <img src={aLogo} alt="" width={20} height={20} className="h-5 w-5 object-contain" />}
          <span className={`t-small tnum font-semibold ${aWin ? "text-live" : "text-text-2"}`}>{as_}</span>
          <span className="t-small text-text-3">&ndash;</span>
          <span className={`t-small tnum font-semibold ${hWin ? "text-live" : "text-text-2"}`}>{hs}</span>
          {hLogo && <img src={hLogo} alt="" width={20} height={20} className="h-5 w-5 object-contain" />}
          <span className="t-small tnum text-text-3 ml-2">Q{play.quarter} {play.clock ?? ""}</span>
        </div>

        {diff > 0 && <span className="t-small tnum text-text-3 ml-auto">{'▼'} {diff}</span>}
      </div>

      {/* Main content */}
      <div className="flex items-start gap-3">
        {/* Outer wrapper stays un-clipped so the corner badge (negative-offset) isn't cut
            off by the avatar's own overflow-hidden — the base structured it the same way. */}
        <div className="relative h-10 w-10 sm:h-12 sm:w-12 shrink-0">
          <div className="h-full w-full rounded-md overflow-hidden bg-surface-2 border border-border">
            {headshot ? (
              <img src={headshot} alt="" width={48} height={48} loading="lazy" className="w-full h-full object-cover" />
            ) : tl ? (
              <img src={tl} alt="" width={48} height={48} loading="lazy" className="w-full h-full object-contain p-2" />
            ) : null}
          </div>
          {/* Team logo corner badge — only needed when the headshot is already occupying the avatar */}
          {headshot && tl && (
            <img
              src={tl}
              alt=""
              width={16}
              height={16}
              className="absolute -bottom-1 -right-1 h-4 w-4 rounded-sm border border-border bg-surface-1"
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="t-body font-semibold text-text-1">{title}</p>

          {play.player_name && (
            <p className="t-small text-text-2 mt-1 flex items-center gap-1.5">
              {tl && <img src={tl} alt="" width={16} height={16} className="h-4 w-4 shrink-0" />}
              <span>
                {abbr(play.player_name)}
                {meta && <span className="text-text-3"> &middot; {meta}</span>}
              </span>
            </p>
          )}

          {assist && (
            <p className="t-small text-text-3 mt-0.5 flex items-center gap-1.5">
              {tl && <img src={tl} alt="" width={16} height={16} className="h-4 w-4 shrink-0" />}
              <span>
                {abbr(assist)}
                {aStats && aStats.ast > 0 && <span> &middot; {aStats.ast} ast</span>}
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Reaction */}
      {(scoring || miss) && (
        <div className="flex items-center gap-2 mt-3 ml-[52px] sm:ml-[60px]">
          <button
            type="button"
            aria-label="React with fire"
            onClick={() => onReact("fire")}
            className={`t-small rounded-md px-2 py-1 transition-colors duration-300 ${
              myReaction === "fire" ? "bg-surface-2 text-text-1" : "text-text-3 hover:bg-surface-2"
            }`}
          >
            {'\u{1F525}'}
            {(reactions.fire || 0) > 0 && <span className="tnum ml-1">{reactions.fire}</span>}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Timeout ─── */

function TimeoutDivider({ play }) {
  const tl = play.team ? getLogoUrl(play.team) : null;
  return (
    <div className="flex items-center justify-center gap-3 py-3">
      <span className="flex-1 h-px bg-border" />
      {tl && <img src={tl} alt="" width={16} height={16} className="h-4 w-4" />}
      <span className="t-label text-text-3">Timeout</span>
      <span className="flex-1 h-px bg-border" />
    </div>
  );
}

/* ─── Live Feed ─── */

export function LiveFeed({ gameId, status = "scheduled", homeTeam, awayTeam, plays: playsProp, connected: connectedProp, boxData: boxDataProp }) {
  // When props provided (from GameDetailPage), use them directly — no second WS connection
  const internal = useGameFeed(playsProp ? null : gameId, playsProp ? "scheduled" : status);
  const plays = playsProp || internal.plays;
  const connected = connectedProp !== undefined ? connectedProp : internal.connected;
  const error = playsProp ? null : internal.error;

  const feedRef = useRef(null);
  const prevCount = useRef(0);
  const { playGlassClick } = useTheme();

  const snapshots = useMemo(() => buildStatsSnapshots(plays), [plays]);

  // Build headshot map from boxData prop or fetch if standalone
  const [headshotMap, setHeadshotMap] = useState({});
  useEffect(() => {
    if (boxDataProp) {
      setHeadshotMap(buildHeadshotMap(boxDataProp));
    } else if (gameId && !playsProp) {
      fetchBoxScore(gameId).then((data) => {
        if (data) setHeadshotMap(buildHeadshotMap(data));
      }).catch(() => {});
    }
  }, [gameId, boxDataProp, playsProp]);

  useEffect(() => {
    if (plays.length > prevCount.current && feedRef.current) feedRef.current.scrollTop = 0;
    prevCount.current = plays.length;
  }, [plays.length]);

  if (error) {
    return (
      <PageState
        kind="error"
        title="Couldn't load the feed."
        message={error}
        onRetry={() => { fetchPlays(gameId).catch(() => {}); }}
      />
    );
  }

  const title = status === "final" ? "Recap" : status === "scheduled" ? "Feed" : "Live feed";

  return (
    <Card>
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="t-section text-text-1">{title}</span>
          <span className="t-small tnum text-text-3">{plays.length} plays</span>
        </div>
        {status !== "final" && status !== "scheduled" && (
          connected ? <Badge variant="live" dot>Live</Badge> : <Badge variant="neutral">Reconnecting</Badge>
        )}
      </div>

      {/* Feed — plays already sorted newest-first from hook */}
      {plays.length === 0 ? (
        <p className="py-16 text-center t-small text-text-3">
          {status === "scheduled" ? "This game hasn't started." : connected ? "Waiting for tip-off." : "Connecting."}
        </p>
      ) : (
        <div ref={feedRef} className="overflow-y-auto max-h-[calc(100vh-260px)] divide-y divide-border">
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
    </Card>
  );
}
