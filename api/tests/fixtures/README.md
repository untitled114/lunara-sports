# Recorded responses

Every file here is real data: ESPN responses recorded as they were served (except where the
table says a part was removed), and rows exported from the production database. Most unit tests use small inline inputs and mocks; these back the tests that
need a real payload.

| File | What | Recorded |
|---|---|---|
| `espn_leaders_2026_types2_limit1.json` | ESPN core API, season 2026 (2025-26) regular-season leaders, `?limit=1` | 2026-09-25 19:17 UTC |
| `espn_leaders_2025_types2_limit1.json` | The same request for season 2025 (2024-25) | 2026-09-25 |
| `espn_scoreboard_default.json` | ESPN scoreboard with no date (the current slate and its season calendar); ESPN's navigation links, ticket offers and sponsor removed | on or before 2026-09-25 |
| `espn_standings_2026.json` | ESPN standings, 2025-26 final; navigation links removed | on or before 2026-09-25 |
| `espn_standings_2027_preseason.json` | ESPN standings, 2026-27 before its first regular-season game; navigation links removed | on or before 2026-09-25 |
| `espn_roster_{POR_22,CLE_5,CHA_30}_20261110.json` | ESPN team rosters for Portland, Cleveland and Charlotte; navigation links and ticket offers removed | 2026-11-10 12:25 EST |
| `lunara_plays_401909953.json` | Every stored play for CLE @ CHA, 2026-11-09 (451 rows), as the database held them before plays were keyed on ESPN's play id; `json_agg` output | 2026-11-10 12:20 EST |
| `lunara_rows_401909953.json` | That game's row and its two teams | 2026-11-10 11:20 EST |
