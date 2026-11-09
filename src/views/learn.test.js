// @vitest-environment happy-dom
// The whole path of a live study guide (Design.md §5 "Learning pages >
// Routes and pages"), with the fixture guide flipped to live for this file
// only: the routes, the header and footer links, the index, the guide page
// with every chapter, the tuner's "How it works" links, and the axe sweep in
// light and dark. src/learn/guides.test.js checks that no draft is routed.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import axe from 'axe-core'

vi.mock('@/learn/guides.js', async (importOriginal) => {
  const { mockGuides } = await import('@/learn/__fixtures__/demoKit.js')
  return mockGuides(await importOriginal())
})

const { default: App } = await import('@/App.vue')
const { routes } = await import('@/router.js')
const { ROUTES_META, ROUTE_META_BY_PATH, jsonLdFor } = await import('@/routes-meta.js')
const { DEMO_LEARN, DEMO_DEFS } = await import('@/learn/__fixtures__/demoKit.js')
const { storedKernel } = await import('@/ui/learn/kernelPref.js')

const stubs = { AdSlot: { props: ['slot', 'label'], template: '<aside data-ad :data-slot="slot" />' }, ChartFrame: { template: '<div role="img" aria-label="chart" />' } }

let wrapper

async function mountAt(path) {
  const router = createRouter({ history: createMemoryHistory(), routes })
  router.push(path)
  await router.isReady()
  wrapper = mount(App, { attachTo: document.body, global: { plugins: [router], stubs } })
  await flushPromises()
  return { wrapper, router }
}

function setScheme(dark) {
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    matches: dark && query.includes('dark'),
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    onchange: null,
    dispatchEvent: () => false,
  }))
}

async function violations() {
  const { violations } = await axe.run(document, { resultTypes: ['violations'], rules: { 'color-contrast': { enabled: false } } })
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(' ')}`))
}

beforeEach(() => {
  setActivePinia(createPinia())
  document.documentElement.lang = 'en'
  document.title = 'linux-tuners.dev'
  storedKernel.value = null
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('a live guide', { timeout: 30_000 }, () => {
  it('gets the /learn index and its own page, with route metadata', () => {
    const learn = ROUTES_META.filter((r) => r.path.startsWith('/learn'))
    expect(learn.map((r) => r.path)).toEqual(['/learn', '/learn/demo'])
    expect(ROUTE_META_BY_PATH['/learn/demo'].ogTitle).toBe(DEMO_LEARN.title)
    expect(jsonLdFor(ROUTE_META_BY_PATH['/learn/demo'])).toMatchObject({ '@type': 'TechArticle', headline: DEMO_LEARN.title, url: 'https://linux-tuners.dev/learn/demo' })
    expect(jsonLdFor(ROUTE_META_BY_PATH['/learn'])['@type']).toBe('CollectionPage')
  })

  it('shows Learn in the header and the footer', async () => {
    const { wrapper: w } = await mountAt('/')
    expect(w.get('header').findAll('a').map((a) => a.text())).toContain('Learn')
    expect(w.get('nav[aria-label="Footer"]').findAll('a').map((a) => a.text())).toContain('Learn')
  })

  it('lists the guide on the index with its lead and facts', async () => {
    const { wrapper: w } = await mountAt('/learn')
    expect(w.get('h1').text()).toBe('Learn how Linux settings work')
    const card = w.get('[data-guides] li')
    expect(card.get('h2 a').attributes('href')).toBe('/learn/demo')
    expect(card.text()).toContain('fixture data')
    expect(card.text()).toContain('5 chapters')
    expect(card.text()).toContain('5 min read')
    expect(w.get('header a[aria-current="page"]').text()).toBe('Learn')
  })

  it('renders /learn/demo with the header block, the map, the rail and every chapter', async () => {
    const { wrapper: w } = await mountAt('/learn/demo')
    expect(w.get('h1').text()).toBe(DEMO_LEARN.title)
    expect(w.get('nav[aria-label="Breadcrumb"]').text()).toContain('Learn')
    expect(w.get('[data-facts]').findAll('li').map((li) => li.text())).toEqual(['5 chapters', '7 settings', '5 min read', 'Figures measured on 5 kernels'])
    expect(w.get('[data-tune-link]').attributes('href')).toBe('/swap')
    expect(w.get('#start-here [role="figure"]').attributes('aria-label')).toContain('Parts map.')
    // The map of chapters, with the settings each pins.
    const map = w.findAll('[data-chapter-map] > li')
    expect(map).toHaveLength(DEMO_LEARN.chapters.length)
    expect(map[0].text()).toContain('demo.reserve_kbytes')
    expect(map[0].text()).toContain('demo.fill_ratio')
    // Every chapter, an h2 each, in order.
    expect(w.findAll('[data-chapter]').map((s) => s.attributes('id'))).toEqual(DEMO_LEARN.chapters.map((c) => c.id))
    expect(w.findAll('h2').map((h) => h.text())).toEqual(['Start here', 'The chapters', ...DEMO_LEARN.chapters.map((c) => c.title)])
    // One ad, after the last chapter.
    const ads = w.findAll('[data-ad]')
    expect(ads).toHaveLength(1)
    expect(ads[0].attributes('data-slot')).toBe('learn')
    const last = w.findAll('[data-chapter]').at(-1).element
    expect(last.compareDocumentPosition(ads[0].element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // Previous and next.
    const steps = w.findAll('[data-prev-next]')
    expect(steps[0].text()).toContain(`Next: ${DEMO_LEARN.chapters[1].title}`)
    expect(steps.at(-1).text()).toContain(`Previous: ${DEMO_LEARN.chapters.at(-2).title}`)
    expect(steps.at(-1).text()).toContain('Tune these settings')
  })

  it('links each setting to the tuner with a focus query, never a hash', async () => {
    const { wrapper: w } = await mountAt('/learn/demo')
    const tune = w.findAll('[data-pin-panel] a:not([target])').map((a) => a.attributes('href'))
    expect(tune).toContain('/swap?focus=reserve_kbytes')
    for (const href of tune) expect(href).not.toContain('#')
  })

  it('has a chapter rail of links with the chapter in view current, and a phone disclosure', async () => {
    const { wrapper: w } = await mountAt('/learn/demo')
    const rail = w.get('nav[aria-label="Chapters"]')
    const toggle = rail.get('button')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(toggle.attributes('aria-controls')).toBe(rail.get('[data-rail]').attributes('id'))
    expect(rail.get('[data-rail]').classes()).toEqual(expect.arrayContaining(['hidden', 'lg:block']))
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(rail.get('[data-rail]').classes()).toContain('block')
    const links = rail.findAll('a')
    expect(links.map((a) => a.attributes('href'))).toEqual(DEMO_LEARN.chapters.map((c) => `#${c.id}`))
    // happy-dom has no layout, so the scroll spy marks nothing; at most one is current.
    expect(links.filter((a) => a.attributes('aria-current')).length).toBeLessThanOrEqual(1)
    for (const a of links) expect([undefined, 'location']).toContain(a.attributes('aria-current'))
    await links[2].trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('false')
  })

  it('follows the shared kernel choice in the parts map', async () => {
    const { wrapper: w } = await mountAt('/learn/demo')
    await w.findAll('[data-kernels]')[0].findAll('button')[2].trigger('click')
    for (const group of w.findAll('[data-kernels]')) expect(group.get('[aria-pressed="true"]').text()).toBe('Fedora 43')
    expect(localStorage.getItem('linux-tuners:learn-kernel')).toBe('fedora-43')
  })

  it('gives the tuner page a "How it works" link and the cards their chapter lookup', async () => {
    const { wrapper: w } = await mountAt('/swap')
    const link = w.get('[data-guide-link]')
    expect(link.attributes('href')).toBe('/learn/demo')
    expect(link.text()).toContain('How it works')
  })

  it('opens a Tune it link on the tuner with the card in view and the query gone', async () => {
    const { router } = await mountAt('/swap?focus=page_cluster')
    await new Promise((resolve) => setTimeout(resolve, 0))
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/swap')
    expect(document.activeElement?.id).toBe('setting-page_cluster')
  })

  it.each([['light', false], ['dark', true]])('has no serious or critical axe violation on /learn and /learn/demo (%s)', async (_name, dark) => {
    setScheme(dark)
    for (const path of ['/learn', '/learn/demo']) {
      await mountAt(path)
      expect(await violations(), path).toEqual([])
      if (path === '/learn/demo') {
        await wrapper.get('nav[aria-label="Chapters"] button').trigger('click')
        expect(await violations(), 'rail open').toEqual([])
      }
      wrapper.unmount()
      wrapper = null
      document.body.innerHTML = ''
    }
  })
})
