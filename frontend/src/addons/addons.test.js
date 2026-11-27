import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { addonRoutes } from './index.js'

// Optional parts of the site live in src/addons/<name>/. The site must build and run without
// any of them, so core code reaches them only through src/addons/index.js.
const SRC = resolve(__dirname, '..')

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(js|jsx)$/.test(name) ? [path] : []
  })
}

const ADDON_IMPORT = /(?:from\s+|import\s*\(\s*)['"](?:@\/|\.{1,2}\/)+addons\/[^'"]+['"]/

describe('optional add-ons', () => {
  it("gathers every present add-on's routes into one list", () => {
    expect(Array.isArray(addonRoutes)).toBe(true)
    for (const route of addonRoutes) {
      expect(typeof route.path).toBe('string')
      expect(route.element).toBeTruthy()
    }
  })

  it('core code never imports an add-on directly, so the site builds without them', () => {
    const direct = sourceFiles(SRC)
      .map((file) => relative(SRC, file))
      .filter((rel) => !rel.startsWith('addons/'))
      .filter((rel) => ADDON_IMPORT.test(readFileSync(join(SRC, rel), 'utf8')))
    expect(direct).toEqual([])
  })
})
