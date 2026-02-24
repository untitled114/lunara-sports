import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Calendar, Users, BarChart2 } from 'lucide-react';
import { Skeleton } from '@/components/ui';
import { fetchTeams } from '@/services/api';
import { useTheme } from '@/context/ThemeContext';
import { getTeamColor, getLogoUrl } from '@/utils/teamColors';

function TeamRow({ team, idx = 0, baseDelay = 0 }) {
  const logoUrl = getLogoUrl(team.abbrev);
  const colors = getTeamColor(team.abbrev);
  const { playGlassClick } = useTheme();

  return (
    <Link
      to={`/team/${team.abbrev}`}
      onClick={() => playGlassClick()}
      className="group flex items-center justify-between p-5 border-b border-white/5 hover:bg-white/[0.03] transition-all animate-intel"
      style={{ animationDelay: `${baseDelay + idx * 0.04}s` }}
    >
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <div className="h-11 w-11 rounded-xl bg-[#050a18] border border-white/10 flex items-center justify-center shadow-lg group-hover:border-white/20 transition-colors p-1.5 overflow-hidden relative z-10">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
            <img src={logoUrl} alt={team.abbrev} width={44} height={44} loading="lazy" className="w-full h-full object-contain relative z-10 group-hover:scale-110 transition-transform duration-500" />
          </div>
          <div
            className="absolute -inset-1.5 rounded-xl blur-lg opacity-0 group-hover:opacity-20 transition-opacity duration-500"
            style={{ backgroundColor: colors.primary }}
          />
        </div>
        <div>
          <h4 className="text-base font-black text-white uppercase tracking-tight group-hover:text-indigo-400 transition-colors">
            {team.name}
          </h4>
          {team.last_game ? (
            <p className="text-[13px] font-bold text-white/60 uppercase tracking-widest flex items-center gap-2 mt-0.5">
              <span className={team.last_game.startsWith('W') ? 'text-emerald-400' : 'text-red-400'}>
                {team.last_game.split(' ')[0]}
              </span>
              <span className="text-white/70">{team.last_game.split(' ').slice(1).join(' ')}</span>
            </p>
          ) : (
            <p className="text-sm font-bold text-white/70 uppercase tracking-widest mt-0.5">
              {team.conference} &bull; {team.division}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-6 md:flex">
         <div className="flex gap-5 opacity-30 group-hover:opacity-100 transition-opacity">
            <Calendar className="h-4 w-4 text-white/60 hover:text-indigo-400 transition-colors" />
            <Users className="h-4 w-4 text-white/60 hover:text-indigo-400 transition-colors" />
            <BarChart2 className="h-4 w-4 text-white/60 hover:text-indigo-400 transition-colors" />
         </div>
         <ChevronRight className="h-5 w-5 text-white/20 group-hover:text-white transition-colors" />
      </div>
    </Link>
  );
}

export default function TeamsPage() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeConf, setActiveConf] = useState('all');
  const { playGlassClick } = useTheme();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchTeams()
      .then((data) => { if (!cancelled) setTeams(data); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleConfChange = (conf) => {
    if (activeConf !== conf) {
      playGlassClick();
      setActiveConf(conf);
    }
  };

  if (loading) {
    return (
      <div className="max-w-[1400px] mx-auto space-y-12 pb-20 animate-fadeIn px-4 pt-10">
        <Skeleton variant="rectangle" height="h-24" className="w-1/2 rounded-[2rem]" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {[1, 2].map(i => <Skeleton key={i} variant="rectangle" height="h-[600px]" className="rounded-[3rem]" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-[1400px] mx-auto py-32 text-center px-4">
        <div className="deboss inline-flex flex-col p-16 rounded-[3rem] border border-white/10 shadow-2xl relative overflow-hidden">
           <div className="absolute inset-0 bg-red-500/5 animate-pulse" />
           <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-4 relative z-10 italic">Franchise Sync Failure</h2>
           <p className="text-white/40 uppercase text-xs font-bold tracking-[0.4em] relative z-10 max-w-sm mx-auto leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  // Filter and Group teams
  const grouped = {};
  for (const team of teams) {
    const conf = team.conference || "Unknown";
    const div = team.division || "Unknown";

    if (activeConf === 'east' && !conf.includes('East')) continue;
    if (activeConf === 'west' && !conf.includes('West')) continue;

    if (!grouped[conf]) grouped[conf] = {};
    if (!grouped[conf][div]) grouped[conf][div] = [];
    grouped[conf][div].push(team);
  }

  const conferences = Object.entries(grouped).map(([conf, divisions]) => ({
    name: conf.includes("East") ? "Eastern Conference" : conf.includes("West") ? "Western Conference" : conf,
    divisions: Object.entries(divisions).map(([div, teams]) => ({ name: div, teams })),
  }));

  return (
    <div className="max-w-[1400px] mx-auto pb-32 relative pt-8">
      {/* Arena Environment */}
      <div className="scanline opacity-20 pointer-events-none" />

      <div className="relative z-10 space-y-12 px-4">
        {/* Header */}
        <div className="animate-intel flex flex-col md:flex-row md:items-end justify-between gap-10 border-b border-white/5 pb-12 relative overflow-hidden">
          <div className="relative z-10">
            <h1 className="text-6xl md:text-[8rem] text-jumbotron tracking-tighter uppercase italic leading-none opacity-90">Teams</h1>
            <p className="text-[14px] font-black text-white/50 uppercase tracking-[0.5em] mt-8 ml-2">
              FRANCHISE DIRECTORY <span className="mx-4 text-white/10">|</span> 2025-26 DATASTREAM
            </p>
          </div>

          <div className="animate-intel flex items-center gap-4 bg-[#050a18]/80 p-2 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-md relative z-10 rim-light" style={{ animationDelay: '0.15s' }}>
            {[
              { id: 'all', label: 'All Clusters' },
              { id: 'east', label: 'Eastern' },
              { id: 'west', label: 'Western' }
            ].map(c => (
              <button
                key={c.id}
                onClick={() => handleConfChange(c.id)}
                className={`px-10 py-4 text-[11px] font-black uppercase tracking-[0.3em] rounded-xl transition-all duration-700 ${activeConf === c.id ? 'bg-white text-black shadow-[0_0_30px_rgba(255,255,255,0.3)] scale-105' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Background Accent */}
          <div className="absolute -top-24 right-0 w-96 h-96 bg-indigo-500/5 blur-[120px] rounded-full" />
        </div>

        {/* Conference Groups */}
        <div className={`grid grid-cols-1 ${activeConf === 'all' ? 'lg:grid-cols-2' : ''} gap-x-16 gap-y-16 items-start transition-all duration-700`}>
          {conferences.map((conf, confIdx) => (
            <div key={conf.name} className="space-y-12">
              <div className="animate-intel flex items-center gap-6 border-b border-white/5 pb-6" style={{ animationDelay: `${0.3 + confIdx * 0.2}s` }}>
                <div className="h-6 w-1 bg-indigo-500 shadow-[0_0_10px_indigo]" />
                <h2 className="text-3xl font-black uppercase tracking-[0.2em] text-white/90 italic">
                  {conf.name}
                </h2>
                <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
              </div>

              <div className="space-y-16">
                {conf.divisions.map((div, divIdx) => {
                  const sectionDelay = 0.4 + confIdx * 0.2 + divIdx * 0.15;
                  return (
                    <div key={div.name} className="space-y-6">
                      {/* INCREASED OPACITY FROM 40% TO 70% */}
                      <h3 className="animate-intel text-xs font-black text-white/70 uppercase tracking-[0.4em] ml-2 flex items-center gap-3" style={{ animationDelay: `${sectionDelay}s` }}>
                        <div className="h-1 w-1 rounded-full bg-indigo-500/40" />
                        {div.name} SECTOR
                      </h3>
                      <div
                        className="animate-intel liquid-mirror rounded-[3rem] overflow-hidden divide-y divide-white/5 shadow-2xl luxury-edge relative"
                        style={{ animationDelay: `${sectionDelay + 0.05}s` }}
                      >
                        {/* Data sweep on container */}
                        <div className="absolute top-0 left-0 right-0 h-px overflow-hidden z-10">
                          <div
                            className="h-full w-full bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent"
                            style={{ animation: 'data-sweep 3s ease-in-out forwards', animationDelay: `${sectionDelay + 0.3}s` }}
                          />
                        </div>
                        {div.teams.map((team, teamIdx) => (
                          <TeamRow key={team.abbrev} team={team} idx={teamIdx} baseDelay={sectionDelay + 0.1} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
