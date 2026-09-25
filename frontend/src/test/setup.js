import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// RTL's own auto-cleanup only registers when a *global* `afterEach` exists (it does
// `typeof afterEach === 'function'`); this project's vitest config doesn't set
// `test.globals: true`, so without this it never runs and every test after the first
// that queries by role/text risks matching leftover nodes from earlier renders.
afterEach(() => {
  cleanup()
})
