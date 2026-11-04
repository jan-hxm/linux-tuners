/**
 * Import boundaries between the layers (Design.md §9 "Layers and dependency
 * direction"). The project has no ESLint, so this scans import statements.
 * Test files are exempt: shared-code tests mount real tuners as fixtures.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = fileURLToPath(new URL('.', import.meta.url))
const REGISTRY = 'tuners/registry.js'
const DOMAINS = 'tuners/domains.js'

// Static imports, re-exports, side-effect imports, dynamic import() and JSDoc
// import() types alike.
const SPECIFIER = /(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)['"]([^'"]+)['"]/g

function files(path) {
  if (statSync(path).isFile()) return [path]
  return readdirSync(path).flatMap((name) => files(join(path, name)))
}

const posix = (p) => p.split(sep).join('/')

/** Every import of a source file, resolved to a src-relative path ('vue' etc. kept bare). */
function importsOf(file) {
  const out = []
  for (const [, spec] of readFileSync(file, 'utf8').matchAll(SPECIFIER)) {
    if (spec.startsWith('@/')) out.push(spec.slice(2))
    else if (spec.startsWith('.')) out.push(posix(relative(SRC, resolve(dirname(file), spec))))
    else out.push(spec)
  }
  return out
}

const tunerOf = (path) => path.match(/^tuners\/([^/]+)\//)?.[1]

/** Why `from` may not import `to`, or null if it may. */
function violation(from, to) {
  const layer = from.split('/')[0]
  if (layer === 'core') {
    if (to === 'vue' || to.endsWith('.vue')) return 'core is plain JS, no Vue'
    if (/^(ui|tuners|views|setup)\//.test(to)) return 'core imports only core'
  }
  if (layer === 'ui' && /^(tuners|views|setup)\//.test(to) && to !== REGISTRY) return 'ui never imports a tuner'
  // The guided setup is a composition root: every tuner through TUNER_DOMAINS
  // and the registry, never a tuner's internals; only the router imports it.
  if (layer === 'setup' && /^tuners\//.test(to) && to !== REGISTRY && to !== DOMAINS) return 'setup reads tuners only through domains.js and the registry'
  if (layer === 'setup' && to.startsWith('views/')) return 'setup never imports views'
  if (to.startsWith('setup/') && layer !== 'setup' && from !== 'router.js') return 'only the router imports setup'
  // The static page text is a composition root the build loads: tuners only
  // through domains.js and the registry, plain-JS ui modules, no Vue of its
  // own, and nothing in the app imports it.
  if (layer === 'static') {
    if (to === 'vue' || to.endsWith('.vue')) return 'static is plain JS, no Vue'
    if (/^tuners\//.test(to) && to !== REGISTRY && to !== DOMAINS) return 'static reads tuners only through domains.js and the registry'
    if (/^(setup|views)\//.test(to) || to === 'router.js' || to === 'main.js') return 'static never imports the app'
  }
  if (to.startsWith('static/') && layer !== 'static') return 'only the build imports static'
  const own = tunerOf(from)
  const other = tunerOf(to)
  if (own && other && own !== other) return 'tuners never import each other'
  if (own && to.startsWith('views/')) return 'tuners never import views'
  return null
}

const sources = files(SRC)
  .filter((f) => /\.(js|vue)$/.test(f) && !f.endsWith('.test.js'))
  .map((f) => posix(relative(SRC, f)))

describe('import boundaries', () => {
  it('scans every layer', () => {
    for (const layer of ['core/', 'ui/', 'setup/', 'static/', 'tuners/swap/', 'tuners/systemd/']) {
      expect(sources.some((f) => f.startsWith(layer)), layer).toBe(true)
    }
  })

  it('flags a broken rule', () => {
    expect(violation('ui/X.vue', 'tuners/swap/index.js')).toBeTruthy()
    expect(violation('core/x.js', 'vue')).toBeTruthy()
    expect(violation('tuners/swap/x.js', 'tuners/systemd/x.js')).toBeTruthy()
    expect(violation('ui/layout/SiteHeader.vue', REGISTRY)).toBeNull()
    expect(violation('setup/steps.js', 'tuners/swap/defs.js')).toBeTruthy()
    expect(violation('setup/steps.js', 'tuners/swap/index.js')).toBeTruthy()
    expect(violation('views/LandingView.vue', 'setup/steps.js')).toBeTruthy()
    expect(violation('setup/steps.js', DOMAINS)).toBeNull()
    expect(violation('router.js', 'setup/SetupView.vue')).toBeNull()
    expect(violation('static/pages.js', DOMAINS)).toBeNull()
    expect(violation('static/pages.js', 'ui/richText.js')).toBeNull()
    expect(violation('static/pages.js', 'tuners/swap/defs.js')).toBeTruthy()
    expect(violation('static/pages.js', 'ui/RichText.vue')).toBeTruthy()
    expect(violation('static/pages.js', 'setup/steps.js')).toBeTruthy()
    expect(violation('main.js', 'static/index.js')).toBeTruthy()
    expect(violation('ui/TunerPage.vue', 'static/html.js')).toBeTruthy()
  })

  it('keeps every import inside the allowed direction', () => {
    const hits = sources.flatMap((from) =>
      importsOf(join(SRC, from))
        .map((to) => [to, violation(from, to)])
        .filter(([, why]) => why)
        .map(([to, why]) => `${from} -> ${to}: ${why}`),
    )
    expect(hits).toEqual([])
  })
})
