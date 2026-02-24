import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'

const LandingPage = lazy(() => import('./pages/LandingPage'))
const GamesPage = lazy(() => import('./pages/GamesPage'))
const GameDetailPage = lazy(() => import('./pages/GameDetailPage'))
const StandingsPage = lazy(() => import('./pages/StandingsPage'))
const TeamsPage = lazy(() => import('./pages/TeamsPage'))
const TeamDetailPage = lazy(() => import('./pages/TeamDetailPage'))
const SchedulePage = lazy(() => import('./pages/SchedulePage'))
const PlayersPage = lazy(() => import('./pages/PlayersPage'))
const PlayerProfilePage = lazy(() => import('./pages/PlayerProfilePage'))
const StatsPage = lazy(() => import('./pages/StatsPage'))
const TermsPage = lazy(() => import('./pages/TermsPage'))
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'))

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/scoreboard" element={<GamesPage />} />
            <Route path="/game/:id" element={<GameDetailPage />} />
            <Route path="/standings" element={<StandingsPage />} />
            <Route path="/teams" element={<TeamsPage />} />
            <Route path="/team/:abbrev" element={<TeamDetailPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/players" element={<PlayersPage />} />
            <Route path="/player/:id" element={<PlayerProfilePage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
