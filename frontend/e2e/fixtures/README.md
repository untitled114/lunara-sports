# e2e fixtures

Real captures from the production API (https://api.lunara-app.com), taken with `node e2e/fixtures/capture.mjs`.
The bodies are stored exactly as returned. Nothing is hand-edited or invented; an endpoint
that was empty at capture time (for example picks in the preseason) stays empty.

`mockApi.js` serves the app's requests from `manifest.json`. Any API request without an
entry fails the test. To refresh, re-run the capture script and regenerate the screenshot
baselines in the pinned Playwright image (see `playwright.config.js`).

`fonts/` holds the Inter webfont exactly as Google Fonts served it (SIL Open Font License),
and `images/` the ESPN logos and headshots the pages load; see `fonts/README.md` and
`images/README.md`.

| Request (app path) | File | HTTP | Source URL | Captured (ET) |
|---|---|---|---|---|
| `/games/?game_date=2026-09-22` | `api/games__game_date_2026-09-22.json` | 200 | https://api.lunara-app.com/games/?game_date=2026-09-22 | Sep 25, 2026, 1:44:24 PM EDT |
| `/games/?game_date=2026-09-23` | `api/games__game_date_2026-09-23.json` | 200 | https://api.lunara-app.com/games/?game_date=2026-09-23 | Sep 25, 2026, 1:44:24 PM EDT |
| `/games/?game_date=2026-09-24` | `api/games__game_date_2026-09-24.json` | 200 | https://api.lunara-app.com/games/?game_date=2026-09-24 | Sep 25, 2026, 1:44:24 PM EDT |
| `/games/?game_date=2026-09-25` | `api/games__game_date_2026-09-25.json` | 200 | https://api.lunara-app.com/games/?game_date=2026-09-25 | Sep 25, 2026, 1:44:25 PM EDT |
| `/games/?game_date=2026-09-26` | `api/games__game_date_2026-09-26.json` | 200 | https://api.lunara-app.com/games/?game_date=2026-09-26 | Sep 25, 2026, 1:44:25 PM EDT |
| `/games/?game_date=2026-09-27` | `api/games__game_date_2026-09-27.json` | 200 | https://api.lunara-app.com/games/?game_date=2026-09-27 | Sep 25, 2026, 1:44:25 PM EDT |
| `/games/?game_date=2026-09-28` | `api/games__game_date_2026-09-28.json` | 200 | https://api.lunara-app.com/games/?game_date=2026-09-28 | Sep 25, 2026, 1:44:25 PM EDT |
| `/games/?game_date=2026-10-03` | `api/games__game_date_2026-10-03.json` | 200 | https://api.lunara-app.com/games/?game_date=2026-10-03 | Sep 25, 2026, 1:44:25 PM EDT |
| `/games/next?after=2026-09-25` | `api/games_next_after_2026-09-25.json` | 200 | https://api.lunara-app.com/games/next?after=2026-09-25 | Sep 25, 2026, 1:44:25 PM EDT |
| `/games/next?after=2026-10-03` | `api/games_next_after_2026-10-03.json` | 200 | https://api.lunara-app.com/games/next?after=2026-10-03 | Sep 25, 2026, 1:44:25 PM EDT |
| `/games/next?after=2026-09-24` | `api/games_next_after_2026-09-24.json` | 200 | https://api.lunara-app.com/games/next?after=2026-09-24 | Sep 25, 2026, 2:08:02 PM EDT |
| `/games/next?after=2026-09-28` | `api/games_next_after_2026-09-28.json` | 200 | https://api.lunara-app.com/games/next?after=2026-09-28 | Sep 25, 2026, 2:08:02 PM EDT |
| `/standings` | `api/standings.json` | 200 | https://api.lunara-app.com/standings | Sep 25, 2026, 1:44:25 PM EDT |
| `/teams` | `api/teams.json` | 200 | https://api.lunara-app.com/teams | Sep 25, 2026, 1:44:25 PM EDT |
| `/teams/MIA` | `api/teams_MIA.json` | 200 | https://api.lunara-app.com/teams/MIA | Sep 25, 2026, 1:44:25 PM EDT |
| `/teams/MIA/roster` | `api/teams_MIA_roster.json` | 200 | https://api.lunara-app.com/teams/MIA/roster | Sep 25, 2026, 1:44:25 PM EDT |
| `/teams/MIA/schedule` | `api/teams_MIA_schedule.json` | 200 | https://api.lunara-app.com/teams/MIA/schedule | Sep 25, 2026, 1:44:25 PM EDT |
| `/players` | `api/players.json` | 200 | https://api.lunara-app.com/players | Sep 25, 2026, 1:44:25 PM EDT |
| `/players/4066261` | `api/players_4066261.json` | 200 | https://api.lunara-app.com/players/4066261 | Sep 25, 2026, 1:44:26 PM EDT |
| `/players/4066261/stats` | `api/players_4066261_stats.json` | 200 | https://api.lunara-app.com/players/4066261/stats | Sep 25, 2026, 1:44:26 PM EDT |
| `/players/4066261/log` | `api/players_4066261_log.json` | 200 | https://api.lunara-app.com/players/4066261/log | Sep 25, 2026, 1:44:26 PM EDT |
| `/stats/leaders?limit=5` | `api/stats_leaders_limit_5.json` | 200 | https://api.lunara-app.com/stats/leaders?limit=5 | Sep 25, 2026, 3:37:22 PM EDT |
| `/stats/teams` | `api/stats_teams.json` | 200 | https://api.lunara-app.com/stats/teams | Sep 25, 2026, 1:44:26 PM EDT |
| `/picks/today` | `api/picks_today.json` | 200 | https://api.lunara-app.com/picks/today | Sep 25, 2026, 1:44:26 PM EDT |
| `/games/401811037` | `api/games_401811037.json` | 200 | https://api.lunara-app.com/games/401811037 | Sep 25, 2026, 1:44:27 PM EDT |
| `/games/401811037/plays` | `api/games_401811037_plays.json` | 200 | https://api.lunara-app.com/games/401811037/plays | Sep 25, 2026, 1:44:27 PM EDT |
| `/games/401811037/boxscore` | `api/games_401811037_boxscore.json` | 200 | https://api.lunara-app.com/games/401811037/boxscore | Sep 25, 2026, 1:44:27 PM EDT |
| `/games/401811037/picks` | `api/games_401811037_picks.json` | 200 | https://api.lunara-app.com/games/401811037/picks | Sep 25, 2026, 1:44:27 PM EDT |
| `/games/401902644` | `api/games_401902644.json` | 200 | https://api.lunara-app.com/games/401902644 | Sep 25, 2026, 1:44:27 PM EDT |
| `/games/401902644/plays` | `api/games_401902644_plays.json` | 200 | https://api.lunara-app.com/games/401902644/plays | Sep 25, 2026, 1:44:27 PM EDT |
| `/games/401902644/boxscore` | `api/games_401902644_boxscore.json` | 404 | https://api.lunara-app.com/games/401902644/boxscore | Sep 25, 2026, 1:44:27 PM EDT |
| `/games/401902644/picks` | `api/games_401902644_picks.json` | 200 | https://api.lunara-app.com/games/401902644/picks | Sep 25, 2026, 1:44:27 PM EDT |
