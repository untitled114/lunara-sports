// Captures the ESPN images the e2e pages load (team logos and the small combiner-sized
// headshots) exactly as a.espncdn.com serves them, status included (one headshot really
// is a 404 upstream, and stays one here).
//
//   node e2e/fixtures/capture-images.mjs            (re-captures everything)
//   node e2e/fixtures/capture-images.mjs --missing  (captures only URLs not yet in the
//                                                    manifest; existing files stay as-is)
//
// The URL list (images/urls.txt) is every a.espncdn.com request the spec's pages make.
// Every headshot is the small combiner size getHeadshotUrl asks for (2x the avatar); the
// app never requests a full-size headshot, and one that is not in the list fails the test.
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = join(dirname(fileURLToPath(import.meta.url)), 'images')

const etStamp = (d) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'medium',
    timeStyle: 'long',
  }).format(d)

async function main() {
  const urls = readFileSync(join(DIR, 'urls.txt'), 'utf8').split('\n').filter(Boolean)
  const out = join(DIR, 'files')
  const missingOnly = process.argv.includes('--missing')
  const manifestPath = join(DIR, 'manifest.json')
  const existing = missingOnly && existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {}
  if (!missingOnly) rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })
  const manifest = {}
  // New files continue the numbering after the ones already on disk.
  let i = missingOnly ? readdirSync(out).length : 0
  for (const url of urls) {
    const u = new URL(url)
    if (existing[u.pathname + u.search]) {
      manifest[u.pathname + u.search] = existing[u.pathname + u.search]
      continue
    }
    if (manifest[u.pathname + u.search]) continue
    const res = await fetch(url)
    const buf = Buffer.from(await res.arrayBuffer())
    const file = `${String(i++).padStart(3, '0')}-${(u.pathname + u.search).replace(/[^A-Za-z0-9.-]/g, '_').slice(-80)}`
    writeFileSync(join(out, file), buf)
    manifest[u.pathname + u.search] = {
      file: `files/${file}`,
      status: res.status,
      contentType: res.headers.get('content-type') || 'application/octet-stream',
      url,
      capturedAtET: etStamp(new Date()),
    }
    console.log(res.status, url, `${buf.length}B`)
  }
  writeFileSync(join(DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
