# Phase 1: Vite Migration Checklist

**See also:** `/PLAN.md` (design rationale + component structure)
**Goal:** Production-ready React + Vite frontend on Vercel, fully wired to FastAPI backend.

---

## Current State

The frontend has already been migrated conceptually:
- `package.json` uses Vite 5, React 18, React Router 7, Tailwind v4
- `vite.config.js` has API proxy to `localhost:8000`
- All components exist: 12 UI, 6 shared dashboard, 18 sport-specific, 13 pages
- `App.jsx` has routes: `/` (GamesPage) and `/game/:id` (GameDetailPage)
- `frontend/dist/` exists (was built at some point)

**The gap:** Integration has not been fully validated end-to-end with the live API.

---

## Checklist

### Environment Setup
- [ ] Verify `npm install` runs clean (no peer dep errors)
- [ ] Confirm Tailwind v4 PostCSS setup works (`tailwind.config.js` + `postcss.config.js`)
- [ ] Confirm `vite.config.js` proxy routes `/api/*` → `localhost:8000`
- [ ] Confirm WebSocket proxy routes `wss://` → `ws://localhost:8000`

### API Service Layer (`src/services/api.js`)
- [ ] `fetchGames(date)` → `GET /api/games?date={date}` returns data
- [ ] `fetchGame(id)` → `GET /api/games/{id}` returns data
- [ ] `fetchPlays(gameId)` → `GET /api/games/{id}/plays` returns data
- [ ] `fetchPicks(gameId)` → `GET /api/games/{id}/picks` returns data
- [ ] Error handling: non-200 responses show EmptyState, not white screen

### WebSocket Hook (`src/hooks/useGameFeed.js`)
- [ ] Connects to `ws://localhost:8000/ws/{gameId}` in dev
- [ ] `history` message type populates initial play feed
- [ ] `play` message type appends to feed in real-time
- [ ] Exponential backoff reconnect on disconnect
- [ ] Disconnects cleanly on component unmount

### GamesPage (`src/pages/GamesPage.jsx`)
- [ ] DateNav renders with ← → arrows, shows correct date
- [ ] DateNav changes date and refetches games
- [ ] Game cards render with team names, scores, status
- [ ] Empty state when no games scheduled
- [ ] Live indicator on active games
- [ ] Clicking a game navigates to `/game/{id}`

### GameDetailPage (`src/pages/GameDetailPage.jsx`)
- [ ] Score header updates when game is live
- [ ] BetTracker panel shows picks with tier badges and edge %
- [ ] LiveFeed panel connects WebSocket and shows plays as they arrive
- [ ] BoxScore panel shows player stat lines
- [ ] All 3 panels render simultaneously (no blocking)
- [ ] Handles game not found (404 → back to games list)

### Components
- [ ] `GameCard.jsx` — teams, score, status badge render correctly
- [ ] `BetTracker.jsx` — pick tier colors (X=purple, Z=blue, META=orange, GOLDMINE=gold)
- [ ] `LiveFeed.jsx` — play type icons, score update formatting
- [ ] `BoxScore.jsx` — sortable columns via Lunara Table component
- [ ] `DateNav.jsx` — disables forward arrow on today's date

### Responsiveness
- [ ] Mobile (375px): single column, bottom nav visible
- [ ] Tablet (768px): two columns for game grid
- [ ] Desktop (1280px): three-column game detail layout

### Build
- [ ] `npm run build` produces `dist/` with no errors
- [ ] `dist/index.html` has correct base URL (for Vercel)
- [ ] Static assets fingerprinted correctly

---

## Vercel Deployment

**Config file:** `.env.vercel.example` has the template.

```bash
# From project root (not frontend/) — Vercel is configured at repo root
npx vercel --prod --yes

# Environment variables to set in Vercel dashboard:
VITE_API_URL=https://api.lunara-app.com
VITE_WS_URL=wss://api.lunara-app.com
```

**vercel.json (create in frontend/):**
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

This handles React Router's client-side routing (all paths → index.html).

---

## What "Done" Looks Like

- `lunara-app.com` loads the Vite frontend (not the old Next.js build)
- Date navigation works
- Live game feed updates in real-time via WebSocket
- Picks render with correct tier styling
- Box scores load
- No console errors in production build
- Lighthouse score ≥ 85 (performance)
