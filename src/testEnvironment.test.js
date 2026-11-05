/**
 * Every test that needs a DOM names its environment in the file (the
 * happy-dom environment comment on its first line) instead of path globs in
 * the Vitest config. Vitest matches such globs against absolute paths, case
 * sensitively, so a run started from a lowercase drive letter (`c:\...`, as
 * some Windows shells and editors start it) silently ran DOM tests in Node.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

function testFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name)
    if (e.isDirectory()) return testFiles(path)
    return e.name.endsWith('.test.js') ? [path] : []
  })
}

// Built from parts so this file's own text doesn't select an environment.
const PRAGMA = new RegExp(`^// @${'vitest'}-environment happy-dom$`, 'm')
// Signs that a test touches the DOM.
// These only name DOM APIs in strings and patterns.
const NO_DOM = new Set(['src/testEnvironment.test.js', 'src/sourceScan.test.js'])
const NEEDS_DOM = /@vue\/test-utils|\bdocument\.|\bwindow\.|\blocalStorage\b|\bnavigator\./

describe('test environments', () => {
  const files = [...testFiles(join(ROOT, 'src')), ...testFiles(join(ROOT, 'scripts'))]

  it('finds the test files', () => {
    expect(files.length).toBeGreaterThan(50)
  })

  it('every test that touches the DOM declares happy-dom in the file', () => {
    const missing = files
      .filter((f) => !NO_DOM.has(relative(ROOT, f).replaceAll('\\', '/')))
      .filter((f) => {
        const code = readFileSync(f, 'utf8')
        return NEEDS_DOM.test(code) && !PRAGMA.test(code)
      })
      .map((f) => relative(ROOT, f))
    expect(missing).toEqual([])
  })
})
