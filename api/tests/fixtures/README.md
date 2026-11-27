# Recorded responses

Every file here is real data: ESPN responses recorded as they were served (except where the
table says a part was removed), and rows exported from the production database. Most unit tests use small inline inputs and mocks; these back the tests that
need a real payload.

| File | What | Recorded |
|---|---|---|
| `espn_scoreboard_default.json` | ESPN scoreboard with no date (the current slate and its season calendar); ESPN's navigation links, ticket offers and sponsor removed | on or before 2026-09-25 |
| `espn_standings_2026.json` | ESPN standings, 2025-26 final; navigation links removed | on or before 2026-09-25 |
| `espn_standings_2027_preseason.json` | ESPN standings, 2026-27 before its first regular-season game; navigation links removed | on or before 2026-09-25 |
| `espn_roster_{POR_22,CLE_5,CHA_30}_20261110.json` | ESPN team rosters for Portland, Cleveland and Charlotte; navigation links and ticket offers removed | 2026-11-10 12:25 EST |
| `espn_roster_27_20261125.json` | ESPN's /teams/27/roster (Washington Wizards); navigation links removed; its athletes carry `experience.years`, which the team endpoint's `enable=roster` list leaves out | 2026-11-25 23:58 EST |
| `espn_athlete_stats_3945274_20261125.json` | ESPN's athlete stats for Luka Doncic (id 3945274), 2026-27 in progress; navigation links removed | 2026-11-25 |
| `espn_team_stats_2027_20261125.json` | ESPN's statistics by team, every team's per-game numbers for the 2026-27 regular season; navigation links removed | 2026-11-25 |
| `espn_standings_2027_20261125.json` | ESPN standings at the same time as the team stats above (the W-L column) | 2026-11-25 |
| `espn_qualified_pts_20261126.json`, `espn_qualified_threes_20261126.json` | ESPN statistics/byathlete, 2026-27 regular season, `isqualified=true`, top 25 by points and by threes made per game; navigation links removed | 2026-11-26 00:13 EST |
| `espn_all_players_20261126.json` | ESPN statistics/byathlete, 2026-27 regular season, `isqualified=false`, limit 600: all 482 players with stats; trimmed to each athlete's id, name, age, position, team and stat values (ESPN's totals, ranks, headshots and links dropped) | 2026-11-26 ~14:00 EST |
| `espn_roster_18_20261126.json` | ESPN teams/18/roster (New York Knicks), with jersey numbers; navigation links removed | 2026-11-26 ~14:00 EST |
| `espn_standings_2027_20261126.json` | ESPN standings, 2026-27, the same afternoon as the players list (no games in between); navigation links removed | 2026-11-26 ~14:00 EST |
| `espn_player_count_20261126.json` | The same endpoint, `isqualified=false&limit=1` (its total, 481, is the number of players with stats); navigation links removed | 2026-11-26 00:13 EST |
| `espn_gamelog_4066328_20261126.json` | ESPN's game log for Jarrett Allen (/athletes/4066328/gamelog); navigation links removed | 2026-11-26 00:06 EST |
| `lunara_plays_401909953.json` | Every stored play for CLE @ CHA, 2026-11-09 (451 rows), as the database held them before plays were keyed on ESPN's play id; `json_agg` output | 2026-11-10 12:20 EST |
| `lunara_rows_401909953.json` | That game's row and its two teams | 2026-11-10 11:20 EST |
