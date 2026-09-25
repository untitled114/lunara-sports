// Captures the e2e fixtures from the real production API. Nothing here is invented:
// every body is exactly what api.lunara-app.com returned at capture time, byte for byte.
//
//   node e2e/fixtures/capture.mjs
//
// Writes one file per request into e2e/fixtures/api/, plus manifest.json (request key ->
// file, HTTP status, source URL, capture time in ET) and README.md. mockApi.js serves
// the app's requests from the manifest; a request with no manifest entry fails the test.
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SOURCE = 'https://api.lunara-app.com'

// The app's request path + query string, exactly as services/api.js builds it.
export const ENDPOINTS = [
  // Scoreboard, ticker and schedule (schedule = today ±3 days, today = 2026-09-25 ET)
  ...['2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-10-03'].map(
    (d) => `/games/?game_date=${d}`,
  ),
  '/games/next?after=2026-09-25',
  '/games/next?after=2026-10-03',
  '/standings',
  '/teams',
  '/teams/MIA',
  '/teams/MIA/roster',
  '/teams/MIA/schedule',
  '/players',
  '/players/4066261',
  '/players/4066261/stats',
  '/players/4066261/log',
  '/stats/leaders?limit=5',
  '/stats/teams',
  '/picks/today',
  // Final game (OKC @ DEN) and the scheduled MIA @ TOR opener
  ...['401811037', '401902644'].flatMap((id) => [
    `/games/${id}`,
    `/games/${id}/plays`,
    `/games/${id}/boxscore`,
    `/games/${id}/picks`,
  ]),
]

export const fileFor = (key) => `${key.replace(/^\//, '').replace(/[^A-Za-z0-9.-]/g, '_')}.json`

const etStamp = (d) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'medium',
    timeStyle: 'long',
  }).format(d)

async function main() {
  const out = join(HERE, 'api')
  rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })
  const manifest = {}
  for (const key of ENDPOINTS) {
    const url = `${SOURCE}${key}`
    const res = await fetch(url)
    const body = await res.text()
    const file = fileFor(key)
    writeFileSync(join(out, file), body)
    manifest[key] = {
      file,
      status: res.status,
      contentType: res.headers.get('content-type') || 'application/json',
      url,
      capturedAtET: etStamp(new Date()),
    }
    console.log(res.status, key, `${body.length}B`)
  }
  writeFileSync(join(HERE, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

  const rows = Object.entries(manifest)
    .map(([key, m]) => `| \`${key}\` | \`api/${m.file}\` | ${m.status} | ${m.url} | ${m.capturedAtET} |`)
    .join('\n')
  writeFileSync(
    join(HERE, 'README.md'),
    `# e2e fixtures

Real captures from the production API (${SOURCE}), taken with \`node e2e/fixtures/capture.mjs\`.
The bodies are stored exactly as returned. Nothing is hand-edited or invented; an endpoint
that was empty at capture time (for example picks in the preseason) stays empty.

\`mockApi.js\` serves the app's requests from \`manifest.json\`. Any API request without an
entry fails the test. To refresh, re-run the capture script and regenerate the screenshot
baselines in the pinned Playwright image (see \`playwright.config.js\`).

\`fonts/\` holds the Inter webfont exactly as Google Fonts served it (SIL Open Font License),
and \`images/\` the ESPN logos and headshots the pages load; see \`fonts/README.md\` and
\`images/README.md\`.

| Request (app path) | File | HTTP | Source URL | Captured (ET) |
|---|---|---|---|---|
${rows}
`,
  )
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
