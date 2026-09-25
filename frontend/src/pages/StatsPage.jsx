import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Skeleton, Segmented, SectionHeader, DataTable, PageState } from '@/components/ui';
import { TrendingUp, Shield, Zap, Award, ChevronRight, Target, Activity } from 'lucide-react';
import { fetchStatLeaders, fetchTeamStatsList } from '@/services/api';
import { useTheme } from '@/context/ThemeContext';
import { PlayerHeadshot } from '@/components/sport/PlayerHeadshot';

function LeaderboardCard({ title, icon: Icon, data, unit, delay = 0 }) {
  const { playGlassClick } = useTheme();

  return (
    <div
      className="bg-surface-1 border border-border rounded-lg overflow-hidden flex flex-col h-full animate-fadeIn transition-colors duration-500 hover:border-border-strong group"
      style={{ animationDelay: `${delay}s` }}
    >
      {/* Card header */}
      <div className="flex items-center justify-between px-6 py-4 bg-surface-2 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-md bg-surface-1 border border-border flex items-center justify-center group-hover:border-accent transition-colors">
            <Icon className="h-4 w-4 text-accent" />
          </div>
          <h3 className="t-label text-text-1">{title}</h3>
        </div>
        <span className="t-label text-text-3">{unit}</span>
      </div>

      {/* Table body */}
      <div className="flex-1">
        <table className="w-full text-left border-collapse">
          <tbody className="divide-y divide-border">
            {data.map((row, idx) => (
              <tr key={row.player_id + idx} className="group/row hover:bg-surface-2 transition-colors duration-300 cursor-default">
                <td className="py-4 px-6 w-10">
                  <span className="t-small tnum text-text-3">{row.rank}</span>
                </td>
                <td className="py-4 px-2">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-md bg-surface-2 border border-border overflow-hidden shrink-0">
                      <PlayerHeadshot
                        url={row.headshot_url}
                        px={48}
                        alt={row.player}
                        className="w-full h-full object-cover"
                        fallback={<div className="w-full h-full flex items-center justify-center t-small text-text-3">{row.player[0]}</div>}
                      />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <Link
                        to={`/player/${row.player_id}`}
                        onClick={() => playGlassClick()}
                        className="t-small font-semibold text-text-1 group-hover/row:text-accent transition-colors truncate"
                      >
                        {row.player}
                      </Link>
                      <span className="t-label text-text-3">{row.team}</span>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-6 text-right tnum">
                  <span className="t-body font-semibold text-text-1 group-hover/row:text-accent transition-colors">{row.value}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Card footer */}
      <div className="p-3 bg-surface-2 border-t border-border">
        <Link
          to="/players"
          onClick={() => playGlassClick()}
          className="flex items-center justify-center gap-2 py-2 rounded-md hover:bg-surface-1 transition-colors group/link"
        >
          <span className="t-label text-text-3 group-hover/link:text-accent transition-colors">See all leaders</span>
          <ChevronRight className="h-3 w-3 text-text-3 group-hover/link:translate-x-1 group-hover/link:text-accent transition-all" />
        </Link>
      </div>
    </div>
  );
}

function StatSection({ title, subtitle, children }) {
  return (
    <div className="space-y-8">
      <SectionHeader title={title} aside={subtitle} />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">{children}</div>
    </div>
  );
}

export default function StatsPage() {
  const [activeTab, setActiveTab] = useState('players');
  const [leaders, setLeaders] = useState({});
  const [teamStats, setTeamStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    Promise.all([fetchStatLeaders(5), fetchTeamStatsList()])
      .then(([leadersData, teamsData]) => {
        if (cancelled) return;
        setLeaders(leadersData?.categories || {});
        setTeamStats(teamsData || []);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [retryNonce]);

  const teamColumns = [
    { key: 'rank', label: 'Rk', numeric: true },
    { key: 'team', label: 'Franchise', render: (t) => <span className="font-semibold text-text-1">{t.team}</span> },
    { key: 'record', label: 'W-L', numeric: true },
    { key: 'ortg', label: 'ORTG', numeric: true, render: (t) => <span className="tnum text-accent">{t.ortg}</span> },
    { key: 'drtg', label: 'DRTG', numeric: true, render: (t) => <span className="tnum text-loss">{t.drtg}</span> },
    { key: 'net_rtg', label: 'Net', numeric: true, render: (t) => <span className="tnum font-semibold text-text-1">{t.net_rtg}</span> },
    { key: 'pace', label: 'Pace', numeric: true },
    { key: 'ts_pct', label: 'TS%', numeric: true },
  ];

  if (error) {
    return (
      <div className="max-w-[1600px] mx-auto px-4 pt-10">
        <PageState kind="error" title="Couldn&apos;t load stats." onRetry={() => setRetryNonce((n) => n + 1)} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-[1600px] mx-auto space-y-12 animate-fadeIn px-4 pt-10">
        <Skeleton variant="rectangle" height="h-24" className="w-1/3 rounded-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="rectangle" height="h-[600px]" className="rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-16 pb-40 animate-fadeIn px-4 pt-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-border pb-10">
        <div>
          <h1 className="t-title text-text-1">Statistics</h1>
          <p className="t-label text-text-3 mt-3">
            League stats <span className="mx-3 text-text-3">|</span> 2025-26 regular season
          </p>
        </div>

        <Segmented
          options={[
            { id: 'players', label: 'Individual' },
            { id: 'teams', label: 'Franchise' },
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {activeTab === 'players' ? (
        <div className="space-y-16">
          {/* Offense */}
          <StatSection title="Offense" subtitle="Scoring and playmaking">
            <LeaderboardCard title="Points" icon={Zap} data={leaders.pts || []} unit="PPG" delay={0} />
            <LeaderboardCard title="Assists" icon={Activity} data={leaders.ast || []} unit="APG" delay={0.1} />
            <LeaderboardCard title="Three pointers" icon={Target} data={leaders.threes || []} unit="3PM" delay={0.2} />
          </StatSection>

          {/* Defense */}
          <StatSection title="Defense" subtitle="Rim protection and perimeter defense">
            <LeaderboardCard title="Rebounds" icon={Shield} data={leaders.reb || []} unit="RPG" delay={0.3} />
            <LeaderboardCard title="Blocks" icon={TrendingUp} data={leaders.blk || []} unit="BPG" delay={0.4} />
            <LeaderboardCard title="Steals" icon={Zap} data={leaders.stl || []} unit="SPG" delay={0.5} />
          </StatSection>

          {/* Advanced stats banner */}
          <div className="bg-surface-1 border border-border rounded-lg p-8 sm:p-12 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
            <div className="flex items-center gap-6 relative z-10">
              <div className="h-20 w-20 rounded-lg bg-surface-2 border border-border flex items-center justify-center shrink-0">
                <Award className="h-10 w-10 text-accent" />
              </div>
              <div>
                <h2 className="t-section text-text-1 mb-2">Advanced stats</h2>
                <p className="t-small text-text-2">Player impact estimate (PIE) and true shooting percentages</p>
              </div>
            </div>
            <Link
              to="/standings"
              className="relative z-10 px-8 py-3 bg-accent-fill hover:bg-accent-fill-hover text-white t-small font-semibold rounded-md transition-colors"
            >
              See standings
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-scaleIn">
          <SectionHeader title="Team stats" aside={<Badge variant="accent">League rank</Badge>} />
          {teamStats.length === 0 ? (
            <PageState kind="empty" title="Team stats aren&apos;t available yet." />
          ) : (
            <DataTable columns={teamColumns} rows={teamStats} getKey={(t) => t.rank} />
          )}
        </div>
      )}
    </div>
  );
}
