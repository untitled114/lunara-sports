# Lunara Frontend — Design System & De-"AI-look" Pass — Design

**Status:** approved in conversation by owner 2026-09-25 (sections 1–4) · **Branch:** `polish/design-system` (stacked on `migrate/oci-backend` / PR #2)

## Why

- The site reads as AI-generated. Measured in `frontend/src` on 2026-09-25:
  - sci-fi copy: "telemetry" ×16, "uplink" ×6, "protocol error while decrypting…";
  - 346 `font-black`/`italic`;
  - 129 wide `tracking-[…em]`;
  - 69 gradients and 27 blur/glass effects;
  - 170 hard-coded hex colors with no token system.
- The look shipped in the first commit (`c0bc053`, 2026-02-23). There is no clean version to restore. The only record of intent is the uncommitted `PLAN.md` (Feb 17): a dark slate dashboard with Inter, one indigo accent, and Tailwind tokens instead of hex.
- Three data bugs visible on the live site:
  - **100% / 0% win probability.** Every team is 0-0, so both pcts are 0 and the formula gives one side 100%.
  - **"EAST PLAY-IN" badge.** With every team at 0-0, standings rank alphabetically.
  - **Date strip.** The owner wants it to open on today and run forward to the first game, not open centered on the game date.

## Goals / success criteria

1. No sci-fi or jargon copy anywhere. The banned-word check passes.
2. One token set (color, type, radius, spacing, effects), used by every page. No hex outside the token file and `utils/teamColors.js`.
3. The same component looks identical on every page, at 390 px and at 1280 px.
4. The date strip opens on today (ET) and runs forward. A day with no games links to the next game day.
5. No badge or number the data doesn't support. Before the season, numbers come from the 2025–26 regular season and are labeled that way.
6. The identity stays premium and dark. Tap sounds and animation timing are kept exactly as they are (owner decision).

## Decisions

### 1. Design tokens (`frontend/src/styles/tokens.css`, exposed through Tailwind 4 `@theme`)

**Surfaces:** elevation is a lighter step, not a glow.

| Token | Value | Use |
|---|---|---|
| `--surface-0` | `#0B0D12` | page |
| `--surface-1` | `#12151C` | card |
| `--surface-2` | `#1A1E27` | raised: menus, sheets, popovers |
| `--border` | `#262B36` | default border |
| `--border-strong` | `#323846` | hover border |

**Text**

| Token | Value | Use |
|---|---|---|
| `--text-1` | `#E8EAF0` | primary |
| `--text-2` | `#A3A9B7` | secondary |
| `--text-3` | `#6B7280` | labels and timestamps only |

**Accent and status**

| Token | Value | Use |
|---|---|---|
| `--accent` | `#6366F1` | brand; the only accent: active tab, links, focus ring, selected date |
| `--accent-hover` | `#7C7FF3` | accent hover |
| `--live` | `#22C55E` | live; also used for win |
| `--loss` | `#EF4444` | loss and error |
| `--warn` | `#F59E0B` | warning |

Team colors appear only in team marks and logos, never in chrome.

**Type:** Inter only, weights 400/500/600/700. Weights 800 and 900 are dropped from the font load.

| Role | Size / line height | Style |
|---|---|---|
| page title | 24/32 | 600 |
| section | 18/26 | 600 |
| body | 15/22 | 400 |
| small | 13/18 | 400 |
| label | 12/16 | 500, uppercase, `letter-spacing: 0.06em` (the only tracked style) |
| score | 28/32 | 700 |

- No italics.
- `font-variant-numeric: tabular-nums` on every score, stat, clock, and odds value.

**Shape**
- Radius: 8 px (inputs, badges), 12 px (rows, tabs, segmented controls), 16 px (cards). The maximum is 16 px.
- Spacing: 4 px grid.

**Effects:** each has a stated purpose, and these are the only places they may appear.

| Effect | Allowed on |
|---|---|
| grain texture | page background |
| frosted glass | top bar, bottom tab bar |
| glow | card of a game with `status=live` |

No gradient sweeps or mirror/gloss effects on cards.

#### Amendment (D31, owner, 2026-09-25)

The owner found the flat redesign "soulless" and chose to bring the arena look back. This
amends the Effects and Type rules above; the plain copy, nav terms, data fixes, AA contrast,
uniform components, sounds and motion all stay.

**Effects added**

| Effect | Allowed on | Where it's defined |
|---|---|---|
| arena backdrop: `/branding/background-1-alt.webp` at 40%, darkened toward the bottom, three radial glow washes (`--glow-1` top-left, `--glow-2` top-right, `--glow-3` bottom-center), an edge vignette | the page background, behind everything | `AppLayout.jsx` (inline) |
| translucent cards: every card is `bg-surface-card` (`--surface-1` at 85%) so the backdrop shows through faintly; table frames use the same fill | all card chrome | `--surface-card` in `tokens.css` |
| team washes: each team's primary fades in from its own side | the game detail header only | `.team-wash` in `tokens.css`; colors and strength from `teamWash()` in `utils/teamColors.js` |

- `--glow-1` is the default top-left color. A favorite team's primary replaces it, and on a
  game page the home team's primary does (as before the redesign).
- The "Background glow" setting (formerly "Background texture") drives the washes' opacity:
  the setting times 0.7, with the same 1 s fade. At the default (40%) the brightest backdrop
  spot stays near luminance 0.045, so `--text-2` holds 4.5:1 anywhere on it. The grain stays,
  at a fixed 5%.
- Straight on the backdrop, `--text-3` reads as `--text-2` (the photo alone is too bright for
  `--text-3` at 4.5:1); any surface restores it. Accent text on the backdrop uses
  `--accent-hover`.
- `teamWash()` caps each team's wash so `--text-2` keeps 4.5:1 and the losing score
  (`--text-3`, large) keeps 3:1 on it. Team colors still never appear in other chrome;
  scoreboard game cards get no wash.

**Type added:** one display class, `.display-wordmark`: Inter 900 italic, uppercase,
`letter-spacing: -0.05em`, line height 0.9, silver gradient text fill (`#FFFFFF` → `#C8D0DC` →
`#94A3B8`). It is used for "LUNARA SPORTS" on the landing hero and in the top bar, and nowhere
else. The font load adds only Inter 900 italic. The game header's scores use
`.t-score-display` (the score style at 44 px, 72 px from `sm`, still 700 and tabular).

**Guardrail:** `check-design.mjs` allows heavy weight, italic and gradients only inside the
`.display-wordmark` block of `tokens.css` (and gradients inside `.team-wash`), plus the
backdrop in `AppLayout.jsx`. `tokens.css` is no longer allow-listed for effects as a whole.

### 2. Shared components (`frontend/src/components/ui/`)

Existing `Badge`, `Table`, `Tabs`, `EmptyState`, `Skeleton` and `Alert` are rebuilt on the tokens. New components are added. Every page uses only these for the patterns below.

- **`Card`:** default, or `live` (adds the glow).
- **`SectionHeader`:** title, plus an optional right-side slot (action link or season label such as "2025–26 final").
- **`Badge`:** variants `neutral | accent | live | win | loss` only.
- **`Stat`:** label, tabular value, optional ▲/▼ delta.
- **`Tabs` / `Segmented`:** used for All/Live/Scheduled/Final, East/West, and similar.
- **`DataTable`:** sticky header, tabular numbers, no zebra striping. Used for standings, box score, leaders and roster.
- **`TeamMark`:** logo plus abbreviation. The only consumer of team colors.
- **`PageState`:** `loading` (skeleton) / `empty` / `error`. One look and one copy style. Error always offers "Try again".

**Rollout order**
1. `AppLayout` (top bar, bottom tabs, menu).
2. `StandingsPage`, `TeamDetailPage`, `PlayerProfilePage`, `GameDetailPage`, `StatsPage`, `GamesPage`.
3. The remaining pages (Landing, Picks, Players, Schedule, Teams, Admin, Privacy, Terms).
4. Sport components: `GameCard`, `DateNav`, `ScoreTicker`, `LiveFeed`, `BoxScore`, `PickTracker`, and the rest.

After the rollout, no page defines its own card or badge styling.

### 3. Copy rules

- Plain sports language, sentence case. Uppercase only through the `label` token.
- Errors say what happened and what to do:
  - "Couldn't load standings. Try again."
  - "Couldn't connect. Check your connection and try again."
- Empty states give the next step:
  - "No games today. Next game: Sat, Oct 3 →"
  - "No games match this filter."
- One term per concept everywhere: "Scoreboard", "Standings", "Picks", "Stats", "Teams", "Players".
- Banned in user-facing copy: telemetry, uplink, protocol, decrypt, sector, node, matrix, console, neural, quantum, synthesize, intelligence station, arena console, sync failure, re-establish.

### 4. Data changes

**Standings fallback (API `standings_service`)**
- When the current season has no regular-season games played (every team has `w + l == 0`), fetch ESPN standings for the previous season (`season=<current start year>`; `season=2026` returns 2025–26, verified 2026-09-25).
- Add response fields `season_label` (e.g. `"2025–26 final"`) and `is_previous_season` (bool).
- Once any regular-season game is played, it switches automatically. Preseason is not counted.
- Cached in Redis like today.
- This is the single source for standings, team pages and game-card records and seeds.

**Game card**
- Seed badge from real seeding:
  - 1–6 → "East #3" (or West);
  - 7–10 → "Play-in";
  - worse than 10 → no badge.
  - When `is_previous_season`, the tooltip or label says it is last season's seeding.
- Win probability:
  - Hidden unless both teams have `w + l > 0` in the standings being used.
  - Computed from those win pcts.
  - When `is_previous_season`, a caption reads "Based on 2025–26 records".
  - Never shows 100/0 without data.
- Record line: "2025–26: 37-45" before the season; this season's record after.

**Date strip (`DateNav`, `GamesPage`)**
- Opens on today (America/New_York) and shows today plus the next 6 days. The left arrow still navigates back.
- New API endpoint `GET /games/next?after=YYYY-MM-DD` returns the next date with games (`{"date": "2026-10-03"}` or `{"date": null}`). It checks the local `games` table first, then ESPN scoreboard dates.
- A day with no games shows "No games today. Next game: Sat, Oct 3 →", linking to that date.

**Timezone:** every date computation uses America/New_York.

### 5. Guardrails, testing, release

**Design check (`frontend/scripts/check-design.mjs`, in pre-commit and CI):** fails on any of:
- hex outside the token file and `teamColors.js`;
- `tracking-[…]` > 0.08em, `font-black`, `italic`;
- radius > 16 px;
- gradient or blur outside the allowed-effects list;
- any banned word in `src/**`.

**Frontend tests:** Vitest + React Testing Library, new to the repo.
- Every shared component: its variants and loading/empty/error states.
- Logic:
  - win-probability rules (hidden, previous-season caption);
  - seed badge;
  - date strip (starts on today ET, next-game link, across a DST boundary);
  - copy of the error states.

**API tests:** pytest for the standings fallback and switchover, `season_label`, and `/games/next`. The 99.1% coverage gate still applies.

**Visual checks:** Playwright.
- Every page at 390 px and 1280 px, against mocked API fixtures (deterministic).
- Screenshot baselines are committed. A change that alters them must be approved deliberately.
- DOM uniformity assertions: all cards share background, border and radius; no text lighter than `--text-3`; tabular numbers on score and stat cells.

**Accessibility:** axe on every page. Text contrast ≥ 4.5:1 (≥ 3:1 for large text and labels). Visible focus ring.

**Release**
1. API changes ship first via `deploy/oci/deploy.sh`. They are backward compatible: the old frontend ignores the new fields.
2. The frontend goes to a Vercel preview URL for the owner to review on a phone.
3. After owner approval, it goes to production via Vercel.
4. No deploys between tip-off and final.

## Out of scope

- New features.
- Accounts and auth: the `X-User-Id` header is trusted, which the owner accepts for now.
- Removing or changing sounds and animation timing.
- Lumen and ingestion behavior.
- The Oct 3 live gate. That is separate and unaffected.
