import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Award, Info, ChevronRight, Activity, Zap, Shield } from 'lucide-react';
import { Skeleton } from '@/components/ui';
import { fetchStandings, fetchTeams } from '@/services/api';
import { getTeamColor, getLogoUrl } from '@/utils/teamColors';
import { useTheme } from '@/context/ThemeContext';

function StandingsTable({ teams, title, subtitle, delay = 0 }) {
  const [sortKey, setSortKey] = useState('rank');
  const [sortDir, setSortDir] = useState('asc');
  const { playGlassClick } = useTheme();
  const navigate = useNavigate();

  const handleSort = (key) => {
    playGlassClick();
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortedTeams = [...teams].sort((a, b) => {
    let valA = a[sortKey];
    let valB = b[sortKey];

    if (sortKey === 'pct') {
      valA = parseFloat(valA);
      valB = parseFloat(valB);
    }

    if (valA < valB) return sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const headers = [
    { key: 'rank', label: 'Telemetry Node', align: 'left', minWidth: 'min-w-[240px]' },
    { key: 'w', label: 'W', align: 'right' },
    { key: 'l', label: 'L', align: 'right' },
    { key: 'pct', label: 'PCT', align: 'right' },
    { key: 'gb', label: 'GB', align: 'right' },
    { key: 'l10', label: 'L10', align: 'right' },
    { key: 'strk', label: 'Strk', align: 'right' },
  ];

  return (
    <div
      className="animate-intel liquid-mirror rounded-[3rem] border border-white/5 overflow-hidden shadow-2xl transition-all duration-500 hover:border-white/10 flex flex-col h-full luxury-edge group/table"
      style={{ animationDelay: `${delay}s` }}
    >
      {/* Data sweep accent on top */}
      <div className="h-px w-full overflow-hidden relative">
        <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent" style={{ animation: 'data-sweep 4s ease-in-out infinite', animationDelay: `${delay + 0.6}s` }} />
      </div>

      <div className="bg-white/5 px-8 py-6 border-b border-white/5 flex items-center justify-between relative overflow-hidden">
        <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover/table:opacity-100 transition-opacity" />
        <div className="flex items-center gap-4 relative z-10">
          <div className="h-10 w-10 rounded-2xl bg-[#050a18] border border-white/10 flex items-center justify-center shadow-xl">
             <Award className="h-5 w-5 text-indigo-400" />
          </div>
          <div className="flex flex-col">
             <h3 className="text-sm font-black uppercase tracking-[0.3em] text-white">
               {title} <span className="text-white/50 font-bold ml-1">{subtitle}</span>
             </h3>
             <span className="text-[13px] font-black text-indigo-400/60 uppercase tracking-[0.4em]">Grid Status: Operational</span>
          </div>
        </div>
        <div className="deboss px-4 py-1.5 rounded-xl text-[13px] font-black text-white/40 uppercase tracking-widest relative z-10">
          SORT: {sortKey}
        </div>
      </div>

      <div className="overflow-x-auto flex-1 scrollbar-hide">
        <table className="w-full border-collapse min-w-[650px]">
          <thead>
            <tr className="bg-black/20 border-b border-white/5">
              {headers.map((h) => (
                <th
                  key={h.key}
                  onClick={() => handleSort(h.key)}
                  className={`py-4 px-6 text-[13px] font-black text-white/50 uppercase tracking-widest cursor-pointer hover:text-white transition-colors ${h.align === 'right' ? 'text-right' : 'text-left'} ${h.minWidth || ''}`}
                >
                  <div className={`flex items-center gap-2 ${h.align === 'right' ? 'justify-end' : ''}`}>
                    {h.label}
                    {sortKey === h.key && (
                      <Zap className="h-2.5 w-2.5 text-indigo-400 animate-pulse" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sortedTeams.map((team, idx) => {
              const colors = getTeamColor(team.abbrev);
              const logoUrl = getLogoUrl(team.abbrev);
              const isTop = team.rank <= 6;
              const isPlayIn = team.rank > 6 && team.rank <= 10;

              return (
                <tr
                  key={team.abbrev}
                  onClick={() => { playGlassClick(); navigate(`/team/${team.abbrev}`); }}
                  className="hover:bg-white/[0.03] transition-all duration-300 group cursor-pointer animate-intel relative"
                  style={{ animationDelay: `${delay + 0.3 + idx * 0.03}s` }}
                >
                  <td className="py-5 px-6 relative overflow-hidden">
                    {/* Team Color Accent */}
                    <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: colors.primary }} />

                    <div className="flex items-center gap-5">
                      <div className="relative flex items-center justify-center w-6">
                        <span className={`text-sm font-black tabular-nums transition-all ${isTop ? 'text-[var(--green)]' : isPlayIn ? 'text-yellow-500' : 'text-white/10'}`}>
                          {team.rank}
                        </span>
                        {(isTop || isPlayIn) && (
                          <div className={`absolute -inset-2 blur-lg opacity-20 ${isTop ? 'bg-[var(--green)]' : 'bg-yellow-500'}`} />
                        )}
                      </div>

                      <div className="relative">
                        <div className="h-11 w-11 rounded-2xl bg-[#050a18] flex items-center justify-center border-t border-white/10 border-b border-black/40 shadow-2xl relative z-10 p-2 overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                          <img src={logoUrl} alt={team.abbrev} width={44} height={44} loading="lazy" className="w-full h-full object-contain drop-shadow-lg group-hover:scale-110 transition-transform duration-500" />
                        </div>
                        <div
                          className="absolute -inset-2 rounded-2xl blur-xl opacity-0 group-hover:opacity-20 transition-opacity"
                          style={{ backgroundColor: colors.primary }}
                        />
                      </div>

                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                           <span className="text-base font-black text-white uppercase tracking-tighter group-hover:text-indigo-400 transition-colors">
                             {team.name}
                           </span>
                           {team.rank === 1 && <Zap className="h-3 w-3 text-indigo-400" />}
                        </div>
                        <div className="flex items-center gap-3">
                           <span className="text-[13px] font-black text-white/50 uppercase tracking-[0.2em]">#{team.rank} SEED</span>
                           <span className="text-[13px] font-bold text-indigo-400/40 uppercase tracking-widest hidden group-hover:inline animate-fadeIn">Record: {team.w}-{team.l}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-5 px-4 text-right tabular-nums text-lg font-black text-white">{team.w}</td>
                  <td className="py-5 px-4 text-right tabular-nums text-lg font-black text-white/60">{team.l}</td>
                  <td className="py-5 px-4 text-right tabular-nums text-sm font-bold text-white/40">{team.pct}</td>
                  <td className="py-5 px-4 text-right tabular-nums text-sm font-black text-indigo-400/60 group-hover:text-indigo-400 transition-colors">{team.gb}</td>
                  <td className="py-5 px-4 text-right tabular-nums text-sm font-medium text-white/50">{team.l10 || '—'}</td>
                  <td className="py-5 px-6 text-right tabular-nums">
                     <span className={`text-[13px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border shadow-inner ${
                       team.strk.startsWith('W') ? 'text-[var(--green)] bg-[var(--green)]/5 border-[var(--green)]/20' : 'text-[var(--red)] bg-[var(--red)]/5 border-[var(--red)]/20'
                     }`}>
                        {team.strk}
                     </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div className="bg-black/20 px-10 py-5 border-t border-white/5 flex items-center justify-between relative overflow-hidden">
         <div className="absolute inset-0 texture-mesh opacity-5 pointer-events-none" />
         <div className="flex items-center gap-8 relative z-10">
            <div className="flex items-center gap-3">
               <div className="h-2 w-2 rounded-full bg-[var(--green)] shadow-[0_0_10px_var(--green)] animate-pulse" />
               <span className="text-[13px] font-black text-white/50 uppercase tracking-[0.3em]">Playoff Cutoff</span>
            </div>
            <div className="flex items-center gap-3">
               <div className="h-2 w-2 rounded-full bg-yellow-500 shadow-[0_0_10px_yellow] animate-pulse" />
               <span className="text-[13px] font-black text-white/50 uppercase tracking-[0.3em]">Play-In Boundary</span>
            </div>
         </div>
         <a href="/stats" className="flex items-center gap-2 text-sm font-black text-indigo-400 uppercase tracking-[0.4em] hover:text-white transition-all group/link relative z-10">
            Analytics Console <ChevronRight className="h-4 w-4 group-hover/link:translate-x-2 transition-transform" />
         </a>
      </div>
    </div>
  );
}

// Division order for display
const DIVISION_ORDER = {
  Eastern: ['Atlantic', 'Central', 'Southeast'],
  Western: ['Northwest', 'Pacific', 'Southwest'],
};

export default function StandingsPage() {
  const [standings, setStandings] = useState(null);
  const [teamsData, setTeamsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('conference');
  const { playGlassClick } = useTheme();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchStandings(),
      fetchTeams().catch(() => []),
    ])
      .then(([standingsData, teams]) => {
        if (cancelled) return;
        setStandings(standingsData);
        setTeamsData(teams);
      })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="max-w-[1600px] mx-auto space-y-12 pb-20 animate-fadeIn px-4 pt-8">
        <Skeleton variant="rectangle" height="h-24" className="w-1/3 rounded-3xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <Skeleton variant="rectangle" height="h-[800px]" className="rounded-[3.5rem]" />
          <Skeleton variant="rectangle" height="h-[800px]" className="rounded-[3.5rem]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-[1600px] mx-auto py-40 text-center px-4">
        <div className="deboss inline-flex flex-col p-16 rounded-[4rem] border border-white/5 shadow-2xl relative overflow-hidden">
           <div className="absolute inset-0 bg-red-500/5 animate-pulse" />
           <Info className="h-16 w-16 text-red-500 mb-8 mx-auto relative z-10" />
           <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-4 relative z-10">Telemetry Sync Failure</h2>
           <p className="text-white/40 uppercase text-sm font-bold tracking-[0.4em] relative z-10 max-w-md mx-auto leading-relaxed">System encountered a protocol error while decrypting league standings: {error}</p>
           <button onClick={() => window.location.reload()} className="mt-10 px-8 py-4 bg-white text-black rounded-2xl text-[13px] font-black uppercase tracking-[0.4em] hover:scale-105 transition-all relative z-10 shadow-2xl">Re-establish Uplink</button>
        </div>
      </div>
    );
  }

  const eastern = standings?.eastern || [];
  const western = standings?.western || [];

  // Build abbrev → division lookup from teams data
  const divisionMap = {};
  for (const t of teamsData) {
    divisionMap[t.abbrev] = t.division || 'Unknown';
  }

  // Group standings by division for division view
  const buildDivisionGroups = (confTeams, confName) => {
    const divGroups = {};
    for (const team of confTeams) {
      const div = divisionMap[team.abbrev] || 'Unknown';
      if (!divGroups[div]) divGroups[div] = [];
      divGroups[div].push(team);
    }
    // Sort by defined order
    const order = DIVISION_ORDER[confName] || Object.keys(divGroups);
    return order
      .filter(d => divGroups[d])
      .map(d => ({ name: d, teams: divGroups[d] }));
  };

  const handleViewChange = (v) => {
    if (v !== view) {
      playGlassClick();
      setView(v);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto pb-40 relative pt-12">
      {/* Arena Environment Elements */}
      <div className="scanline opacity-20 pointer-events-none" />

      <div className="relative z-10 space-y-16 px-4">
        {/* Standings Header Console */}
        <div className="animate-intel flex flex-col md:flex-row md:items-end justify-between gap-12 border-b border-white/5 pb-16 relative overflow-hidden">
          <div className="relative z-10">
            <h1 className="text-7xl md:text-[10rem] text-jumbotron tracking-tighter italic uppercase leading-none mix-blend-plus-lighter opacity-90">Standings</h1>
            <p className="text-[14px] font-black text-white/50 uppercase tracking-[0.6em] mt-8 ml-2 flex items-center gap-4">
              <span>{standings?.season || "2025-26"} SEASON</span>
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_indigo]" />
              <span className="text-indigo-400/80">GLOBAL TELEMETRY UPLINK ACTIVE</span>
            </p>
          </div>

          <div className="animate-intel flex items-center gap-4 bg-[#050a18]/80 p-3 rounded-3xl border border-white/10 shadow-2xl backdrop-blur-2xl relative z-10 rim-light" style={{ animationDelay: '0.15s' }}>
            <button
              onClick={() => handleViewChange('conference')}
              className={`px-10 py-4 text-[13px] font-black uppercase tracking-[0.3em] rounded-2xl transition-all duration-700 ${view === 'conference' ? 'bg-white text-black shadow-[0_0_40px_rgba(255,255,255,0.3)] scale-105' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
            >
              Conference
            </button>
            <button
              onClick={() => handleViewChange('division')}
              className={`px-10 py-4 text-[13px] font-black uppercase tracking-[0.3em] rounded-2xl transition-all duration-700 ${view === 'division' ? 'bg-white text-black shadow-[0_0_40px_rgba(255,255,255,0.3)] scale-105' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
            >
              Division
            </button>
          </div>

          {/* Background Atmospheric Glow */}
          <div className="absolute -top-24 right-0 w-[500px] h-[500px] bg-indigo-500/5 blur-[150px] rounded-full pointer-events-none" />
        </div>

        {/* Main Content Matrix */}
        {view === 'conference' ? (
          <div key="conference" className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start relative">
            {/* Conference Divider Line */}
            <div className="hidden lg:block absolute left-1/2 top-20 bottom-20 w-px bg-gradient-to-b from-transparent via-white/5 to-transparent -translate-x-1/2" />

            <StandingsTable teams={eastern} title="Eastern" subtitle="CONFERENCE" delay={0.3} />
            <StandingsTable teams={western} title="Western" subtitle="CONFERENCE" delay={0.45} />
          </div>
        ) : (
          <div key="division" className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-20 items-start">
            {/* Eastern divisions */}
            <div className="space-y-16">
              <div className="animate-intel flex items-center gap-8 border-b border-white/5 pb-6" style={{ animationDelay: '0.3s' }}>
                <div className="h-8 w-1 bg-indigo-500 shadow-[0_0_10px_indigo]" />
                <h2 className="text-3xl font-black uppercase tracking-[0.3em] text-white/90 italic">Eastern Sector</h2>
                <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
              </div>
              {buildDivisionGroups(eastern, 'Eastern').map((div, i) => (
                <StandingsTable key={div.name} teams={div.teams} title={div.name} subtitle="NODE" delay={0.4 + i * 0.15} />
              ))}
            </div>
            {/* Western divisions */}
            <div className="space-y-16">
              <div className="animate-intel flex items-center gap-8 border-b border-white/5 pb-6" style={{ animationDelay: '0.35s' }}>
                <div className="h-8 w-1 bg-indigo-500 shadow-[0_0_10px_indigo]" />
                <h2 className="text-3xl font-black uppercase tracking-[0.3em] text-white/90 italic">Western Sector</h2>
                <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
              </div>
              {buildDivisionGroups(western, 'Western').map((div, i) => (
                <StandingsTable key={div.name} teams={div.teams} title={div.name} subtitle="NODE" delay={0.45 + i * 0.15} />
              ))}
            </div>
          </div>
        )}

        {/* High-Fidelity Analytics Footer */}
        <div className="animate-intel flex flex-col lg:flex-row items-center justify-between gap-12 pt-24 border-t border-white/5" style={{ animationDelay: '0.9s' }}>
          <div className="flex flex-wrap justify-center lg:justify-start gap-16">
             <div className="flex flex-col gap-4">
                <span className="text-micro opacity-40 uppercase tracking-[0.4em]">Protocol Classification</span>
                <div className="flex gap-10">
                   <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-[var(--green)] shadow-[0_0_12px_var(--green)] animate-pulse" />
                      <span className="text-[13px] font-black text-white uppercase tracking-[0.2em]">Verified Playoff Candidate</span>
                   </div>
                   <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-yellow-500 shadow-[0_0_12px_yellow] animate-pulse" />
                      <span className="text-[13px] font-black text-white uppercase tracking-[0.2em]">Play-In Contingency</span>
                   </div>
                </div>
             </div>

             <div className="flex flex-col gap-4 border-l border-white/10 pl-16 hidden md:flex">
                <span className="text-micro opacity-40 uppercase tracking-[0.4em]">Node Diagnostics</span>
                <div className="flex gap-10 text-sm font-bold text-white/50 uppercase tracking-widest">
                   <span className="flex items-center gap-2 group cursor-help"><b className="text-white/40 group-hover:text-indigo-400 transition-colors">GB:</b> Delta Units</span>
                   <span className="flex items-center gap-2 group cursor-help"><b className="text-white/40 group-hover:text-indigo-400 transition-colors">PCT:</b> Efficiency</span>
                   <span className="flex items-center gap-2 group cursor-help"><b className="text-white/40 group-hover:text-indigo-400 transition-colors">STRK:</b> Momentum</span>
                </div>
             </div>
          </div>

          <div className="liquid-mirror px-10 py-6 rounded-[2.5rem] luxury-edge flex items-center gap-6 shadow-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-indigo-500/5 group-hover:bg-indigo-500/10 transition-colors duration-1000" />
            <Activity className="h-6 w-6 text-indigo-400 relative z-10" />
            <div className="flex flex-col gap-1 relative z-10">
               <p className="text-[13px] font-black text-white uppercase tracking-[0.3em] leading-none">Global Sync Status</p>
               <span className="text-sm font-bold text-white/50 uppercase tracking-[0.2em]">Last Decryption: 14ms Ago</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
