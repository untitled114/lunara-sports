import { Card, Badge, TeamMark } from '@/components/ui';
import { getLogoUrl } from '@/utils/teamColors';
import { useTheme } from '@/context/ThemeContext';

export function CourtView({ game }) {
  const { playGlassClick } = useTheme();
  const isLive = game.status === 'live' || game.status === 'halftime';
  const isFinal = game.status === 'final';

  const handleZoneClick = (zone) => {
    playGlassClick();
    console.log(`Filtering by zone: ${zone}`);
  };

  return (
    <Card className="mb-6">
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-border">
        <span className="t-section text-text-1">Shot chart</span>
        <div className="flex items-center gap-4">
          <TeamMark abbrev={game.away_team} logoUrl={getLogoUrl(game.away_team)} size="sm" />
          <TeamMark abbrev={game.home_team} logoUrl={getLogoUrl(game.home_team)} size="sm" />
        </div>
      </div>

      <div className="relative aspect-[16/9] w-full bg-surface-2 rounded-lg border border-border overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="h-full w-px bg-border" />
        </div>

        <button
          type="button"
          onClick={() => handleZoneClick('Left Paint')}
          className="absolute inset-y-0 left-0 w-1/4 border-r border-border hover:bg-surface-1 transition-colors"
        >
          <span className="absolute top-3 left-3 t-label text-text-3">Left paint</span>
        </button>

        <button
          type="button"
          onClick={() => handleZoneClick('Right Paint')}
          className="absolute inset-y-0 right-0 w-1/4 border-l border-border hover:bg-surface-1 transition-colors"
        >
          <span className="absolute top-3 right-3 t-label text-text-3">Right paint</span>
        </button>
      </div>

      <div className="mt-4 flex items-center justify-end">
        {isLive ? (
          <Badge variant="live" dot>Live</Badge>
        ) : (
          <span className="t-label text-text-3">{isFinal ? 'Final' : 'Upcoming'}</span>
        )}
      </div>
    </Card>
  );
}
