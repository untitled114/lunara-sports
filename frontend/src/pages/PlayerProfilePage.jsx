import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, BarChart2, Calendar, Trophy } from 'lucide-react';
import { Tabs, Badge, Stat, DataTable, PageState, SectionHeader, Card, TeamMark } from '@/components/ui';
import { fetchPlayerDetail, fetchPlayerStats, fetchPlayerGameLog } from '@/services/api';
import { getLogoUrl } from '@/utils/teamColors';
import { useTheme } from '@/context/ThemeContext';
import { PlayerHeadshot } from '@/components/sport/PlayerHeadshot';

function ShootingRow({ label, value, pct }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="t-label text-text-3">{label}</span>
        <span className="t-small tnum text-text-1">{value}</span>
      </div>
      <div className="h-1.5 w-full bg-surface-2 rounded-sm overflow-hidden">
        <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ResultBadge({ result }) {
  if (!result) return <span className="t-small text-text-3">{'—'}</span>;
  return <Badge variant={result === 'W' ? 'win' : 'loss'}>{result}</Badge>;
}

// Every field the pre-design-system profile rendered for a game row (date,
// home/away + opponent, result, final score, PTS/REB/AST/STL/BLK, FG, MIN) —
// kept here in one place so neither the Recent Performances preview nor the
// full Game Log table can drop a field the old page showed (ruling D9).
const GAME_LOG_COLUMNS = [
  { key: 'date', label: 'Date', nowrap: true },
  {
    key: 'opponent',
    label: 'Opponent',
    render: (r) => `${r.home_away ? `${r.home_away} ` : ''}${r.opponent ?? ''}`,
  },
  { key: 'result', label: 'W/L', render: (r) => <ResultBadge result={r.result} /> },
  { key: 'score', label: 'Score', numeric: true, render: (r) => r.score ?? '—' },
  { key: 'pts', label: 'PTS', numeric: true },
  { key: 'reb', label: 'REB', numeric: true },
  { key: 'ast', label: 'AST', numeric: true },
  { key: 'stl', label: 'STL', numeric: true },
  { key: 'blk', label: 'BLK', numeric: true },
  { key: 'fg', label: 'FG', numeric: true },
  { key: 'min', label: 'MIN', numeric: true, render: (r) => r.min ?? '—' },
];

export default function PlayerProfilePage() {
  const { id } = useParams();
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [stats, setStats] = useState(null);
  const [gameLog, setGameLog] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [retryKey, setRetryKey] = useState(0);
  const { playGlassClick } = useTheme();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    Promise.all([
      fetchPlayerDetail(id),
      fetchPlayerStats(id).catch(() => null),
      fetchPlayerGameLog(id).catch(() => []),
    ])
      .then(([playerData, statsData, logData]) => {
        if (cancelled) return;
        setPlayer(playerData);
        setStats(statsData);
        setGameLog(logData);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [id, retryKey]);

  if (loading) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 pt-10 pb-32">
        <PageState kind="loading" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 pt-10 pb-32">
        <PageState
          kind="error"
          title="Couldn't load this player."
          onRetry={() => setRetryKey((k) => k + 1)}
        />
      </div>
    );
  }

  if (!player) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 pt-10 pb-32">
        <PageState
          kind="empty"
          title="Player not found."
          action={
            <Link to="/players" className="t-small text-accent hover:text-accent-hover">
              Back to players
            </Link>
          }
        />
      </div>
    );
  }

  const teamLogo = getLogoUrl(player.team_abbrev || 'NBA');
  const recentGames = gameLog.slice(0, 5).map((r, i) => ({ ...r, _key: i }));
  const allGames = gameLog.map((r, i) => ({ ...r, _key: i }));

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 pb-32 px-4 pt-10">
      <Link
        to="/players"
        className="inline-flex items-center gap-2 t-small text-text-2 hover:text-text-1 transition-colors group"
      >
        <ChevronLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" /> Players
      </Link>

      <Card className="flex flex-col sm:flex-row sm:items-center gap-6">
        <div className="flex items-center gap-4">
          <PlayerHeadshot
            url={player.headshot_url}
            px={80}
            alt={player.name}
            className="h-20 w-20 rounded-lg object-cover border border-border"
          />
          <TeamMark abbrev={player.team_abbrev} logoUrl={teamLogo} size="lg" />
        </div>

        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex items-center gap-3">
            <span className="t-small tnum text-text-3">#{player.jersey || '00'}</span>
            <Badge variant="accent">{player.position}</Badge>
          </div>
          <h1 className="t-title text-text-1">{player.name}</h1>
          <p className="t-label text-text-3">{player.team}</p>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Statistics */}
        <div className="lg:col-span-8 space-y-4">
          <SectionHeader title="Statistics" />
          <Card>
            <Tabs
              variant="underline"
              activeTab={activeTab}
              onChange={setActiveTab}
              tabs={[
                {
                  id: 'overview',
                  label: 'Overview',
                  icon: Trophy,
                  content: (
                    <div className="space-y-8">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <Stat label="Points" value={stats?.ppg ?? '0.0'} />
                        <Stat label="Rebounds" value={stats?.rpg ?? '0.0'} />
                        <Stat label="Assists" value={stats?.apg ?? '0.0'} />
                        <Stat label="Games" value={stats?.gp ?? '0'} />
                      </div>

                      <div className="h-px w-full bg-border" />

                      <div className="space-y-4">
                        <span className="t-label text-text-3">Shooting</span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                          <ShootingRow
                            label="Field goal"
                            value={stats?.fg_pct ?? '0.0%'}
                            pct={parseFloat(stats?.fg_pct) || 0}
                          />
                          <ShootingRow
                            label="Three point"
                            value={stats?.three_pct ?? '0.0%'}
                            pct={parseFloat(stats?.three_pct) || 0}
                          />
                          <ShootingRow
                            label="Free throw"
                            value={stats?.ft_pct ?? '0.0%'}
                            pct={parseFloat(stats?.ft_pct) || 0}
                          />
                        </div>
                      </div>

                      {recentGames.length > 0 && (
                        <div className="space-y-4">
                          <SectionHeader
                            title="Recent performances"
                            aside={`Last ${recentGames.length} games`}
                          />
                          <DataTable columns={GAME_LOG_COLUMNS} rows={recentGames} getKey={(r) => r._key} />
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  id: 'stats',
                  label: 'Detailed stats',
                  icon: BarChart2,
                  content: (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                      <Stat label="Steals" value={stats?.spg ?? '0.0'} />
                      <Stat label="Blocks" value={stats?.bpg ?? '0.0'} />
                      <Stat label="Games played" value={stats?.gp ?? '0'} />
                    </div>
                  ),
                },
                {
                  id: 'log',
                  label: 'Game log',
                  icon: Calendar,
                  content:
                    allGames.length === 0 ? (
                      <PageState kind="empty" title="No games logged yet." />
                    ) : (
                      <DataTable columns={GAME_LOG_COLUMNS} rows={allGames} getKey={(r) => r._key} />
                    ),
                },
              ]}
            />
          </Card>
        </div>

        {/* Bio */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="space-y-6">
            <SectionHeader title="Bio" />
            <div className="space-y-4">
              {[
                { label: 'Height / weight', val: `${player.height || '—'} / ${player.weight || '—'} lbs` },
                { label: 'Age / experience', val: `${player.age || '—'} years / ${player.experience || '—'}` },
                ...(player.draft ? [{ label: 'Draft', val: player.draft }] : []),
                ...(player.birthplace ? [{ label: 'Born', val: player.birthplace }] : []),
                { label: 'Team', val: player.team || '—' },
              ].map((bio) => (
                <div key={bio.label} className="flex flex-col gap-1">
                  <span className="t-label text-text-3">{bio.label}</span>
                  <span className="t-small text-text-1">{bio.val}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
