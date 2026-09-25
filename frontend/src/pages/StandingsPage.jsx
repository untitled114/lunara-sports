import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, DataTable, PageState, SectionHeader, Segmented, TeamMark } from '@/components/ui';
import { fetchStandings, fetchTeams } from '@/services/api';
import { useTheme } from '@/context/ThemeContext';

const PLAY_IN_CUTOFF = 10;

const DIVISION_ORDER = {
  Eastern: ['Atlantic', 'Central', 'Southeast'],
  Western: ['Northwest', 'Pacific', 'Southwest'],
};

const VIEW_OPTIONS = [
  { id: 'conference', label: 'Conference' },
  { id: 'division', label: 'Division' },
];

function strkBadge(strk) {
  if (!strk) return <span className="text-text-3">—</span>;
  return <Badge variant={strk.startsWith('W') ? 'win' : 'loss'}>{strk}</Badge>;
}

function buildDivisionGroups(confTeams, confName, divisionMap) {
  const groups = {};
  for (const team of confTeams) {
    const div = divisionMap[team.abbrev] || 'Unknown';
    if (!groups[div]) groups[div] = [];
    groups[div].push(team);
  }
  const order = DIVISION_ORDER[confName] || Object.keys(groups);
  return order.filter((d) => groups[d]).map((d) => ({ name: d, teams: groups[d] }));
}

function ConferenceStandings({ title, teams, columns }) {
  const top = teams.slice(0, PLAY_IN_CUTOFF);
  const rest = teams.slice(PLAY_IN_CUTOFF);

  return (
    <div className="flex flex-col gap-3" data-testid={`conference-${title.toLowerCase().split(' ')[0]}`}>
      <SectionHeader title={title} />
      <DataTable columns={columns} rows={top} getKey={(t) => t.abbrev} />
      {rest.length > 0 && (
        <>
          <div className="flex items-center gap-3 py-1">
            <span className="t-label text-text-3">Play-in line</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <DataTable columns={columns} rows={rest} getKey={(t) => t.abbrev} />
        </>
      )}
    </div>
  );
}

function DivisionStandings({ conferenceName, teams, columns, divisionMap }) {
  const divisions = buildDivisionGroups(teams, conferenceName, divisionMap);
  return (
    <div className="flex flex-col gap-8">
      {divisions.map((div) => (
        <div key={div.name} className="flex flex-col gap-3" data-testid={`division-${div.name.toLowerCase()}`}>
          <SectionHeader title={div.name} />
          <DataTable columns={columns} rows={div.teams} getKey={(t) => t.abbrev} />
        </div>
      ))}
    </div>
  );
}

export default function StandingsPage() {
  const [standings, setStandings] = useState(null);
  const [teamsData, setTeamsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('conference');
  const { playGlassClick } = useTheme();

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([fetchStandings(), fetchTeams().catch(() => [])])
      .then(([standingsData, teams]) => {
        if (cancelled) return;
        setStandings(standingsData);
        setTeamsData(teams);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => reload(), [reload]);

  const handleViewChange = (id) => {
    if (id !== view) {
      playGlassClick();
      setView(id);
    }
  };

  const columns = [
    {
      key: 'team',
      label: 'Team',
      render: (team) => (
        <Link
          to={`/team/${team.abbrev}`}
          onClick={playGlassClick}
          className="flex items-center gap-3 hover:text-accent transition-colors"
        >
          <span className="t-label tnum w-5 shrink-0 text-right text-text-3">{team.seed ?? '—'}</span>
          <TeamMark abbrev={team.abbrev} logoUrl={team.logo_url} size="sm" />
          <span className="text-text-1">{team.name}</span>
        </Link>
      ),
    },
    { key: 'w', label: 'W', numeric: true, render: (t) => t.w },
    { key: 'l', label: 'L', numeric: true, render: (t) => t.l },
    { key: 'pct', label: 'PCT', numeric: true, render: (t) => t.pct },
    { key: 'gb', label: 'GB', numeric: true, render: (t) => t.gb || '-' },
    { key: 'home', label: 'Home', numeric: true, render: (t) => t.home || '—' },
    { key: 'road', label: 'Road', numeric: true, render: (t) => t.road || '—' },
    { key: 'l10', label: 'L10', numeric: true, render: (t) => t.l10 || '—' },
    { key: 'strk', label: 'Strk', numeric: true, render: (t) => strkBadge(t.strk) },
  ];

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <PageState kind="loading" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <PageState kind="error" title="Couldn't load standings." onRetry={reload} />
      </div>
    );
  }

  const eastern = standings?.eastern || [];
  const western = standings?.western || [];
  const seasonLabel = standings?.season_label || standings?.season || '';

  const divisionMap = {};
  for (const t of teamsData) {
    divisionMap[t.abbrev] = t.division || 'Unknown';
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeader title="Standings" aside={seasonLabel} />
        <Segmented options={VIEW_OPTIONS} value={view} onChange={handleViewChange} />
      </div>

      {view === 'conference' ? (
        <div className="flex flex-col gap-10">
          <ConferenceStandings title="Eastern Conference" teams={eastern} columns={columns} />
          <ConferenceStandings title="Western Conference" teams={western} columns={columns} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          <DivisionStandings conferenceName="Eastern" teams={eastern} columns={columns} divisionMap={divisionMap} />
          <DivisionStandings conferenceName="Western" teams={western} columns={columns} divisionMap={divisionMap} />
        </div>
      )}

      <Link to="/stats" className="t-small inline-flex items-center gap-1 text-accent hover:text-accent-hover">
        Stats
      </Link>
    </div>
  );
}
