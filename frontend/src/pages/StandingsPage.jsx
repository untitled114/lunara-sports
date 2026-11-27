import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TeamLink } from '@/components/sport/TeamLink';
import { Badge, DataTable, PageState, SectionHeader, Segmented } from '@/components/ui';
import { fetchStandings, fetchTeams } from '@/services/api';
import { PHONE, useMediaQuery } from '@/hooks/useMediaQuery';
import { usePageMeta } from '@/hooks/usePageMeta';

const PLAYOFF_CUTOFF = 6;
const PLAY_IN_CUTOFF = 10;
const EMPTY = '-'; // the one empty/placeholder glyph used everywhere on this page

const DIVISION_ORDER = {
  Eastern: ['Atlantic', 'Central', 'Southeast'],
  Western: ['Northwest', 'Pacific', 'Southwest'],
};

const VIEW_OPTIONS = [
  { id: 'conference', label: 'Conference' },
  { id: 'division', label: 'Division' },
];

// Phones show one group at a time.
const PHONE_GROUPS = [
  { id: 'east', label: 'East' },
  { id: 'west', label: 'West' },
  { id: 'division', label: 'Division' },
  { id: 'league', label: 'League' },
];

// Seed (falling back to rank when seed is null) drives both the default sort and the
// playoff/play-in banding - never array position.
function effectiveSeed(team) {
  return team.seed ?? team.rank ?? Infinity;
}

function bandOf(team) {
  const seed = effectiveSeed(team);
  if (seed <= PLAYOFF_CUTOFF) return 'playoff';
  if (seed <= PLAY_IN_CUTOFF) return 'playIn';
  return 'rest';
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

// The line under a row, in seed order: the playoff line (solid orange) where the playoff
// seeds end and the play-in seeds begin, the play-in line (dashed) where the top 10 end.
const LINE_CLASS = {
  playoff: 'line-playoff [&>td]:border-b-2 [&>td]:border-b-accent',
  playIn: 'line-play-in [&>td]:border-b-2 [&>td]:border-dashed [&>td]:border-b-text-3',
};

function lineUnder(team, next) {
  if (!next) return null;
  const here = bandOf(team);
  const below = bandOf(next);
  if (here === below) return null;
  return here === 'playoff' && below === 'playIn' ? 'playoff' : 'playIn';
}

// "Boston Celtics" -> "Celtics", "Oklahoma City Thunder" -> "Thunder" (the
// abbreviation and the nickname).
const TWO_WORD_CITIES = ['New York', 'Los Angeles', 'Golden State', 'San Antonio', 'Oklahoma City', 'New Orleans'];
export function nickname(name = '') {
  const city = TWO_WORD_CITIES.find((c) => name.startsWith(`${c} `));
  return city ? name.slice(city.length + 1) : name.split(' ').slice(1).join(' ') || name;
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

// One table per conference or division: its own sort; in seed order the
// playoff and play-in lines are drawn under their rows.
function ConferenceTable({ title, teams, columns, testId, initialSort = { key: 'team', dir: 'asc' } }) {
  const [sort, setSort] = useState(initialSort);

  const handleSortChange = (key) => {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));
  };

  const sorted = [...teams].sort((a, b) => compareTeams(a, b, sort.key, sort.dir));
  const seedOrder = sort.key === 'team' && sort.dir === 'asc';

  return (
    <div className="flex flex-col gap-3 min-w-0" data-testid={testId}>
      <SectionHeader title={title} />
      <DataTable
        compact
        columns={columns}
        rows={sorted}
        getKey={(t) => t.abbrev}
        rowLink={(t) => `/team/${t.abbrev}`}
        rowClassName={(t, i) => (seedOrder ? LINE_CLASS[lineUnder(t, sorted[i + 1])] : undefined)}
        sort={sort}
        onSortChange={handleSortChange}
      />
    </div>
  );
}

export default function StandingsPage() {
  usePageMeta('Standings', 'NBA standings for both conferences, with the playoff and play-in lines.');
  const [standings, setStandings] = useState(null);
  const [teamsData, setTeamsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('conference');
  const [group, setGroup] = useState('east');
  const phone = useMediaQuery(PHONE);

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
      setView(id);
    }
  };

  const columns = [
    {
      key: 'team',
      label: 'Team',
      sortable: true,
      sticky: true,
      // Phones: seed, logo and abbreviation only, so nothing wraps into the W column.
      // Desktop adds the full name, cut short with the full name on hover.
      render: (team) => (
        <TeamLink
          abbrev={team.abbrev}
          className="flex items-center gap-3 hover:text-accent transition-colors"
        >
          <span className="t-label tnum w-5 shrink-0 text-right text-text-3">{team.seed ?? EMPTY}</span>
          {/* The abbreviation at body size, like the numbers beside it. */}
          <img src={team.logo_url} alt={`${team.abbrev} logo`} width={24} height={24} loading="lazy" className="h-6 w-6 shrink-0 object-contain" />
          <span className="t-body font-semibold text-text-1 w-10 shrink-0">{team.abbrev}</span>
          {/* Desktops: the nickname, full name on hover; screen readers hear the full name. */}
          <span className="hidden sm:inline truncate max-w-[120px] text-text-2" title={team.name} aria-hidden="true">{nickname(team.name)}</span>
          <span className="sr-only">{team.name}</span>
        </TeamLink>
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
      <div className="py-4">
        <PageState kind="loading" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-4">
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
    // East and West side by side; on wide screens the page reaches past the 1,100px column so
    // both boxes keep every column.
    <div className="space-y-8 pb-16 2xl:-mx-[150px]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="t-title text-text-1">Standings</h1>
          {seasonLabel && <p className="t-label text-text-3 mt-1">{seasonLabel}</p>}
        </div>
        {!phone && <Segmented aria-label="Standings view" options={VIEW_OPTIONS} value={view} onChange={handleViewChange} />}
      </div>

      {phone ? (
        <div className="flex flex-col gap-6">
          <Segmented aria-label="Standings group" options={PHONE_GROUPS} value={group} onChange={setGroup} />
          {group === 'east' && <ConferenceTable title="Eastern Conference" teams={eastern} columns={columns} testId="conference-eastern" />}
          {group === 'west' && <ConferenceTable title="Western Conference" teams={western} columns={columns} testId="conference-western" />}
          {group === 'division' &&
            [...buildDivisionGroups(eastern, 'Eastern', divisionMap), ...buildDivisionGroups(western, 'Western', divisionMap)].map((div) => (
              <ConferenceTable key={div.name} title={div.name} teams={div.teams} columns={columns} testId={`division-${div.name.toLowerCase()}`} />
            ))}
          {group === 'league' && (
            <ConferenceTable title="League" teams={[...eastern, ...western]} columns={columns} testId="league" initialSort={{ key: 'pct', dir: 'desc' }} />
          )}
        </div>
      ) : view === 'conference' ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ConferenceTable title="Eastern Conference" teams={eastern} columns={columns} testId="conference-eastern" />
          <ConferenceTable title="Western Conference" teams={western} columns={columns} testId="conference-western" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-8 min-w-0">
            {buildDivisionGroups(eastern, 'Eastern', divisionMap).map((div) => (
              <ConferenceTable
                key={div.name}
                title={div.name}
                teams={div.teams}
                columns={columns}
                testId={`division-${div.name.toLowerCase()}`}
              />
            ))}
          </div>
          <div className="flex flex-col gap-8 min-w-0">
            {buildDivisionGroups(western, 'Western', divisionMap).map((div) => (
              <ConferenceTable
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
              <span aria-hidden="true" className="w-6 shrink-0 border-t-2 border-accent" />
              <span className="t-small text-text-2">Seeds 1-6 make the playoffs: the solid orange line is under 6th.</span>
            </div>
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="w-6 shrink-0 border-t-2 border-dashed border-text-3" />
              <span className="t-small text-text-2">Seeds 7-10 go to the play-in tournament: the dashed line is under 10th.</span>
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

      {/* On the arena backdrop: --accent-hover holds 4.5:1 over the glow, --accent doesn't. */}
      <Link to="/stats" className="t-small inline-flex items-center gap-1 text-accent-hover hover:text-text-1">
        Stats
      </Link>
    </div>
  );
}
