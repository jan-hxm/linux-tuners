// @vitest-environment happy-dom
// Automated accessibility sweep (Design.md §7): mounts the whole app at every
// route, plus the states a reader reaches by clicking (every setup step, every
// card and disclosure open, a preset applied with its undo toast, every graph
// tab, the info drawer), and runs axe-core over the document. Any serious or
// critical violation fails.
//
// happy-dom has no layout or stylesheet, so the rules that need one (colour
// contrast, label-in-name, scrollable regions) don't run here: contrast pairs
// are pinned in ui/theme.test.js, and Design.md §7 says when to rerun axe in a
// real browser.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import axe from 'axe-core'
import App from './App.vue'
import { ROUTES_META } from './routes-meta.js'
import { routes } from './router.js'
import { LIVE_TUNERS } from './tuners/registry.js'
import { SETUP_STEPS } from './setup/steps.js'

// Chart.js needs a real canvas, so ChartFrame, the one component that draws
// it, is stubbed (it has its own test, which covers its label). The graph tab
// components are lazy, so they can't be stubbed by name.
const stubs = { AdSlot: true, ChartFrame: { template: '<div role="img" />' } }

let wrapper

async function mountAt(path) {
  const router = createRouter({ history: createMemoryHistory(), routes })
  router.push(path)
  await router.isReady()
  wrapper = mount(App, { attachTo: document.body, global: { plugins: [router], stubs } })
  await flushPromises()
  return wrapper
}

/** Serious and critical axe violations in the document, one line each. */
async function violations() {
  const { violations } = await axe.run(document, {
    resultTypes: ['violations'],
    // No stylesheet here (see the header comment).
    rules: { 'color-contrast': { enabled: false } },
  })
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(' ')} (${n.failureSummary?.split('\n')[1]?.trim() ?? v.help})`))
}

const button = (w, text) => w.findAll('button').find((b) => b.text().includes(text))

beforeEach(() => {
  setActivePinia(createPinia())
  // index.html sets the language and the router each page's title.
  document.documentElement.lang = 'en'
  document.title = 'linux-tuners.dev'
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  localStorage.clear() // the show-all switch is remembered
  vi.restoreAllMocks()
})

// Each case mounts the whole app and runs axe several times over a large DOM:
// about 1 to 5 s alone, and several times that when the full suite loads
// every core, so the default 5 s timeout is too tight for them.
describe('axe sweep', { timeout: 30_000 }, () => {
  it.each(ROUTES_META.map((r) => r.path))('%s has no serious or critical violations', async (path) => {
    await mountAt(path)
    expect(await violations()).toEqual([])
  })

  it('every setup step has no serious or critical violations', async () => {
    const w = await mountAt('/setup')
    for (let i = 0; i <= SETUP_STEPS.length; i++) {
      await button(w, '→').trigger('click')
      await flushPromises()
      expect(await violations(), w.get('h2').text()).toEqual([])
    }
  })

  it.each(LIVE_TUNERS.map((t) => [t.path]))('%s with every layer open has none', async (path) => {
    const w = await mountAt(path)
    // Every card and every disclosure: the show-all switch, then each
    // collapsed section and Learn more, and one preset preview (they share a
    // panel, so only one is open at a time).
    await w.get('#tune [role="switch"]').trigger('click')
    const collapsed = () => w.findAll('#tune button[aria-expanded="false"]')
    for (let pass = 0; pass < 5 && collapsed().length; pass++) {
      for (const toggle of collapsed()) await toggle.trigger('click')
      await flushPromises()
    }
    expect(collapsed().map((b) => b.attributes('aria-label') ?? b.text())).toEqual([])
    await w.get('#preset button[aria-expanded="false"]').trigger('click')
    expect(await violations(), 'all open').toEqual([])

    // A preset snap, with its undo toast.
    await w.get('#preset button[aria-pressed="false"]').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Undo')
    expect(await violations(), 'preset applied').toEqual([])

    for (const tab of w.findAll('[role="tab"]')) {
      await tab.trigger('click')
      await flushPromises()
      expect(await violations(), `tab ${tab.text()}`).toEqual([])
    }

    await w.get('#tune button[aria-label$=", open reference"]').trigger('click')
    await flushPromises()
    expect(document.querySelector('[role="dialog"]')).not.toBe(null)
    expect(await violations(), 'drawer open').toEqual([])
  })
})
