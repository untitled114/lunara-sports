import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import LandingPage from './pages/LandingPage'
import GamesPage from './pages/GamesPage'
import GameDetailPage from './pages/GameDetailPage'
import StandingsPage from './pages/StandingsPage'
import TeamsPage from './pages/TeamsPage'
import TeamDetailPage from './pages/TeamDetailPage'
import SchedulePage from './pages/SchedulePage'
import PlayersPage from './pages/PlayersPage'
import PlayerProfilePage from './pages/PlayerProfilePage'
import StatsPage from './pages/StatsPage'
import TermsPage from './pages/TermsPage'
import PrivacyPage from './pages/PrivacyPage'

export default function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  )
}
