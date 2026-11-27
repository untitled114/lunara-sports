import { Link, useLocation } from 'react-router-dom';
import { Home, Calendar, ListOrdered, BarChart3, User } from 'lucide-react';
import clsx from 'clsx';

// Phones only: the five places within thumb reach (the menu panel has everything else).
// The same icon per destination as the top bar, so one icon never means two places.
const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/scoreboard', label: 'Scores', icon: Calendar },
  { to: '/standings', label: 'Standings', icon: ListOrdered },
  { to: '/stats', label: 'Stats', icon: BarChart3 },
  { to: '/players', label: 'Players', icon: User },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface-0/95 backdrop-blur-sm md:hidden"
      aria-label="Main navigation"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="mx-auto flex max-w-md items-center justify-around py-1">
        {NAV_ITEMS.map((item) => {
          const isActive = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              to={item.to}
              aria-current={isActive ? 'page' : undefined}
              className={clsx(
                'flex flex-col items-center gap-0.5 px-2 py-2.5 min-w-[56px] min-h-[44px] transition-colors',
                isActive ? 'text-accent' : 'text-text-3 hover:text-text-2'
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="t-label">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
