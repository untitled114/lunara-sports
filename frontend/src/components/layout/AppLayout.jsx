import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { BottomNav } from '@/components/sport/BottomNav';
import { ScoreTicker } from '@/components/sport/ScoreTicker';
import { CommandBar } from '@/components/ui/CommandBar';
import { JumbotronAlert } from '@/components/sport/JumbotronAlert';
import { useTheme } from '@/context/ThemeContext';
import { BRANDING_IMAGES } from '@/constants/branding';
import { TopBar } from './TopBar';
import { MenuPanel } from './MenuPanel';

// The page grain sits on top of the arena backdrop at a fixed, faint opacity. The
// "Background glow" setting (arenaIntensity, 0..1) drives the glow washes instead, as it
// did before the redesign.
const GRAIN_OPACITY = 0.05;
// The glow washes' opacity is the setting times this cap: base drew them at the raw setting
// (0.4 by default), which put the brightest backdrop spots near luminance 0.058, too bright
// for --text-2 at 4.5:1. At 0.7 the default (40%) peaks near 0.045 and holds AA; the
// slider still reaches a brighter glow when a viewer asks for it.
const GLOW_SCALE = 0.7;

const AppLayout = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const location = useLocation();
  const { accentColors, arenaIntensity } = useTheme();
  const [activeAlert] = useState(null);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  // Close the menu panel on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // "/" (outside a text field) and Ctrl+K / Cmd+K open search; not while the menu panel is
  // open (search would open hidden behind it).
  useEffect(() => {
    if (menuOpen) return undefined;
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((o) => !o);
        return;
      }
      const el = e.target;
      const typing = el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
      if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: 'var(--backdrop)' }}>

      {/* Skip to Content */}
      <a href="#main-content" className="skip-to-content">Skip to content</a>

      {/* Arena backdrop, as the original site drew it: the leather arena photo at
          40%, darkened toward the bottom, three glow washes (top-left follows the favorite
          or home team) whose strength is the "Background glow" setting, a faint grain and
          a vignette at the edges. Fixed behind the scroller; nothing here takes pointer events. */}
      <div data-testid="arena-backdrop" aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, pointerEvents: 'none', backgroundColor: 'var(--backdrop)' }}>
        <img src={BRANDING_IMAGES.backdrop} alt="" width={1920} height={1080} className="w-full h-full object-cover opacity-40" />
        <div
          className="absolute inset-0"
          style={{ backgroundImage: 'linear-gradient(to bottom, color-mix(in srgb, var(--backdrop) 30%, transparent), color-mix(in srgb, var(--backdrop) 60%, transparent), var(--backdrop))' }}
        />
        <div
          data-testid="arena-glow"
          className="absolute inset-0"
          style={{
            opacity: arenaIntensity * GLOW_SCALE,
            transition: 'opacity 1s',
            backgroundImage: `radial-gradient(circle at 0% 0%, ${accentColors?.primary || 'var(--glow-1)'} 0px, transparent 60%), radial-gradient(circle at 100% 0%, var(--glow-2) 0px, transparent 60%), radial-gradient(at 50% 100%, var(--glow-3) 0px, transparent 50%)`
          }}
        />
        <div
          data-testid="page-grain"
          className="page-grain absolute inset-0 mix-blend-overlay"
          style={{ opacity: GRAIN_OPACITY }}
        />
        <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 150px color-mix(in srgb, var(--backdrop) 90%, transparent)' }} />
      </div>


      {/* SCROLLABLE CONTENT - everything scrolls together */}
      <div data-testid="page-scroller" style={{ flex: '1 1 0%', minHeight: 0, overflowY: menuOpen ? 'hidden' : 'auto', overflowX: 'hidden', position: 'relative', zIndex: 30, WebkitOverflowScrolling: 'touch' }}>

        {/* Top bar - scrolls with content */}
        <div style={{ position: 'relative', zIndex: 40, padding: '8px 12px 0' }}>
          <div className="max-w-[1100px] mx-auto">
            <TopBar onOpenMenu={() => setMenuOpen(true)} onOpenSearch={() => setSearchOpen(true)} menuButtonRef={menuButtonRef} />
          </div>
        </div>

        {/* SCORE TICKER - scrolls with content */}
        <div style={{ position: 'relative', zIndex: 40, padding: '8px 12px 8px' }}>
          <div className="max-w-[1100px] mx-auto">
            <ScoreTicker />
          </div>
        </div>

        <MenuPanel open={menuOpen} onClose={closeMenu} onOpenSearch={() => setSearchOpen(true)} />

        <JumbotronAlert
          message={activeAlert?.message}
          subtext={activeAlert?.subtext}
        />

        <CommandBar open={searchOpen} onOpenChange={setSearchOpen} />

        {/* Main Content Area */}
        <main
          id="main-content"
          className="flex-1 relative z-30 pb-24 md:pb-10"
        >
          {location.pathname === '/' ? (
            <Outlet />
          ) : (
            <div className="w-full max-w-[1100px] mx-auto px-4 sm:px-6 py-8">
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
