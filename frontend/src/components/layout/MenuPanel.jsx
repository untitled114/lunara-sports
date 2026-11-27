import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Calendar, CalendarDays, ListOrdered, BarChart3, Trophy, User, Shield, Search, X } from 'lucide-react';
import clsx from 'clsx';
import { BRANDING_IMAGES } from '@/constants/branding';
import { fetchStandings } from '@/services/api';
import { getLogoUrl } from '@/utils/teamColors';
import { SettingsSection } from './SettingsSection';

// Every page, in three groups.
const GROUPS = [
  [
    { path: '/', label: 'Home', icon: Home },
    { path: '/scoreboard', label: 'Scoreboard', icon: Calendar },
    { path: '/schedule', label: 'Schedule', icon: CalendarDays },
  ],
  [
    { path: '/standings', label: 'Standings', icon: ListOrdered },
    { path: '/stats', label: 'Stats', icon: BarChart3 },
    { path: '/stats/leaders/pts', label: 'League leaders', icon: Trophy },
  ],
  [
    { path: '/players', label: 'Players', icon: User },
    { path: '/teams', label: 'Teams', icon: Shield },
  ],
];

const SHOWN = 5;
const winPct = (t) => Number(t.w) / Math.max(1, Number(t.w) + Number(t.l));

// The three-line menu: a panel from the left with every page, all 30 teams (best record
// first) and the Settings. 86% of a phone's width, 320px on larger screens.
export function MenuPanel({ open, onClose, onOpenSearch }) {
  const { pathname } = useLocation();
  const [teams, setTeams] = useState(null);
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const closeRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    fetchStandings()
      .then((d) => {
        if (cancelled) return;
        const all = [...(d?.eastern || []), ...(d?.western || [])];
        setTeams(all.map((t, i) => ({ ...t, i })).sort((a, b) => winPct(b) - winPct(a) || a.i - b.i));
      })
      .catch(() => !cancelled && setTeams([]));
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    // Escape closes; Tab and Shift+Tab wrap inside the panel, so keyboard focus never
    // moves to the dimmed page behind it.
    const onKey = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      const dialog = dialogRef.current;
      if (e.key !== 'Tab' || !dialog) return;
      const stops = [...dialog.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')].filter(
        (el) => !el.disabled && el.getAttribute('tabindex') !== '-1'
      );
      if (!stops.length) return;
      const first = stops[0];
      const last = stops[stops.length - 1];
      const inside = dialog.contains(document.activeElement);
      if (e.shiftKey && (!inside || document.activeElement === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || document.activeElement === last)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const shown = useMemo(() => {
    if (!teams) return [];
    const q = query.trim().toLowerCase();
    if (q) return teams.filter((t) => t.name.toLowerCase().includes(q) || t.abbrev.toLowerCase().includes(q));
    return showAll ? teams : teams.slice(0, SHOWN);
  }, [teams, query, showAll]);

  if (!open) return null;

  return (
    <>
      <div data-testid="menu-overlay" aria-hidden="true" onClick={onClose} className="fixed inset-0 z-[200] bg-surface-0/70 animate-fadeIn" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className="fixed top-0 bottom-0 left-0 z-[210] w-[86vw] sm:w-[320px] overflow-y-auto bg-surface-1 border-r border-border shadow-card"
      >
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/" onClick={onClose} className="flex min-h-[44px] items-center gap-2">
            <img src={BRANDING_IMAGES.logos.general} alt="" width={36} height={36} className="h-9 w-9 rounded-md object-cover border border-border" />
            <span className="display-wordmark text-lg" style={{ wordSpacing: '0.2em' }}>Lunara Sports</span>
          </Link>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close menu" className="h-11 w-11 flex items-center justify-center rounded-md text-text-2 hover:bg-surface-2">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenSearch();
          }}
          className="sm:hidden mx-4 mb-2 w-[calc(100%-2rem)] min-h-[44px] flex items-center gap-2 px-3 rounded-md border border-border bg-surface-0 t-small text-text-2"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          Search players and teams
        </button>

        <nav aria-label="Pages" className="pb-2">
          {GROUPS.map((group, gi) => (
            <div key={gi}>
              {gi > 0 && <div aria-hidden="true" className="mx-4 border-t border-border" />}
              <div className="py-1 px-1">
              {group.map(({ path, label, icon: Icon }) => {
                const active = pathname === path;
                return (
                  <Link
                    key={path}
                    to={path}
                    onClick={onClose}
                    aria-current={active ? 'page' : undefined}
                    className={clsx('flex min-h-[44px] items-center gap-3 rounded-md px-3 t-body', active ? 'text-accent font-semibold' : 'text-text-1 hover:bg-surface-2')}
                  >
                    <Icon className="hidden sm:inline h-[18px] w-[18px]" aria-hidden="true" />
                    {label}
                  </Link>
                );
              })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-border mx-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="t-label text-text-2">Teams</span>
          </div>
          <input
            type="search"
            aria-label="Search teams"
            placeholder="Search teams"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full min-h-[44px] rounded-md border border-border bg-surface-0 px-3 t-small text-text-1 placeholder:text-text-3"
          />
          <ul aria-label="Teams" className="space-y-0.5">
            {shown.map((t) => (
              <li key={t.abbrev}>
                <Link to={`/team/${t.abbrev}`} onClick={onClose} className="flex min-h-[44px] items-center gap-2.5 rounded-md px-1 t-small text-text-1 hover:bg-surface-2">
                  <img src={getLogoUrl(t.abbrev)} alt="" width={20} height={20} className="h-5 w-5" />
                  <span className="truncate">{t.name}</span>
                  <span className="ml-auto tnum text-text-2">{`${t.w}-${t.l}`}</span>
                </Link>
              </li>
            ))}
          </ul>
          {teams && !query && teams.length > SHOWN && (
            <button type="button" onClick={() => setShowAll((s) => !s)} className="min-h-[44px] t-small text-text-2 hover:text-text-1">
              {showAll ? 'Show fewer' : 'Show all 30'}
            </button>
          )}
        </div>

        <div className="border-t border-border pt-3">
          <SettingsSection />
        </div>
      </div>
    </>
  );
}
