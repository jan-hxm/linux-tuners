/**
 * Forbidden-sink scan (Design.md §10 "Automated guards"). Shared-link state
 * is attacker-controlled, so the page never renders HTML from strings or runs
 * strings as code. Vue's text interpolation escapes; these bypass it.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SCANNED = ['src', 'scripts', 'index.html']

const SINKS = [
  ['v-html', /\bv-html\b/],
  ['innerHTML / outerHTML', /\.(inner|outer)HTML\b/],
  ['insertAdjacentHTML', /\binsertAdjacentHTML\b/],
  ['document.write', /\bdocument\.write(ln)?\s*\(/],
  ['eval', /(^|[^\w.])eval\s*\(/],
  ['new Function', /\bnew\s+Function\s*\(/],
  ['string timer', /\bset(Timeout|Interval)\s*\(\s*['"`]/],
]

function files(path) {
  if (statSync(path).isFile()) return [path]
  return readdirSync(path).flatMap((name) => files(join(path, name)))
}

describe('forbidden sinks', () => {
  const sources = SCANNED.flatMap((p) => files(join(ROOT, p)))
    .filter((f) => /\.(js|mjs|vue|html)$/.test(f) && !f.endsWith('.test.js'))

  it('scans the source tree', () => {
    expect(sources.length).toBeGreaterThan(20)
  })

  it.each(SINKS)('no %s', (_name, pattern) => {
    const hits = sources.flatMap((f) =>
      readFileSync(f, 'utf8')
        .split('\n')
        .map((line, i) => [line, i])
        .filter(([line]) => pattern.test(line))
        .map(([, i]) => `${relative(ROOT, f)}:${i + 1}`),
    )
    expect(hits).toEqual([])
  })
})
