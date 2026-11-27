import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge, Card } from '@/components/ui';
import { useScoreboard } from '@/hooks/useScoreboard';
import { todayET, addDaysISO } from '@/lib/et';
import { hasStarted } from '@/lib/gameMath';
import { fetchGames, fetchStandings, fetchStatLeaders } from '@/services/api';
import { HomeBox } from '@/components/home/HomeBox';
import { FanLine, LeaderChip, LeaderFaces, LiveGameChip, NewestPlayChip, OFFER_ITEMS, StandingsLine, TeamLogos } from '@/components/home/realPieces';
import { usePageMeta } from '@/hooks/usePageMeta';

// How far back the home pieces look for the latest game day when today has none
// (Thanksgiving, the All-Star break).
const LOOK_BACK_DAYS = 7;

// Today's games (ET) once one has tipped off; before that (or on a day with none), the
// most recent day with games, so the home pieces show the latest final and its last play.
// Without any, today's scheduled games.
function useLatestGames() {
  const today = todayET();
  const { games, loading } = useScoreboard(today);
  const [past, setPast] = useState(null);
  const startedToday = games.some((g) => hasStarted(g.status));
  const lookBack = !loading && !startedToday;

  useEffect(() => {
    if (!lookBack) return undefined;
    let cancelled = false;
    (async () => {
      for (let back = 1; back <= LOOK_BACK_DAYS; back += 1) {
        let day;
        try {
          day = await fetchGames(addDaysISO(today, -back));
        } catch {
          return;
        }
        if (cancelled) return;
        const finals = Array.isArray(day) ? day.filter((g) => hasStarted(g.status)) : [];
        if (finals.length) {
          setPast(finals);
          return;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lookBack, today]);

  if (startedToday) return games;
  return past || games;
}

// Points leaders and the number of players with stats this season (live, never typed in).
function useLeaders() {
  const [leaders, setLeaders] = useState({ pts: [], count: null });
  useEffect(() => {
    let cancelled = false;
    fetchStatLeaders(5)
      .then((d) => {
        if (!cancelled) setLeaders({ pts: d?.categories?.pts || [], count: d?.player_count ?? null });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return leaders;
}

// The standings, for the Standings and Team pages pieces.
function useStandings() {
  const [standings, setStandings] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetchStandings()
      .then((d) => {
        if (!cancelled) setStandings(d || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return standings;
}

// "Live now" only while a game today (ET) is actually live or at halftime, from the same
// scoreboard feed the ticker uses. With nothing live it renders nothing.
export function LiveNowBadge() {
  const { games } = useScoreboard(todayET());
  const anyLive = games.some((g) => g.status === 'live' || g.status === 'halftime');
  if (!anyLive) return null;
  return (
    <div className="inline-flex items-center gap-2 rounded-sm bg-live/10 border border-live/20 px-3 py-1.5">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full rounded-sm bg-live opacity-75 animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-sm bg-live" />
      </span>
      <span className="t-label text-live">Live now</span>
    </div>
  );
}

export default function LandingPage() {
  usePageMeta('Lunara Sports', 'Every NBA game, live: scores, play by play, box scores, standings and stats. Free, no account.');
  const navigate = useNavigate();
  const games = useLatestGames();
  const leaders = useLeaders();
  const standings = useStandings();

  const handleEnterArena = () => {
    navigate('/scoreboard');
  };

  return (
    <div className="animate-fadeIn">
      {/* Hero */}
      <div className="relative text-center flex flex-col items-center justify-center min-h-[56vh]">
        <div className="relative z-10 flex flex-col items-center gap-8">
          <LiveNowBadge />

          {/* The display wordmark, as large as the pre-redesign hero. */}
          <h1 className="display-wordmark text-5xl sm:text-6xl md:text-[10rem]">
            <span className="block">Lunara</span>{' '}
            <span className="block">Sports</span>
          </h1>

          <p className="max-w-xl mx-auto t-body text-text-2">
            Live scores, real-time stats, and every play
            <br className="hidden md:block" /> of every NBA game, as it happens.
          </p>

          <div className="pt-6 flex flex-col sm:flex-row justify-center items-center gap-4 px-4 sm:px-0">
            <button
              onClick={handleEnterArena}
              className="w-full sm:w-auto px-10 py-4 rounded-md bg-accent-fill hover:bg-accent-fill-hover text-accent-ink t-small font-semibold transition-colors duration-500 text-center"
            >
              View live scores
            </button>
            <Link
              to="/standings"
              className="w-full sm:w-auto px-10 py-4 rounded-md bg-surface-1 border border-border hover:border-border-strong text-text-1 t-small font-semibold transition-colors flex items-center justify-center"
            >
              Standings
            </Link>
          </div>
        </div>
      </div>

      {/* Below hero: one centered column about 960px wide */}
      <div className="max-w-[960px] mx-auto px-4 pb-24 sm:pb-40 space-y-[88px]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[56px]">
          <HomeBox
            title="Every NBA game, live"
            text="Live scores, play by play and box scores for every game, plus standings and stats for every team and player."
            piece={<LiveGameChip games={games} />}
            href="/scoreboard"
            glow="var(--live)"
          />
          <HomeBox
            title="Live from tip to end"
            text="We check every live game with ESPN every second. A new play shows up on your screen within a quarter of a second after that."
            piece={<NewestPlayChip games={games} />}
            href="/scoreboard"
            glow="var(--info)"
            delay="0.2s"
          />
          <HomeBox
            title="Free for every fan"
            text="No account, no paywall, no ads. Just the game."
            piece={<FanLine />}
            glow="var(--loss)"
            delay="0.4s"
          />
          <HomeBox
            title="Every player, every team"
            text={`All 30 NBA teams and ${leaders.count ? `all ${leaders.count} players` : 'every player'} who ${leaders.count ? 'have' : 'has'} played this season, each with a page of their own. MLB joins when the 2027 season starts.`}
            piece={<LeaderFaces leaders={leaders.pts} />}
            href="/players"
            glow="var(--accent)"
            delay="0.6s"
          />
        </div>

        {/* Everything on Lunara: only the pages that have shipped (OFFER_ITEMS[].live) */}
        <Card as="section" className="p-6 sm:p-8 space-y-4">
          <Badge variant="accent">What we offer</Badge>
          <h2 className="t-title text-text-1">Everything on Lunara</h2>
          <p className="t-body text-text-2">Every NBA game of the 2026-27 season, live and after the final horn.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-7 gap-y-5 pt-2">
            {OFFER_ITEMS.filter((item) => item.live).map((item) => (
              <div key={item.key} className="space-y-2">
                <h3 className="t-body font-semibold text-text-1">{item.title}</h3>
                <p className="t-small text-text-2">{typeof item.text === 'function' ? item.text(leaders.count) : item.text}</p>
                {item.key === 'scoreboard' && <LiveGameChip games={games} />}
                {item.key === 'stats' && <LeaderChip leader={leaders.pts[0]} />}
                {item.key === 'team' && <TeamLogos standings={standings} />}
                {item.key === 'standings' && <StandingsLine standings={standings} />}
              </div>
            ))}
          </div>
          <Link to="/scoreboard" className="inline-flex items-center min-h-[44px] t-small font-semibold text-text-2 hover:text-accent transition-colors">
            Get started
          </Link>
        </Card>
      </div>
    </div>
  );
}
