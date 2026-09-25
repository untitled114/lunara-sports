import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Trophy, Target, Activity, Shield, BarChart2, Brain, Users } from 'lucide-react';
import clsx from 'clsx';
import { useTheme } from '@/context/ThemeContext';
import { BRANDING_IMAGES } from '@/constants/branding';
import { Badge, SectionHeader } from '@/components/ui';
import { useScoreboard } from '@/hooks/useScoreboard';
import { todayET } from '@/lib/et';

function FeatureCard({ icon: Icon, title, desc, link, delay = '0s', color = 'var(--accent)', image, transitionImage }) {
  const { playGlassClick, triggerArenaEntry } = useTheme();
  const navigate = useNavigate();

  const handleClick = (e) => {
    e.preventDefault();
    playGlassClick();
    triggerArenaEntry(() => {
      navigate(link);
    }, transitionImage);
  };

  return (
    <a
      href={link}
      onClick={handleClick}
      className="group block bg-surface-1 border border-border rounded-lg p-7 sm:p-10 transition-all duration-1000 hover:border-border-strong hover:-translate-y-2 animate-float relative overflow-hidden h-full"
      style={{ animationDelay: delay }}
    >
      {image && (
        <div className="absolute inset-0 z-0 opacity-15 group-hover:opacity-30 transition-opacity duration-1000 pointer-events-none">
          <img src={image} alt="" width={600} height={400} loading="lazy" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-surface-1/80" />
        </div>
      )}

      <div className="relative z-10">
        <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-md bg-surface-2 border border-border flex items-center justify-center mb-6 sm:mb-8">
          <Icon className="h-6 w-6 sm:h-8 sm:w-8" style={{ color }} />
        </div>
        <h2 className="t-section text-text-1 mb-3 sm:mb-4">{title}</h2>
        <p className="t-body text-text-2 mb-6 sm:mb-8">{desc}</p>
        <div className="flex items-center gap-3 t-label text-text-3 group-hover:text-text-1 transition-colors">
          Explore <ChevronRight className="h-3.5 w-3.5" />
        </div>
      </div>
    </a>
  );
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
  const { triggerArenaEntry } = useTheme();
  const navigate = useNavigate();

  const handleEnterArena = () => {
    triggerArenaEntry(() => {
      navigate('/scoreboard');
    }, BRANDING_IMAGES.transitions.main1);
  };

  return (
    <div className="animate-fadeIn">
      {/* Hero */}
      <div className="relative text-center flex flex-col items-center justify-center min-h-[70vh]">
        <div className="relative z-10 flex flex-col items-center gap-8">
          <LiveNowBadge />

          <h1 className="t-title text-text-1">Lunara Sports</h1>

          <p className="max-w-xl mx-auto t-body text-text-2">
            Live scores, real-time stats, and ML-powered picks
            <br className="hidden md:block" /> across every league that matters.
          </p>

          <div className="pt-6 flex flex-col sm:flex-row justify-center items-center gap-4 px-4 sm:px-0">
            <button
              onClick={handleEnterArena}
              className="w-full sm:w-auto px-10 py-4 rounded-md bg-accent-fill hover:bg-accent-fill-hover text-white t-small font-semibold transition-colors duration-500 text-center"
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

      {/* Below hero */}
      <div className="space-y-16 sm:space-y-24 pb-24 sm:pb-40 max-w-[1400px] mx-auto px-4">
        {/* League cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-10">
          <FeatureCard
            icon={Trophy}
            title="NBA"
            desc="Live play-by-play, box scores, player profiles, and league-wide stat leaders."
            link="/scoreboard"
            delay="0s"
            color="var(--warn)"
            image={BRANDING_IMAGES.logos.nba}
            transitionImage={BRANDING_IMAGES.sites.nba}
          />
          <FeatureCard
            icon={Target}
            title="MLB"
            desc="Pitch tracking, batting splits, and diamond analytics. Coming soon."
            link="/scoreboard"
            delay="0.2s"
            color="var(--live)"
            image={BRANDING_IMAGES.logos.mlb}
            transitionImage={BRANDING_IMAGES.sites.mlb}
          />
          <FeatureCard
            icon={Activity}
            title="NFL"
            desc="Drive charts, snap counts, and matchup breakdowns. Coming soon."
            link="/scoreboard"
            delay="0.4s"
            color="var(--accent)"
            image={BRANDING_IMAGES.logos.nfl}
            transitionImage={BRANDING_IMAGES.sites.nfl}
          />
        </div>

        {/* What we offer */}
        <div className="group bg-surface-1 border border-border rounded-lg p-8 sm:p-16 relative overflow-hidden">
          <img
            src={BRANDING_IMAGES.transitions.main1}
            alt=""
            width={1200}
            height={800}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover opacity-15 group-hover:opacity-30 transition-opacity duration-[2s]"
          />

          <div className="relative z-10 space-y-10">
            <Badge variant="accent">
              <Shield className="h-3 w-3" /> What we do
            </Badge>

            <SectionHeader title="Sports intelligence" />

            <p className="t-body text-text-2 max-w-lg">
              Lunara Sports is a free platform for fans who want more than just a score. We provide real-time
              play-by-play feeds, deep player analytics, and league-wide stat tracking — all in one place.
            </p>

            <div className="grid grid-cols-1 gap-5">
              {[
                {
                  icon: BarChart2,
                  color: 'text-accent',
                  title: 'Live stats and scores',
                  body: 'Real-time scoreboards, box scores, and play-by-play across NBA — with MLB and NFL on the way.',
                },
                {
                  icon: Brain,
                  color: 'text-live',
                  title: 'ML-powered picks',
                  body: 'Our Sport-suite models analyze 100+ features per prop across 7 sportsbooks to find edges others miss. Player points and rebounds picks with verified win rates.',
                },
                {
                  icon: Users,
                  color: 'text-warn',
                  title: 'Player profiles',
                  body: 'Full rosters for all 30 teams. Season averages, recent game logs, shooting splits, and performance trends for every player.',
                },
              ].map((item) => (
                <div key={item.title} className="flex gap-4 items-start">
                  <div className={clsx('h-10 w-10 shrink-0 rounded-md bg-surface-2 border border-border flex items-center justify-center', item.color)}>
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="t-body font-semibold text-text-1 mb-1">{item.title}</h3>
                    <p className="t-small text-text-2">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleEnterArena}
              className="flex items-center gap-3 t-label text-text-2 hover:text-accent transition-colors pt-4"
            >
              Get started <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
