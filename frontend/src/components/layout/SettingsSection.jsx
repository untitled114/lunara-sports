import { Link } from 'react-router-dom';
import { Segmented } from '@/components/ui/Segmented';
import { useTheme } from '@/context/ThemeContext';
import { TEAM_COLORS } from '@/utils/teamColors';

const ALL_TEAMS = Object.keys(TEAM_COLORS);

const TEXT_SIZE_OPTIONS = [
  { id: 'sm', label: 'S' },
  { id: 'md', label: 'M' },
  { id: 'lg', label: 'L' },
];

const REFRESH_OPTIONS = [
  { id: 15, label: '15s' },
  { id: 30, label: '30s' },
  { id: 60, label: '60s' },
];

const TIMEZONE_OPTIONS = [
  { id: 'ET', label: 'ET' },
  { id: 'CT', label: 'CT' },
  { id: 'MT', label: 'MT' },
  { id: 'PT', label: 'PT' },
  { id: 'local', label: 'Local' },
];

// The visitor's display settings, at the bottom of the menu panel (the old gear panel's
// controls, minus sound, which was removed). Stored in the browser only.
export function SettingsSection() {
  const {
    arenaIntensity, updateIntensity, favoriteTeam, selectFavoriteTeam, fontSize, updateFontSize,
    reducedMotion, toggleReducedMotion, refreshInterval, updateRefreshInterval, timezone, updateTimezone,
  } = useTheme();

  return (
    <section aria-labelledby="menu-settings-heading" className="space-y-5 px-4 pb-6">
      <h2 id="menu-settings-heading" className="t-label text-text-2">Settings</h2>

      <div className="space-y-2">
        <span className="t-small text-text-2 block">Time zone</span>
        <Segmented aria-label="Time zone" options={TIMEZONE_OPTIONS} value={timezone} onChange={updateTimezone} />
      </div>

      <div className="space-y-2">
        <span className="t-small text-text-2 block">Text size</span>
        <Segmented aria-label="Text size" options={TEXT_SIZE_OPTIONS} value={fontSize} onChange={updateFontSize} />
      </div>

      <div className="space-y-2">
        <span className="t-small text-text-2 block" id="menu-glow-label">Background glow</span>
        <input
          type="range" min="0" max="1" step="0.1"
          aria-labelledby="menu-glow-label"
          value={arenaIntensity}
          onChange={(e) => updateIntensity(parseFloat(e.target.value))}
          className="w-full cursor-pointer accent-[var(--accent)]"
        />
      </div>

      <div className="space-y-2">
        <span className="t-small text-text-2 block">Refresh interval</span>
        <Segmented aria-label="Refresh interval" options={REFRESH_OPTIONS} value={refreshInterval} onChange={updateRefreshInterval} />
      </div>

      <button
        type="button"
        onClick={toggleReducedMotion}
        aria-pressed={reducedMotion}
        className="w-full min-h-[44px] flex items-center justify-between px-3 rounded-md border border-border bg-surface-2 hover:border-border-strong transition-colors"
      >
        <span className="t-small text-text-1">Reduced motion</span>
        <span className="t-small text-text-2">{reducedMotion ? 'On' : 'Off'}</span>
      </button>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="t-small text-text-2">Favorite team</span>
          {favoriteTeam && (
            <button type="button" onClick={() => selectFavoriteTeam(null)} className="min-h-[44px] px-2 t-small text-loss">
              Clear
            </button>
          )}
        </div>
        <div className="grid grid-cols-6 gap-1.5">
          {ALL_TEAMS.map((team) => (
            <button
              key={team}
              type="button"
              onClick={() => selectFavoriteTeam(team)}
              aria-pressed={favoriteTeam === team}
              className={`h-11 rounded-md border t-label transition-colors ${favoriteTeam === team ? 'bg-accent-fill text-accent-ink border-transparent' : 'bg-surface-2 border-border text-text-2 hover:border-border-strong'}`}
            >
              {team}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-4 t-small">
        <Link to="/terms" className="inline-flex min-h-[44px] items-center text-text-2 hover:text-text-1">Terms</Link>
        <Link to="/privacy" className="inline-flex min-h-[44px] items-center text-text-2 hover:text-text-1">Privacy</Link>
      </div>
    </section>
  );
}
