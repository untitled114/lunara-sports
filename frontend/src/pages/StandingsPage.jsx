import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, DataTable, PageState, SectionHeader, Segmented, TeamMark } from '@/components/ui';
import { fetchStandings, fetchTeams } from '@/services/api';
import { useTheme } from '@/context/ThemeContext';

const PLAYOFF_CUTOFF = 6;
const PLAY_IN_CUTOFF = 10;
const EMPTY = '—'; // em dash — the one empty/placeholder glyph used everywhere on this page

const DIVISION_ORDER = {
  Eastern: ['Atlantic', 'Central', 'Southeast'],
  Western: ['Northwest', 'Pacific', 'Southwest'],
};

const VIEW_OPTIONS = [
  { id: 'conference', label: 'Conference' },
  { id: 'division', label: 'Division' },
];

// Seed (falling back to rank when seed is null) drives both the default sort and the
// playoff/play-in banding — never array position. See ruling D9/item 3.
function effectiveSeed(team) {
  return team.seed ?? team.rank ?? Infinity;
}

function bandOf(team) {
  const seed = effectiveSeed(team);
  if (seed <= PLAYOFF_CUTOFF) return 'playoff';
  if (seed <= PLAY_IN_CUTOFF) return 'playIn';
  return 'rest';
}

function dividerLabelForTransition(fromBand, toBand) {
  const pair = new Set([fromBand, toBand]);
  if (pair.has('playoff') && pair.has('playIn')) return 'Playoff line';
  return 'Play-in line';
}

// Same comparator shape the pre-DS page used: raw field comparison, except 'pct'
// (parsed as a float) and 'team' (the seed/rank column, since there's no longer a raw
// `rank` field driving that column's display).
function compareTeams(a, b, key, dir) {
  let valA;
  let valB;
  if (key === 'team') {
    valA = effectiveSeed(a);
    valB = effectiveSeed(b);
  } else if (key === 'pct') {
    valA = parseFloat(a.pct);
    valB = parseFloat(b.pct);
  } else {
    valA = a[key];
    valB = b[key];
  }
  if (valA < valB) return dir === 'asc' ? -1 : 1;
  if (valA > valB) return dir === 'asc' ? 1 : -1;
  return 0;
}

// Splits a sorted team list into table segments with a "Playoff line" / "Play-in line"
// divider at each seed-band transition. Bands are only contiguous (and therefore only
// meaningful to mark) when the list is in its default seed/rank order — sorting by any
// other column intentionally drops the dividers rather than scatter them.
function segmentsFor(sortedTeams, sort) {
  if (sort.key !== 'team') return [{ type: 'table', teams: sortedTeams }];
  const segments = [];
  let currentBand = null;
  let group = [];
  const flush = () => {
    if (group.length) segments.push({ type: 'table', teams: group });
    group = [];
  };
  for (const team of sortedTeams) {
    const band = bandOf(team);
    if (currentBand !== null && band !== currentBand) {
      flush();
      segments.push({ type: 'divider', label: dividerLabelForTransition(currentBand, band) });
    }
    group.push(team);
    currentBand = band;
  }
  flush();
  return segments;
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

function strkBadge(strk) {
  if (!strk) return <span className="text-text-3">{EMPTY}</span>;
  return <Badge variant={strk.startsWith('W') ? 'win' : 'loss'}>{strk}</Badge>;
}

// One table group (a conference's full 15 teams, or a single division's teams):
// owns its own sort state, sorts, bands by seed, and renders 1–3 DataTables with
// "Playoff line" / "Play-in line" dividers between bands.
function SeedBandedTable({ title, teams, columns, testId }) {
  const [sort, setSort] = useState({ key: 'team', dir: 'asc' });
  const { playGlassClick } = useTheme();

  const handleSortChange = (key) => {
    playGlassClick();
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));
  };

  const sortedTeams = [...teams].sort((a, b) => compareTeams(a, b, sort.key, sort.dir));
  const segments = segmentsFor(sortedTeams, sort);

  return (
    <div className="flex flex-col gap-3" data-testid={testId}>
      <SectionHeader title={title} />
      {segments.map((seg, i) =>
        seg.type === 'divider' ? (
          <div key={`divider-${i}`} className="flex items-center gap-3 py-1">
            <span className="t-label text-text-3">{seg.label}</span>
            <div className="h-px flex-1 bg-border" />
          </div>
        ) : (
          <DataTable
            key={`table-${i}`}
            columns={columns}
            rows={seg.teams}
            getKey={(t) => t.abbrev}
            sort={sort}
            onSortChange={handleSortChange}
          />
        )
      )}
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
      sortable: true,
      render: (team) => (
        <Link
          to={`/team/${team.abbrev}`}
          onClick={playGlassClick}
          className="flex items-center gap-3 hover:text-accent transition-colors"
        >
          <span className="t-label tnum w-5 shrink-0 text-right text-text-3">{team.seed ?? EMPTY}</span>
          <TeamMark abbrev={team.abbrev} logoUrl={team.logo_url} size="sm" />
          <span className="text-text-1">{team.name}</span>
          {bandOf(team) === 'playIn' && <Badge variant="warn">Play-in</Badge>}
        </Link>
      ),
    },
    { key: 'w', label: 'W', numeric: true, sortable: true, render: (t) => t.w },
    { key: 'l', label: 'L', numeric: true, sortable: true, render: (t) => t.l },
    { key: 'pct', label: 'PCT', numeric: true, sortable: true, render: (t) => t.pct },
    { key: 'gb', label: 'GB', numeric: true, sortable: true, render: (t) => (t.gb && t.gb !== '-' ? t.gb : EMPTY) },
    { key: 'home', label: 'Home', numeric: true, render: (t) => t.home || EMPTY },
    { key: 'road', label: 'Road', numeric: true, render: (t) => t.road || EMPTY },
    { key: 'l10', label: 'L10', numeric: true, sortable: true, render: (t) => t.l10 || EMPTY },
    { key: 'strk', label: 'Strk', numeric: true, sortable: true, render: (t) => strkBadge(t.strk) },
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
        <div>
          <h1 className="t-title text-text-1">Standings</h1>
          {seasonLabel && <p className="t-label text-text-3 mt-1">{seasonLabel}</p>}
        </div>
        <Segmented aria-label="Standings view" options={VIEW_OPTIONS} value={view} onChange={handleViewChange} />
      </div>

      {view === 'conference' ? (
        <div className="flex flex-col gap-10">
          <SeedBandedTable title="Eastern Conference" teams={eastern} columns={columns} testId="conference-eastern" />
          <SeedBandedTable title="Western Conference" teams={western} columns={columns} testId="conference-western" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          <div className="flex flex-col gap-8">
            {buildDivisionGroups(eastern, 'Eastern', divisionMap).map((div) => (
              <SeedBandedTable
                key={div.name}
                title={div.name}
                teams={div.teams}
                columns={columns}
                testId={`division-${div.name.toLowerCase()}`}
              />
            ))}
          </div>
          <div className="flex flex-col gap-8">
            {buildDivisionGroups(western, 'Western', divisionMap).map((div) => (
              <SeedBandedTable
                key={div.name}
                title={div.name}
                teams={div.teams}
                columns={columns}
                testId={`division-${div.name.toLowerCase()}`}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-8 border-t border-border pt-8 sm:flex-row sm:justify-between">
        <div className="flex flex-col gap-2">
          <span className="t-label text-text-3">Key</span>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <Badge variant="win">Playoff</Badge>
              <span className="t-small text-text-2">Seeds 1–6 clinch a playoff spot — that's the playoff line.</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="warn">Play-in</Badge>
              <span className="t-small text-text-2">Seeds 7–10 play in the play-in tournament — that's the play-in line.</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="t-label text-text-3">Details</span>
          <dl className="flex flex-col gap-1.5 t-small text-text-2">
            <div className="flex gap-2">
              <dt className="w-10 text-text-1">GB</dt>
              <dd>Games behind the conference leader</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-10 text-text-1">PCT</dt>
              <dd>Win percentage</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-10 text-text-1">L10</dt>
              <dd>Record in the last 10 games</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-10 text-text-1">STRK</dt>
              <dd>Current win or loss streak</dd>
            </div>
          </dl>
        </div>
      </div>

      <Link to="/stats" className="t-small inline-flex items-center gap-1 text-accent hover:text-accent-hover">
        Stats
      </Link>
    </div>
  );
}
