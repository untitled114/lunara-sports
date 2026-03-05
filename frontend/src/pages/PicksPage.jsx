import { useState, useEffect, useMemo } from "react";
import { fetchTodayPicks } from "@/services/api";
import { Skeleton } from "@/components/ui";
import { PickCard } from "@/components/sport/PickCard";
import { useAuth } from "@/context/AuthContext";
import { TrendingUp, Filter } from "lucide-react";

function StatBox({ label, value, sub, delay = 0 }) {
  return (
    <div
      className="liquid-mirror rounded-[2rem] border border-white/5 px-6 py-5 flex flex-col items-center gap-1 animate-fadeIn"
      style={{ animationDelay: `${delay}s` }}
    >
      <span className="text-[9px] font-black text-white/25 uppercase tracking-[0.4em]">{label}</span>
      <span className="text-2xl font-black text-white tabular-nums">{value}</span>
      {sub && <span className="text-[10px] font-bold text-white/30 tabular-nums">{sub}</span>}
    </div>
  );
}

function FilterBar({ filters, onChange }) {
  const sections = [
    {
      key: "market",
      label: "Market",
      options: ["All", "PTS", "REB"],
    },
    {
      key: "tier",
      label: "Tier",
      options: ["All", "X", "Z", "META", "Goldmine", "star_tier"],
    },
    {
      key: "model",
      label: "Model",
      options: ["All", "XL", "V3"],
    },
    {
      key: "status",
      label: "Status",
      options: ["All", "Pending", "Hits", "Misses"],
    },
  ];

  return (
    <div className="flex gap-4 sm:gap-6 overflow-x-auto scrollbar-hide pb-1 animate-fadeIn" style={{ animationDelay: "0.2s" }}>
      {sections.map((section) => (
        <div key={section.key} className="flex flex-col gap-2 shrink-0">
          <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em]">
            {section.label}
          </span>
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
            {section.options.map((opt) => {
              const active = filters[section.key] === opt;
              return (
                <button
                  key={opt}
                  onClick={() => onChange(section.key, opt)}
                  className={`px-4 py-2 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all duration-300 ${
                    active
                      ? "bg-white text-black shadow-lg scale-105"
                      : "text-white/35 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {opt === "star_tier" ? "Star" : opt}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

const MARKET_MAP = { PTS: "POINTS", REB: "REBOUNDS" };

function applyFilters(picks, filters) {
  return picks.filter((p) => {
    if (filters.market !== "All") {
      const target = MARKET_MAP[filters.market] || filters.market;
      if (p.market !== target) return false;
    }
    if (filters.tier !== "All") {
      if (p.tier !== filters.tier) return false;
    }
    if (filters.model !== "All") {
      const target = filters.model.toLowerCase();
      if (p.model_version !== target) return false;
    }
    if (filters.status !== "All") {
      if (filters.status === "Pending" && p.is_hit != null) return false;
      if (filters.status === "Hits" && p.is_hit !== true) return false;
      if (filters.status === "Misses" && p.is_hit !== false) return false;
    }
    return true;
  });
}

export default function PicksPage() {
  const { token } = useAuth();
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    market: "All",
    tier: "All",
    model: "All",
    status: "All",
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchTodayPicks(token)
      .then((data) => {
        if (!cancelled) setPicks(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

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
  const avgEdge =
    picks.length > 0
      ? (picks.reduce((s, p) => s + (p.edge ?? 0), 0) / picks.length).toFixed(1)
      : "--";

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  if (loading) {
    return (
      <div className="max-w-[1600px] mx-auto space-y-12 animate-fadeIn px-4 pt-10">
        <Skeleton variant="rectangle" height="h-24" className="w-1/3 rounded-[2rem]" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="rectangle" height="h-24" className="rounded-[2rem]" />
          ))}
        </div>
        <Skeleton variant="rectangle" height="h-12" className="w-2/3 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} variant="rectangle" height="h-[380px]" className="rounded-[2.5rem]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-10 sm:space-y-20 pb-24 sm:pb-40 animate-fadeIn px-4 pt-6 sm:pt-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 sm:gap-10 border-b border-white/5 pb-8 sm:pb-16">
        <div>
          <h1 className="text-4xl sm:text-6xl md:text-9xl text-jumbotron tracking-tighter">AI Picks</h1>
          <p className="text-[11px] sm:text-[13px] font-black text-white/50 uppercase tracking-[0.5em] mt-3 sm:mt-6 ml-1">
            Sport-suite XL + V3 Predictions
            <span className="mx-4 text-white/10">|</span>
            {today}
          </p>
        </div>
        <div className="flex items-center gap-3 text-white/30">
          <TrendingUp className="h-5 w-5 text-indigo-400/60" />
          <span className="text-[11px] font-black uppercase tracking-[0.3em]">
            {picks.length} Pick{picks.length !== 1 ? "s" : ""} Today
          </span>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatBox label="Total Picks" value={picks.length} delay={0} />
        <StatBox
          label="Win Rate"
          value={winRate != null ? `${winRate}%` : "--"}
          sub={decided > 0 ? `${decided} decided` : null}
          delay={0.05}
        />
        <StatBox label="Avg Edge" value={avgEdge} delay={0.1} />
        <StatBox
          label="Record"
          value={`${hits}-${misses}-${pending}`}
          sub="W-L-P"
          delay={0.15}
        />
      </div>

      {/* Filters */}
      <div className="space-y-6">
        <div className="flex items-center gap-3 border-l-4 border-indigo-500 pl-6">
          <Filter className="h-4 w-4 text-indigo-400/60" />
          <h2 className="text-xl font-black uppercase tracking-tight text-white">Filters</h2>
        </div>
        <FilterBar filters={filters} onChange={handleFilterChange} />
      </div>

      {/* Picks grid */}
      {filtered.length === 0 ? (
        <div className="rounded-[4rem] deboss py-40 text-center border-white/5 shadow-2xl">
          <p className="text-sm font-black uppercase tracking-[0.5em] text-white/10 italic">
            No picks available for the current filters
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="flex items-center gap-3 border-l-4 border-indigo-500 pl-6">
            <h2 className="text-3xl font-black uppercase tracking-tighter text-white">
              Today&apos;s Picks
            </h2>
            <span className="text-sm font-black text-white/30 tabular-nums ml-2">
              {filtered.length}
            </span>
          </div>
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
