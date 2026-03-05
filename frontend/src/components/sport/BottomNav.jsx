import { Link, useLocation } from 'react-router-dom';
import { Home, Clock, BarChart3, Bell, TrendingUp } from 'lucide-react';

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: Home },
  { to: "/scoreboard", label: "Games", icon: Clock },
  { to: "/standings", label: "Rankings", icon: BarChart3 },
  { to: "/picks", label: "Picks", icon: TrendingUp },
  { to: "/stats", label: "Stats", icon: Bell },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--border)] bg-[var(--bg-base)]/95 backdrop-blur-sm md:hidden"
      aria-label="Mobile tab navigation"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="mx-auto flex max-w-md items-center justify-around py-1">
        {NAV_ITEMS.map((item) => {
          const isActive = item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              to={item.to}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 px-4 py-2.5 min-w-[60px] transition ${
                isActive ? "text-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[11px] font-semibold">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
