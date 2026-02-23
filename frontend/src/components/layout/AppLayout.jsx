import React, { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Search, Settings, Volume2, VolumeX, Sun, X as CloseIcon, Cpu, Activity, Wifi, Shield, Zap, Globe, Layers, FileText, ChevronRight, Monitor, Eye } from 'lucide-react';
import { BottomNav } from '@/components/sport/BottomNav';
import { ScoreTicker } from '@/components/sport/ScoreTicker';
import { CommandBar } from '@/components/ui/CommandBar';
import { JumbotronAlert } from '@/components/sport/JumbotronAlert';
import { useTheme } from '@/context/ThemeContext';
import { BRANDING_IMAGES } from '@/constants/branding';
import { TEAM_COLORS } from '@/utils/teamColors';

const ALL_TEAMS = Object.keys(TEAM_COLORS);

function SegmentedControl({ options, value, onChange }) {
  return (
    <div className="flex rounded-xl overflow-hidden border border-white/10">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 py-2.5 px-3 text-[10px] font-black uppercase tracking-widest transition-all ${
            value === opt.value
              ? 'bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.3)]'
              : 'bg-white/5 text-white/30 hover:text-white/60 hover:bg-white/10'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

const AppLayout = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const location = useLocation();
  const {
    accentColors,
    playGlassClick,
    playThud,
    isTransitioning,
    transitionImage,
    soundEnabled,
    toggleSound,
    arenaIntensity,
    updateIntensity,
    favoriteTeam,
    selectFavoriteTeam,
    fontSize,
    updateFontSize,
    reducedMotion,
    toggleReducedMotion,
    refreshInterval,
    updateRefreshInterval,
    timezone,
    updateTimezone
  } = useTheme();
  const [activeAlert, setActiveAlert] = useState(null);

  // Close menus on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setSettingsOpen(false);
  }, [location.pathname]);

  const isActive = (path) => location.pathname === path;
  const isGameDetail = false; // Always show top nav

  const handleNavClick = () => {
    playGlassClick();
  };

  const NAV_LINKS = [
    { path: '/', label: 'Home', icon: Cpu },
    { path: '/scoreboard', label: 'Scores', icon: Activity },
    { path: '/standings', label: 'Grid', icon: Shield },
    { path: '/teams', label: 'Nodes', icon: Globe },
    { path: '/stats', label: 'Data', icon: Zap }
  ];

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', backgroundColor: '#000105' }}>

      {/* Skip to Content */}
      <a href="#main-content" className="skip-to-content">Skip to content</a>

      {/* Background layers — fixed to viewport */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <img src="/branding/background-1-alt.jpg" alt="" className="w-full h-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#000105]/30 via-[#000105]/60 to-[#000105]" />
      </div>
      <div
        className="fixed inset-0 pointer-events-none transition-opacity duration-1000 z-0"
        style={{
          opacity: arenaIntensity,
          backgroundImage: `
            radial-gradient(circle at 0% 0%, ${accentColors.primary} 0px, transparent 60%),
            radial-gradient(circle at 100% 0%, var(--accent-alt) 0px, transparent 60%),
            radial-gradient(at 50% 100%, var(--accent-warm) 0px, transparent 50%)
          `
        }}
      />
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-0 texture-grain mix-blend-overlay" />
      <div className="fixed inset-0 pointer-events-none opacity-10 z-0 texture-mesh" />
      <div className="fixed inset-0 pointer-events-none shadow-[inset_0_0_150px_rgba(0,0,0,0.9)] z-0" />

      {/* Cinematic Transition Overlay */}
      {isTransitioning && (
        <div className="fixed inset-0 z-[200] bg-white animate-flash flex flex-col items-center justify-center">
           <div className="absolute inset-0 z-0 overflow-hidden">
              <img
                src={transitionImage || BRANDING_IMAGES.transitions.main1}
                alt=""
                className="w-full h-full object-cover animate-scaleIn transition-all duration-1000"
              />
              <div className="absolute inset-0 bg-white/40 mix-blend-overlay" />
           </div>
           <div className="flex flex-col items-center gap-8 animate-fadeIn relative z-10">
              <div className="h-32 w-32 rounded-[2.5rem] bg-black flex items-center justify-center shadow-[0_0_50px_rgba(255,255,255,0.2)] border border-white/10 overflow-hidden relative">
                 <img src={BRANDING_IMAGES.logos.general} alt="Lunara" className="absolute inset-0 w-full h-full object-cover opacity-80" />
                 <span className="relative z-10 text-white font-black text-6xl italic mix-blend-difference">L</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                 <span className="text-[11px] font-black text-black uppercase tracking-[1em] ml-4 drop-shadow-xl">Lunara Sports</span>
                 <div className="h-1 w-48 bg-black/20 rounded-full overflow-hidden backdrop-blur-md">
                    <div className="h-full bg-black animate-progress" />
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* HEADER — Disabled for now */}
      <header style={{ display: 'none' }}>
          <div className="max-w-[1800px] mx-auto flex flex-col gap-2">

            {/* Upper Deck: Brand & Primary Navigation */}
            <div className="relative group/header">
              {/* Outer Shell */}
              <div className="absolute inset-0 bg-[#050a18]/90 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden">
                <div className="absolute inset-0 texture-mesh opacity-5" />
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent" />

                {/* Hardware Details (Industrial "Personality") */}
                <div className="absolute top-4 left-4 flex gap-1 opacity-20">
                  <div className="h-1 w-1 rounded-full bg-white" />
                  <div className="h-1 w-1 rounded-full bg-white" />
                </div>
                <div className="absolute top-4 right-4 flex gap-1 opacity-20">
                  <div className="h-1 w-1 rounded-full bg-white" />
                  <div className="h-1 w-1 rounded-full bg-white" />
                </div>
                <div className="absolute bottom-4 left-4 flex gap-1 opacity-20">
                  <div className="h-1 w-1 rounded-full bg-white" />
                  <div className="h-1 w-1 rounded-full bg-white" />
                </div>
                <div className="absolute bottom-4 right-4 flex gap-1 opacity-20">
                  <div className="h-1 w-1 rounded-full bg-white" />
                  <div className="h-1 w-1 rounded-full bg-white" />
                </div>
              </div>

              <div className="relative h-20 px-8 flex items-center justify-between">
                {/* LOGO MODULE */}
                <Link to="/" onClick={handleNavClick} className="flex items-center gap-5 group/logo">
                  <div className="relative">
                    <div className="absolute -inset-2 bg-indigo-500/20 blur-xl opacity-0 group-hover/logo:opacity-100 transition-opacity" />
                    <div className="h-14 w-14 rounded-2xl bg-black border border-white/10 flex items-center justify-center shadow-2xl relative overflow-hidden ring-1 ring-white/5">
                      <img src={BRANDING_IMAGES.logos.general} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />
                      <span className="relative z-10 text-white font-black italic text-2xl mix-blend-difference">L</span>
                    </div>
                  </div>
                  <div className="flex flex-col leading-none">
                    <div className="flex items-baseline gap-2 group-hover:text-indigo-400 transition-colors">
                      <span className="text-2xl font-black text-white tracking-tighter uppercase italic">Lunara</span>
                      <span className="text-xl font-black text-white/80 tracking-tighter uppercase italic">Sports</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="h-1 w-1 rounded-full bg-indigo-500 animate-pulse" />
                      <span className="text-[10px] font-black text-white/70 uppercase tracking-[0.5em]">Intelligence Station</span>
                    </div>
                  </div>
                </Link>

                {/* TACTICAL NAVIGATION */}
                <nav className="hidden lg:flex items-center gap-2 bg-black/40 p-1.5 rounded-2xl border border-white/5 shadow-inner">
                  {NAV_LINKS.map(link => {
                    const active = isActive(link.path);
                    return (
                      <Link
                        key={link.path}
                        to={link.path}
                        onClick={handleNavClick}
                        className={`relative h-12 px-8 flex items-center gap-3 rounded-xl transition-all duration-500 group/nav ${
                          active ? 'bg-white text-black shadow-2xl' : 'text-white/40 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <link.icon className={`h-4 w-4 ${active ? 'text-black' : 'text-indigo-400/60 group-hover/nav:text-indigo-400'} transition-colors`} />
                        <span className="text-[13px] font-black uppercase tracking-widest">{link.label}</span>

                        {/* Dynamic Active Indicator */}
                        {active && (
                          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white shadow-[0_0_10px_white]" />
                        )}
                      </Link>
                    );
                  })}
                </nav>

                {/* SYSTEM DIAGNOSTICS */}
                <div className="flex items-center gap-6">
                  <div className="hidden xl:flex flex-col items-end border-r border-white/5 pr-6">
                    <span className="text-[9px] font-black text-white/70 uppercase tracking-[0.4em] mb-1">System Frequency</span>
                    <div className="flex items-center gap-3">
                      <div className="flex gap-0.5">
                        {[1,2,3,4].map(i => <div key={i} className={`h-2.5 w-0.5 rounded-full ${i <= 3 ? 'bg-indigo-500' : 'bg-white/10'}`} />)}
                      </div>
                      <span className="text-xs font-black text-indigo-400 tabular-nums">142.8 MHZ</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { playGlassClick(); window.dispatchEvent(new KeyboardEvent('keydown', { 'metaKey': true, 'key': 'k' })); }}
                      className="h-12 w-12 flex items-center justify-center rounded-xl bg-white/5 border border-white/5 text-white/30 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all shadow-xl"
                    >
                      <Search className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => { playGlassClick(); setSettingsOpen(true); }}
                      className="h-12 w-12 flex items-center justify-center rounded-xl bg-white/5 border border-white/5 text-white/30 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all shadow-xl group/settings"
                    >
                      <Settings className={`h-5 w-5 group-hover/settings:rotate-180 transition-transform duration-[1.5s] ${settingsOpen ? 'text-indigo-400' : ''}`} />
                    </button>
                  </div>

                  {/* Mobile Trigger */}
                  <button
                    className="lg:hidden h-12 w-12 flex flex-col items-center justify-center gap-1.5 rounded-xl bg-white/5 border border-white/5"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  >
                    <div className={`h-0.5 bg-white/60 transition-all ${mobileMenuOpen ? 'w-6 rotate-45 translate-y-2' : 'w-6'}`} />
                    <div className={`h-0.5 bg-white/60 transition-all ${mobileMenuOpen ? 'opacity-0' : 'w-4'}`} />
                    <div className={`h-0.5 bg-white/60 transition-all ${mobileMenuOpen ? 'w-6 -rotate-45 -translate-y-2' : 'w-6'}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Lower Deck: The Data Stream Console */}
            <div className="relative">
              <div className="absolute inset-0 bg-[#050a18]/90 backdrop-blur-3xl border border-white/10 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden">
                <div className="absolute inset-0 texture-mesh opacity-[0.02]" />
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/[0.02] to-transparent" />
              </div>

              <div className="relative">
                <ScoreTicker />
              </div>
            </div>

          </div>
        </header>

      {/* SCROLLABLE CONTENT — this is the only thing that scrolls */}
      <div style={{ flex: '1 1 0%', overflowY: 'auto', overflowX: 'clip', position: 'relative', zIndex: 30 }}>
        {/* Settings Drawer */}
        {settingsOpen && (
          <>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] animate-fadeIn" onClick={() => setSettingsOpen(false)} aria-hidden="true" />
            <div className="fixed top-0 right-0 bottom-0 w-80 bg-[#050a18] z-[210] shadow-2xl border-l border-white/10 animate-slideInRight flex flex-col" role="dialog" aria-label="Settings" aria-modal="true">
              <div className="p-10 border-b border-white/5 flex items-center justify-between bg-white/5 relative overflow-hidden">
                 <img src={BRANDING_IMAGES.logos.general} alt="" className="absolute inset-0 w-full h-full object-cover opacity-10" />
                 <div className="flex items-center gap-4 relative z-10">
                    <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                       <Settings className="h-4 w-4 text-indigo-400" />
                    </div>
                    <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white">Console</h2>
                 </div>
                 <button onClick={() => setSettingsOpen(false)} className="p-2 hover:bg-white/5 rounded-xl transition-colors relative z-10">
                    <CloseIcon className="h-5 w-5 text-white/20" />
                 </button>
              </div>

              <div className="p-10 flex-1 overflow-y-auto space-y-12 scrollbar-hide">

                 {/* 1. Display */}
                 <section className="space-y-6">
                    <div className="flex items-center justify-between">
                       <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Display</span>
                       <Monitor className="h-3 w-3 text-indigo-400/40" />
                    </div>
                    <div className="space-y-4">
                       <div>
                          <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest block mb-3">Font Size</span>
                          <SegmentedControl
                            options={[
                              { value: 'sm', label: 'S' },
                              { value: 'md', label: 'M' },
                              { value: 'lg', label: 'L' },
                            ]}
                            value={fontSize}
                            onChange={updateFontSize}
                          />
                       </div>
                       <button
                         onClick={toggleReducedMotion}
                         className="w-full flex items-center justify-between p-4 rounded-xl deboss hover:border-indigo-500/30 transition-all group"
                       >
                         <div className="flex items-center gap-3">
                            <Eye className="h-4 w-4 text-white/30" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">Reduced Motion</span>
                         </div>
                         <div className={`h-2 w-2 rounded-full ${reducedMotion ? 'bg-indigo-500 shadow-[0_0_10px_indigo]' : 'bg-white/10'}`} />
                       </button>
                    </div>
                 </section>

                 {/* 2. Audio Hardware */}
                 <section className="space-y-6">
                    <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Audio Hardware</span>
                    <button
                      onClick={toggleSound}
                      className="w-full flex items-center justify-between p-5 rounded-[1.5rem] deboss hover:border-indigo-500/30 transition-all group"
                    >
                      <div className="flex items-center gap-4">
                         <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/5">
                            {soundEnabled ? <Volume2 className="h-5 w-5 text-indigo-400" /> : <VolumeX className="h-5 w-5 text-red-400" />}
                         </div>
                         <span className="text-xs font-bold uppercase tracking-widest text-white">{soundEnabled ? 'Active' : 'Muted'}</span>
                      </div>
                      <div className={`h-2 w-2 rounded-full ${soundEnabled ? 'bg-indigo-500 shadow-[0_0_10px_indigo] animate-pulse' : 'bg-white/10'}`} />
                    </button>
                 </section>

                 {/* 3. Visual Intensity */}
                 <section className="space-y-6">
                    <div className="flex items-center justify-between">
                       <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Visual Intensity</span>
                       <Sun className="h-3 w-3 text-indigo-400/40" />
                    </div>
                    <div className="p-8 rounded-[1.5rem] deboss border-white/5">
                       <input
                          type="range" min="0" max="1" step="0.1"
                          value={arenaIntensity}
                          onChange={(e) => updateIntensity(parseFloat(e.target.value))}
                          className="w-full accent-indigo-500 cursor-pointer"
                       />
                       <div className="flex justify-between mt-6 text-[9px] font-black uppercase text-white/20 tracking-widest tabular-nums">
                          <span>0%</span>
                          <span className="text-indigo-400">{(arenaIntensity * 100).toFixed(0)}% POWER</span>
                          <span>100%</span>
                       </div>
                    </div>
                 </section>

                 {/* 4. Node Affinity — all 30 teams */}
                 <section className="space-y-6">
                    <div className="flex items-center justify-between">
                       <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Node Affinity</span>
                       {favoriteTeam && (
                          <button
                            onClick={() => selectFavoriteTeam(null)}
                            className="text-[9px] font-bold uppercase tracking-widest text-red-400/60 hover:text-red-400 transition-colors"
                          >
                            Clear
                          </button>
                       )}
                    </div>
                    <div className="grid grid-cols-6 gap-2">
                       {ALL_TEAMS.map(team => (
                          <button
                            key={team}
                            onClick={() => selectFavoriteTeam(team)}
                            className={`h-10 rounded-lg border flex items-center justify-center text-[9px] font-black transition-all ${favoriteTeam === team ? 'bg-white text-black border-white shadow-2xl scale-110' : 'bg-white/5 border-white/5 text-white/20 hover:border-white/20'}`}
                          >
                            {team}
                          </button>
                       ))}
                    </div>
                 </section>

                 {/* 5. Data Uplink */}
                 <section className="space-y-6">
                    <div className="flex items-center justify-between">
                       <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Data Uplink</span>
                       <Wifi className="h-3 w-3 text-indigo-400/40" />
                    </div>
                    <div className="space-y-4">
                       <div>
                          <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest block mb-3">Refresh Interval</span>
                          <SegmentedControl
                            options={[
                              { value: 15, label: '15s' },
                              { value: 30, label: '30s' },
                              { value: 60, label: '60s' },
                            ]}
                            value={refreshInterval}
                            onChange={updateRefreshInterval}
                          />
                       </div>
                       <div>
                          <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest block mb-3">Timezone</span>
                          <SegmentedControl
                            options={[
                              { value: 'local', label: 'Local' },
                              { value: 'ET', label: 'ET' },
                              { value: 'CT', label: 'CT' },
                              { value: 'MT', label: 'MT' },
                              { value: 'PT', label: 'PT' },
                            ]}
                            value={timezone}
                            onChange={updateTimezone}
                          />
                       </div>
                    </div>
                 </section>

                 {/* 6. System Protocols */}
                 <section className="space-y-6">
                    <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">System Protocols</span>
                    <div className="space-y-2">
                       <Link
                         to="/terms"
                         onClick={() => setSettingsOpen(false)}
                         className="flex items-center justify-between p-4 rounded-xl deboss hover:bg-white/5 transition-all group"
                       >
                         <div className="flex items-center gap-3">
                            <FileText className="h-4 w-4 text-white/30 group-hover:text-indigo-400 transition-colors" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-white/60 group-hover:text-white transition-colors">Terms & Conditions</span>
                         </div>
                         <ChevronRight className="h-4 w-4 text-white/10 group-hover:text-white/30 transition-colors" />
                       </Link>
                       <Link
                         to="/privacy"
                         onClick={() => setSettingsOpen(false)}
                         className="flex items-center justify-between p-4 rounded-xl deboss hover:bg-white/5 transition-all group"
                       >
                         <div className="flex items-center gap-3">
                            <Shield className="h-4 w-4 text-white/30 group-hover:text-indigo-400 transition-colors" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-white/60 group-hover:text-white transition-colors">Privacy Policy</span>
                         </div>
                         <ChevronRight className="h-4 w-4 text-white/10 group-hover:text-white/30 transition-colors" />
                       </Link>
                    </div>
                 </section>
              </div>

              <div className="p-8 bg-black/40 border-t border-white/5 relative overflow-hidden">
                 <img src={BRANDING_IMAGES.transitions.brand2} alt="" className="absolute inset-0 w-full h-full object-cover opacity-5" />
                 <p className="relative z-10 text-[9px] font-black uppercase tracking-[0.5em] text-white/10 text-center italic">Hardware V1.04.2</p>
              </div>
            </div>
          </>
        )}

        {/* Mobile Navigation Overlay */}
        {mobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/80 backdrop-blur-md lg:hidden z-[60] animate-fadeIn"
              onClick={() => setMobileMenuOpen(false)}
            ></div>

            <div className="fixed top-0 right-0 bottom-0 w-[85vw] bg-[#050a18] lg:hidden z-[70] shadow-2xl animate-slideInRight border-l border-white/10">
              <div className="flex items-center justify-between p-8 border-b border-white/5">
                <div className="flex items-center gap-3">
                   <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10 font-black italic text-sm">L</div>
                   <h2 className="text-sm font-black text-white uppercase tracking-[0.3em]">Menu</h2>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-xl hover:bg-white/5 transition"
                >
                  <CloseIcon className="h-6 w-6 text-white/20" />
                </button>
              </div>

              <nav className="flex flex-col p-6 space-y-3">
                {[
                  { path: '/', label: 'Home' },
                  { path: '/scoreboard', label: 'Scoreboard' },
                  { path: '/standings', label: 'Standings' },
                  { path: '/teams', label: 'Teams' },
                  { path: '/stats', label: 'Stats' }
                ].map(link => (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`text-xl p-6 rounded-2xl transition-all uppercase tracking-widest font-black ${
                      isActive(link.path) ? 'bg-white text-black shadow-2xl translate-x-2' : 'text-white/20 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
          </>
        )}

        <JumbotronAlert 
          message={activeAlert?.message} 
          subtext={activeAlert?.subtext} 
        />

        <CommandBar />

        {/* Main Content Area */}
        <main
          id="main-content"
          className={`flex-1 relative z-30 pb-20`}
        >
          {location.pathname === '/' ? (
            <Outlet />
          ) : (
            <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-8 max-w-[1800px] mx-auto">
              <Outlet />
            </div>
          )}
        </main>

        {/* Bottom Navigation (mobile) */}
        <BottomNav />
      </div>
    </div>
  );
};

export default AppLayout;
