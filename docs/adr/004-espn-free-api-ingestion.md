# ADR-004: ESPN Free API for Data Ingestion

## Status

Accepted

## Context

The application requires real-time NBA game data including:
- Live scoreboard (scores, clock, period, game status)
- Play-by-play events (each scoring play, turnover, foul, timeout)
- Team metadata (names, abbreviations, records)

Budget constraint: $0 for data feeds. This is a portfolio/open-source project.

## Decision

Use the **ESPN free API** with:
- Scoreboard endpoint: `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard`
- Play-by-play endpoint: `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event={gameId}`
- **30-second polling interval** via async Python (httpx)
- Async collectors publish to Kafka topics (`raw.scoreboard`, `raw.plays`)
- Team abbreviation mapping for edge cases: WSH→WAS, NO→NOP, SA→SAS, GS→GSW

## Alternatives Considered

**Sportradar / Stats Perform** — Professional sports data APIs with WebSocket push, historical data, and guaranteed SLAs. Rejected due to cost ($500+/month minimum), which is prohibitive for a portfolio project.

**Web Scraping** — Scraping ESPN.com or NBA.com directly. Rejected because it's fragile (DOM changes break scrapers), likely violates terms of service, and provides worse data structure than the JSON API.

**NBA Official API** — The NBA's own API endpoints. Rejected due to aggressive rate limiting, lack of documentation, and CORS restrictions that complicate server-side usage.

## Consequences

**Positive:**
- Zero cost — no API key, no authentication, no billing
- Reliable — ESPN's API serves their own mobile apps and has high uptime
- Clean JSON responses with well-structured game and play data
- No rate limit headers observed at 30-second polling intervals

**Negative:**
- Polling-only — no WebSocket push, so there's inherent latency (up to 30 seconds)
- No historical backfill — only current/recent games are available on the scoreboard endpoint
- Implicit rate limiting — no documented limits, but aggressive polling may trigger blocks
- Undocumented API — endpoints and response schemas may change without notice
