const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function fetchGames(date) {
  const params = date ? `?game_date=${date}` : "";
  const res = await fetch(`${API_URL}/games/${params}`);
  if (!res.ok) throw new Error("Failed to fetch games");
  return res.json();
}

export async function fetchGame(id) {
  const res = await fetch(`${API_URL}/games/${id}`);
  if (!res.ok) throw new Error("Failed to fetch game");
  return res.json();
}

export async function fetchPlays(gameId, opts) {
  const params = new URLSearchParams();
  if (opts?.quarter) params.set("quarter", String(opts.quarter));
  if (opts?.afterSequence) params.set("after_sequence", String(opts.afterSequence));
  const qs = params.toString();
  const res = await fetch(`${API_URL}/games/${gameId}/plays${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("Failed to fetch plays");
  return res.json();
}

export async function fetchLeaderboard(season, limit = 25) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (season) params.set("season", season);
  const res = await fetch(`${API_URL}/leaderboard/?${params}`);
  if (!res.ok) throw new Error("Failed to fetch leaderboard");
  return res.json();
}

export async function fetchModelPicks(gameId) {
  const res = await fetch(`${API_URL}/games/${gameId}/picks`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchPredictions(userId) {
  const res = await fetch(`${API_URL}/predictions/${userId}`);
  if (!res.ok) throw new Error("Failed to fetch predictions");
  return res.json();
}

// ── New API functions ──────────────────────────────────────────────

export async function fetchStandings() {
  const res = await fetch(`${API_URL}/standings`);
  if (!res.ok) throw new Error("Failed to fetch standings");
  return res.json();
}

export async function fetchTeams() {
  const res = await fetch(`${API_URL}/teams`);
  if (!res.ok) throw new Error("Failed to fetch teams");
  return res.json();
}

export async function fetchTeamDetail(abbrev) {
  const res = await fetch(`${API_URL}/teams/${abbrev}`);
  if (!res.ok) throw new Error("Failed to fetch team detail");
  return res.json();
}

export async function fetchTeamRoster(abbrev) {
  const res = await fetch(`${API_URL}/teams/${abbrev}/roster`);
  if (!res.ok) throw new Error("Failed to fetch roster");
  return res.json();
}

export async function fetchTeamSchedule(abbrev) {
  const res = await fetch(`${API_URL}/teams/${abbrev}/schedule`);
  if (!res.ok) throw new Error("Failed to fetch schedule");
  return res.json();
}

export async function fetchTeamStats(abbrev) {
  const res = await fetch(`${API_URL}/teams/${abbrev}/stats`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchPlayers(search = "") {
  const params = search ? `?search=${encodeURIComponent(search)}` : "";
  const res = await fetch(`${API_URL}/players${params}`);
  if (!res.ok) throw new Error("Failed to fetch players");
  return res.json();
}

export async function fetchPlayerDetail(playerId) {
  const res = await fetch(`${API_URL}/players/${playerId}`);
  if (!res.ok) throw new Error("Failed to fetch player details");
  return res.json();
}

export async function fetchPlayerStats(playerId) {
  const res = await fetch(`${API_URL}/players/${playerId}/stats`);
  if (!res.ok) return null;
  return res.json();
}

export async function fetchPlayerGameLog(playerId) {
  const res = await fetch(`${API_URL}/players/${playerId}/log`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchStatLeaders(limit = 10) {
  const res = await fetch(`${API_URL}/stats/leaders?limit=${limit}`);
  if (!res.ok) throw new Error("Failed to fetch stat leaders");
  return res.json();
}

export async function fetchTeamStatsList() {
  const res = await fetch(`${API_URL}/stats/teams`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchBoxScore(gameId) {
  const res = await fetch(`${API_URL}/games/${gameId}/boxscore`);
  if (!res.ok) return null;
  return res.json();
}

export async function fetchNextGame(abbrev) {
  // Get tomorrow's games and find one involving this team
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().slice(0, 10);
  try {
    const games = await fetchGames(dateStr);
    return games.find(g => g.home_team === abbrev || g.away_team === abbrev) || null;
  } catch {
    return null;
  }
}

// ── Reactions ─────────────────────────────────────────────────────────

export async function fetchReactions(playId) {
  const res = await fetch(`${API_URL}/plays/${playId}/reactions`);
  if (!res.ok) return [];
  return res.json();
}

export async function addReaction(playId, emoji, userId = "anon") {
  const res = await fetch(`${API_URL}/plays/${playId}/reactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-User-Id": userId },
    body: JSON.stringify({ emoji }),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function removeReaction(playId, userId = "anon") {
  const res = await fetch(`${API_URL}/plays/${playId}/reactions`, {
    method: "DELETE",
    headers: { "X-User-Id": userId },
  });
  return res.ok;
}

// ── Comments ──────────────────────────────────────────────────────────

export async function fetchComments(gameId, limit = 50) {
  const res = await fetch(`${API_URL}/games/${gameId}/comments?limit=${limit}`);
  if (!res.ok) return [];
  return res.json();
}

export async function postComment(gameId, body, userId = "anon", playId = null) {
  const payload = { body };
  if (playId) payload.play_id = playId;
  const res = await fetch(`${API_URL}/games/${gameId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-User-Id": userId },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return null;
  return res.json();
}

// ── Picks ────────────────────────────────────────────────────────────

export async function fetchTodayPicks(token) {
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}/picks/today`, { headers });
  if (!res.ok) return [];
  return res.json();
}

export async function triggerPickSync(date = "") {
  const params = date ? `?pick_date=${date}` : "";
  const res = await fetch(`${API_URL}/picks/sync${params}`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to sync picks");
  return res.json();
}

export async function tailPick(pickId, token) {
  const res = await fetch(`${API_URL}/picks/${pickId}/tail`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to tail pick");
  return res.json();
}

export async function untailPick(pickId, token) {
  const res = await fetch(`${API_URL}/picks/${pickId}/tail`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok;
}

export async function fetchTailedPicks(token) {
  const res = await fetch(`${API_URL}/picks/tailed`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  return res.json();
}

// ── Auth ─────────────────────────────────────────────────────────────

export async function authRegister(username, email, password) {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Registration failed");
  }
  return res.json();
}

export async function authLogin(email, password) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Login failed");
  }
  return res.json();
}

export async function authMe(token) {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}

// Build a standings lookup map: { abbrev: { rank, w, l, record, streak, conf, pct } }
export function buildStandingsLookup(standings) {
  const map = {};
  if (!standings) return map;
  const process = (teams, conf) => {
    for (const t of teams) {
      map[t.abbrev] = {
        rank: t.rank,
        w: t.w,
        l: t.l,
        record: `${t.w}-${t.l}`,
        pct: t.pct,
        streak: t.strk,
        conf,
        l10: t.l10,
        gb: t.gb,
      };
    }
  };
  process(standings.eastern || [], "East");
  process(standings.western || [], "West");
  return map;
}
