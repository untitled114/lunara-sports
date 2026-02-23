import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui';
import { Users, Calendar, BarChart2, ChevronLeft, MapPin, Trophy, Hash, TrendingUp, ChevronRight, Clock } from 'lucide-react';
import { fetchTeamDetail, fetchTeamRoster, fetchTeamSchedule, fetchTeamStats, fetchStandings, buildStandingsLookup } from '@/services/api';
import { getTeamColor, getLogoUrl } from '@/utils/teamColors';
import { useTheme } from '@/context/ThemeContext';

// ─── Roster Tab ───────────────────────────────────────────

function RosterTab({ roster, delay = 0 }) {
  const { playGlassClick } = useTheme();
  if (roster.length === 0) {
    return (
      <div className="animate-intel liquid-mirror rounded-[2rem] py-24 text-center shadow-2xl" style={{ animationDelay: `${delay}s` }}>
        <div className="h-10 w-10 rounded-2xl bg-white/5 border border-white/10 animate-pulse flex items-center justify-center mx-auto mb-4">
          <Users className="h-5 w-5 text-white/50" />
        </div>
        <p className="text-sm font-black text-white/50 uppercase tracking-[0.3em]">Loading Roster Data...</p>
      </div>
    );
  }

  return (
    <div className="animate-intel liquid-mirror rounded-[2rem] overflow-hidden shadow-2xl" style={{ animationDelay: `${delay}s` }}>
      {/* Data sweep */}
      <div className="h-px w-full overflow-hidden relative">
        <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent" style={{ animation: 'data-sweep 3s ease-in-out forwards', animationDelay: `${delay + 0.4}s` }} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[750px]">
          <thead>
            <tr className="bg-black/20 text-sm font-black uppercase tracking-[0.2em] text-white/50 border-b border-white/5">
              <th className="py-5 px-6">No</th>
              <th className="py-5 px-6">Player</th>
              <th className="py-5 px-6 text-center">Pos</th>
              <th className="py-5 px-6 text-center">Ht</th>
              <th className="py-5 px-6 text-center">Wt</th>
              <th className="py-5 px-6 text-center">Age</th>
              <th className="py-5 px-6 text-center">Exp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {roster.map((p, idx) => (
              <tr
                key={p.jersey + p.name}
                className="hover:bg-white/[0.03] transition-all group animate-intel"
                style={{ animationDelay: `${delay + 0.3 + idx * 0.03}s` }}
              >
                <td className="py-5 px-6">
                  <span className="text-base font-black text-white/50 tabular-nums">#{p.jersey}</span>
                </td>
                <td className="py-5 px-6">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-[#050a18] border border-white/10 flex items-center justify-center overflow-hidden shadow-lg shrink-0 relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                      {p.headshot_url ? (
                        <img src={p.headshot_url} alt={p.name} className="w-full h-full object-cover scale-110 group-hover:scale-125 transition-transform duration-500" />
                      ) : (
                        <div className="text-base font-black text-white/10 uppercase">{p.name[0]}</div>
                      )}
                    </div>
                    <Link
                      to={`/player/${p.id}`}
                      onClick={() => playGlassClick()}
                      className="font-black text-white uppercase tracking-tight text-base group-hover:text-[var(--accent)] transition-colors"
                    >
                      {p.name}
                    </Link>
                  </div>
                </td>
                <td className="py-5 px-6 text-center text-base font-black text-[var(--accent)]">{p.position}</td>
                <td className="py-5 px-6 text-center text-base tabular-nums text-white/50">{p.height}</td>
                <td className="py-5 px-6 text-center text-base tabular-nums text-white/50">{p.weight ? `${p.weight} lbs` : '—'}</td>
                <td className="py-5 px-6 text-center text-base tabular-nums text-white/50">{p.age || '—'}</td>
                <td className="py-5 px-6 text-center text-base tabular-nums text-white/50">{p.experience || 'R'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Schedule Tab ─────────────────────────────────────────

function ScheduleTab({ schedule, delay = 0 }) {
  if (schedule.length === 0) {
    return (
      <div className="animate-intel liquid-mirror rounded-[2rem] py-24 text-center shadow-2xl" style={{ animationDelay: `${delay}s` }}>
        <div className="h-10 w-10 rounded-2xl bg-white/5 border border-white/10 animate-pulse flex items-center justify-center mx-auto mb-4">
          <Calendar className="h-5 w-5 text-white/50" />
        </div>
        <p className="text-sm font-black text-white/50 uppercase tracking-[0.3em]">Loading Schedule...</p>
      </div>
    );
  }

  // Split into results and upcoming
  const results = schedule.filter(s => s.status === 'final').slice(0, 20);
  const upcoming = schedule.filter(s => s.status !== 'final').slice(0, 15);

  return (
    <div className="space-y-10">
      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="space-y-4">
          <h3 className="animate-intel text-micro opacity-40 ml-1" style={{ animationDelay: `${delay}s` }}>Upcoming Games</h3>
          <div className="animate-intel liquid-mirror rounded-[2rem] overflow-hidden shadow-2xl" style={{ animationDelay: `${delay + 0.05}s` }}>
            <div className="h-px w-full overflow-hidden relative">
              <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent" style={{ animation: 'data-sweep 3s ease-in-out forwards', animationDelay: `${delay + 0.5}s` }} />
            </div>
            <div className="divide-y divide-white/5">
              {upcoming.map((g, idx) => (
                <Link
                  key={g.game_id}
                  to={`/game/${g.game_id}`}
                  className="flex items-center justify-between px-8 py-5 hover:bg-white/[0.03] transition-all group animate-intel"
                  style={{ animationDelay: `${delay + 0.15 + idx * 0.04}s` }}
                >
                  <div className="flex items-center gap-6">
                    <span className="text-sm font-black text-white/50 uppercase tracking-wider w-20">{g.date}</span>
                    <span className="text-base font-black text-white uppercase tracking-tight group-hover:text-[var(--accent)] transition-colors">{g.opponent}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-base font-black text-[var(--accent)] uppercase tracking-widest">
                      <Clock className="h-4 w-4" />
                      Scheduled
                    </div>
                    <ChevronRight className="h-5 w-5 text-white/10 group-hover:text-[var(--accent)] transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <h3 className="animate-intel text-micro opacity-40 ml-1" style={{ animationDelay: `${delay + 0.2}s` }}>Recent Results</h3>
          <div className="animate-intel liquid-mirror rounded-[2rem] overflow-hidden shadow-2xl" style={{ animationDelay: `${delay + 0.25}s` }}>
            <div className="divide-y divide-white/5">
              {results.map((g, idx) => {
                const isWin = g.result?.startsWith('W');
                const isLoss = g.result?.startsWith('L');
                return (
                  <Link
                    key={g.game_id}
                    to={`/game/${g.game_id}`}
                    className="flex items-center justify-between px-8 py-5 hover:bg-white/[0.03] transition-all group animate-intel"
                    style={{ animationDelay: `${delay + 0.35 + idx * 0.03}s` }}
                  >
                    <div className="flex items-center gap-6">
                      <span className="text-sm font-black text-white/50 uppercase tracking-wider w-20">{g.date}</span>
                      <div className="flex items-center gap-3">
                        <span className={`text-base font-black uppercase tracking-widest px-2.5 py-1 rounded ${
                          isWin ? 'text-[var(--green)] bg-[var(--green)]/10' : isLoss ? 'text-[var(--red)] bg-[var(--red)]/10' : 'text-white/50'
                        }`}>
                          {g.result?.charAt(0) || '—'}
                        </span>
                        <span className="text-base font-black text-white uppercase tracking-tight group-hover:text-[var(--accent)] transition-colors">{g.opponent}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-base font-bold text-white/40 tabular-nums">{g.score}</span>
                      <ChevronRight className="h-5 w-5 text-white/10 group-hover:text-[var(--accent)] transition-colors" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Stats Tab ────────────────────────────────────────────

function StatsTab({ stats, delay = 0 }) {
  if (stats.length === 0) {
    return (
      <div className="animate-intel liquid-mirror rounded-[2rem] py-24 text-center shadow-2xl" style={{ animationDelay: `${delay}s` }}>
        <div className="h-10 w-10 rounded-2xl bg-white/5 border border-white/10 animate-pulse flex items-center justify-center mx-auto mb-4">
          <BarChart2 className="h-5 w-5 text-white/50" />
        </div>
        <p className="text-sm font-black text-white/50 uppercase tracking-[0.3em]">No Stats Available</p>
      </div>
    );
  }

  // Find leaders for highlighting
  const maxPPG = Math.max(...stats.map(s => s.ppg || 0));
  const maxRPG = Math.max(...stats.map(s => s.rpg || 0));
  const maxAPG = Math.max(...stats.map(s => s.apg || 0));

  return (
    <div className="animate-intel liquid-mirror rounded-[2rem] overflow-hidden shadow-2xl" style={{ animationDelay: `${delay}s` }}>
      <div className="h-px w-full overflow-hidden relative">
        <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent" style={{ animation: 'data-sweep 3s ease-in-out forwards', animationDelay: `${delay + 0.4}s` }} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-black/20 text-sm font-black uppercase tracking-[0.2em] text-white/50 border-b border-white/5">
              <th className="py-5 px-6">Player</th>
              <th className="py-5 px-5 text-center">GP</th>
              <th className="py-5 px-5 text-center">MPG</th>
              <th className="py-5 px-5 text-right text-[var(--accent)]">PPG</th>
              <th className="py-5 px-5 text-right">RPG</th>
              <th className="py-5 px-5 text-right">APG</th>
              <th className="py-5 px-5 text-right">SPG</th>
              <th className="py-5 px-5 text-right">BPG</th>
              <th className="py-5 px-5 text-center">FG%</th>
              <th className="py-5 px-5 text-center">3P%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {stats.map((s, idx) => (
              <tr
                key={s.player}
                className="hover:bg-white/[0.03] transition-all group animate-intel"
                style={{ animationDelay: `${delay + 0.3 + idx * 0.04}s` }}
              >
                <td className="py-5 px-6">
                  <span className="text-base font-black text-white uppercase tracking-tight group-hover:text-[var(--accent)] transition-colors">
                    {s.player}
                  </span>
                </td>
                <td className="py-5 px-5 text-center text-base tabular-nums text-white/40 font-bold">{s.gp}</td>
                <td className="py-5 px-5 text-center text-base tabular-nums text-white/40 font-bold">{s.mpg}</td>
                <td className={`py-5 px-5 text-right tabular-nums font-black ${s.ppg === maxPPG ? 'text-[var(--accent)] text-lg' : 'text-white text-base'}`}>
                  {s.ppg}
                </td>
                <td className={`py-5 px-5 text-right tabular-nums font-bold ${s.rpg === maxRPG ? 'text-[var(--accent)]' : 'text-white/70'} text-base`}>
                  {s.rpg}
                </td>
                <td className={`py-5 px-5 text-right tabular-nums font-bold ${s.apg === maxAPG ? 'text-[var(--accent)]' : 'text-white/70'} text-base`}>
                  {s.apg}
                </td>
                <td className="py-5 px-5 text-right text-base tabular-nums text-white/40 font-bold">{s.spg}</td>
                <td className="py-5 px-5 text-right text-base tabular-nums text-white/40 font-bold">{s.bpg}</td>
                <td className="py-5 px-5 text-center text-base tabular-nums text-white/40 font-black">{s.fg_pct}</td>
                <td className="py-5 px-5 text-center text-base tabular-nums text-white/40 font-black">{s.three_pct}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────

export default function TeamDetailPage() {
  const { abbrev } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'roster';
  const { playGlassClick } = useTheme();

  const logoUrl = getLogoUrl(abbrev);
  const colors = getTeamColor(abbrev);

  const [team, setTeam] = useState(null);
  const [standingsInfo, setStandingsInfo] = useState(null);
  const [roster, setRoster] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load team detail + standings
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setRoster([]);
    setSchedule([]);
    setStats([]);

    Promise.all([
      fetchTeamDetail(abbrev),
      fetchStandings().catch(() => null),
    ])
      .then(([teamData, standingsData]) => {
        if (cancelled) return;
        setTeam(teamData);
        const lookup = buildStandingsLookup(standingsData);
        setStandingsInfo(lookup[abbrev] || null);
      })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [abbrev]);

  // Lazy-load tab data
  useEffect(() => {
    if (!team) return;
    if (activeTab === 'roster' && roster.length === 0) {
      fetchTeamRoster(abbrev).then(setRoster).catch(() => {});
    } else if (activeTab === 'schedule' && schedule.length === 0) {
      fetchTeamSchedule(abbrev).then(setSchedule).catch(() => {});
    } else if (activeTab === 'stats' && stats.length === 0) {
      fetchTeamStats(abbrev).then(setStats).catch(() => {});
    }
  }, [activeTab, abbrev, team]);

  const handleTabChange = (id) => {
    playGlassClick();
    setSearchParams({ tab: id });
  };

  const tabs = [
    { id: 'roster', label: 'Roster', icon: Users },
    { id: 'schedule', label: 'Schedule', icon: Calendar },
    { id: 'stats', label: 'Statistics', icon: BarChart2 },
  ];

  if (loading) {
    return (
      <div className="max-w-[1400px] mx-auto space-y-8 pb-32 px-4">
        <Skeleton variant="rectangle" height="h-8" className="w-24 rounded-lg" />
        <Skeleton variant="rectangle" height="h-72" className="rounded-[2.5rem]" />
        <Skeleton variant="rectangle" height="h-16" className="rounded-2xl" />
        <Skeleton variant="rectangle" height="h-[500px]" className="rounded-[2rem]" />
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="max-w-[1400px] mx-auto py-32 text-center px-4">
        <div className="deboss inline-flex flex-col p-10 rounded-[3rem] border-white/5 shadow-2xl">
          <h2 className="text-xl font-black text-white uppercase tracking-widest mb-2">Sync Error</h2>
          <p className="text-[var(--text-muted)] uppercase text-sm font-bold tracking-widest mb-6">{error || "Team not found"}</p>
          <Link to="/teams" className="text-[var(--accent)] text-sm font-black uppercase tracking-widest hover:text-white transition-colors">
            Back to Teams
          </Link>
        </div>
      </div>
    );
  }

  const st = standingsInfo;

  return (
    <div className="max-w-[1400px] mx-auto pb-32 relative pt-8">
      {/* Arena Environment */}
      <div className="absolute inset-0 -top-20 z-0 h-[600px] jumbotron-grid opacity-30 pointer-events-none" />
      <div className="scanline" />

      {/* Team color ambient wash */}
      <div
        className="absolute top-0 left-0 right-0 h-[500px] opacity-[0.06] pointer-events-none z-0"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${colors.primary} 0%, transparent 70%)` }}
      />

      {/* Ambient side lights */}
      <div className="absolute -left-20 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-[var(--accent)]/20 to-transparent blur-sm pointer-events-none" />
      <div className="absolute -right-20 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-[var(--accent)]/20 to-transparent blur-sm pointer-events-none" />

      <div className="relative z-10 space-y-8 px-4">
        {/* Breadcrumb */}
        <Link
          to="/teams"
          onClick={() => playGlassClick()}
          className="animate-intel inline-flex items-center gap-1.5 text-sm font-black uppercase tracking-[0.2em] text-white/50 hover:text-white transition-colors group"
        >
          <ChevronLeft className="h-3.5 w-3.5 group-hover:-translate-x-1 transition-transform" />
          All Teams
        </Link>

        {/* ═══ Team Hero Header ═══ */}
        <div className="animate-intel relative overflow-hidden rounded-[2.5rem] liquid-mirror shadow-2xl" style={{ animationDelay: '0.1s' }}>
          {/* Team color left accent */}
          <div className="absolute top-0 left-0 w-1.5 h-full rounded-l-[2.5rem]" style={{ backgroundColor: colors.primary }} />

          {/* Data sweep on top */}
          <div className="h-px w-full overflow-hidden relative">
            <div
              className="absolute inset-0 h-full w-full bg-gradient-to-r from-transparent to-transparent"
              style={{ background: `linear-gradient(to right, transparent, ${colors.primary}, transparent)`, animation: 'data-sweep 3s ease-in-out forwards', animationDelay: '0.7s' }}
            />
          </div>

          <div className="relative p-10 md:p-14 flex flex-col md:flex-row items-center gap-10">
            {/* Logo */}
            <div className="relative shrink-0">
              <div className="h-32 w-32 md:h-36 md:w-36 rounded-[2rem] bg-[#050a18] flex items-center justify-center border-t-2 border-white/20 border-x border-white/5 border-b-2 border-black/80 shadow-2xl p-6 overflow-hidden relative z-10">
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
                <img src={logoUrl} alt={abbrev} className="w-full h-full object-contain drop-shadow-2xl relative z-10" />
              </div>
              <div
                className="absolute -inset-4 rounded-[2.5rem] blur-2xl opacity-20"
                style={{ backgroundColor: colors.primary }}
              />
            </div>

            {/* Team Info */}
            <div className="flex-1 text-center md:text-left min-w-0">
              <h1 className="text-5xl md:text-7xl text-jumbotron tracking-tighter leading-none mb-4">
                {team.name}
              </h1>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-8 gap-y-3">
                {team.venue && (
                  <div className="flex items-center gap-2 text-sm font-bold text-white/40 uppercase tracking-widest">
                    <MapPin className="h-4 w-4 text-[var(--accent)]" />
                    {team.venue}
                  </div>
                )}
                {team.city && (
                  <span className="text-sm font-bold text-white/50 uppercase tracking-widest">{team.city}</span>
                )}
                {st && (
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm font-black text-white uppercase tracking-wider">{st.record}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Stats Cluster */}
            <div className="flex gap-4 shrink-0">
              {st?.rank && (
                <div className="deboss px-5 py-4 rounded-2xl flex flex-col items-center min-w-[70px]">
                  <span className="text-[13px] font-black text-white/50 uppercase tracking-widest mb-1">{st.conf || 'Conf'}</span>
                  <span className={`text-2xl font-black tabular-nums ${st.rank <= 6 ? 'text-[var(--green)]' : st.rank <= 10 ? 'text-yellow-500' : 'text-white/40'}`}>
                    #{st.rank}
                  </span>
                </div>
              )}
              {st?.pct && (
                <div className="deboss px-5 py-4 rounded-2xl flex flex-col items-center min-w-[70px]">
                  <span className="text-[13px] font-black text-white/50 uppercase tracking-widest mb-1">PCT</span>
                  <span className="text-2xl font-black tabular-nums text-white">{st.pct}</span>
                </div>
              )}
              {st?.streak && (
                <div className="deboss px-5 py-4 rounded-2xl flex flex-col items-center min-w-[70px]">
                  <span className="text-[13px] font-black text-white/50 uppercase tracking-widest mb-1">Strk</span>
                  <span className={`text-2xl font-black tabular-nums ${st.streak.startsWith('W') ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                    {st.streak}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Conference / Division badges */}
          <div className="px-10 md:px-14 pb-6 flex items-center gap-3">
            {team.conference && (
              <span className="px-4 py-2 text-[13px] font-black tracking-widest uppercase bg-[var(--accent)]/10 text-[var(--accent)] rounded-xl border border-[var(--accent)]/20">
                {team.conference} Conference
              </span>
            )}
            {team.division && (
              <span className="px-4 py-2 text-[13px] font-black tracking-widest uppercase bg-white/5 text-white/40 rounded-xl border border-white/5">
                {team.division} Division
              </span>
            )}
            {st?.l10 && (
              <span className="px-4 py-2 text-[13px] font-black tracking-widest uppercase bg-white/5 text-white/50 rounded-xl border border-white/5">
                L10: {st.l10}
              </span>
            )}
            {st?.gb && (
              <span className="px-4 py-2 text-[13px] font-black tracking-widest uppercase bg-white/5 text-white/50 rounded-xl border border-white/5">
                {st.gb === '—' || st.gb === '0' ? `${st.conf || 'Conf'} Leader` : `${st.gb} GB in ${st.conf || 'Conf'}`}
              </span>
            )}
          </div>
        </div>

        {/* ═══ Tab Navigation ═══ */}
        <div
          className="animate-intel flex items-center gap-2 bg-[#050a18]/60 p-2 rounded-2xl border border-white/5 shadow-2xl backdrop-blur-md rim-light"
          style={{ animationDelay: '0.25s' }}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2.5 px-8 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all duration-500 ${
                  isActive
                    ? 'bg-white text-black shadow-[0_0_30px_rgba(255,255,255,0.3)] scale-105'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}

          {/* Right side info */}
          <div className="ml-auto px-6 hidden md:flex items-center gap-4">
            <div className="flex flex-col items-end">
              <span className="text-[13px] font-black uppercase tracking-[0.3em] text-white/50">Roster Size</span>
              <span className="text-sm font-black text-white tabular-nums">{roster.length || '—'}</span>
            </div>
          </div>
        </div>

        {/* ═══ Tab Content ═══ */}
        <div key={activeTab}>
          {activeTab === 'roster' && <RosterTab roster={roster} delay={0.35} />}
          {activeTab === 'schedule' && <ScheduleTab schedule={schedule} delay={0.35} />}
          {activeTab === 'stats' && <StatsTab stats={stats} delay={0.35} />}
        </div>
      </div>
    </div>
  );
}
