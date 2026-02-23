import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Tabs, Skeleton, Badge } from '@/components/ui';
import { ChevronLeft, BarChart2, Calendar, Trophy, Zap, MapPin, User as UserIcon, Users, TrendingUp } from 'lucide-react';
import { fetchPlayerDetail, fetchPlayerStats, fetchPlayerGameLog } from '@/services/api';
import { getTeamColor, getLogoUrl } from '@/utils/teamColors';
import { useTheme } from '@/context/ThemeContext';

export default function PlayerProfilePage() {
  const { id } = useParams();
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [gameLog, setGameLog] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const { playGlassClick } = useTheme();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      fetchPlayerDetail(id).catch(() => null),
      fetchPlayerStats(id).catch(() => null),
      fetchPlayerGameLog(id).catch(() => []),
    ]).then(([playerData, statsData, logData]) => {
      if (!cancelled) {
        setPlayer(playerData);
        setStats(statsData);
        setGameLog(logData);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [id]);

  const teamColors = getTeamColor(player?.team_abbrev || 'NBA');
  const teamLogo = getLogoUrl(player?.team_abbrev || 'NBA');

  if (loading) {
    return (
      <div className="max-w-[1400px] mx-auto space-y-12 animate-fadeIn px-4 pt-10 pb-32">
        <Skeleton variant="rectangle" height="h-80" className="rounded-[3rem]" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <Skeleton variant="rectangle" height="h-96" className="rounded-[2.5rem] lg:col-span-2" />
           <Skeleton variant="rectangle" height="h-96" className="rounded-[2.5rem]" />
        </div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="max-w-[1400px] mx-auto py-40 text-center">
        <h2 className="text-4xl text-jumbotron mb-6">Player Not Found</h2>
        <Link to="/players" className="text-indigo-400 font-black uppercase tracking-widest">Return to Directory</Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-12 pb-40 animate-fadeIn px-4 pt-10">
      {/* Breadcrumb */}
      <Link to="/players" className="inline-flex items-center gap-2 text-[13px] font-black uppercase tracking-[0.3em] text-white/50 hover:text-white transition group">
        <ChevronLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" /> Player Directory
      </Link>

      {/* Player Cinematic Header */}
      <div className="relative overflow-hidden rounded-[3.5rem] liquid-mirror shadow-2xl border-white/5 h-80 flex items-end">
        {/* Background Aura */}
        <div className="absolute inset-0 opacity-20 pointer-events-none blur-[120px]"
             style={{ background: `radial-gradient(circle at 30% 50%, ${teamColors.primary} 0%, transparent 60%)` }} />

        {/* Surface Detail */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

        {/* Player Image - Cinematic Scale */}
        <div className="absolute right-10 bottom-0 h-full w-[40%] flex items-end justify-end pointer-events-none overflow-hidden">
           {player.headshot_url && (
             <img src={player.headshot_url} alt={player.name} className="h-[110%] object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.8)] translate-y-10" />
           )}
        </div>

        {/* Scrim to separate text from image */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent pointer-events-none z-[5]" />

        <div className="relative z-10 p-12 w-full flex items-end justify-between">
           <div className="flex items-center gap-10 max-w-[55%]">
              <div className="h-28 w-28 rounded-[2rem] bg-[#050a18] border-t-2 border-white/20 border-x border-white/5 border-b-2 border-black/80 shadow-2xl p-5 overflow-hidden flex items-center justify-center shrink-0">
                 <img src={teamLogo} alt={player.team_abbrev} className="w-full h-full object-contain drop-shadow-2xl" />
              </div>

              <div className="flex flex-col gap-2">
                 <div className="flex items-center gap-4">
                    <span className="text-2xl font-black text-white/50 tabular-nums">#{player.jersey || '00'}</span>
                    <Badge variant="primary" className="px-4 py-1.5 text-sm font-black tracking-widest uppercase border-indigo-500/30">{player.position}</Badge>
                 </div>
                 <h1 className={`text-jumbotron tracking-tighter leading-[0.9] ${player.name.length > 18 ? 'text-3xl md:text-4xl lg:text-5xl' : 'text-4xl md:text-5xl lg:text-6xl'}`}>{player.name}</h1>
                 <p className="text-sm font-bold text-white/50 uppercase tracking-[0.4em] mt-2">{player.team}</p>
              </div>
           </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">

        {/* Statistics Console */}
        <div className="lg:col-span-8 space-y-10">
           <div className="liquid-mirror rounded-[2.5rem] p-1 border-white/5 shadow-2xl overflow-hidden">
              <div className="bg-white/5 p-4 border-b border-white/5">
                 <Tabs
                   variant="underline"
                   activeTab={activeTab}
                   onChange={setActiveTab}
                   tabs={[
                     { id: 'overview', label: 'Overview', icon: Trophy },
                     { id: 'stats', label: 'Detailed Stats', icon: BarChart2 },
                     { id: 'log', label: 'Game Log', icon: Calendar },
                   ]}
                 />
              </div>

              <div className="p-10 animate-scaleIn">
                 {activeTab === 'overview' && (
                   <div className="space-y-12">
                      {/* Season Averages */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
                         {[
                           { label: 'Points', val: stats?.ppg || '0.0', unit: 'PPG', icon: Zap, color: 'text-orange-500' },
                           { label: 'Rebounds', val: stats?.rpg || '0.0', unit: 'RPG', icon: Trophy, color: 'text-indigo-400' },
                           { label: 'Assists', val: stats?.apg || '0.0', unit: 'APG', icon: Users, color: 'text-emerald-400' },
                           { label: 'Games', val: stats?.gp || '0', unit: 'GP', icon: Calendar, color: 'text-white/40' },
                         ].map(stat => (
                           <div key={stat.label} className="flex flex-col gap-3 group">
                              <div className="flex items-center gap-2">
                                 <stat.icon className={`h-3 w-3 ${stat.color}`} />
                                 <span className="text-sm font-black uppercase tracking-[0.2em] text-white/50">{stat.label}</span>
                              </div>
                              <div className="flex items-baseline gap-2">
                                 <span className="text-5xl text-luxury text-white group-hover:text-indigo-400 transition-colors">{stat.val}</span>
                                 <span className="text-micro opacity-20">{stat.unit}</span>
                              </div>
                           </div>
                         ))}
                      </div>

                      <div className="h-px w-full bg-white/5" />

                      {/* Shooting Efficiency */}
                      <div className="space-y-6">
                         <span className="text-micro">Shooting Efficiency</span>
                         <div className="grid grid-cols-3 gap-6">
                            {[
                              { label: 'Field Goal', val: stats?.fg_pct || '0.0%', pct: parseFloat(stats?.fg_pct) || 0 },
                              { label: 'Three Point', val: stats?.three_pct || '0.0%', pct: parseFloat(stats?.three_pct) || 0 },
                              { label: 'Free Throw', val: stats?.ft_pct || '0.0%', pct: parseFloat(stats?.ft_pct) || 0 },
                            ].map(item => (
                              <div key={item.label} className="space-y-3">
                                 <div className="flex justify-between items-center">
                                    <span className="text-[13px] font-black uppercase tracking-widest text-white/40">{item.label}</span>
                                    <span className="text-sm font-black text-white tabular-nums">{item.val}</span>
                                 </div>
                                 <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex border border-white/5 shadow-inner">
                                    <div className="h-full bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]" style={{ width: `${item.pct}%` }} />
                                 </div>
                              </div>
                            ))}
                         </div>
                      </div>

                      <div className="h-px w-full bg-white/5" />

                      {/* Recent Performances */}
                      {gameLog.length > 0 && (
                        <div className="space-y-8">
                           <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                 <TrendingUp className="h-4 w-4 text-indigo-400" />
                                 <span className="text-[13px] font-black uppercase tracking-[0.2em] text-white">Recent Performances</span>
                              </div>
                              <span className="text-[13px] font-black uppercase tracking-widest text-white/50">Last {Math.min(gameLog.length, 10)} Games</span>
                           </div>

                           {/* Game Cards */}
                           <div className="space-y-3">
                              {gameLog.slice(0, 5).map((g, i) => {
                                 const isWin = g.result === 'W';
                                 const oppLogo = getLogoUrl(g.opponent);
                                 const avgPts = parseFloat(stats?.ppg) || 0;
                                 const hotGame = g.pts >= avgPts * 1.2;
                                 const coldGame = g.pts < avgPts * 0.6;
                                 return (
                                    <div key={i} className="group relative flex items-stretch rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 transition-all overflow-hidden">
                                       {/* Performance indicator strip */}
                                       <div className={`w-1 shrink-0 ${hotGame ? 'bg-emerald-500' : coldGame ? 'bg-red-500/60' : 'bg-white/10'}`} />

                                       <div className="flex items-center gap-5 p-5 flex-1 min-w-0">
                                          {/* Opponent Logo */}
                                          <div className="h-12 w-12 rounded-2xl bg-white/5 border border-white/10 p-2 shrink-0 overflow-hidden shadow-lg">
                                             <img src={oppLogo} alt={g.opponent} className="w-full h-full object-contain" />
                                          </div>

                                          {/* Main stats */}
                                          <div className="flex-1 min-w-0">
                                             <div className="flex items-center gap-2 mb-2">
                                                <span className="text-sm font-bold text-white/50">
                                                   {new Date(g.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                </span>
                                                <span className="text-sm text-white/15">{g.home_away}</span>
                                                <span className="text-[13px] font-black text-white/50 uppercase">{g.opponent}</span>
                                                {g.result && (
                                                   <span className={`text-[13px] font-black px-2 py-0.5 rounded-full ${isWin ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>{g.result}</span>
                                                )}
                                                {g.score && (
                                                   <span className="text-sm font-bold text-white/15 tabular-nums">{g.score}</span>
                                                )}
                                             </div>
                                             <div className="flex items-baseline gap-1">
                                                <span className={`text-3xl font-black tabular-nums ${hotGame ? 'text-white' : 'text-white/80'}`}>{g.pts}</span>
                                                <span className="text-[13px] font-black text-white/50 uppercase mr-3">PTS</span>
                                                <span className="text-xl font-black text-white/40 tabular-nums">{g.reb}</span>
                                                <span className="text-[13px] font-black text-white/15 uppercase mr-3">REB</span>
                                                <span className="text-xl font-black text-white/40 tabular-nums">{g.ast}</span>
                                                <span className="text-[13px] font-black text-white/15 uppercase mr-3">AST</span>
                                                {(g.stl > 0 || g.blk > 0) && (
                                                   <>
                                                      <span className="text-sm font-black text-white/25 tabular-nums">{g.stl}</span>
                                                      <span className="text-[13px] font-black text-white/10 uppercase mr-2">STL</span>
                                                      <span className="text-sm font-black text-white/25 tabular-nums">{g.blk}</span>
                                                      <span className="text-[13px] font-black text-white/10 uppercase">BLK</span>
                                                   </>
                                                )}
                                             </div>
                                          </div>

                                          {/* Right side: FG + MIN */}
                                          <div className="shrink-0 flex flex-col items-end gap-1.5">
                                             <div className="deboss px-3 py-1.5 rounded-lg text-center">
                                                <div className="text-[13px] font-black text-white/50 uppercase tracking-wider">FG</div>
                                                <div className="text-sm font-black text-white/60 tabular-nums">{g.fg}</div>
                                             </div>
                                             {g.min && (
                                                <span className="text-[13px] font-bold text-white/15 tabular-nums">{g.min} MIN</span>
                                             )}
                                          </div>
                                       </div>
                                    </div>
                                 );
                              })}
                           </div>
                        </div>
                      )}
                   </div>
                 )}

                 {activeTab === 'stats' && (
                    <div className="space-y-8">
                       <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                          {[
                             { label: 'Steals', val: stats?.spg || '0.0', unit: 'SPG' },
                             { label: 'Blocks', val: stats?.bpg || '0.0', unit: 'BPG' },
                             { label: 'Games Played', val: stats?.gp || '0', unit: 'GP' },
                          ].map(s => (
                             <div key={s.label} className="deboss p-6 rounded-2xl flex flex-col gap-2">
                                <span className="text-sm font-black uppercase tracking-widest text-white/50">{s.label}</span>
                                <div className="flex items-baseline gap-2">
                                   <span className="text-3xl font-black text-white">{s.val}</span>
                                   <span className="text-sm opacity-20 uppercase">{s.unit}</span>
                                </div>
                             </div>
                          ))}
                       </div>
                    </div>
                 )}

                 {activeTab === 'log' && (
                    <div className="overflow-x-auto">
                       <table className="w-full text-left border-collapse min-w-[600px]">
                          <thead>
                             <tr className="bg-white/5 text-[13px] font-black uppercase tracking-[0.2em] text-white/50 border-b border-white/5">
                                <th className="py-4 px-4">Date</th>
                                <th className="py-4 px-4">Opponent</th>
                                <th className="py-4 px-4 text-center">W/L</th>
                                <th className="py-4 px-4 text-right">PTS</th>
                                <th className="py-4 px-4 text-right">REB</th>
                                <th className="py-4 px-4 text-right">AST</th>
                                <th className="py-4 px-4 text-right">FG</th>
                                <th className="py-4 px-4 text-right">MIN</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                             {gameLog.map((entry, idx) => (
                                <tr key={idx} className="hover:bg-white/[0.03] transition-colors group">
                                   <td className="py-4 px-4 text-sm font-bold text-white/40">{entry.date}</td>
                                   <td className="py-4 px-4">
                                      <div className="flex items-center gap-2">
                                         <span className="text-micro opacity-20">{entry.home_away}</span>
                                         <span className="text-sm font-black text-white uppercase">{entry.opponent}</span>
                                      </div>
                                   </td>
                                   <td className="py-4 px-4 text-center">
                                      {entry.result && (
                                         <span className={`text-sm font-black ${entry.result === 'W' ? 'text-emerald-400' : 'text-red-400'}`}>{entry.result}</span>
                                      )}
                                   </td>
                                   <td className="py-4 px-4 text-right text-sm font-black text-white">{entry.pts}</td>
                                   <td className="py-4 px-4 text-right text-sm font-black text-white/60">{entry.reb}</td>
                                   <td className="py-4 px-4 text-right text-sm font-black text-white/60">{entry.ast}</td>
                                   <td className="py-4 px-4 text-right text-sm tabular-nums text-white/50">{entry.fg}</td>
                                   <td className="py-4 px-4 text-right text-sm tabular-nums text-white/50">{entry.min || '—'}</td>
                                </tr>
                             ))}
                             {gameLog.length === 0 && (
                                <tr>
                                   <td colSpan="8" className="py-20 text-center text-sm font-black uppercase tracking-widest text-white/10">No recent data streams</td>
                                </tr>
                             )}
                          </tbody>
                       </table>
                    </div>
                 )}
              </div>
           </div>
        </div>

        {/* Biography & Data (Right) */}
        <div className="lg:col-span-4 space-y-8">
           <div className="liquid-mirror rounded-[2.5rem] p-10 space-y-10 luxury-edge shadow-2xl">
              <div className="flex items-center gap-4">
                 <UserIcon className="h-5 w-5 text-indigo-400" />
                 <h3 className="text-sm font-black uppercase tracking-[0.3em] text-white">Bio Telemetry</h3>
              </div>

              <div className="space-y-8">
                 {[
                   { label: 'Height / Weight', val: `${player.height || '—'} / ${player.weight || '—'} lbs` },
                   { label: 'Age / Experience', val: `${player.age || '—'} Years / ${player.experience || '—'}` },
                   ...(player.draft ? [{ label: 'Draft', val: player.draft }] : []),
                   ...(player.birthplace ? [{ label: 'Origin', val: player.birthplace }] : []),
                   { label: 'Current Sector', val: player.team || '—' },
                 ].map(bio => (
                   <div key={bio.label} className="flex flex-col gap-2">
                      <span className="text-micro opacity-30">{bio.label}</span>
                      <span className="text-base font-black text-white uppercase tracking-tight">{bio.val}</span>
                   </div>
                 ))}
              </div>

              <div className="pt-6 border-t border-white/5">
                 <button className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-sm font-black uppercase tracking-[0.3em] text-white hover:bg-white hover:text-black transition-all duration-500">
                    Full Bio Profile
                 </button>
              </div>
           </div>

           <div className="rounded-[2.5rem] deboss p-10 border-white/5 space-y-6">
              <div className="flex items-center gap-3">
                 <MapPin className="h-4 w-4 text-white/50" />
                 <span className="text-micro opacity-40">Local Arena</span>
              </div>
              <p className="text-base font-black text-white uppercase tracking-tight leading-relaxed">
                 {player.team} <br />
                 <span className="text-indigo-400">Arena Operations</span>
              </p>
           </div>
        </div>

      </div>
    </div>
  );
}
