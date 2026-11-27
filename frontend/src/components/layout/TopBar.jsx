import { Link, useLocation } from 'react-router-dom';
import { Menu, Search, Home, Calendar, ListOrdered, BarChart3, Shield, User } from 'lucide-react';
import clsx from 'clsx';
import { BRANDING_IMAGES } from '@/constants/branding';

// Desktop page links; phones use the bottom bar and the menu panel instead.
const NAV_LINKS = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/scoreboard', label: 'Scoreboard', icon: Calendar },
  { path: '/standings', label: 'Standings', icon: ListOrdered },
  { path: '/stats', label: 'Stats', icon: BarChart3 },
  { path: '/teams', label: 'Teams', icon: Shield },
  { path: '/players', label: 'Players', icon: User },
];

// The top bar: the three-line menu button, the Lunara mark and wordmark, the page links
// (desktop) and a search field you can see (a search button on phones).
export function TopBar({ onOpenMenu, onOpenSearch, menuButtonRef }) {
  const { pathname } = useLocation();

  return (
    <div className="bg-surface-1 border border-border rounded-lg shadow-card">
      <div className="h-14 sm:h-16 px-2 sm:px-3 flex items-center gap-2 sm:gap-3">
        <button
          ref={menuButtonRef}
          type="button"
          onClick={onOpenMenu}
          aria-label="Open menu"
          className="h-11 w-11 shrink-0 flex items-center justify-center rounded-md border border-border bg-surface-2 text-text-1 hover:border-border-strong"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <img src={BRANDING_IMAGES.logos.general} alt="" width={36} height={36} className="h-9 w-9 rounded-md object-cover border border-border" />
          {/* At this size the wordmark's tight letters nearly close the space; keep the two words apart. */}
          <span className="display-wordmark text-lg sm:text-xl" style={{ wordSpacing: '0.2em' }}>Lunara Sports</span>
        </Link>

        <nav aria-label="Primary" className="hidden lg:flex items-center gap-1 ml-2">
          {NAV_LINKS.map(({ path, label, icon: Icon }) => {
            const active = pathname === path;
            return (
              <Link
                key={path}
                to={path}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'h-10 px-3 flex items-center gap-2 rounded-md t-body font-medium transition-colors',
                  active ? 'bg-accent-fill text-accent-ink font-semibold' : 'text-text-2 hover:text-text-1 hover:bg-surface-2'
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={onOpenSearch}
          className="hidden lg:flex ml-auto h-10 w-60 shrink-0 items-center justify-start gap-2 whitespace-nowrap text-left rounded-md border border-border bg-surface-0 px-3 t-small text-text-2 hover:border-border-strong"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          Search players and teams
        </button>
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Open search"
          className="lg:hidden ml-auto h-11 w-11 shrink-0 flex items-center justify-center rounded-md border border-border bg-surface-2 text-text-1"
        >
          <Search className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
