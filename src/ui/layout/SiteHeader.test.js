// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import SiteHeader from './SiteHeader.vue'
import { LIVE_TUNERS } from '@/tuners/registry.js'

const Empty = { template: '<div />' }
let mounted
afterEach(() => mounted?.unmount())

async function headerAt(path, extraRoutes = []) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: Empty }, { path: '/privacy', component: Empty }, { path: '/setup', component: Empty }, ...extraRoutes, ...LIVE_TUNERS.map((t) => ({ path: t.path, component: Empty }))],
  })
  router.push(path)
  await router.isReady()
  const wrapper = mount(SiteHeader, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  mounted = wrapper
  wrapper.router = router
  return wrapper
}

const toggle = (w) => w.get('button[aria-controls="tuners-menu"]')
const panel = (w) => w.get('#tuners-menu')
const current = (w) => w.findAll('[aria-current="page"]').map((a) => a.text())
const open = async (w) => { await toggle(w).trigger('click') }

describe('SiteHeader', () => {
  it('toggles aria-expanded on the Tuners button', async () => {
    const w = await headerAt('/')
    expect(toggle(w).attributes('aria-expanded')).toBe('false')
    expect(panel(w).isVisible()).toBe(false)
    await open(w)
    expect(toggle(w).attributes('aria-expanded')).toBe('true')
    expect(panel(w).isVisible()).toBe(true)
    await open(w)
    expect(toggle(w).attributes('aria-expanded')).toBe('false')
  })

  it('lists every live tuner, with its question, then All tuners', async () => {
    const w = await headerAt('/')
    const links = panel(w).findAll('a').map((a) => a.attributes('href'))
    expect(links).toEqual([...LIVE_TUNERS.map((t) => t.path), '/'])
    for (const t of LIVE_TUNERS) {
      const a = panel(w).get(`a[href="${t.path}"]`)
      expect(a.text()).toContain(t.navLabel ?? t.title)
      if (t.question) expect(a.text()).toContain(t.question)
    }
  })

  it('marks the current tuner in the panel and after the slash', async () => {
    const tuner = LIVE_TUNERS[1]
    const w = await headerAt(tuner.path)
    const name = tuner.navLabel ?? tuner.title
    const marked = current(w)
    expect(marked).toHaveLength(2)
    expect(marked.every((t) => t.startsWith(name))).toBe(true)
    expect(panel(w).get(`a[href="${tuner.path}"]`).attributes('aria-current')).toBe('page')
    expect(panel(w).get(`a[href="${tuner.path}"]`).classes()).toContain('border-fit')
  })

  it('shows no tuner name off a tuner page', async () => {
    expect(current(await headerAt('/privacy'))).toEqual([])
  })

  it('marks All tuners on the landing page', async () => {
    const w = await headerAt('/')
    expect(current(w)).toEqual(['All tuners'])
  })

  it('closes on Escape and returns focus to the button', async () => {
    const w = await headerAt('/')
    await open(w)
    panel(w).get('a').element.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(toggle(w).attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(toggle(w).element)
  })

  it('closes on a click outside, not inside', async () => {
    const w = await headerAt('/')
    await open(w)
    panel(w).element.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await flushPromises()
    expect(toggle(w).attributes('aria-expanded')).toBe('true')
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await flushPromises()
    expect(toggle(w).attributes('aria-expanded')).toBe('false')
  })

  it('closes when a link is chosen and on any route change', async () => {
    const w = await headerAt('/')
    await open(w)
    await panel(w).get(`a[href="${LIVE_TUNERS[0].path}"]`).trigger('click')
    await flushPromises()
    expect(toggle(w).attributes('aria-expanded')).toBe('false')
    await open(w)
    await w.router.push('/privacy')
    await flushPromises()
    expect(toggle(w).attributes('aria-expanded')).toBe('false')
  })

  it('offers one primary Start setup link to the guided setup', async () => {
    const w = await headerAt('/')
    const start = w.findAll('a').filter((a) => a.text() === 'Start setup')
    expect(start).toHaveLength(1)
    expect(start[0].attributes('href')).toBe('/setup')
  })

  it('shows Glossary only when that route exists', async () => {
    expect((await headerAt('/')).findAll('a').some((a) => a.text() === 'Glossary')).toBe(false)
    mounted.unmount()
    const w = await headerAt('/', [{ path: '/glossary', name: 'glossary', component: Empty }])
    expect(w.findAll('a').some((a) => a.text() === 'Glossary')).toBe(true)
  })
})
