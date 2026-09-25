import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  Search, Settings, Volume2, VolumeX, Sun, X as CloseIcon, Eye, FileText, ChevronRight,
  Shield, Wifi, Monitor, Home, Calendar, ListOrdered, TrendingUp, BarChart3, Users, User
} from 'lucide-react';
import { BottomNav } from '@/components/sport/BottomNav';
import { ScoreTicker } from '@/components/sport/ScoreTicker';
import { CommandBar } from '@/components/ui/CommandBar';
import { JumbotronAlert } from '@/components/sport/JumbotronAlert';
import { Segmented } from '@/components/ui/Segmented';
import { useTheme } from '@/context/ThemeContext';
import { BRANDING_IMAGES } from '@/constants/branding';
import { TEAM_COLORS } from '@/utils/teamColors';

const ALL_TEAMS = Object.keys(TEAM_COLORS);

const NAV_LINKS = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/scoreboard', label: 'Scoreboard', icon: Calendar },
  { path: '/standings', label: 'Standings', icon: ListOrdered },
  { path: '/picks', label: 'Picks', icon: TrendingUp },
  { path: '/stats', label: 'Stats', icon: BarChart3 },
  { path: '/teams', label: 'Teams', icon: Users },
  { path: '/players', label: 'Players', icon: User }
];

const FONT_SIZE_OPTIONS = [
  { id: 'sm', label: 'S' },
  { id: 'md', label: 'M' },
  { id: 'lg', label: 'L' }
];

const REFRESH_OPTIONS = [
  { id: 15, label: '15s' },
  { id: 30, label: '30s' },
  { id: 60, label: '60s' }
];

const TIMEZONE_OPTIONS = [
  { id: 'local', label: 'Local' },
  { id: 'ET', label: 'ET' },
  { id: 'CT', label: 'CT' },
  { id: 'MT', label: 'MT' },
  { id: 'PT', label: 'PT' }
];

// The page grain (the one allowed ambient effect) tops out well under full opacity —
// arenaIntensity (0..1) is scaled into this ceiling rather than driving a decorative
// glow that no longer exists.
const GRAIN_MAX_OPACITY = 0.12;

const AppLayout = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const location = useLocation();
  const {
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
  const [activeAlert] = useState(null);

  // Close menus on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setSettingsOpen(false);
  }, [location.pathname]);

  const isActive = (path) => location.pathname === path;

  const handleNavClick = () => {
    playGlassClick();
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} className="bg-surface-0">

      {/* Skip to Content */}
      <a href="#main-content" className="skip-to-content">Skip to content</a>

      {/* Page background: flat surface + grain texture only. The "Background texture"
          setting drives this layer's opacity directly (0 - GRAIN_MAX_OPACITY) — it's
          the one allowed ambient effect, so the control now does something real. */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, pointerEvents: 'none' }} className="bg-surface-0">
        <div
          data-testid="page-grain"
          className="texture-grain absolute inset-0 mix-blend-overlay"
          style={{ opacity: arenaIntensity * GRAIN_MAX_OPACITY }}
        />
      </div>

      {/* Cinematic Transition Overlay */}
      {isTransitioning && (
        <div
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200, backgroundColor: 'var(--text-1)' }}
          className="animate-flash flex flex-col items-center justify-center"
        >
          <div className="absolute inset-0 z-0 overflow-hidden">
            <img
              src={transitionImage || BRANDING_IMAGES.transitions.main1}
              alt=""
              className="w-full h-full object-cover animate-scaleIn transition-transform duration-1000"
            />
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'var(--text-1)', opacity: 0.4, mixBlendMode: 'overlay' }} />
          </div>
          <div className="flex flex-col items-center gap-8 animate-fadeIn relative z-10">
            <div className="h-32 w-32 rounded-lg bg-surface-2 border border-border flex items-center justify-center overflow-hidden relative">
              <img src={BRANDING_IMAGES.logos.general} alt="" className="absolute inset-0 w-full h-full object-cover opacity-80" />
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="t-section" style={{ color: 'var(--surface-0)' }}>Lunara Sports</span>
              <div className="h-1 w-48 rounded-sm overflow-hidden" style={{ backgroundColor: 'color-mix(in srgb, var(--surface-0) 20%, transparent)' }}>
                <div className="h-full animate-progress" style={{ backgroundColor: 'var(--surface-0)' }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SCROLLABLE CONTENT — everything scrolls together */}
      <div style={{ flex: '1 1 0%', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', position: 'relative', zIndex: 30, WebkitOverflowScrolling: 'touch' }}>

        {/* UPPER NAV — scrolls with content. Frosted glass is allowed here (top bar). */}
        <div style={{ position: 'relative', zIndex: 40, padding: '8px 12px 0' }}>
          <div className="max-w-[1800px] mx-auto">
            <div className="relative bg-surface-1/90 backdrop-blur-xl border border-border rounded-lg">
              <div className="relative h-14 sm:h-20 px-4 sm:px-8 flex items-center justify-between">
                <Link to="/" onClick={handleNavClick} className="flex items-center gap-3 sm:gap-4">
                  <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-md bg-surface-2 border border-border flex items-center justify-center overflow-hidden shrink-0">
                    <img src={BRANDING_IMAGES.logos.general} alt="" className="w-full h-full object-cover opacity-80" />
                  </div>
                  <span className="t-section text-text-1">Lunara Sports</span>
                </Link>

                <nav aria-label="Primary" className="hidden lg:flex items-center gap-1 bg-surface-0/40 p-1 rounded-md border border-border">
                  {NAV_LINKS.map(link => {
                    const active = isActive(link.path);
                    return (
                      <Link
                        key={link.path}
                        to={link.path}
                        onClick={handleNavClick}
                        className={`h-10 px-4 flex items-center gap-2 rounded-md t-small transition-colors duration-500 ${active ? 'bg-accent-fill text-white' : 'text-text-2 hover:text-text-1 hover:bg-surface-2'}`}
                      >
                        <link.icon className="h-4 w-4" />
                        <span>{link.label}</span>
                      </Link>
                    );
                  })}
                </nav>

                <div className="flex items-center gap-2 sm:gap-3">
                  <button
                    aria-label="Open search"
                    onClick={() => { playGlassClick(); window.dispatchEvent(new KeyboardEvent('keydown', { 'metaKey': true, 'key': 'k' })); }}
                    className="h-9 w-9 sm:h-11 sm:w-11 flex items-center justify-center rounded-md bg-surface-2 border border-border text-text-3 hover:text-text-1 transition-colors"
                  >
                    <Search className="h-4 w-4 sm:h-5 sm:w-5" />
                  </button>
                  <button
                    aria-label="Open settings"
                    onClick={() => { playGlassClick(); setSettingsOpen(true); }}
                    className="group/settings h-9 w-9 sm:h-11 sm:w-11 flex items-center justify-center rounded-md bg-surface-2 border border-border text-text-3 hover:text-text-1 transition-colors"
                  >
                    <Settings className={`h-4 w-4 sm:h-5 sm:w-5 group-hover/settings:rotate-180 transition-transform duration-[1.5s] ${settingsOpen ? 'text-accent' : ''}`} />
                  </button>
                  <button
                    aria-label="Toggle navigation menu"
                    className="lg:hidden h-9 w-9 sm:h-11 sm:w-11 flex flex-col items-center justify-center gap-1.5 rounded-md bg-surface-2 border border-border"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  >
                    <div className={`h-0.5 w-5 bg-text-2 transition-transform ${mobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`} />
                    <div className={`h-0.5 bg-text-2 transition-opacity ${mobileMenuOpen ? 'opacity-0 w-4' : 'w-4'}`} />
                    <div className={`h-0.5 w-5 bg-text-2 transition-transform ${mobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SCORE TICKER — scrolls with content */}
        <div style={{ position: 'relative', zIndex: 40, padding: '4px 12px 8px' }}>
          <div className="max-w-[1800px] mx-auto">
            <ScoreTicker />
          </div>
        </div>

        {/* Settings Drawer */}
        {settingsOpen && (
          <>
            <div className="fixed inset-0 z-[200] bg-surface-0/60 animate-fadeIn" onClick={() => setSettingsOpen(false)} aria-hidden="true" />
            <div className="fixed top-0 right-0 bottom-0 w-80 bg-surface-1 z-[210] shadow-2xl border-l border-border animate-slideInRight flex flex-col" role="dialog" aria-label="Settings" aria-modal="true">
              <div className="p-6 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-md bg-accent/10 flex items-center justify-center">
                    <Settings className="h-4 w-4 text-accent" />
                  </div>
                  <h2 className="t-section text-text-1">Settings</h2>
                </div>
                <button onClick={() => setSettingsOpen(false)} aria-label="Close menu" className="p-2 hover:bg-surface-2 rounded-md transition-colors">
                  <CloseIcon className="h-5 w-5 text-text-3" />
                </button>
              </div>

              <div className="p-6 flex-1 overflow-y-auto space-y-8 scrollbar-thin">

                {/* 1. Display */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="t-label text-text-3">Display</span>
                    <Monitor className="h-3.5 w-3.5 text-text-3" />
                  </div>
                  <div className="space-y-3">
                    <div>
                      <span className="t-label text-text-3 block mb-2">Font size</span>
                      <Segmented options={FONT_SIZE_OPTIONS} value={fontSize} onChange={updateFontSize} />
                    </div>
                    <button
                      onClick={toggleReducedMotion}
                      className="w-full flex items-center justify-between p-3 rounded-md border border-border bg-surface-2 hover:border-border-strong transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Eye className="h-4 w-4 text-text-3" />
                        <span className="t-small text-text-2">Reduced motion</span>
                      </div>
                      <div className={`h-2 w-2 rounded-sm ${reducedMotion ? 'bg-accent' : 'bg-border-strong'}`} />
                    </button>
                  </div>
                </section>

                {/* 2. Sound */}
                <section className="space-y-3">
                  <span className="t-label text-text-3">Sound</span>
                  <button
                    onClick={toggleSound}
                    className="w-full flex items-center justify-between p-3 rounded-md border border-border bg-surface-2 hover:border-border-strong transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-md bg-surface-1 border border-border flex items-center justify-center">
                        {soundEnabled ? <Volume2 className="h-4 w-4 text-accent" /> : <VolumeX className="h-4 w-4 text-loss" />}
                      </div>
                      <span className="t-small text-text-1">{soundEnabled ? 'On' : 'Muted'}</span>
                    </div>
                    <div className={`h-2 w-2 rounded-sm ${soundEnabled ? 'bg-accent' : 'bg-border-strong'}`} />
                  </button>
                </section>

                {/* 3. Background texture — controls the page grain layer's opacity */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="t-label text-text-3">Background texture</span>
                    <Sun className="h-3.5 w-3.5 text-text-3" />
                  </div>
                  <div className="p-4 rounded-md border border-border bg-surface-2">
                    <input
                      type="range" min="0" max="1" step="0.1"
                      value={arenaIntensity}
                      onChange={(e) => updateIntensity(parseFloat(e.target.value))}
                      className="w-full cursor-pointer accent-[var(--accent)]"
                    />
                    <div className="flex justify-between mt-3 t-label text-text-3">
                      <span className="tnum">0%</span>
                      <span className="text-accent tnum">{(arenaIntensity * 100).toFixed(0)}%</span>
                      <span className="tnum">100%</span>
                    </div>
                  </div>
                </section>

                {/* 4. Favorite team — all 30 teams */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="t-label text-text-3">Favorite team</span>
                    {favoriteTeam && (
                      <button
                        onClick={() => selectFavoriteTeam(null)}
                        className="t-label text-loss hover:text-loss"
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
                        className={`h-10 rounded-md border t-label transition-colors ${favoriteTeam === team ? 'bg-accent-fill text-white border-transparent' : 'bg-surface-2 border-border text-text-3 hover:border-border-strong hover:text-text-2'}`}
                      >
                        {team}
                      </button>
                    ))}
                  </div>
                </section>

                {/* 5. Data */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="t-label text-text-3">Data</span>
                    <Wifi className="h-3.5 w-3.5 text-text-3" />
                  </div>
                  <div className="space-y-3">
                    <div>
                      <span className="t-label text-text-3 block mb-2">Refresh interval</span>
                      <Segmented options={REFRESH_OPTIONS} value={refreshInterval} onChange={updateRefreshInterval} />
                    </div>
                    <div>
                      <span className="t-label text-text-3 block mb-2">Timezone</span>
                      <Segmented options={TIMEZONE_OPTIONS} value={timezone} onChange={updateTimezone} />
                    </div>
                  </div>
                </section>

                {/* 6. Settings */}
                <section className="space-y-3">
                  <span className="t-label text-text-3">Settings</span>
                  <div className="space-y-2">
                    <Link
                      to="/terms"
                      onClick={() => setSettingsOpen(false)}
                      className="flex items-center justify-between p-3 rounded-md hover:bg-surface-2 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-text-3 group-hover:text-accent transition-colors" />
                        <span className="t-small text-text-2 group-hover:text-text-1 transition-colors">Terms &amp; Conditions</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-text-3 group-hover:text-text-2 transition-colors" />
                    </Link>
                    <Link
                      to="/privacy"
                      onClick={() => setSettingsOpen(false)}
                      className="flex items-center justify-between p-3 rounded-md hover:bg-surface-2 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <Shield className="h-4 w-4 text-text-3 group-hover:text-accent transition-colors" />
                        <span className="t-small text-text-2 group-hover:text-text-1 transition-colors">Privacy Policy</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-text-3 group-hover:text-text-2 transition-colors" />
                    </Link>
                  </div>
                </section>
              </div>
            </div>
          </>
        )}

        {/* Mobile Navigation Overlay */}
        {mobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 lg:hidden z-[60] bg-surface-0/70 animate-fadeIn"
              onClick={() => setMobileMenuOpen(false)}
            ></div>

            <div className="fixed top-0 right-0 bottom-0 w-[85vw] bg-surface-1 lg:hidden z-[70] shadow-2xl animate-slideInRight border-l border-border">
              <div className="flex items-center justify-between p-6 border-b border-border">
                <h2 className="t-section text-text-1">Menu</h2>
                <button
                  aria-label="Close menu"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-md hover:bg-surface-2 transition"
                >
                  <CloseIcon className="h-5 w-5 text-text-3" />
                </button>
              </div>

              <nav className="flex flex-col p-4 space-y-2">
                {NAV_LINKS.map(link => (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 t-body p-4 rounded-md transition-colors ${isActive(link.path) ? 'bg-accent-fill text-white' : 'text-text-2 hover:text-text-1 hover:bg-surface-2'}`}
                  >
                    <link.icon className="h-4 w-4" />
                    <span>{link.label}</span>
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
          className="flex-1 relative z-30 pb-24 md:pb-10"
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
