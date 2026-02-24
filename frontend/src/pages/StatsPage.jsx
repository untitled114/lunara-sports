import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Skeleton } from '@/components/ui';
import { BarChart3, TrendingUp, Users, Shield, Zap, Award, ChevronRight, Target, Activity } from 'lucide-react';
import { fetchStatLeaders, fetchTeamStatsList } from '@/services/api';
import { useTheme } from '@/context/ThemeContext';

function LeaderboardCard({ title, icon: Icon, data, unit, delay = 0 }) {
  const { playGlassClick } = useTheme();

  return (
    <div
      className="liquid-mirror rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl flex flex-col h-full animate-fadeIn transition-all duration-500 hover:border-white/10 group/card"
      style={{ animationDelay: `${delay}s` }}
    >
      {/* Card Header */}
      <div className="flex items-center justify-between px-8 py-6 bg-white/5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-[#050a18] border border-white/10 flex items-center justify-center shadow-lg group-hover/card:border-indigo-500/50 transition-colors">
            <Icon className="h-4 w-4 text-indigo-400" />
          </div>
          <h3 className="text-sm font-black uppercase tracking-[0.3em] text-white">{title}</h3>
        </div>
        <span className="text-sm font-black text-white/50 uppercase tracking-widest">{unit}</span>
      </div>

      {/* Table Body */}
      <div className="flex-1">
        <table className="w-full text-left border-collapse">
          <tbody className="divide-y divide-white/5">
            {data.map((row, idx) => (
              <tr key={row.player_id + idx} className="group hover:bg-white/[0.03] transition-all duration-300 cursor-default">
                <td className="py-4 px-8 w-12">
                   <span className="text-sm font-black text-white/10 tabular-nums">{row.rank}</span>
                </td>
                <td className="py-4 px-2">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-[#050a18] border border-white/10 overflow-hidden shadow-lg shrink-0 relative">
                       <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                       {row.headshot_url ? (
                         <img src={row.headshot_url} alt={row.player} width={96} height={70} loading="lazy" className="w-full h-full object-cover scale-110 group-hover:scale-125 transition-transform duration-500" />
                       ) : (
                         <div className="w-full h-full flex items-center justify-center text-sm font-black text-white/10 uppercase">{row.player[0]}</div>
                       )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <Link
                        to={`/player/${row.player_id}`}
                        onClick={() => playGlassClick()}
                        className="text-sm font-black text-white uppercase tracking-tight group-hover:text-indigo-400 transition-colors truncate"
                      >
                        {row.player}
                      </Link>
                      <span className="text-sm font-bold text-white/50 uppercase tracking-widest">{row.team}</span>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-8 text-right tabular-nums">
                   <span className="text-lg font-black text-white group-hover:text-indigo-400 transition-colors">{row.value}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Card Footer */}
      <div className="p-4 bg-white/5 border-t border-white/5">
         <Link
           to="/players"
           onClick={() => playGlassClick()}
           className="flex items-center justify-center gap-2 py-3 rounded-xl hover:bg-white/5 transition-all group/link"
         >
            <span className="text-sm font-black uppercase tracking-[0.3em] text-white/50 group-hover/link:text-indigo-400 transition-colors">Complete Leaders</span>
            <ChevronRight className="h-3 w-3 text-white/10 group-hover/link:translate-x-1 group-hover/link:text-indigo-400 transition-all" />
         </Link>
      </div>
    </div>
  );
}

function StatSection({ title, subtitle, children }) {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 border-l-4 border-indigo-500 pl-6">
        <h2 className="text-3xl font-black uppercase tracking-tighter text-white">{title}</h2>
        <p className="text-sm font-black text-white/50 uppercase tracking-[0.4em]">{subtitle}</p>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
        {children}
      </div>
    </div>
  );
}

export default function StatsPage() {
  const [activeTab, setActiveTab] = useState('players');
  const [leaders, setLeaders] = useState({});
  const [teamStats, setTeamStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      fetchStatLeaders(5),
      fetchTeamStatsList(),
    ])
      .then(([leadersData, teamsData]) => {
        if (cancelled) return;
        setLeaders(leadersData?.categories || {});
        setTeamStats(teamsData || []);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="max-w-[1600px] mx-auto space-y-12 animate-fadeIn px-4 pt-10">
        <Skeleton variant="rectangle" height="h-24" className="w-1/3 rounded-[2rem]" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} variant="rectangle" height="h-[600px]" className="rounded-[3rem]" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-20 pb-40 animate-fadeIn px-4 pt-10">
      {/* Header Console */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-10 border-b border-white/5 pb-16">
        <div>
          <h1 className="text-6xl md:text-9xl text-jumbotron tracking-tighter">Statistics</h1>
          <p className="text-[13px] font-black text-white/50 uppercase tracking-[0.5em] mt-6 ml-1">NBA Global Telemetry <span className="mx-4 text-white/10">|</span> 2025-26 Regular Season</p>
        </div>

        <div className="flex items-center gap-4 bg-white/5 p-2 rounded-2xl border border-white/5 shadow-2xl">
          <button
            onClick={() => setActiveTab('players')}
            className={`px-10 py-4 text-sm font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'players' ? 'bg-white text-black shadow-2xl scale-105' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
          >
            Individual
          </button>
          <button
            onClick={() => setActiveTab('teams')}
            className={`px-10 py-4 text-sm font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'teams' ? 'bg-white text-black shadow-2xl scale-105' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
          >
            Franchise
          </button>
        </div>
      </div>

      {activeTab === 'players' ? (
        <div className="space-y-24">
          {/* Offensive Leaders */}
          <StatSection title="Offensive Telemetry" subtitle="Primary Scoring & Playmaking Vectors">
             <LeaderboardCard title="Points" icon={Zap} data={leaders.pts || []} unit="PPG" delay={0} />
             <LeaderboardCard title="Assists" icon={Activity} data={leaders.ast || []} unit="APG" delay={0.1} />
             <LeaderboardCard title="Three Pointers" icon={Target} data={leaders.threes || []} unit="3PM" delay={0.2} />
          </StatSection>

          {/* Defensive Leaders */}
          <StatSection title="Defensive Telemetry" subtitle="Rim Protection & Perimeter Pressure">
             <LeaderboardCard title="Rebounds" icon={Shield} data={leaders.reb || []} unit="RPG" delay={0.3} />
             <LeaderboardCard title="Blocks" icon={TrendingUp} data={leaders.blk || []} unit="BPG" delay={0.4} />
             <LeaderboardCard title="Steals" icon={Zap} data={leaders.stl || []} unit="SPG" delay={0.5} />
          </StatSection>

          {/* Efficiency Banner */}
          <div className="liquid-mirror rounded-[3rem] luxury-edge p-12 flex flex-col md:flex-row items-center justify-between gap-10 shadow-2xl relative overflow-hidden group">
             <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
             <div className="flex items-center gap-8 relative z-10">
                <div className="h-20 w-20 rounded-[2rem] bg-[#050a18] flex items-center justify-center border border-white/10 shadow-2xl group-hover:scale-110 transition-transform duration-500">
                   <Award className="h-10 w-10 text-indigo-400" />
                </div>
                <div>
                   <h2 className="text-2xl font-black uppercase tracking-tight text-white mb-2 leading-none">Advanced Analytics Console</h2>
                   <p className="text-sm font-bold text-white/50 uppercase tracking-[0.3em]">Player Impact Estimate (PIE) & True Shooting Percentages</p>
                </div>
             </div>
             <Link to="/standings" className="relative z-10 px-12 py-5 bg-white text-black text-[13px] font-black uppercase tracking-[0.4em] rounded-2xl hover:shadow-[0_0_50px_rgba(255,255,255,0.3)] hover:scale-105 transition-all active:scale-95">
                League Intel
             </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-scaleIn">
          <div className="liquid-mirror rounded-[3rem] border border-white/5 overflow-hidden shadow-2xl luxury-edge">
            <div className="px-10 py-8 bg-white/5 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-lg font-black uppercase tracking-[0.3em] text-white">Consolidated Team Matrix</h2>
              <div className="glass-pill px-4 py-1.5 rounded-full text-sm font-black text-indigo-400 uppercase tracking-widest">Global Rank</div>
            </div>
            {teamStats.length === 0 ? (
              <div className="py-32 text-center">
                 <p className="text-sm font-black uppercase tracking-[0.5em] text-white/10">No franchise telemetry available</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead>
                    <tr className="bg-black/20 text-sm font-black uppercase tracking-[0.3em] text-white/50 border-b border-white/5">
                      <th className="py-6 px-10 w-24 text-center">RK</th>
                      <th className="py-6 px-6">Franchise</th>
                      <th className="py-6 px-4 text-right">W-L</th>
                      <th className="py-6 px-4 text-right text-indigo-400">ORTG</th>
                      <th className="py-6 px-4 text-right text-red-400">DRTG</th>
                      <th className="py-6 px-4 text-right text-white">NET</th>
                      <th className="py-6 px-4 text-right">PACE</th>
                      <th className="py-6 px-10 text-right">TS%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {teamStats.map((team) => (
                      <tr key={team.rank} className="group hover:bg-white/[0.03] transition-all duration-300">
                        <td className="py-6 px-10 text-center tabular-nums text-sm font-black text-white/50">{team.rank}</td>
                        <td className="py-6 px-6">
                          <span className="text-lg font-black text-white uppercase tracking-tight group-hover:text-indigo-400 transition-colors">{team.team}</span>
                        </td>
                        <td className="py-6 px-4 text-right tabular-nums text-sm font-bold text-white/40">{team.record}</td>
                        <td className="py-6 px-4 text-right tabular-nums text-base font-black text-indigo-400/80">{team.ortg}</td>
                        <td className="py-6 px-4 text-right tabular-nums text-base font-black text-red-400/80">{team.drtg}</td>
                        <td className="py-6 px-4 text-right tabular-nums text-base font-black text-white">{team.net_rtg}</td>
                        <td className="py-6 px-4 text-right tabular-nums text-sm font-bold text-white/40">{team.pace}</td>
                        <td className="py-6 px-10 text-right tabular-nums text-sm font-black text-white/60">{team.ts_pct}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
