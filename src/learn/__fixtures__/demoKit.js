/**
 * The fixture guide (demo.learn.js) as the figure components and the learn
 * pages take it, for their tests only: the guide, its defs (with a docs link,
 * as a real def has), the five fixture captures and a `valueFor(ref, imageId)`
 * that reads them, and a live guide entry in the shape of src/learn/guides.js
 * LIVE_GUIDES, so a test can route the fixture as if it were live
 * (`liveDemoGuides()`). Never imported by the app.
 */
import { LEARN, DEFS_BY_KEY } from './demo.learn.js'
import { PROBES } from './demo.probes.js'
import { IMAGES_ORDER, loadEvidence, valueFor as readValue } from '../evidence.js'

export const DEMO_LEARN = LEARN
export const DEMO_PROBES = PROBES
export const DEMO_IMAGES = IMAGES_ORDER
export const DEMO_DOCS = 'https://docs.kernel.org/admin-guide/sysctl/vm.html'
export const DEMO_DEFS = Object.fromEntries(Object.entries(DEFS_BY_KEY).map(([k, d]) => [k, { ...d, kernelDocsUrl: DEMO_DOCS }]))

export const DEMO_EVIDENCE = loadEvidence(import.meta.glob('./evidence/*.json', { eager: true, import: 'default' }))

/** valueFor(ref, imageId) over the fixture captures. */
export const valueFor = (ref, imageId) => readValue(ref, imageId, DEMO_EVIDENCE)

/** A stand-in domain for the fixture's made-up tuner. */
export const DEMO_DOMAIN = Object.freeze({ id: 'demo', defsByKey: DEMO_DEFS, page: { title: 'Demo tuner' } })

/** The fixture as a GuideSource (src/learn/guides.js), for a test's own GUIDES. */
export const DEMO_SOURCE = Object.freeze({
  tunerId: 'swap',
  route: {
    title: 'How a demo tuner works | linux-tuners.dev',
    description: 'A fixture guide for the tests, with made-up numbers.',
    ogTitle: LEARN.title,
    priority: 0.5,
    changefreq: 'monthly',
    jsonLdType: 'TechArticle',
  },
  learn: async () => LEARN,
  probes: async () => PROBES,
  evidence: async () => DEMO_EVIDENCE,
  domain: async () => DEMO_DOMAIN,
})

/**
 * LIVE_GUIDES with the fixture flipped to live, attached to the swap tuner's
 * page (the fixture has no tuner of its own). No import of guides.js here, so
 * a vi.mock factory of guides.js can import this file.
 */
export function liveDemoGuides() {
  return [{ ...DEMO_SOURCE, slug: LEARN.slug, path: `/learn/${LEARN.slug}`, tunerPath: '/swap', tunerTitle: 'Swap & memory' }]
}

/**
 * A vi.mock factory for src/learn/guides.js that makes the fixture the one
 * live guide: `vi.mock('@/learn/guides.js', async (orig) => (await import(kit)).mockGuides(await orig()))`.
 */
export function mockGuides(actual) {
  return { ...actual, GUIDES: { ...actual.GUIDES, demo: DEMO_SOURCE }, LIVE_GUIDES: liveDemoGuides() }
}
