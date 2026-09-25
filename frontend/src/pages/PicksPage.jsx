import { useState, useEffect, useMemo } from 'react';
import { fetchTodayPicks } from '@/services/api';
import { Skeleton, Card, Stat, Segmented, SectionHeader, PageState } from '@/components/ui';
import { PickCard } from '@/components/sport/PickCard';
import { useAuth } from '@/context/AuthContext';
import { TrendingUp } from 'lucide-react';
import { todayET } from '@/lib/et';

// UTC-noon anchored, like lib/et.js's own formatters, so this never gets
// reinterpreted by the machine's local timezone — todayET() is already the
// ET calendar date, and formatting it needs to stay on that exact date.
function formatLongDate(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(
    d
  );
}

function StatBox({ label, value, sub, delay = 0 }) {
  return (
    <Card className="flex flex-col items-center gap-1 animate-fadeIn" style={{ animationDelay: `${delay}s` }}>
      <Stat label={label} value={value} />
      {sub && <span className="t-label text-text-3">{sub}</span>}
    </Card>
  );
}

const FILTER_SECTIONS = [
  { key: 'market', label: 'Market', options: ['All', 'PTS', 'REB'] },
  { key: 'tier', label: 'Tier', options: ['All', 'X', 'Z', 'META', 'Goldmine', 'star_tier'] },
  { key: 'model', label: 'Model', options: ['All', 'XL', 'V3'] },
  { key: 'status', label: 'Status', options: ['All', 'Pending', 'Hits', 'Misses'] },
];

function FilterBar({ filters, onChange }) {
  return (
    <div className="flex gap-4 sm:gap-6 overflow-x-auto scrollbar-hide pb-1 animate-fadeIn" style={{ animationDelay: '0.2s' }}>
      {FILTER_SECTIONS.map((section) => (
        <div key={section.key} className="flex flex-col gap-2 shrink-0">
          <span className="t-label text-text-3">{section.label}</span>
          <Segmented
            options={section.options.map((opt) => ({ id: opt, label: opt === 'star_tier' ? 'Star' : opt }))}
            value={filters[section.key]}
            onChange={(value) => onChange(section.key, value)}
          />
        </div>
      ))}
    </div>
  );
}

const MARKET_MAP = { PTS: 'POINTS', REB: 'REBOUNDS' };

function applyFilters(picks, filters) {
  return picks.filter((p) => {
    if (filters.market !== 'All') {
      const target = MARKET_MAP[filters.market] || filters.market;
      if (p.market !== target) return false;
    }
    if (filters.tier !== 'All') {
      if (p.tier !== filters.tier) return false;
    }
    if (filters.model !== 'All') {
      const target = filters.model.toLowerCase();
      if (p.model_version !== target) return false;
    }
    if (filters.status !== 'All') {
      if (filters.status === 'Pending' && p.is_hit != null) return false;
      if (filters.status === 'Hits' && p.is_hit !== true) return false;
      if (filters.status === 'Misses' && p.is_hit !== false) return false;
    }
    return true;
  });
}

export default function PicksPage() {
  const { token } = useAuth();
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    market: 'All',
    tier: 'All',
    model: 'All',
    status: 'All',
  });
  const [error, setError] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetchTodayPicks(token)
      .then((data) => {
        if (!cancelled) setPicks(data);
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
  }, [token, retryNonce]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const filtered = useMemo(() => applyFilters(picks, filters), [picks, filters]);

  // Summary stats
  const hits = picks.filter((p) => p.is_hit === true).length;
  const misses = picks.filter((p) => p.is_hit === false).length;
  const pending = picks.filter((p) => p.is_hit == null).length;
  const decided = hits + misses;
  const winRate = decided > 0 ? Math.round((hits / decided) * 100) : null;
  const avgEdge = picks.length > 0 ? (picks.reduce((s, p) => s + (p.edge ?? 0), 0) / picks.length).toFixed(1) : '--';

  const today = formatLongDate(todayET());

  if (error) {
    return (
      <div className="max-w-[1600px] mx-auto px-4 pt-10">
        <PageState kind="error" title="Couldn&apos;t load picks." onRetry={() => setRetryNonce((n) => n + 1)} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-[1600px] mx-auto space-y-12 animate-fadeIn px-4 pt-10">
        <Skeleton variant="rectangle" height="h-24" className="w-1/3 rounded-lg" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="rectangle" height="h-24" className="rounded-lg" />
          ))}
        </div>
        <Skeleton variant="rectangle" height="h-12" className="w-2/3 rounded-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} variant="rectangle" height="h-[380px]" className="rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-10 sm:space-y-16 pb-24 sm:pb-40 animate-fadeIn px-4 pt-6 sm:pt-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 sm:gap-10 border-b border-border pb-8 sm:pb-12">
        <div>
          <h1 className="t-title text-text-1">Player prop picks</h1>
          <p className="t-label text-text-3 mt-3">
            Sport-suite XL + V3 predictions
            <span className="mx-4 text-text-3">|</span>
            {today}
          </p>
        </div>
        <div className="flex items-center gap-3 text-text-3">
          <TrendingUp className="h-5 w-5 text-accent" />
          <span className="t-label tnum">
            {picks.length} pick{picks.length !== 1 ? 's' : ''} today
          </span>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatBox label="Total picks" value={picks.length} delay={0} />
        <StatBox
          label="Win rate"
          value={winRate != null ? `${winRate}%` : '--'}
          sub={decided > 0 ? `${decided} decided` : null}
          delay={0.05}
        />
        <StatBox label="Avg edge" value={avgEdge} delay={0.1} />
        <StatBox label="Record" value={`${hits}-${misses}-${pending}`} sub="W-L-P" delay={0.15} />
      </div>

      {/* Filters */}
      <div className="space-y-6">
        <SectionHeader title="Filters" />
        <FilterBar filters={filters} onChange={handleFilterChange} />
      </div>

      {/* Picks grid */}
      {filtered.length === 0 ? (
        <PageState kind="empty" title="No picks match these filters." message="Try adjusting a filter above." />
      ) : (
        <div className="space-y-8">
          <SectionHeader title="Today's picks" aside={String(filtered.length)} />
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
            {filtered.map((pick, idx) => (
              <PickCard key={pick.id ?? idx} pick={pick} delay={0.05 * idx} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
