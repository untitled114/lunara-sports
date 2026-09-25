import { Card, Badge, Stat, TeamMark } from '@/components/ui';
import { getLogoUrl } from '@/utils/teamColors';

export function MomentumMeter({ game }) {
  const isLive = game.status === 'live' || game.status === 'halftime';
  const isFinal = game.status === 'final';

  // Derive momentum from score differential: positive = home leading
  const diff = (game.home_score || 0) - (game.away_score || 0);
  const margin = Math.abs(diff);
  const leadingTeam = diff > 0 ? game.home_team : diff < 0 ? game.away_team : null;

  // Impact level based on point differential
  let impactLabel = 'Even';
  if (margin >= 15) impactLabel = 'Blowout';
  else if (margin >= 8) impactLabel = 'High';
  else if (margin >= 3) impactLabel = 'Medium';
  else if (margin > 0) impactLabel = 'Low';

  // Score display
  const scoreDisplay = isLive || isFinal
    ? (leadingTeam ? `${leadingTeam} +${margin}` : 'Tied')
    : '—';

  // Bar fill: 0 = tied, 100% of a half = a 20-point lead, direction shows who leads
  const fillPct = isLive || isFinal ? Math.min(100, (margin / 20) * 100) : 0;
  const homeLeads = diff > 0;

  return (
    <Card className="mb-6">
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-border">
        <span className="t-section text-text-1">Momentum</span>
        {isLive ? (
          <Badge variant="live" dot>Live</Badge>
        ) : (
          <span className="t-label text-text-3">{isFinal ? 'Final' : 'Upcoming'}</span>
        )}
      </div>

      <div className="flex items-center justify-between mb-3">
        <TeamMark abbrev={game.away_team} logoUrl={getLogoUrl(game.away_team)} size="sm" />
        <TeamMark abbrev={game.home_team} logoUrl={getLogoUrl(game.home_team)} size="sm" />
      </div>

      <div className="relative h-2 rounded-sm bg-surface-2 overflow-hidden">
        <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
        <div
          className="absolute inset-y-0 bg-live"
          style={{
            width: `${fillPct / 2}%`,
            left: homeLeads ? '50%' : `${50 - fillPct / 2}%`,
          }}
        />
      </div>

      <div className="flex gap-10 mt-4">
        <Stat label="Lead" value={scoreDisplay} />
        <Stat label="Impact" value={impactLabel} />
      </div>
    </Card>
  );
}
