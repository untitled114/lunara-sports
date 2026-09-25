# Lunara Design System & De-"AI-look" Pass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the AI-generated look from lunara-app.com and put every page on one token-based design system. Fix the preseason data bugs: last season's standings, honest win probability and seed badges, and a date strip that starts on today.

**Architecture:**
- **API first.** Standings fall back to the previous regular season, and a new `/games/next` endpoint is added. Both are backward compatible.
- **Frontend foundation.**
  - Tokens (`tokens.css` plus the Tailwind 4 `@theme`).
  - One set of shared UI components.
  - Pure logic helpers (win probability, seed badge, ET dates).
  - A design-check script that ratchets violations down to zero.
- **Rollout.** Every page and component moves to the foundation. Legacy styles are then removed.
- **Checks.** Playwright visual, uniformity, and axe checks against mocked API data lock the result in.

**Tech Stack:** React 18, Vite 5, Tailwind 4 (`@tailwindcss/postcss`), lucide-react, Vitest + React Testing Library + jsdom (new), Playwright + @axe-core/playwright (new), FastAPI + pytest (API).

**Spec:** `docs/superpowers/specs/2026-09-25-lunara-design-system-design.md` (owner-approved 2026-09-25)

## Global Constraints

**Tokens.** Values are verbatim from the spec. These are the only colors allowed outside `utils/teamColors.js`.

| Token | Value |
|---|---|
| `--surface-0` | `#0B0D12` |
| `--surface-1` | `#12151C` |
| `--surface-2` | `#1A1E27` |
| `--border` | `#262B36` |
| `--border-strong` | `#323846` |
| `--text-1` | `#E8EAF0` |
| `--text-2` | `#A3A9B7` |
| `--text-3` | `#6B7280` |
| `--accent` | `#6366F1` |
| `--accent-hover` | `#7C7FF3` |
| `--live` | `#22C55E` (also used for win) |
| `--loss` | `#EF4444` |
| `--warn` | `#F59E0B` |

**Typography.** Inter only, weights 400/500/600/700. No 800/900 and no italic.

| Role | Size/line-height | Weight | Other |
|---|---|---|---|
| title | 24/32 | 600 | |
| section | 18/26 | 600 | |
| body | 15/22 | 400 | |
| small | 13/18 | 400 | |
| label | 12/16 | 500 | uppercase, `letter-spacing: 0.06em`. The only tracked style. |
| score | 28/32 | 700 | |

- `tabular-nums` applies to every score, stat, clock, and odds value.

**Shape.**
- Radius is 8px (inputs, badges), 12px (rows, tabs, segmented controls), or 16px (cards). The maximum is 16px.
- Spacing sits on a 4px grid.

**Effects allowed, and only here.**
- Grain texture on the page background.
- Frosted glass on the top bar and the bottom tab bar.
- Glow on a `status=live` game card.
- No gradient sweeps, mirror effects, or gloss on cards.

**Kept exactly as-is.** Tap sounds (`playGlassClick`, `playThud` from `useTheme`) and animation durations and timing.

**Copy rules.**
- Plain sports language in sentence case. Uppercase comes only from the `label` style.
- One term per concept: "Scoreboard", "Standings", "Picks", "Stats", "Teams", "Players".
- Error copy: "Couldn't load <thing>. Try again." with a "Try again" button.
- Empty states name the next step.

**Banned in user-facing copy and comments (case-insensitive).**
- `telemetry`, `uplink`, `protocol`, `decrypt`, `sector`, `node`/`nodes` (as words), `matrix`, `console`, `neural`, `quantum`, `synthesi*`, `intelligence station`, `arena console`, `sync failure`, `re-establish`.
- **Exempt:** code identifiers `console.log/error/warn/info` and `PropTypes.node`.
- **Explicit allow:** a line containing `design-check-allow`, used only in `PrivacyPage.jsx` for its legal "telemetry services" sentence.

**Timezone.** Every date computation uses `America/New_York`.

**Commits and scope.**
- Conventional commits. No `Co-Authored-By`. Don't bypass pre-commit. Never push unless a task says so.
- API coverage gate: `fail_under = 99.1` (api/pyproject.toml) must still pass.
- No synthetic prediction or pipeline data. UI test fixtures are captured from real ESPN and API responses.
- Deletions only where a task lists the exact paths. The owner approves this plan, so those listed deletions are approved.
- Deploys never happen between tip-off and final.

## Review Focus

1. **Standings switchover day.** When the first regular-season game is final, the API must switch from `2025–26 final` to live standings. Preseason games must never flip it. Covered in Task 1.
2. **Team missing from standings.** A newly relocated team, or an abbreviation mismatch like `UTAH` vs `UTA`, must show no badge and no win probability. It must not crash and must not show 100/0. Covered in Task 5.
3. **Date strip across the DST boundary** (Nov 1, 2026). Today+6 must not skip or duplicate a day. Covered in Task 5.
4. **No next game.** When `/games/next` returns `{"date": null}` (the offseason after the Finals), show "No games scheduled yet." with no link. Covered in Tasks 2 and 7.
5. **API down.** Every page shows the shared error state with a working "Try again". There must be no blank page and no infinite skeleton. Covered in Tasks 4 and 13.

---

## File Structure

| Path | Responsibility |
|---|---|
| `api/src/services/standings_service.py` (modify) | previous-season fallback, `season_label`, `is_previous_season`, `seed` |
| `api/src/services/espn_client.py` (modify) | `get_standings(season: int \| None)`, `get_scoreboard_calendar()` |
| `api/src/models/schemas.py` (modify) | `StandingsTeam.seed`, `StandingsResponse.season_label/is_previous_season`, `NextGameResponse` |
| `api/src/routers/games.py`, `api/src/services/game_service.py` (modify) | `GET /games/next?after=` |
| `frontend/src/styles/tokens.css` (new) | tokens + `@theme` + type/label/tabular utilities |
| `frontend/src/lib/et.js` (new) | ET date helpers |
| `frontend/src/lib/gameMath.js` (new) | `seedBadge`, `winProbability`, `recordLine` |
| `frontend/src/components/ui/{Card,SectionHeader,Badge,Stat,Segmented,DataTable,TeamMark,PageState}.jsx` | shared components (Badge rebuilt; others new) |
| `frontend/scripts/check-design.mjs` + `frontend/design-check-baseline.json` (new) | ratcheting design lint |
| `frontend/vitest.config.js`, `frontend/src/test/setup.js` (new) | unit test infra |
| `frontend/e2e/*` + `frontend/playwright.config.js` (new) | visual, uniformity and axe checks with mocked API |

---

# Phase A — API

### Task 1: Standings fall back to the previous regular season

**Files:**
- Modify: `api/src/services/espn_client.py:69-78`
- Modify: `api/src/services/standings_service.py`
- Modify: `api/src/models/schemas.py:194-213`
- Create: `api/tests/fixtures/espn_standings_2027_preseason.json`, `api/tests/fixtures/espn_standings_2026.json`. These are REAL captured ESPN responses, not synthetic.
- Test: `api/tests/test_standings_fallback.py`

**Interfaces:**
- Produces:
  - `espn_client.get_standings(season: int | None = None) -> dict | None`. Cache key `espn:standings` or `espn:standings:{season}`.
  - `StandingsTeam.seed: int | None`.
  - `StandingsResponse.season_label: str`, `StandingsResponse.is_previous_season: bool`.
  - JSON example: `{"eastern":[...],"western":[...],"season":"2025-26","season_label":"2025–26 final","is_previous_season":true}`.

- [ ] **Step 1: Capture the real fixtures.**

  ```bash
  cd api && mkdir -p tests/fixtures
  curl -s "https://site.api.espn.com/apis/v2/sports/basketball/nba/standings" > tests/fixtures/espn_standings_2027_preseason.json
  curl -s "https://site.api.espn.com/apis/v2/sports/basketball/nba/standings?season=2026" > tests/fixtures/espn_standings_2026.json
  python3 -c "import json;d=json.load(open('tests/fixtures/espn_standings_2027_preseason.json'));print(d['seasons'][0]['year'],d['seasons'][1]['seasonYears'])"
  ```

  Expected output: `2027 2025-26`. The preseason file has every team with `wins == losses == 0`, and the 2026 file has 82-game records. If today's live response already has regular-season games (after Oct 20), stop and report NEEDS_CONTEXT: the "before" fixture must be the preseason state.

- [ ] **Step 2: Write the failing tests.**

  ```python
  """Standings fall back to the previous regular season until this one has games."""

  import json
  from pathlib import Path
  from unittest.mock import AsyncMock, patch

  import pytest

  from src.services import standings_service

  FIX = Path(__file__).parent / "fixtures"
  PRE = json.loads((FIX / "espn_standings_2027_preseason.json").read_text())
  PREV = json.loads((FIX / "espn_standings_2026.json").read_text())


  def _with_one_game_played(data: dict) -> dict:
      """Real preseason payload with one team's regular-season record bumped to 1-0."""
      d = json.loads(json.dumps(data))
      entry = d["children"][0]["standings"]["entries"][0]
      for s in entry["stats"]:
          if s["name"] == "wins":
              s["value"], s["displayValue"] = 1.0, "1"
      return d


  @pytest.mark.asyncio
  async def test_preseason_falls_back_to_previous_regular_season():
      get = AsyncMock(side_effect=lambda season=None: PREV if season == 2026 else PRE)
      with patch.object(standings_service.espn_client, "get_standings", get):
          r = await standings_service.get_standings()
      assert r.is_previous_season is True
      assert r.season_label == "2025–26 final"
      assert get.await_args_list[-1].kwargs == {"season": 2026}
      assert sum(t.w + t.l for t in r.eastern) > 0


  @pytest.mark.asyncio
  async def test_uses_current_season_once_a_regular_season_game_is_played():
      cur = _with_one_game_played(PRE)
      get = AsyncMock(return_value=cur)
      with patch.object(standings_service.espn_client, "get_standings", get):
          r = await standings_service.get_standings()
      assert r.is_previous_season is False
      assert r.season_label == "2026–27"
      get.assert_awaited_once_with(season=None)


  @pytest.mark.asyncio
  async def test_seed_comes_from_espn_playoff_seed():
      get = AsyncMock(side_effect=lambda season=None: PREV if season == 2026 else PRE)
      with patch.object(standings_service.espn_client, "get_standings", get):
          r = await standings_service.get_standings()
      seeds = sorted(t.seed for t in r.eastern if t.seed is not None)
      assert seeds[:6] == [1, 2, 3, 4, 5, 6] and len(r.eastern) == 15


  @pytest.mark.asyncio
  async def test_previous_season_unavailable_returns_current_empty_records():
      get = AsyncMock(side_effect=lambda season=None: None if season == 2026 else PRE)
      with patch.object(standings_service.espn_client, "get_standings", get):
          r = await standings_service.get_standings()
      assert r.is_previous_season is False and r.season_label == "2026–27"


  @pytest.mark.asyncio
  async def test_espn_down_returns_empty():
      with patch.object(standings_service.espn_client, "get_standings", AsyncMock(return_value=None)):
          r = await standings_service.get_standings()
      assert r.eastern == [] and r.western == [] and r.is_previous_season is False
  ```

- [ ] **Step 3: Run them.** Run `cd api && python3 -m pytest tests/test_standings_fallback.py -q`. Expected: FAIL. `season_label` and `seed` don't exist yet, and `get_standings` takes no `season`.

- [ ] **Step 4: Implement.**

  In `schemas.py`, add `seed: int | None = None` to `StandingsTeam`. Add `season_label: str = ""` and `is_previous_season: bool = False` to `StandingsResponse`.

  In `espn_client.py`:

  ```python
  async def get_standings(season: int | None = None) -> dict | None:
      """Fetch NBA standings from ESPN (/apis/v2/). `season` is ESPN's end-year (2026 = 2025-26)."""
      url = "https://site.api.espn.com/apis/v2/sports/basketball/nba/standings"
      key = "espn:standings"
      if season is not None:
          url += f"?season={season}"
          key += f":{season}"
      return await _cached_get(key, url, STANDINGS_TTL)
  ```

  In `standings_service.py`:

  ```python
  def _season_years(data: dict, index: int) -> tuple[int | None, str]:
      seasons = data.get("seasons") or []
      if len(seasons) <= index:
          return None, ""
      s = seasons[index]
      return s.get("year"), (s.get("seasonYears") or s.get("displayName") or "")


  def _label(years: str, final: bool) -> str:
      pretty = years.replace("-", "–")
      return f"{pretty} final" if final else pretty


  def _parse(data: dict) -> tuple[list, list]:
      eastern, western = [], []
      for child in data.get("children", []):
          name = child.get("name", "").lower()
          if "east" in name:
              eastern = _parse_conference(child)
          elif "west" in name:
              western = _parse_conference(child)
      return eastern, western


  async def get_standings() -> StandingsResponse:
      """Current standings; before the regular season starts, last season's final standings."""
      data = await espn_client.get_standings(season=None)
      if not data:
          return StandingsResponse(eastern=[], western=[])
      eastern, western = _parse(data)
      _, cur_years = _season_years(data, 0)
      if any(t.w + t.l for t in eastern + western):
          return StandingsResponse(eastern=eastern, western=western, season=cur_years,
                                   season_label=_label(cur_years, final=False))
      prev_year, prev_years = _season_years(data, 1)
      prev = await espn_client.get_standings(season=prev_year) if prev_year else None
      if not prev:
          return StandingsResponse(eastern=eastern, western=western, season=cur_years,
                                   season_label=_label(cur_years, final=False))
      p_east, p_west = _parse(prev)
      return StandingsResponse(eastern=p_east, western=p_west, season=prev_years,
                               season_label=_label(prev_years, final=True), is_previous_season=True)
  ```

  In `_parse_conference`, read `playoffSeed` from the entry's `stats` (the same way `wins`/`losses` are read) into `seed=int(value)` when present and greater than 0, else `None`. Keep `rank` as it is today.

- [ ] **Step 5: Test.** Run `cd api && python3 -m pytest tests/ -q --cov`. Expected: all tests pass, TOTAL ≥ 99.1%. Existing standings tests that asserted the old signature must be updated to pass `season=None`.

- [ ] **Step 6: Commit.**

  ```bash
  git add api/src/services/espn_client.py api/src/services/standings_service.py api/src/models/schemas.py api/tests/test_standings_fallback.py api/tests/fixtures/espn_standings_*.json
  git commit -m "feat(api): last season's final standings until the regular season starts; playoff seeds"
  ```

---

### Task 2: `GET /games/next?after=YYYY-MM-DD`

**Files:**
- Modify: `api/src/services/espn_client.py` (add `get_scoreboard_calendar`)
- Modify: `api/src/services/game_service.py` (add `next_game_date`)
- Modify: `api/src/routers/games.py` (add route **before** `/{game_id}`)
- Modify: `api/src/models/schemas.py` (add `NextGameResponse`)
- Create: `api/tests/fixtures/espn_scoreboard_default.json` (real capture)
- Test: `api/tests/test_games_next.py`

**Interfaces:**
- Produces:
  - `GET /games/next?after=2026-09-25` returns `{"date": "2026-10-03"}` or `{"date": null}`.
  - `game_service.next_game_date(session, after: date) -> date | None`.
  - `espn_client.get_scoreboard_calendar() -> list[date]`: ET dates, sorted and unique.

- [ ] **Step 1: Capture the fixture.** Run `curl -s "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard" > api/tests/fixtures/espn_scoreboard_default.json` and check that `leagues[0].calendar[0]` is `"2026-10-03T07:00Z"`.

- [ ] **Step 2: Write the failing tests.**

  ```python
  """GET /games/next — next date with games, PG first then ESPN's calendar."""

  import json
  from datetime import date
  from pathlib import Path
  from unittest.mock import AsyncMock, patch

  import pytest

  from src.services import espn_client, game_service

  CAL = json.loads((Path(__file__).parent / "fixtures/espn_scoreboard_default.json").read_text())


  @pytest.mark.asyncio
  async def test_calendar_parses_to_et_dates():
      with patch.object(espn_client, "get_scoreboard", AsyncMock(return_value=CAL)):
          days = await espn_client.get_scoreboard_calendar()
      assert days[0] == date(2026, 10, 3) and days == sorted(set(days))


  @pytest.mark.asyncio
  async def test_next_from_local_games_table(seeded_session):
      # seeded_session contains game 401810001; its date (ET) is the expected answer
      with patch.object(espn_client, "get_scoreboard_calendar", AsyncMock(return_value=[])):
          d = await game_service.next_game_date(seeded_session, date(2000, 1, 1))
      assert d is not None


  @pytest.mark.asyncio
  async def test_next_falls_back_to_espn_calendar(session):
      with patch.object(espn_client, "get_scoreboard_calendar",
                        AsyncMock(return_value=[date(2026, 10, 3), date(2026, 10, 4)])):
          assert await game_service.next_game_date(session, date(2026, 9, 25)) == date(2026, 10, 3)
          assert await game_service.next_game_date(session, date(2026, 10, 3)) == date(2026, 10, 4)


  @pytest.mark.asyncio
  async def test_no_next_game_returns_none(session):
      with patch.object(espn_client, "get_scoreboard_calendar", AsyncMock(return_value=[])):
          assert await game_service.next_game_date(session, date(2026, 9, 25)) is None


  @pytest.mark.asyncio
  async def test_route(client):
      with patch("src.routers.games.next_game_date", AsyncMock(return_value=date(2026, 10, 3))):
          r = await client.get("/games/next", params={"after": "2026-09-25"})
      assert r.status_code == 200 and r.json() == {"date": "2026-10-03"}
      with patch("src.routers.games.next_game_date", AsyncMock(return_value=None)):
          r = await client.get("/games/next", params={"after": "2026-09-25"})
      assert r.json() == {"date": None}
      assert (await client.get("/games/next", params={"after": "nope"})).status_code == 422
  ```

  First confirm the fixture names (`session`, `seeded_session`, `client`) and the seeded game's `start_time` in `api/tests/conftest.py`. Use the real names.

- [ ] **Step 3: Run them.** Expected: FAIL (the names don't exist yet).

- [ ] **Step 4: Implement.**

  ```python
  # espn_client.py
  async def get_scoreboard_calendar() -> list[date]:
      """Dates (ET) that have NBA games in the current ESPN season calendar."""
      data = await get_scoreboard(None)
      raw = ((data or {}).get("leagues") or [{}])[0].get("calendar") or []
      out = set()
      for item in raw:
          s = item if isinstance(item, str) else item.get("startDate", "")
          if s:
              out.add(datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(EASTERN).date())
      return sorted(out)
  ```

  - Use the module's existing `EASTERN = ZoneInfo("America/New_York")`, or the API's `src/eastern.py` helper if present.
  - Check `get_scoreboard`'s real signature. If it requires a date string, call the default (no-`dates=`) URL through `_cached_get` with key `espn:scoreboard:default`.

  ```python
  # game_service.py
  async def next_game_date(session: AsyncSession, after: date) -> date | None:
      """First date strictly after `after` (ET) with games: local games table, else ESPN calendar."""
      start = datetime.combine(after + timedelta(days=1), time.min, tzinfo=EASTERN)
      row = await session.execute(
          select(func.min(Game.start_time)).where(Game.start_time >= start)
      )
      first = row.scalar()
      if first is not None:
          return first.astimezone(EASTERN).date()
      for d in await espn_client.get_scoreboard_calendar():
          if d > after:
              return d
      return None
  ```

  ```python
  # schemas.py
  class NextGameResponse(BaseModel):
      date: date | None = None
  ```

  ```python
  # routers/games.py — declare BEFORE @router.get("/{game_id}")
  @router.get("/next", response_model=NextGameResponse)
  async def next_game(after: date, session: AsyncSession = Depends(get_session)):
      return NextGameResponse(date=await next_game_date(session, after))
  ```

  Import `next_game_date` into the router module by name, so the test's patch target `src.routers.games.next_game_date` resolves. Match the router's existing session dependency name.

- [ ] **Step 5: Test.** Run `cd api && python3 -m pytest tests/ -q --cov`. Expected: all pass, TOTAL ≥ 99.1%.

- [ ] **Step 6: Commit.** `git commit -m "feat(api): GET /games/next returns the next date with games"`, adding only the files above.

---

# Phase B — Frontend foundation

### Task 3: Test infrastructure + design tokens

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/vitest.config.js`, `frontend/src/test/setup.js`
- Create: `frontend/src/styles/tokens.css`
- Modify: `frontend/src/main.jsx`, `frontend/index.html:16`, `frontend/src/styles.css:6-25` (legacy vars → aliases)
- Test: `frontend/src/styles/tokens.test.js`

**Interfaces:**
- Produces:
  - CSS vars from Global Constraints.
  - Tailwind colors `bg-surface-0/1/2`, `border-border`, `border-border-strong`, `text-text-1/2/3`, `bg-accent`, `text-accent`, `text-live`, `text-loss`, `text-warn`.
  - Radius `rounded-sm` (8px), `rounded-md` (12px), `rounded-lg` (16px).
  - Utility classes `.t-title .t-section .t-body .t-small .t-label .t-score .tnum`.

- [ ] **Step 1: Install dev dependencies.**

  ```bash
  cd frontend && npm i -D vitest@^2 @testing-library/react@^16 @testing-library/jest-dom@^6 @testing-library/user-event@^14 jsdom@^25
  ```

  Add the scripts `"test": "vitest run"` and `"test:watch": "vitest"`.

- [ ] **Step 2: Write the config.**

  ```js
  // vitest.config.js
  import { defineConfig } from 'vitest/config'
  import react from '@vitejs/plugin-react'
  import path from 'path'
  export default defineConfig({
    plugins: [react()],
    resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
    test: { environment: 'jsdom', setupFiles: ['./src/test/setup.js'], include: ['src/**/*.test.{js,jsx}'] },
  })
  ```

  ```js
  // src/test/setup.js
  import '@testing-library/jest-dom/vitest'
  ```

- [ ] **Step 3: Write the failing test.**

  ```js
  // src/styles/tokens.test.js
  import { readFileSync } from 'node:fs'
  import { resolve } from 'node:path'
  import { describe, it, expect } from 'vitest'
  const css = readFileSync(resolve(__dirname, 'tokens.css'), 'utf8')
  const expected = {
    '--surface-0': '#0B0D12', '--surface-1': '#12151C', '--surface-2': '#1A1E27',
    '--border': '#262B36', '--border-strong': '#323846', '--text-1': '#E8EAF0',
    '--text-2': '#A3A9B7', '--text-3': '#6B7280', '--accent': '#6366F1',
    '--accent-hover': '#7C7FF3', '--live': '#22C55E', '--loss': '#EF4444', '--warn': '#F59E0B',
  }
  describe('tokens.css', () => {
    it.each(Object.entries(expected))('%s is %s', (name, value) => {
      expect(css).toMatch(new RegExp(`${name}:\\s*${value};`, 'i'))
    })
    it('label is the only tracked style and uses 0.06em', () => {
      const tracked = [...css.matchAll(/letter-spacing:\s*([0-9.]+)em/g)].map((m) => m[1])
      expect(tracked).toEqual(['0.06'])
    })
  })
  ```

  Run `cd frontend && npm test`. Expected: FAIL (the file doesn't exist).

- [ ] **Step 4: Write `src/styles/tokens.css`.**

  ```css
  @import "tailwindcss";

  :root {
    --surface-0: #0B0D12; --surface-1: #12151C; --surface-2: #1A1E27;
    --border: #262B36; --border-strong: #323846;
    --text-1: #E8EAF0; --text-2: #A3A9B7; --text-3: #6B7280;
    --accent: #6366F1; --accent-hover: #7C7FF3;
    --live: #22C55E; --loss: #EF4444; --warn: #F59E0B;
  }

  @theme inline {
    --color-surface-0: var(--surface-0); --color-surface-1: var(--surface-1); --color-surface-2: var(--surface-2);
    --color-border: var(--border); --color-border-strong: var(--border-strong);
    --color-text-1: var(--text-1); --color-text-2: var(--text-2); --color-text-3: var(--text-3);
    --color-accent: var(--accent); --color-accent-hover: var(--accent-hover);
    --color-live: var(--live); --color-loss: var(--loss); --color-warn: var(--warn);
    --radius-sm: 8px; --radius-md: 12px; --radius-lg: 16px;
    --font-sans: 'Inter', system-ui, sans-serif;
  }

  html, body { background: var(--surface-0); color: var(--text-1); font-family: var(--font-sans); }

  @layer utilities {
    .t-title { font-size: 24px; line-height: 32px; font-weight: 600; }
    .t-section { font-size: 18px; line-height: 26px; font-weight: 600; }
    .t-body { font-size: 15px; line-height: 22px; font-weight: 400; }
    .t-small { font-size: 13px; line-height: 18px; font-weight: 400; }
    .t-label { font-size: 12px; line-height: 16px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; }
    .t-score { font-size: 28px; line-height: 32px; font-weight: 700; font-variant-numeric: tabular-nums; }
    .tnum { font-variant-numeric: tabular-nums; }
  }
  ```

  **Wiring:**
  - `main.jsx` imports `./styles/tokens.css` first. Delete the `@import "tailwindcss";` line from `index.css`; keep the `scrollbar-hide` utility.
  - In `index.html`, change the font URL to `family=Inter:wght@400;500;600;700`.

  **Legacy aliases** (temporary, removed in Task 14). In the `:root` of `styles.css`, map old names to new tokens so pages still render during the rollout:
  - `--bg-base: var(--surface-0)`, `--bg-surface: var(--surface-1)`, `--bg-card: var(--surface-1)`, `--bg-card-alt: var(--surface-2)`
  - `--text-primary: var(--text-1)`, `--text-secondary: var(--text-2)`, `--text-muted: var(--text-3)`
  - `--border: var(--border)` (drop the old rgba), `--green: var(--live)`
  - `--accent-alt: var(--live)`, `--accent-warm: var(--warn)`
  - Remove the duplicate `--accent` definition.

- [ ] **Step 5: Test.** Run `npm test` (PASS). Run `npm run build` (succeeds). Run `npm run dev` and open `/scoreboard` to check that the site still renders with no crash. Colors may shift; that's expected.

- [ ] **Step 6: Commit.** `git commit -m "feat(frontend): design tokens and Vitest; alias legacy CSS vars to tokens"`

---

### Task 4: Design check (ratcheting lint) in pre-commit and CI

**Files:**
- Create: `frontend/scripts/check-design.mjs`, `frontend/design-check-baseline.json`, `frontend/scripts/check-design.test.js`
- Modify: `frontend/package.json` (script `design:check`), `.pre-commit-config.yaml`, `.github/workflows/ci.yml`

**Interfaces:**
- Produces:
  - `node scripts/check-design.mjs [--update-baseline]` exits 1 if any file exceeds its baseline count per rule.
  - A file with count 0 is removed from the baseline. `--strict` means the baseline must be empty.
  - Exported `scan(text, path) -> {rule: count}` for tests.

- [ ] **Step 1: Write the failing test.**

  ```js
  // scripts/check-design.test.js
  import { describe, it, expect } from 'vitest'
  import { scan } from './check-design.mjs'
  describe('design check', () => {
    it('flags each rule', () => {
      const t = `<div className="font-black italic tracking-[0.3em] rounded-[2.5rem] bg-[#050a18] bg-gradient-to-r backdrop-blur-xl">Telemetry node</div>`
      expect(scan(t, 'src/pages/X.jsx')).toEqual({
        hex: 1, heavy: 1, italic: 1, tracking: 1, radius: 1, effect: 2, banned: 2,
      })
    })
    it('allows tokens, small tracking, console calls, PropTypes.node, allow marker', () => {
      const t = `tracking-[0.06em] rounded-lg console.error(x) PropTypes.node\n'telemetry services' // design-check-allow`
      expect(scan(t, 'src/pages/Y.jsx')).toEqual({})
    })
    it('skips hex in token and team-color files', () => {
      expect(scan('#FFFFFF', 'src/utils/teamColors.js')).toEqual({})
      expect(scan('#0B0D12', 'src/styles/tokens.css')).toEqual({})
    })
    it('allows effects in the allow-listed files only', () => {
      expect(scan('backdrop-blur-md', 'src/components/layout/AppLayout.jsx')).toEqual({})
    })
  })
  ```

  Add `'scripts/**/*.test.js'` to vitest's `include`. Run `npm test`. Expected: FAIL.

- [ ] **Step 2: Implement `scripts/check-design.mjs`.**

  ```js
  #!/usr/bin/env node
  import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs'
  import { join, relative } from 'node:path'
  import { fileURLToPath } from 'node:url'

  const ROOT = fileURLToPath(new URL('..', import.meta.url))
  const HEX_OK = ['src/styles/tokens.css', 'src/utils/teamColors.js']
  // glass on top bar/bottom tabs; grain on page background; live glow in GameCard
  const EFFECT_OK = ['src/components/layout/AppLayout.jsx', 'src/styles/tokens.css', 'src/components/sport/GameCard.jsx']
  const BANNED = /\b(telemetry|uplink|protocol|decrypt\w*|sector|nodes?|matrix|console|neural|quantum|synthesi\w*|intelligence station|arena console|sync failure|re-establish)\b/gi
  const RULES = {
    hex: /#[0-9a-fA-F]{6}\b/g,
    heavy: /\bfont-(black|extrabold)\b/g,
    italic: /\bitalic\b/g,
    tracking: /tracking-(\[(0\.(0[9]|[1-9]\d*)|[1-9]\d*(\.\d+)?)em\]|widest|wider)/g,
    radius: /rounded-(\[(1[7-9]|[2-9]\d|\d{3,})px\]|\[\d+(\.\d+)?rem\]|2xl|3xl|full)/g,
    effect: /\b(bg-gradient-to-\w+|bg-linear-\w+|backdrop-blur(-\w+)?|blur-\[\w+\]|radial-gradient|linear-gradient|liquid-mirror|gloss-sweep|rim-glow[\w-]*)\b/g,
  }

  export function scan(text, path) {
    const out = {}
    const add = (k, n) => { if (n) out[k] = (out[k] || 0) + n }
    for (const line of text.split('\n')) {
      if (line.includes('design-check-allow')) continue
      for (const [k, re] of Object.entries(RULES)) {
        if (k === 'hex' && HEX_OK.includes(path)) continue
        if (k === 'effect' && EFFECT_OK.includes(path)) continue
        add(k, (line.match(re) || []).length)
      }
      const scrubbed = line.replace(/\bconsole\.(log|error|warn|info|debug)\b/g, '').replace(/PropTypes\.node/g, '')
      add('banned', (scrubbed.match(BANNED) || []).length)
    }
    return out
  }

  function files(dir) {
    return readdirSync(dir).flatMap((f) => {
      const p = join(dir, f)
      if (statSync(p).isDirectory()) return f === 'test' ? [] : files(p)
      return /\.(jsx?|css)$/.test(f) && !/\.test\.jsx?$/.test(f) ? [p] : []
    })
  }

  if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const baseFile = join(ROOT, 'design-check-baseline.json')
    const base = existsSync(baseFile) ? JSON.parse(readFileSync(baseFile, 'utf8')) : {}
    const now = {}
    for (const f of files(join(ROOT, 'src'))) {
      const rel = relative(ROOT, f)
      const r = scan(readFileSync(f, 'utf8'), rel)
      if (Object.keys(r).length) now[rel] = r
    }
    if (process.argv.includes('--update-baseline')) {
      writeFileSync(baseFile, JSON.stringify(now, null, 2) + '\n')
      console.log(`baseline written: ${Object.keys(now).length} files`)
      process.exit(0)
    }
    const strict = process.argv.includes('--strict')
    const errors = []
    for (const [f, r] of Object.entries(now)) {
      for (const [k, n] of Object.entries(r)) {
        const allowed = strict ? 0 : (base[f]?.[k] ?? 0)
        if (n > allowed) errors.push(`${f}: ${k} ${n} > ${allowed}`)
      }
    }
    for (const f of Object.keys(base)) if (!now[f]) errors.push(`${f}: clean now — remove it from design-check-baseline.json`)
    if (errors.length) { console.error(errors.join('\n')); process.exit(1) }
    console.log(`design check OK (${Object.keys(now).length} files still on baseline)`)
  }
  ```

- [ ] **Step 3: Test.** Run `npm test` (PASS), then `node scripts/check-design.mjs --update-baseline`. The baseline records today's counts. Then run `node scripts/check-design.mjs`: expected `design check OK`.

- [ ] **Step 4: Wire it in.**
  - `package.json`: add the script `"design:check": "node scripts/check-design.mjs"`.
  - Pre-commit hook:

    ```yaml
    - id: design-check
      name: frontend design check
      entry: bash -c 'cd frontend && node scripts/check-design.mjs && npx vitest run'
      language: system
      pass_filenames: false
      files: ^frontend/
    ```

  - `ci.yml`: add a `frontend` job (ubuntu, Node 22) with `npm ci`, `npm test`, `npm run design:check`, `npm run build`.

- [ ] **Step 5: Commit.** `git commit -m "build(frontend): ratcheting design check in pre-commit and CI"`

---

### Task 5: Pure logic helpers — ET dates, seed badge, win probability, record line

**Files:**
- Create: `frontend/src/lib/et.js`, `frontend/src/lib/gameMath.js`
- Test: `frontend/src/lib/et.test.js`, `frontend/src/lib/gameMath.test.js`

**Interfaces:**
- Produces:
  - `todayET(now?: Date) -> 'YYYY-MM-DD'`
  - `addDaysISO(iso, n) -> 'YYYY-MM-DD'` (calendar-safe; no DST drift)
  - `stripDays(startIso, count=7) -> string[]`
  - `formatDayLabel(iso) -> {weekday:'Sat', day:'3', month:'Oct'}`
  - `formatLongDay(iso) -> 'Sat, Oct 3'`
  - `seedBadge(team?: {seed, conf}, isPrev) -> null | {text:'East #3'|'Play-in', variant:'accent'|'warn', prev:boolean}`
  - `winProbability(home?, away?) -> null | {home:number, away:number}`: integer percents summing to 100
  - `recordLine(team?, seasonLabel, isPrev) -> string | null`, e.g. `'2025–26: 37-45'` or `'37-45'`

- [ ] **Step 1: Write the failing tests.**

  ```js
  // src/lib/et.test.js
  import { describe, it, expect } from 'vitest'
  import { todayET, addDaysISO, stripDays, formatDayLabel, formatLongDay } from './et'
  describe('et', () => {
    it('today in New York, not UTC', () => {
      expect(todayET(new Date('2026-09-26T02:30:00Z'))).toBe('2026-09-25') // 22:30 EDT
      expect(todayET(new Date('2026-12-01T04:59:00Z'))).toBe('2026-11-30') // 23:59 EST
    })
    it('adds calendar days across DST end without skipping', () => {
      expect(stripDays('2026-10-29')).toEqual(['2026-10-29','2026-10-30','2026-10-31','2026-11-01','2026-11-02','2026-11-03','2026-11-04'])
      expect(addDaysISO('2026-03-07', 1)).toBe('2026-03-08')
      expect(addDaysISO('2026-10-03', -3)).toBe('2026-09-30')
    })
    it('labels', () => {
      expect(formatDayLabel('2026-10-03')).toEqual({ weekday: 'Sat', day: '3', month: 'Oct' })
      expect(formatLongDay('2026-10-03')).toBe('Sat, Oct 3')
    })
  })
  ```

  ```js
  // src/lib/gameMath.test.js
  import { describe, it, expect } from 'vitest'
  import { seedBadge, winProbability, recordLine } from './gameMath'
  const t = (w, l, seed, conf = 'East') => ({ w, l, seed, conf, pct: (w + l ? w / (w + l) : 0).toFixed(3) })
  describe('seedBadge', () => {
    it('1-6 conf seed, 7-10 play-in, else none', () => {
      expect(seedBadge(t(60, 22, 1), false)).toEqual({ text: 'East #1', variant: 'accent', prev: false })
      expect(seedBadge(t(40, 42, 8, 'West'), true)).toEqual({ text: 'Play-in', variant: 'warn', prev: true })
      expect(seedBadge(t(20, 62, 13), false)).toBeNull()
    })
    it('missing team or seed → none', () => {
      expect(seedBadge(undefined, false)).toBeNull()
      expect(seedBadge(t(0, 0, null), false)).toBeNull()
    })
  })
  describe('winProbability', () => {
    it('ratio of win pcts, integer percents summing to 100', () => {
      expect(winProbability(t(45, 37, 5), t(37, 45, 9))).toEqual({ home: 55, away: 45 })
    })
    it('hidden without data — never 100/0', () => {
      expect(winProbability(t(0, 0, null), t(10, 5, 3))).toBeNull()
      expect(winProbability(undefined, t(10, 5, 3))).toBeNull()
      expect(winProbability(t(0, 10, 15), t(0, 10, 15))).toBeNull() // both 0% → no basis
    })
  })
  describe('recordLine', () => {
    it('labels previous season', () => {
      expect(recordLine(t(37, 45, 9), '2025–26 final', true)).toBe('2025–26: 37-45')
      expect(recordLine(t(3, 1, 2), '2026–27', false)).toBe('3-1')
      expect(recordLine(undefined, '', false)).toBeNull()
    })
  })
  ```

  Run `npm test`. Expected: FAIL.

- [ ] **Step 2: Implement.**

  ```js
  // src/lib/et.js
  const TZ = 'America/New_York'
  export function todayET(now = new Date()) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  }
  export function addDaysISO(iso, n) {
    const [y, m, d] = iso.split('-').map(Number)
    const dt = new Date(Date.UTC(y, m - 1, d + n))
    return dt.toISOString().slice(0, 10)
  }
  export function stripDays(startIso, count = 7) {
    return Array.from({ length: count }, (_, i) => addDaysISO(startIso, i))
  }
  const utcNoon = (iso) => new Date(`${iso}T12:00:00Z`)
  export function formatDayLabel(iso) {
    const d = utcNoon(iso)
    const f = (o) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...o }).format(d)
    return { weekday: f({ weekday: 'short' }), day: f({ day: 'numeric' }), month: f({ month: 'short' }) }
  }
  export function formatLongDay(iso) {
    return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }).format(utcNoon(iso))
  }
  ```

  ```js
  // src/lib/gameMath.js
  const played = (t) => t && (Number(t.w) + Number(t.l)) > 0
  export function seedBadge(team, isPrev) {
    if (!team || !team.seed) return null
    if (team.seed <= 6) return { text: `${team.conf} #${team.seed}`, variant: 'accent', prev: !!isPrev }
    if (team.seed <= 10) return { text: 'Play-in', variant: 'warn', prev: !!isPrev }
    return null
  }
  export function winProbability(home, away) {
    if (!played(home) || !played(away)) return null
    const h = parseFloat(home.pct), a = parseFloat(away.pct)
    if (!(h + a > 0)) return null
    const hp = Math.round((h / (h + a)) * 100)
    return { home: hp, away: 100 - hp }
  }
  export function recordLine(team, seasonLabel, isPrev) {
    if (!team) return null
    const rec = `${team.w}-${team.l}`
    return isPrev ? `${seasonLabel.replace(/ final$/, '')}: ${rec}` : rec
  }
  ```

  Standings rows expose `conf` as `"Eastern"`/`"Western"` or `""`. Normalize in `seedBadge`: `const conf = /^w/i.test(team.conf) ? 'West' : 'East'`. Then update the test's expectation if needed, keeping the text `'East #1'` / `'West #…'`.

- [ ] **Step 3: Test.** Run `npm test`. Expected: PASS.

- [ ] **Step 4: Commit.** `git commit -m "feat(frontend): ET date, seed badge, win probability and record helpers"`

---

### Task 6: Shared UI components

**Files:**
- Create: `frontend/src/components/ui/{Card,SectionHeader,Stat,Segmented,DataTable,TeamMark,PageState}.jsx`
- Rewrite: `frontend/src/components/ui/Badge.jsx`
- Modify: `frontend/src/components/ui/index.js` (exports)
- Test: `frontend/src/components/ui/ui.test.jsx`

**Interfaces:**
- Produces:
  - `<Card live? as?='div' className?>`
  - `<SectionHeader title aside?>`
  - `<Badge variant='neutral'|'accent'|'live'|'win'|'loss'|'warn'>`
  - `<Stat label value delta?>`
  - `<Segmented options=[{id,label}] value onChange>`
  - `<DataTable columns=[{key,label,align?,numeric?}] rows getKey>`
  - `<TeamMark abbrev logoUrl? size?='md'>`
  - `<PageState kind='loading'|'empty'|'error' title? message? onRetry? action?>`
  - Error default copy: "Couldn't load this. Try again." with a button "Try again".

- [ ] **Step 1: Write the failing tests.**

  ```jsx
  // ui.test.jsx
  import { describe, it, expect, vi } from 'vitest'
  import { render, screen } from '@testing-library/react'
  import userEvent from '@testing-library/user-event'
  import { Card, Badge, Stat, Segmented, DataTable, TeamMark, PageState, SectionHeader } from './index'

  describe('ui', () => {
    it('Card uses surface-1, border and 16px radius; live adds glow class', () => {
      const { container, rerender } = render(<Card>x</Card>)
      expect(container.firstChild).toHaveClass('bg-surface-1', 'border-border', 'rounded-lg')
      rerender(<Card live>x</Card>)
      expect(container.firstChild).toHaveClass('card-live')
    })
    it('Badge variants map to token colors only', () => {
      render(<><Badge variant="live">Live</Badge><Badge variant="loss">L</Badge><Badge variant="warn">Play-in</Badge></>)
      expect(screen.getByText('Live')).toHaveClass('text-live')
      expect(screen.getByText('L')).toHaveClass('text-loss')
      expect(screen.getByText('Play-in')).toHaveClass('text-warn')
    })
    it('Stat renders tabular value and delta', () => {
      render(<Stat label="PTS" value="32.7" delta={1.2} />)
      expect(screen.getByText('32.7')).toHaveClass('tnum')
      expect(screen.getByText(/▲/)).toBeInTheDocument()
    })
    it('Segmented calls onChange and marks the active option', async () => {
      const onChange = vi.fn()
      render(<Segmented options={[{ id: 'all', label: 'All' }, { id: 'live', label: 'Live' }]} value="all" onChange={onChange} />)
      expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true')
      await userEvent.click(screen.getByRole('tab', { name: 'Live' }))
      expect(onChange).toHaveBeenCalledWith('live')
    })
    it('DataTable renders headers and tabular numeric cells', () => {
      render(<DataTable columns={[{ key: 'team', label: 'Team' }, { key: 'w', label: 'W', numeric: true }]} rows={[{ team: 'DET', w: 60 }]} getKey={(r) => r.team} />)
      expect(screen.getByRole('columnheader', { name: 'W' })).toBeInTheDocument()
      expect(screen.getByText('60')).toHaveClass('tnum')
    })
    it('TeamMark shows abbreviation and logo alt', () => {
      render(<TeamMark abbrev="MIA" logoUrl="https://x/mia.png" />)
      expect(screen.getByText('MIA')).toBeInTheDocument()
      expect(screen.getByAltText('MIA logo')).toBeInTheDocument()
    })
    it('PageState error shows plain copy and retries', async () => {
      const onRetry = vi.fn()
      render(<PageState kind="error" title="Couldn't load standings." onRetry={onRetry} />)
      expect(screen.getByText("Couldn't load standings.")).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
      expect(onRetry).toHaveBeenCalled()
    })
    it('PageState loading and empty', () => {
      const { rerender } = render(<PageState kind="loading" />)
      expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
      rerender(<PageState kind="empty" title="No games today." action={<a href="/x">Next game</a>} />)
      expect(screen.getByText('No games today.')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Next game' })).toBeInTheDocument()
    })
    it('SectionHeader title + aside', () => {
      render(<SectionHeader title="Standings" aside="2025–26 final" />)
      expect(screen.getByRole('heading', { name: 'Standings' })).toHaveClass('t-section')
      expect(screen.getByText('2025–26 final')).toHaveClass('t-label')
    })
  })
  ```

  Run `npm test`. Expected: FAIL.

- [ ] **Step 2: Implement.** Each component uses `clsx` and tokens only.

  ```jsx
  // Card.jsx
  import clsx from 'clsx'
  export function Card({ live = false, as: Tag = 'div', className, children, ...rest }) {
    return <Tag className={clsx('bg-surface-1 border border-border rounded-lg p-4 transition-colors hover:border-border-strong', live && 'card-live', className)} {...rest}>{children}</Tag>
  }
  ```

  ```jsx
  // Badge.jsx
  import clsx from 'clsx'
  const V = {
    neutral: 'text-text-2 bg-surface-2', accent: 'text-accent bg-accent/10',
    live: 'text-live bg-live/10', win: 'text-live bg-live/10',
    loss: 'text-loss bg-loss/10', warn: 'text-warn bg-warn/10',
  }
  export function Badge({ variant = 'neutral', className, children, ...rest }) {
    return <span className={clsx('t-label inline-flex items-center rounded-sm px-2 py-0.5', V[variant], className)} {...rest}>{children}</span>
  }
  export default Badge
  ```

  ```jsx
  // Stat.jsx
  export function Stat({ label, value, delta }) {
    return (
      <div className="flex flex-col gap-1">
        <span className="t-label text-text-3">{label}</span>
        <span className="t-section tnum text-text-1">{value}</span>
        {delta != null && delta !== 0 && (
          <span className={`t-small tnum ${delta > 0 ? 'text-live' : 'text-loss'}`}>{delta > 0 ? '▲' : '▼'} {Math.abs(delta)}</span>
        )}
      </div>
    )
  }
  ```

  ```jsx
  // Segmented.jsx
  import clsx from 'clsx'
  export function Segmented({ options, value, onChange, className }) {
    return (
      <div role="tablist" className={clsx('inline-flex gap-1 rounded-md bg-surface-1 border border-border p-1', className)}>
        {options.map((o) => (
          <button key={o.id} role="tab" aria-selected={value === o.id} onClick={() => onChange(o.id)}
            className={clsx('t-small rounded-md px-3 py-1.5 transition-colors', value === o.id ? 'bg-surface-2 text-text-1' : 'text-text-2 hover:text-text-1')}>
            {o.label}
          </button>
        ))}
      </div>
    )
  }
  ```

  ```jsx
  // DataTable.jsx
  import clsx from 'clsx'
  export function DataTable({ columns, rows, getKey, className }) {
    return (
      <div className={clsx('overflow-x-auto rounded-lg border border-border', className)}>
        <table className="w-full t-small">
          <thead className="sticky top-0 bg-surface-2">
            <tr>{columns.map((c) => <th key={c.key} scope="col" className={clsx('t-label text-text-3 px-3 py-2', c.numeric || c.align === 'right' ? 'text-right' : 'text-left')}>{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={getKey(r)} className="border-t border-border">
                {columns.map((c) => (
                  <td key={c.key} className={clsx('px-3 py-2 text-text-1', c.numeric && 'tnum text-right')}>{c.render ? c.render(r) : r[c.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
  ```

  ```jsx
  // TeamMark.jsx
  const SIZES = { sm: 'h-6 w-6', md: 'h-9 w-9', lg: 'h-14 w-14' }
  export function TeamMark({ abbrev, logoUrl, size = 'md' }) {
    return (
      <span className="inline-flex items-center gap-2">
        {logoUrl ? <img src={logoUrl} alt={`${abbrev} logo`} className={`${SIZES[size]} object-contain`} loading="lazy" /> : null}
        <span className="t-section text-text-1">{abbrev}</span>
      </span>
    )
  }
  ```

  ```jsx
  // PageState.jsx
  export function PageState({ kind, title, message, onRetry, action }) {
    if (kind === 'loading') {
      return (
        <div role="status" aria-busy="true" aria-label="Loading" className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-lg bg-surface-1 animate-pulse" />)}
        </div>
      )
    }
    const heading = title ?? (kind === 'error' ? "Couldn't load this." : 'Nothing here yet.')
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface-1 px-6 py-10 text-center">
        <p className="t-section text-text-1">{heading}</p>
        {message && <p className="t-small text-text-2 max-w-sm">{message}</p>}
        {kind === 'error' && onRetry && (
          <button onClick={onRetry} className="t-small rounded-md bg-accent px-4 py-2 text-white hover:bg-accent-hover">Try again</button>
        )}
        {action}
      </div>
    )
  }
  ```

  ```jsx
  // SectionHeader.jsx
  export function SectionHeader({ title, aside }) {
    return (
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <h2 className="t-section text-text-1">{title}</h2>
        {aside ? (typeof aside === 'string' ? <span className="t-label text-text-3">{aside}</span> : aside) : null}
      </div>
    )
  }
  ```

  Add the `.card-live` rule to `tokens.css`: `.card-live { border-color: color-mix(in srgb, var(--live) 40%, var(--border)); box-shadow: 0 0 24px -8px color-mix(in srgb, var(--live) 45%, transparent); }`. This is the only glow.

  Add every component to `index.js` as named exports, keeping existing exports.

- [ ] **Step 3: Test.** Run `npm test` (PASS) and `npm run design:check` (OK).

- [ ] **Step 4: Commit.** `git commit -m "feat(frontend): shared Card, Badge, Stat, Segmented, DataTable, TeamMark, PageState, SectionHeader"`

---

# Phase C — Rollout

**Class mapping for every rollout task.** Apply it exhaustively in each file you touch.

| Old | New |
|---|---|
| `font-black` / `font-extrabold` | `font-semibold`, or `font-bold` for scores |
| any `italic` | removed |
| `tracking-[≥0.09em]`, `tracking-widest`, `tracking-wider` | none; small uppercase labels use `t-label` |
| `text-[8px..13px] font-black uppercase tracking-…` label clusters | `t-label text-text-3` |
| page `<h1>` / hero headings | `t-title text-text-1` |
| section headings | `SectionHeader` |
| `text-white` | `text-text-1` |
| `text-white/70`..`/50` | `text-text-2` |
| `text-white/40`..`/10` | `text-text-3`. Nothing lighter than `text-3`. |
| `rounded-[2.5rem]`, `rounded-3xl`, `rounded-2xl` on cards | `rounded-lg` (via `Card`) |
| pills | `rounded-sm` (via `Badge`) |
| `liquid-mirror`, `gloss-sweep`, `rim-glow-*`, `arena-shadow`, `texture-*` on cards, gradients, `backdrop-blur` (outside AppLayout bars) | removed |
| raw `#hex` / `bg-[#…]` | the matching token class |
| team colors | only via `TeamMark` and `getTeamColor` for logos and marks |
| ad-hoc card `div`s | `Card` |
| ad-hoc pills | `Badge` |
| ad-hoc tables | `DataTable` |
| ad-hoc filter tabs | `Segmented` |
| ad-hoc loading/empty/error blocks | `PageState` |
| numbers (scores, stats, records, clocks, odds) | wrapped with `tnum` |

- Keep `playGlassClick()` / `playThud()` calls and existing `transition`/`duration-*` values exactly.
- **Definition of done for every rollout task:**
  - The touched files are **removed from `design-check-baseline.json`** (`node scripts/check-design.mjs` reports them clean).
  - `npm test` and `npm run build` pass.
  - A before/after screenshot pair at 390px and 1280px is attached in the task report (`npm run dev`, then a browser screenshot).

### Task 7: Scoreboard — GameCard, DateNav, GamesPage (includes the data fixes)

**Files:**
- Modify: `frontend/src/components/sport/GameCard.jsx`, `frontend/src/components/sport/DateNav.jsx`, `frontend/src/pages/GamesPage.jsx`, `frontend/src/services/api.js`
- Test: `frontend/src/components/sport/GameCard.test.jsx`, `frontend/src/components/sport/DateNav.test.jsx`, `frontend/src/pages/GamesPage.test.jsx`

**Interfaces:**
- Consumes: Task 1 (`seed`, `season_label`, `is_previous_season`), Task 2 (`/games/next`), Task 5 helpers, Task 6 components.
- Produces:
  - `api.fetchNextGameDate(afterIso) -> Promise<string|null>`
  - `GamesPage` passes `standingsMeta = {seasonLabel, isPrev}` to `GameCard`.
  - `DateNav({ current })` shows `stripDays(todayET())` by default, or `stripDays(current)` when `current < today`.

- [ ] **Step 1: Write the failing tests.**

  ```jsx
  // GameCard.test.jsx
  import { render, screen } from '@testing-library/react'
  import { MemoryRouter } from 'react-router-dom'
  import { describe, it, expect, vi } from 'vitest'
  vi.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ playGlassClick: vi.fn(), playThud: vi.fn() }) }))
  import { GameCard } from './GameCard'
  const game = { id: '401902644', away_team: 'MIA', home_team: 'TOR', status: 'scheduled', start_time: '2026-10-03T23:00:00Z', venue: 'Videotron Centre', away_score: 0, home_score: 0 }
  const st = (w, l, seed, conf) => ({ w, l, seed, conf, pct: (w / (w + l)).toFixed(3) })
  const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)
  describe('GameCard', () => {
    it('preseason: last-season seeds, records and captioned win probability', () => {
      wrap(<GameCard game={game} standings={{ MIA: st(37, 45, 10, 'Eastern'), TOR: st(46, 36, 6, 'Eastern') }} standingsMeta={{ seasonLabel: '2025–26 final', isPrev: true }} />)
      expect(screen.getByText('Play-in')).toBeInTheDocument()
      expect(screen.getByText('East #6')).toBeInTheDocument()
      expect(screen.getByText('2025–26: 37-45')).toBeInTheDocument()
      expect(screen.getByText(/Based on 2025–26 records/)).toBeInTheDocument()
      expect(screen.queryByText('100%')).toBeNull()
    })
    it('no standings data: no badge, no win probability', () => {
      wrap(<GameCard game={game} standings={{}} standingsMeta={{ seasonLabel: '', isPrev: false }} />)
      expect(screen.queryByText(/Play-in|#\d/)).toBeNull()
      expect(screen.queryByText(/win prob/i)).toBeNull()
    })
    it('live game uses the live card', () => {
      const { container } = wrap(<GameCard game={{ ...game, status: 'live', home_score: 50, away_score: 48 }} standings={{}} standingsMeta={{ seasonLabel: '', isPrev: false }} />)
      expect(container.querySelector('.card-live')).not.toBeNull()
    })
  })
  ```

  ```jsx
  // DateNav.test.jsx
  import { render, screen } from '@testing-library/react'
  import { MemoryRouter } from 'react-router-dom'
  import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
  vi.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ playGlassClick: vi.fn(), playThud: vi.fn() }) }))
  import { DateNav } from './DateNav'
  describe('DateNav', () => {
    beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-25T14:00:00Z')) })
    afterEach(() => vi.useRealTimers())
    it('starts on today (ET) and runs forward 7 days', () => {
      render(<MemoryRouter><DateNav current="2026-10-03" /></MemoryRouter>)
      const days = screen.getAllByRole('link', { name: /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d+ [A-Z][a-z]{2}$/ })
      expect(days[0]).toHaveAccessibleName('Fri 25 Sep')
      expect(days).toHaveLength(7)
      expect(screen.getByRole('link', { name: 'Thu 1 Oct' })).toBeInTheDocument()
    })
  })
  ```

  ```jsx
  // GamesPage.test.jsx
  import { render, screen, waitFor } from '@testing-library/react'
  import userEvent from '@testing-library/user-event'
  import { MemoryRouter } from 'react-router-dom'
  import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
  vi.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ playGlassClick: vi.fn(), playThud: vi.fn() }) }))
  vi.mock('@/hooks/useScoreboard', () => ({ useScoreboard: () => ({ games: [] }) }))
  const api = vi.hoisted(() => ({ fetchStandings: vi.fn(), fetchNextGameDate: vi.fn() }))
  vi.mock('@/services/api', () => api)
  import GamesPage from './GamesPage'
  const at = (date) => render(<MemoryRouter initialEntries={[`/scoreboard?date=${date}`]}><GamesPage /></MemoryRouter>)
  describe('GamesPage', () => {
    beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); vi.setSystemTime(new Date('2026-09-25T14:00:00Z')) })
    afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })
    it('empty today links to the next game day', async () => {
      api.fetchStandings.mockResolvedValue({ eastern: [], western: [], season_label: '2025–26 final', is_previous_season: true })
      api.fetchNextGameDate.mockResolvedValue('2026-10-03')
      at('2026-09-25')
      expect(await screen.findByText('No games today.')).toBeInTheDocument()
      const link = await screen.findByRole('link', { name: /Next game: Sat, Oct 3/ })
      expect(link).toHaveAttribute('href', '/scoreboard?date=2026-10-03')
    })
    it('no next game: plain message, no link', async () => {
      api.fetchStandings.mockResolvedValue({ eastern: [], western: [] })
      api.fetchNextGameDate.mockResolvedValue(null)
      at('2026-09-25')
      expect(await screen.findByText('No games scheduled yet.')).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /Next game/ })).toBeNull()
    })
    it('standings error shows retry that refetches', async () => {
      api.fetchStandings.mockRejectedValueOnce(new Error('down')).mockResolvedValue({ eastern: [], western: [] })
      api.fetchNextGameDate.mockResolvedValue(null)
      at('2026-09-25')
      expect(await screen.findByText("Couldn't load standings.")).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
      await waitFor(() => expect(api.fetchStandings).toHaveBeenCalledTimes(2))
    })
  })
  ```

  First confirm the real module paths and export names for `useScoreboard`, `api`, and the `GamesPage` default export, then adjust the mock paths to match. Keep the assertions.

  Run `npm test`. Expected: FAIL.

- [ ] **Step 2: Implement.**
  - **`api.js`:** add `export const fetchNextGameDate = (after) => request(`/games/next?after=${after}`).then((r) => r.date)`, using the file's existing request helper.
  - **`GamesPage`:**
    - Default date is `todayET()`.
    - Keep `standings` plus `standingsMeta = { seasonLabel: data.season_label || '', isPrev: !!data.is_previous_season }`.
    - Filters use `Segmented` with All / Live / Scheduled / Final.
    - Errors show `<PageState kind="error" title="Couldn't load standings." onRetry={reload} />`.
    - When there are no games on the date: `<PageState kind="empty" title={date === todayET() ? 'No games today.' : 'No games on this day.'} action={next ? <Link to={`/scoreboard?date=${next}`}>Next game: {formatLongDay(next)} →</Link> : <span className="t-small text-text-2">No games scheduled yet.</span>} />`.
    - An active filter with no matches shows "No games match this filter."
    - The count label becomes "{n} games".
  - **`DateNav`:**
    - `const today = todayET(); const start = current && current < today ? current : today; const dates = stripDays(start)`.
    - Arrows shift by 7 days: `addDaysISO(start, ±7)`.
    - Each day is a `Link` with `aria-label={`${weekday} ${day} ${month}`}`, using the `formatDayLabel` parts.
    - The selected day is `bg-accent text-white rounded-md`; the others are `text-text-2`.
    - A "Today" button links to `/scoreboard?date=${today}`.
    - Keep `playThud`/`playGlassClick` calls.
  - **`GameCard`:**
    - Root is `<Card live={isLive}>`.
    - Teams use `TeamMark`, with `recordLine(team, standingsMeta.seasonLabel, standingsMeta.isPrev)` under each.
    - Badge: `const b = seedBadge(st, standingsMeta.isPrev)`, rendered as `<Badge variant={b.variant} title={b.prev ? `${standingsMeta.seasonLabel} seeding` : undefined}>{b.text}</Badge>`.
    - Win probability: `const wp = winProbability(homeSt, awaySt)`. Render the bar only when `wp`, with the caption `<span className="t-label text-text-3">{standingsMeta.isPrev ? `Based on ${standingsMeta.seasonLabel.replace(' final','')} records` : 'Win probability'}</span>`.
    - Scores use `t-score`.
    - Remove the "ambient glow" div, `liquid-mirror`, and `gloss-sweep`.
    - Apply the class mapping to everything else.

- [ ] **Step 3: Test.** Run `npm test` (PASS). Run `npm run design:check`, which must report the 3 files clean; remove them from the baseline. Then `npm run build`.

- [ ] **Step 4: Screenshot and commit.** `git commit -m "feat(frontend): scoreboard on the design system; honest preseason badges, win probability and date strip"`

### Task 8: App shell — AppLayout

**Files:** Modify `frontend/src/components/layout/AppLayout.jsx`. Test: `frontend/src/components/layout/AppLayout.test.jsx`.

**Required copy changes:**

| Old | New |
|---|---|
| nav `'Nodes'` | `'Teams'` |
| "Intelligence Station" tagline | removed |
| "Console" | "Menu" |
| "Node Affinity" | "Favorite team" |
| "Data Uplink" | "Data" |
| "System Protocols" | "Settings" |
| wordmark `tracking-[1em]` / italic | plain `t-section` wordmark "Lunara Sports" |

- Glass (`backdrop-blur`) stays on the top bar and the bottom tab bar only.
- The grain texture stays only on the page background wrapper.

- [ ] **Step 1: Write the test.** Render with `MemoryRouter`. Assert:
  - nav link names are exactly `['Home','Scoreboard','Standings','Picks','Stats','Teams','Players']`, or the file's existing set with the terms above;
  - none of the banned words appear in `document.body.textContent`;
  - the bottom tab bar has `aria-label="Primary"`.

  Run it. Expected: FAIL.
- [ ] **Step 2: Implement.** Apply the copy table and the class mapping.
- [ ] **Step 3: Test.** Run `npm test` and `design:check`. `AppLayout` must be clean; remove it from the baseline.
- [ ] **Step 4: Screenshot and commit.** `git commit -m "feat(frontend): app shell on the design system; plain navigation copy"`

### Task 9: Standings

**Files:** Modify `frontend/src/pages/StandingsPage.jsx`. Test: `frontend/src/pages/StandingsPage.test.jsx`.

**Required copy changes:**

| Old | New |
|---|---|
| column `'Telemetry Node'` | `'Team'` |
| "Analytics Console" link | "Stats" |
| "Telemetry Sync Failure" block + "System encountered a protocol error…" + "Re-establish uplink" | `<PageState kind="error" title="Couldn't load standings." onRetry={reload} />` |
| "GLOBAL TELEMETRY UPLINK ACTIVE" | the season label via `SectionHeader aside` (e.g. "2025–26 final") |
| "Eastern Sector" / "Western Sector" | "Eastern Conference" / "Western Conference" |
| subtitle "NODE" | removed |
| "Play-In Boundary" | "Play-in line" |
| "Play-In Contingency" | "Play-in" |
| "Protocol Classification" | "Key" |
| "Node Diagnostics" | "Details" |

- Tables use `DataTable` with columns Team, W, L, PCT, GB, Home, Road, L10, Strk. Numbers are tabular.
- The seed column shows `team.seed`.

- [ ] **Step 1: Write the test.** With mocked `fetchStandings` returning the Task 1 fixture shape (`is_previous_season: true`, `season_label: '2025–26 final'`), assert:
  - both conference headings;
  - the "2025–26 final" label;
  - 15 rows per conference;
  - the play-in line after row 10.

  The error path renders "Couldn't load standings." and "Try again". There must be no banned words.

  Run it. Expected: FAIL.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Test.** Run `npm test` and `design:check` (the file is clean); remove it from the baseline.
- [ ] **Step 4: Screenshot and commit.** `git commit -m "feat(frontend): standings on the design system with last-season label"`

### Task 10: Teams and Team detail

**Files:** Modify `frontend/src/pages/TeamsPage.jsx`, `frontend/src/pages/TeamDetailPage.jsx`. Test: `frontend/src/pages/TeamPages.test.jsx`.

**Required copy changes:**

| Old | New |
|---|---|
| "Franchise Sync Failure" | `PageState` error "Couldn't load teams." |
| `{div.name} SECTOR` | `{div.name}` |

- Every other banned word found by `design:check` in these files is rewritten per the copy rules.
- The team record uses `recordLine` with the standings meta.

- [ ] **Step 1: Write the test.** Assert:
  - the teams grid renders 30 `TeamMark`s from a mocked `fetchTeams`;
  - the team detail page shows the name, `TeamMark lg`, and the record line with the "2025–26:" prefix when `is_previous_season`;
  - the roster renders as a `DataTable`;
  - errors show `PageState`;
  - there are no banned words.

  Run it. Expected: FAIL.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Test.** Run `npm test` and `design:check` (both files clean); remove them from the baseline.
- [ ] **Step 4: Screenshot and commit.** `git commit -m "feat(frontend): teams pages on the design system"`

### Task 11: Players and Player profile

**Files:** Modify `frontend/src/pages/PlayersPage.jsx`, `frontend/src/pages/PlayerProfilePage.jsx`. Test: `frontend/src/pages/PlayerPages.test.jsx`.

**Required copy changes:**

| Old | New |
|---|---|
| "Statistics Console" (comment) | "Statistics" |
| "Bio Telemetry" | "Bio" |
| "Current Sector" | "Team" |
| PlayersPage "No nodes matching … found in sector" | "No players match "{query}"." |

- Stats use `Stat` and `DataTable`. The game log is a `DataTable`.

- [ ] **Step 1: Write the test.** Assert:
  - search with no results shows `No players match "zzz".`;
  - the profile renders `Stat`s with tabular values;
  - errors show `PageState`;
  - there are no banned words.

  Run it. Expected: FAIL.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Test.** Run `npm test` and `design:check` (clean); remove the files from the baseline.
- [ ] **Step 4: Screenshot and commit.** `git commit -m "feat(frontend): player pages on the design system"`

### Task 12: Game detail — GameDetailPage, LiveFeed, BoxScore, CourtView, MomentumMeter, PickTracker

**Files:** Modify `frontend/src/pages/GameDetailPage.jsx` and `frontend/src/components/sport/{LiveFeed,BoxScore,CourtView,MomentumMeter,PickTracker}.jsx`. Test: `frontend/src/pages/GameDetailPage.test.jsx`.

**Required copy changes:**

| Old | New |
|---|---|
| "Telemetry Bar Top" (comment) | "Header" |
| `Sector: {venue}` | `{venue}` |
| `Node: #{id}` | removed |
| "Live Court Telemetry" | "Shot chart" |
| "Live Telemetry Active" | "Live" (as a `Badge variant="live"`) |
| "Momentum Telemetry" | "Momentum" |

- Box score uses `DataTable`. The feed rows use tokens. The score header uses `t-score` and `TeamMark`.
- The WebSocket-driven live feed behavior is unchanged.

- [ ] **Step 1: Write the test.** Assert:
  - with a mocked game (live) and plays, the header shows both `TeamMark`s and `t-score` scores;
  - the live badge is present;
  - the box score is a table with tabular numbers;
  - there are no banned words;
  - a mocked `fetchGame` error shows `PageState`.

  Run it. Expected: FAIL.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Test.** Run `npm test` and `design:check` (all 6 files clean); remove them from the baseline.
- [ ] **Step 4: Screenshot and commit.** `git commit -m "feat(frontend): game detail on the design system"`

### Task 13: Stats, ScoreTicker, CommandBar and the remaining pages and components

**Files:**
- Modify: `frontend/src/pages/{StatsPage,LandingPage,PicksPage,SchedulePage,AdminPage,PrivacyPage,TermsPage}.jsx`
- Modify: `frontend/src/components/sport/ScoreTicker.jsx`, `frontend/src/components/ui/CommandBar.jsx`, and every remaining file still listed in `design-check-baseline.json` (including `components/dashboard/shared/*`, `components/ui/*`, `components/sport/*`)
- Test: `frontend/src/pages/RemainingPages.test.jsx`

**Required copy changes:**

| Old | New |
|---|---|
| "NBA Global Telemetry" | "League stats" |
| "Offensive Telemetry" / "Primary Scoring & Playmaking Vectors" | "Offense" / "Scoring and playmaking" |
| "Defensive Telemetry" / "Rim Protection & Perimeter Pressure" | "Defense" / "Rim protection and perimeter defense" |
| "Advanced Analytics Console" | "Advanced stats" |
| "Consolidated Team Matrix" | "Team stats" |
| "No franchise telemetry available" | `PageState` empty "Team stats aren't available yet." |
| ScoreTicker "Away Node" / "Home Node" | "Away" / "Home" |
| ScoreTicker "Loading Telemetry..." | skeleton (`PageState kind="loading"`), inline variant |
| ScoreTicker "Protocol" / "Telemetry" | "Today's games" |
| ScoreTicker "{n} UPLINKS ACTIVE" / "SLATE LOADED" | "{n} live" / "Final scores" |
| CommandBar "Command Console" | "Search" |

- `PrivacyPage`'s legal sentence about "telemetry services" gets `{/* design-check-allow */}` on that line.

- [ ] **Step 1: Write the test.** Each listed page renders with mocked API data. `document.body.textContent` contains none of the banned words, except PrivacyPage's single allowed sentence. Each page's error path shows `PageState` with "Try again" (Review Focus #5). Run it. Expected: FAIL.
- [ ] **Step 2: Implement** across all listed files.
- [ ] **Step 3: Test.** Run `npm test`. `node scripts/check-design.mjs` must now report **0 files on baseline**, and `design-check-baseline.json` is `{}`.
- [ ] **Step 4: Screenshot and commit.** `git commit -m "feat(frontend): all remaining pages on the design system; plain copy everywhere"`

### Task 14: Remove legacy styling; enforce strict mode

**Files:**
- Modify: `frontend/src/styles.css`. Reduce it to the grain background (`.page-grain`) and any keyframes still referenced. Remove "ARENA CONSOLE SYSTEM", the legacy vars and their aliases, `.liquid-mirror`, `.gloss-sweep`, `.rim-glow-*`, `.arena-shadow`, and `.texture-mesh`.
- Modify: `frontend/tailwind.config.js`. Remove the `navy` and `accent` palettes, since tokens own colors. Keep keyframes only if referenced; otherwise delete the file, if nothing imports it and the build passes.
- Modify: `frontend/package.json`: `design:check` becomes `node scripts/check-design.mjs --strict`.
- **Delete (owner-approved by plan approval):** `frontend/design-check-baseline.json` once it is `{}`, and any `components/ui/*` or `components/dashboard/shared/*` file that has no remaining importer (`grep -r "from.*<Name>" src` returns nothing). List the exact deleted paths in the report.

- [ ] **Step 1:** Run `grep -rn "var(--bg-\|var(--text-primary\|var(--green\|liquid-mirror\|gloss-sweep\|rim-glow\|arena-shadow\|texture-mesh" frontend/src`. Expected: no hits. Fix any hits using the class mapping.
- [ ] **Step 2:** Edit the files as above.
- [ ] **Step 3:** Run `npm test`, `npm run design:check` (strict, OK), `npm run build`, and `npm run dev` with a manual pass over every page at 390px.
- [ ] **Step 4: Commit.** `git commit -m "refactor(frontend): remove legacy arena-console styles; design check strict"`

---

# Phase D — Lock it in and release

### Task 15: Playwright visual, uniformity and accessibility checks

**Files:**
- Create: `frontend/playwright.config.js`, `frontend/e2e/fixtures/*.json` (real captures), `frontend/e2e/mockApi.js`, `frontend/e2e/pages.spec.js`
- Modify: `frontend/package.json` (script `e2e`), `.github/workflows/ci.yml` (frontend job runs `npx playwright install --with-deps chromium && npm run e2e`)

**Interfaces:**
- Consumes: every page.
- Produces: committed screenshot baselines `e2e/pages.spec.js-snapshots/*`.

- [ ] **Step 1: Capture real fixtures.**

  ```bash
  for p in standings teams "games/?date=2026-10-03" "games/next?after=2026-09-25" "stats/leaders?limit=10" players; do curl -s "https://api.lunara-app.com/$p" > "frontend/e2e/fixtures/$(echo $p | tr '/?=&' '____').json"; done
  ```

  Also capture one game detail (`/games/401902644`) and its plays.

- [ ] **Step 2: Write `mockApi.js`.** It routes `**/api.lunara-app.com/**` and `**/localhost:8000/**` to the fixtures via `page.route`. The WebSocket connection is stubbed. Clock: `page.clock.setFixedTime(new Date('2026-09-25T16:00:00Z'))`.

- [ ] **Step 3: Write `pages.spec.js`.**

  ```js
  import { test, expect } from '@playwright/test'
  import AxeBuilder from '@axe-core/playwright'
  import { mockApi } from './mockApi'
  const PAGES = ['/', '/scoreboard?date=2026-10-03', '/scoreboard?date=2026-09-25', '/standings', '/teams', '/teams/MIA', '/players', '/stats', '/picks', '/games/401902644', '/privacy', '/terms']
  for (const width of [390, 1280]) {
    for (const path of PAGES) {
      test(`${path} @${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 })
        await mockApi(page)
        await page.goto(path)
        await page.waitForLoadState('networkidle')
        await expect(page).toHaveScreenshot({ fullPage: true, maxDiffPixelRatio: 0.01 })
        // uniformity: every card identical chrome
        const cards = await page.$$eval('.bg-surface-1.rounded-lg', (els) => els.map((e) => {
          const s = getComputedStyle(e); return [s.backgroundColor, s.borderTopColor, s.borderTopLeftRadius].join('|')
        }))
        expect(new Set(cards).size).toBeLessThanOrEqual(1)
        // no banned words rendered
        const text = await page.evaluate(() => document.body.innerText)
        expect(text).not.toMatch(/\b(telemetry|uplink|decrypt|sector|nodes?|matrix|console)\b/i)
        // accessibility
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
        expect(axe.violations.filter((v) => v.id === 'color-contrast')).toEqual([])
      })
    }
  }
  ```

  - `PrivacyPage` legally uses "telemetry". Exclude `/privacy` from the banned-word assertion only.
  - A card-uniformity set size of 2 is acceptable when `card-live` is present, so assert on non-live cards.

- [ ] **Step 4: Generate the baselines.** Run `npx playwright test --update-snapshots`, then check every screenshot by eye against the spec. Run `npm run e2e`. Expected: PASS.

- [ ] **Step 5: Commit.** Commit the spec, fixtures, and snapshots: `git commit -m "test(frontend): visual, uniformity and accessibility checks on every page"`

### Task 16: Release — API, then Vercel preview, then production

**Files:** Modify `deploy/oci/README.md` (append "Design release record").

- [ ] **Step 1: Deploy the API.**
  - Confirm no live NBA game is in progress (`/games/?date=<today>` has no `status=live`).
  - From a clean detached worktree of this branch, run `bash deploy/oci/deploy.sh`. Expected: all 6 gates pass.
  - Then run `curl -s https://api.lunara-app.com/standings | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['season_label'],d['is_previous_season'])"`. Expected: `2025–26 final True` before Oct 20.
  - Also run `curl -s "https://api.lunara-app.com/games/next?after=$(TZ=America/New_York date +%F)"`. Expected: the next game date.
- [ ] **Step 2: Frontend preview.** The owner runs this in their own terminal (the controller cannot change Vercel): `cd ~/play-by-play && npx vercel@latest --yes`, a preview, not `--prod`. The owner reviews the printed preview URL on their phone: Scoreboard, Standings, a team, a player, a game, and Stats.
- [ ] **Step 3: Production.** After the owner approves the preview, the owner runs `cd ~/play-by-play && npx vercel@latest --prod --yes`. The controller then verifies that the live bundle has no `run.app` reference and that the Playwright suite passes against production: `PLAYWRIGHT_BASE_URL=https://www.lunara-app.com npx playwright test --grep-invert @visual`. That run covers only uniformity, copy, and axe, since live data differs from the fixtures.
- [ ] **Step 4: Record and commit.** Record the dates, commit, and Vercel deployment URL in the README, then `git commit -m "docs(deploy): record the design-system release"`.

---

## Self-review notes

**Spec coverage**

| Spec section | Task(s) |
|---|---|
| Tokens | 3 |
| Components | 6 |
| Rollout order | 7–13 |
| Copy rules | 7–13 |
| Standings fallback | 1 |
| Game card fixes | 5, 7 |
| Date strip + `/games/next` | 2, 5, 7 |
| Design check | 4, 14 |
| Vitest | 3–13 |
| API tests | 1, 2 |
| Playwright + uniformity + axe | 15 |
| Release | 16 |
| Sounds and animation kept | Global Constraints, enforced in every rollout task |

**Review Focus coverage**

| Item | Pinned in |
|---|---|
| #1 | Task 1 `test_uses_current_season_once_a_regular_season_game_is_played` |
| #2 | Task 5 `seedBadge`/`winProbability` missing-team cases, Task 7 GameCard "no standings data" |
| #3 | Task 5 DST strip test |
| #4 | Task 2 `test_no_next_game_returns_none`, Task 7 GamesPage null test |
| #5 | Tasks 7 and 13 error-path tests, Task 15 by rendering |

**Type consistency**
- `seed`, `season_label`, `is_previous_season`, `fetchNextGameDate(afterIso) -> string|null`, `standingsMeta {seasonLabel, isPrev}`, and the `seedBadge`/`winProbability`/`recordLine` signatures are identical in Tasks 1, 2, 5, and 7.
