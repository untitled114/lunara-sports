import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { apiPrefetch } from './apiPrefetch.js'

// The API's address comes from the build (VITE_API_URL), never from the source.
const ROOT = resolve(__dirname, '..')

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

describe('the API address comes from the build', () => {
  it("adds a dns-prefetch hint for the API's origin when the build has one", () => {
    expect(apiPrefetch({ VITE_API_URL: 'https://api.example.test/v1' }).transformIndexHtml()).toEqual([
      { tag: 'link', attrs: { rel: 'dns-prefetch', href: 'https://api.example.test' }, injectTo: 'head' },
    ])
  })

  it('adds nothing when the build has no API address', () => {
    expect(apiPrefetch({}).transformIndexHtml()).toEqual([])
  })

  it('adds nothing for a relative API address (a dev proxy path), and does not throw', () => {
    expect(apiPrefetch({ VITE_API_URL: '/api' }).transformIndexHtml()).toEqual([])
  })

  it('no core source file names the API or admin host', () => {
    const files = [join(ROOT, 'index.html'), ...walk(join(ROOT, 'src'))].filter(
      (f) => !f.includes(`${join(ROOT, 'src', 'addons')}/`),
    )
    const named = files
      .filter((f) => /(?:api|admin)\.lunara-app\.com/.test(readFileSync(f, 'utf8')))
      .map((f) => f.slice(ROOT.length + 1))
    expect(named).toEqual([])
  })
})
