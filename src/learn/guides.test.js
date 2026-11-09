/**
 * The guide list (src/learn/guides.js) agrees with the guide contract suite
 * and the registry, and only live guides get a page (Design.md §5 "Learning
 * pages > Routes and pages").
 */
import { describe, it, expect } from 'vitest'
import { TUNERS, LIVE_TUNERS } from '@/tuners/registry.js'
import { GUIDES, LIVE_GUIDES, LEARN_INDEX_ROUTE, liveGuides, loadGuide, chapterIndex, loadChapterIndex, guideFacts, guidePath } from './guides.js'
import { learnRoutesMeta, ROUTES_META } from '@/routes-meta.js'
import { DEMO_LEARN, DEMO_SOURCE, DEMO_EVIDENCE, liveDemoGuides } from './__fixtures__/demoKit.js'

const EM_DASH = String.fromCharCode(0x2014)

// The same glob the contract suite discovers guides with.
const LEARN_MODULES = import.meta.glob('../tuners/*/learn.js', { eager: true })
const discovered = Object.entries(LEARN_MODULES).map(([file, mod]) => ({ tunerId: file.split('/').at(-2), slug: mod.LEARN.slug, learn: mod.LEARN }))
const registryGuides = TUNERS.filter((t) => t.guide).map((t) => ({ tunerId: t.id, slug: t.guide.slug }))

describe('guides.js', () => {
  it('lists exactly the guides the contract suite discovers and the registry names', () => {
    const bySlug = (list) => list.map((g) => `${g.slug}:${g.tunerId}`).sort()
    const listed = Object.entries(GUIDES).map(([slug, g]) => ({ slug, tunerId: g.tunerId }))
    expect(bySlug(listed)).toEqual(bySlug(discovered))
    expect(bySlug(listed)).toEqual(bySlug(registryGuides))
  })

  it('gives each guide a registry entry of a live tuner with a known status', () => {
    for (const t of TUNERS.filter((x) => x.guide)) {
      expect(t.status, t.id).toBe('live')
      expect(['draft', 'live']).toContain(t.guide.status)
      expect(Object.keys(t.guide).sort()).toEqual(['slug', 'status'])
    }
  })

  it('has route metadata that matches the guide and fits a search result', () => {
    for (const [slug, g] of Object.entries(GUIDES)) {
      const learn = discovered.find((d) => d.slug === slug).learn
      expect(g.route.ogTitle, slug).toBe(learn.title)
      expect(g.route.title, slug).toBe(`${learn.title} | linux-tuners.dev`)
      for (const field of ['description', 'priority', 'changefreq', 'jsonLdType']) expect(g.route[field], `${slug}.${field}`).toBeDefined()
      expect(g.route.description.length, slug).toBeLessThanOrEqual(155)
      expect(Object.values(g.route).join(' '), slug).not.toContain(EM_DASH)
    }
    expect(LEARN_INDEX_ROUTE.description.length).toBeLessThanOrEqual(155)
    expect(Object.values(LEARN_INDEX_ROUTE).join(' ')).not.toContain(EM_DASH)
  })

  it('loads each guide and its chapter index lazily', async () => {
    for (const [slug, g] of Object.entries(GUIDES)) {
      const entry = { ...g, slug, path: guidePath(slug) }
      const { learn, probes, evidence } = await loadGuide(entry)
      expect(learn.slug).toBe(slug)
      expect(Object.keys(probes).length).toBeGreaterThan(0)
      expect(typeof evidence).toBe('object')
      expect(await loadChapterIndex(entry)).toEqual(chapterIndex(learn))
    }
  })
})

describe('live guides', () => {
  it('are only the registry entries marked live, so a draft gets no page', () => {
    const live = TUNERS.filter((t) => t.guide?.status === 'live').map((t) => t.guide.slug)
    expect(LIVE_GUIDES.map((g) => g.slug)).toEqual(live.filter((s) => Object.hasOwn(GUIDES, s)))
    const paths = ROUTES_META.map((r) => r.path)
    for (const t of TUNERS.filter((x) => x.guide?.status === 'draft')) expect(paths).not.toContain(guidePath(t.guide.slug))
    if (!LIVE_GUIDES.length) expect(paths).not.toContain(LEARN_INDEX_ROUTE.path)
  })

  it('takes a guide live once its registry entry says so', () => {
    const swap = LIVE_TUNERS.find((t) => t.id === 'swap')
    const tuners = [{ ...swap, guide: { slug: 'demo', status: 'live' } }]
    expect(liveGuides(tuners, { demo: DEMO_SOURCE })).toEqual([
      expect.objectContaining({ slug: 'demo', path: '/learn/demo', tunerId: 'swap', tunerPath: '/swap', tunerTitle: swap.title }),
    ])
    expect(liveGuides([{ ...swap, guide: { slug: 'demo', status: 'draft' } }], { demo: DEMO_SOURCE })).toEqual([])
    // A slug without a loader, or a loader for another tuner, gets no page.
    expect(liveGuides(tuners, {})).toEqual([])
    expect(liveGuides(tuners, { demo: { ...DEMO_SOURCE, tunerId: 'network' } })).toEqual([])
  })

  it('give the learn routes: none without a live guide, else the index and one page each', () => {
    expect(learnRoutesMeta([])).toEqual([])
    const routes = learnRoutesMeta(liveDemoGuides())
    expect(routes.map((r) => [r.path, r.name])).toEqual([['/learn', 'learn'], ['/learn/demo', 'learn-demo']])
    expect(routes[1]).toMatchObject({ title: DEMO_SOURCE.route.title, ogTitle: DEMO_LEARN.title, jsonLdType: 'TechArticle' })
    expect(routes[1].sources).toContain('src/tuners/swap/learn.js')
  })
})

describe('chapter index and facts', () => {
  it('maps each pinned setting to its chapter', () => {
    expect(chapterIndex(DEMO_LEARN)).toEqual({
      reserve_kbytes: 'keeping-a-reserve',
      fill_ratio: 'keeping-a-reserve',
      wake_interval: 'waking-the-worker',
      batch_order: 'reading-in-batches',
      mode: 'promising-memory',
      floor_kbytes: 'reading-the-gauge',
      gap_factor: 'reading-the-gauge',
      buf_sizes: 'comparing-sizes',
      buf_max: 'comparing-sizes',
      buf_auto: 'comparing-sizes',
      unit_weight: 'sharing-the-cpu',
      page_mode: 'picking-a-mode',
      key_mask: 'picking-a-mode',
      scheduler: 'picking-a-mode',
    })
    // Own keys only: a lookup of an inherited name finds nothing.
    expect(Object.hasOwn(chapterIndex(DEMO_LEARN), 'toString')).toBe(false)
  })

  it('says chapters, settings, minutes and kernels', () => {
    expect(guideFacts(DEMO_LEARN, 5)).toEqual(['8 chapters', '14 settings', '5 min read', 'Figures measured on 5 kernels'])
    expect(guideFacts({ ...DEMO_LEARN, chapters: DEMO_LEARN.chapters.slice(0, 1) }, 1)).toEqual(['1 chapter', '2 settings', '5 min read', 'Figures measured on 1 kernel'])
  })

  it('reads the fixture evidence through a test loader', async () => {
    const { evidence } = await loadGuide(liveDemoGuides()[0])
    expect(evidence).toBe(DEMO_EVIDENCE)
  })
})
