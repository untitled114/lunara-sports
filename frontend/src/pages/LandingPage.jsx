import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Zap, Trophy, TrendingUp, Users, Activity, Target, Shield, BarChart2, Globe, Brain } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { BRANDING_IMAGES } from '@/constants/branding';

function FeatureCard({ icon: Icon, title, desc, link, delay = '0s', color = 'var(--accent)', image, transitionImage }) {
  const { playGlassClick, triggerArenaEntry } = useTheme();
  const navigate = useNavigate();

  const handleClick = (e) => {
    e.preventDefault();
    playGlassClick();
    triggerArenaEntry(() => {
      navigate(link);
    }, transitionImage);
  };

  return (
    <div className="relative group perspective h-full">
      <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-3/4 h-12 bg-white/5 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />

      <a
        href={link}
        onClick={handleClick}
        className="block liquid-mirror rounded-[3rem] p-12 gloss-sweep transition-all duration-1000 hover:-translate-y-6 animate-float relative z-10 luxury-edge shadow-[25px_25px_60px_-15px_rgba(0,0,0,0.8)] overflow-hidden h-full"
        style={{ animationDelay: delay }}
      >
        {image && (
          <div className="absolute inset-0 z-0 opacity-20 group-hover:opacity-40 transition-opacity duration-1000 pointer-events-none">
            <img src={image} alt="" className="w-full h-full object-cover scale-110 group-hover:scale-100 transition-transform duration-1000" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050a18] via-[#050a18]/80 to-transparent" />
          </div>
        )}

        <div className="relative z-10">
          <div className="h-16 w-16 rounded-2xl bg-[#050a18] border-t-2 border-white/20 border-x border-white/5 border-b-2 border-black/80 flex items-center justify-center mb-10 shadow-2xl group-hover:scale-110 transition-transform relative overflow-hidden">
            <div className="absolute inset-0 opacity-10 blur-xl" style={{ backgroundColor: color }} />
            <Icon className="h-8 w-8 relative z-10" style={{ color: color }} />
          </div>
          <h3 className="text-2xl font-black uppercase tracking-tight text-white mb-5 leading-tight">{title}</h3>
          <p className="text-[13px] font-bold text-white/80 uppercase tracking-[0.3em] leading-relaxed mb-10">{desc}</p>
          <div className="flex items-center gap-3 text-sm font-black uppercase tracking-[0.4em] text-white/30 group-hover:text-white transition-all">
            Explore <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </a>
    </div>
  );
}

export default function LandingPage() {
  const { triggerArenaEntry } = useTheme();
  const navigate = useNavigate();

  const handleEnterArena = () => {
    triggerArenaEntry(() => {
      navigate('/scoreboard');
    }, BRANDING_IMAGES.transitions.main1);
  };

  return (
    <div className="animate-fadeIn">
      {/* Hero — full bleed, extends behind navbar */}
      <div className="relative text-center flex flex-col items-center justify-center min-h-[70vh]">

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center gap-10">
          <div className="deboss px-8 py-2.5 rounded-full inline-flex items-center gap-4 border-white/10 shadow-2xl backdrop-blur-md rim-light">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-ping shadow-[0_0_10px_rgba(16,185,129,0.6)]" />
            <span className="text-sm font-black uppercase tracking-[0.5em] text-white/90">Live <span className="text-emerald-400 ml-1">Now</span></span>
          </div>

          <div className="drop-shadow-[0_30px_60px_rgba(0,0,0,0.8)]">
            <h1 className="text-6xl md:text-[10rem] text-jumbotron tracking-tighter leading-[0.9] uppercase italic">
              Lunara
            </h1>
            <h1 className="text-6xl md:text-[10rem] text-jumbotron tracking-tighter leading-[0.9] uppercase italic opacity-90">
              Sports
            </h1>
          </div>

          <p className="max-w-xl mx-auto text-sm md:text-base font-medium text-white/90 leading-relaxed tracking-wide">
            Live scores, real-time stats, and ML-powered picks<br className="hidden md:block" /> across every league that matters.
          </p>

          <div className="pt-6 flex justify-center gap-8">
            <button
              onClick={handleEnterArena}
              className="group relative px-16 py-7 rounded-2xl bg-white text-black font-black uppercase tracking-[0.4em] text-[14px] transition-all duration-500 shadow-[0_20px_50px_rgba(255,255,255,0.15)] hover:shadow-[0_0_60px_rgba(255,255,255,0.4)] hover:scale-105 active:scale-95 z-20 overflow-hidden text-center"
            >
              <div className="absolute inset-0 border-t-4 border-white/40 border-l-2 border-white/20 border-r-2 border-black/10 border-b-4 border-black/20 rounded-2xl pointer-events-none" />
              <span className="relative z-10">Enter Arena</span>
            </button>
            <Link
              to="/standings"
              className="group relative px-16 py-7 rounded-2xl liquid-mirror text-white font-black uppercase tracking-[0.4em] text-[14px] hover:border-white/30 transition-all z-20 rim-light shadow-2xl gloss-sweep flex items-center justify-center"
            >
              <span className="relative z-10">Standings</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Below hero — contained width */}
      <div className="space-y-32 pb-40 max-w-[1400px] mx-auto px-4">

      {/* League Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        <FeatureCard
          icon={Trophy}
          title="NBA"
          desc="Live play-by-play, box scores, player profiles, and league-wide stat leaders."
          link="/scoreboard"
          delay="0s"
          color="var(--accent-warm)"
          image={BRANDING_IMAGES.logos.nba}
          transitionImage={BRANDING_IMAGES.sites.nba}
        />
        <FeatureCard
          icon={Target}
          title="MLB"
          desc="Pitch tracking, batting splits, and diamond analytics. Coming Spring 2026."
          link="/scoreboard"
          delay="0.2s"
          color="#10b981"
          image={BRANDING_IMAGES.logos.mlb}
          transitionImage={BRANDING_IMAGES.sites.mlb}
        />
        <FeatureCard
          icon={Activity}
          title="NFL"
          desc="Drive charts, snap counts, and matchup breakdowns. Coming Fall 2026."
          link="/scoreboard"
          delay="0.4s"
          color="var(--accent-alt)"
          image={BRANDING_IMAGES.logos.nfl}
          transitionImage={BRANDING_IMAGES.sites.nfl}
        />
      </div>

      {/* What We Offer */}
      <div className="pb-40">
        <div className="liquid-mirror rounded-[5rem] p-16 md:p-24 relative overflow-hidden group shadow-[inset_0_0_150px_rgba(0,0,0,0.8)] border-white/5 luxury-edge deep-occlusion">
           <img src={BRANDING_IMAGES.transitions.main1} alt="" className="absolute inset-0 w-full h-full object-cover opacity-15 group-hover:opacity-30 transition-opacity duration-[2s]" />
           <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent" />

           <div className="relative z-10">
              <div className="space-y-10">
                 <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-sm font-black uppercase tracking-[0.3em] text-indigo-400">
                    <Shield className="h-3 w-3" /> What We Do
                 </div>

                 <h2 className="text-5xl md:text-7xl text-jumbotron leading-[0.85] uppercase">
                    Sports<br />Intelligence
                 </h2>

                 <p className="text-sm text-white/80 leading-relaxed max-w-lg">
                    Lunara Sports is a free platform for fans who want more than just a score. We provide real-time play-by-play feeds, deep player analytics, and league-wide stat tracking — all in one place.
                 </p>

                 <div className="grid grid-cols-1 gap-5">
                    <div className="flex gap-4 items-start">
                       <div className="h-10 w-10 shrink-0 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-indigo-400">
                          <BarChart2 className="h-5 w-5" />
                       </div>
                       <div>
                          <h4 className="text-sm font-black text-white uppercase tracking-widest mb-1">Live Stats & Scores</h4>
                          <p className="text-sm text-white/80 leading-relaxed">Real-time scoreboards, box scores, and play-by-play across NBA — with MLB and NFL on the way.</p>
                       </div>
                    </div>

                    <div className="flex gap-4 items-start">
                       <div className="h-10 w-10 shrink-0 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-emerald-400">
                          <Brain className="h-5 w-5" />
                       </div>
                       <div>
                          <h4 className="text-sm font-black text-white uppercase tracking-widest mb-1">ML-Powered Picks</h4>
                          <p className="text-sm text-white/80 leading-relaxed">Our Sport-suite models analyze 100+ features per prop across 7 sportsbooks to find edges others miss. Player points and rebounds picks with verified win rates.</p>
                       </div>
                    </div>

                    <div className="flex gap-4 items-start">
                       <div className="h-10 w-10 shrink-0 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-orange-400">
                          <Users className="h-5 w-5" />
                       </div>
                       <div>
                          <h4 className="text-sm font-black text-white uppercase tracking-widest mb-1">Player Profiles</h4>
                          <p className="text-sm text-white/80 leading-relaxed">Full rosters for all 30 teams. Season averages, recent game logs, shooting splits, and performance trends for every player.</p>
                       </div>
                    </div>
                 </div>

                 <button
                    onClick={handleEnterArena}
                    className="flex items-center gap-6 group/btn text-sm font-black uppercase tracking-[0.5em] text-white/80 hover:text-indigo-400 transition-all pt-4"
                 >
                    Get Started <ChevronRight className="h-5 w-5 group-hover/btn:translate-x-4 transition-transform" />
                 </button>
              </div>

           </div>
        </div>
      </div>
      </div>
    </div>
  );
}
