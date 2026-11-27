import { describe, it, expect, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ThemeProvider, useTheme } from './ThemeContext'
import PrivacyPage from '@/pages/PrivacyPage'
import { MemoryRouter } from 'react-router-dom'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..')
const sourceFiles = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) return sourceFiles(p)
    return /\.(js|jsx)$/.test(f) && !/\.test\.jsx?$/.test(f) ? [p] : []
  })

function probe() {
  let seen
  function Probe() {
    seen = useTheme()
    return null
  }
  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>
  )
  return seen
}

describe('ThemeContext after the redesign (no sounds and no arena flash)', () => {
  beforeEach(() => localStorage.clear())

  it('offers no sound and no arena-flash controls', () => {
    const theme = probe()
    for (const key of ['playGlassClick', 'playThud', 'triggerArenaEntry', 'soundEnabled', 'toggleSound', 'isTransitioning', 'transitionImage']) {
      expect(theme, key).not.toHaveProperty(key)
    }
  })

  it('shows times in Eastern by default', () => {
    expect(probe().timezone).toBe('ET')
  })

  it('no source file still calls a sound or the flash', () => {
    const hits = sourceFiles(SRC).filter((f) =>
      /playGlassClick|playThud|triggerArenaEntry|useSoundEffects/.test(readFileSync(f, 'utf8'))
    )
    expect(hits.map((f) => f.slice(SRC.length))).toEqual([])
  })

  it('the privacy page no longer lists a sound setting', () => {
    const { container } = render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>
    )
    expect(container.textContent).not.toMatch(/sound/i)
  })
})
