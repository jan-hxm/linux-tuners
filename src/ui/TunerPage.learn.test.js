// @vitest-environment happy-dom
// The tuner page's side of the study guides (Design.md §5 "Learning pages >
// Routes and pages"): the "How it works" link and the cards' chapter lookup
// with a live guide, nothing loaded without one, and the `?focus=<key>` link
// a guide's "Tune it" opens (ui/focusSetting.js).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { inject, h } from 'vue'
import TunerPage from './TunerPage.vue'
import { HOW_IT_WORKS_KEY } from './descParts.js'
import { settingHref, focusKeyFrom, withoutFocus } from './focusSetting.js'
import { TUNER_DOMAINS } from '@/tuners/domains.js'

const swap = TUNER_DOMAINS.find((d) => d.id === 'swap')
const CHARTS = TUNER_DOMAINS.flatMap((d) => d.graphTabs.map((t) => t.component.__name))
const chartStubs = Object.fromEntries(CHARTS.map((name) => [name, { template: '<div />' }]))

/** Stands in for the panel: shows what the provided lookup says for two keys. */
const LookupProbe = {
  setup() {
    const lookup = inject(HOW_IT_WORKS_KEY, null)
    return () => h('p', { 'data-lookup': '' }, lookup ? `${lookup('swappiness')}|${lookup('toString')}` : 'none')
  },
}

let wrapper
beforeEach(() => {
  setActivePinia(createPinia())
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  history.replaceState(null, '', '/')
  vi.restoreAllMocks()
})

describe('TunerPage with a study guide', () => {
  it('links the guide from the title block and gives the cards their chapter, once loaded', async () => {
    const chapters = vi.fn(async () => ({ swappiness: 'what-reclaim-chooses' }))
    wrapper = mount(TunerPage, {
      props: { domain: swap, guide: { path: '/learn/memory', title: 'How Linux manages memory', chapters } },
      global: { stubs: { ...chartStubs, ParameterPanel: LookupProbe } },
    })
    expect(wrapper.get('[data-guide-link]').attributes('href')).toBe('/learn/memory')
    expect(wrapper.get('[data-guide-link]').text()).toBe('How it works: How Linux manages memory')
    await flushPromises()
    expect(chapters).toHaveBeenCalledTimes(1)
    expect(wrapper.get('[data-lookup]').text()).toBe('what-reclaim-chooses|null')
  })

  it('shows no link and loads nothing without a live guide', async () => {
    wrapper = mount(TunerPage, { props: { domain: swap }, global: { stubs: { ...chartStubs, ParameterPanel: LookupProbe } } })
    await flushPromises()
    expect(wrapper.find('[data-guide-link]').exists()).toBe(false)
    expect(wrapper.get('[data-lookup]').text()).toBe('null|null')
  })
})

describe('the focus link', () => {
  it('builds and reads ?focus=<key>, only for a def key', () => {
    expect(settingHref('/swap', 'page_cluster')).toBe('/swap?focus=page_cluster')
    expect(settingHref('/x', 'a b')).toBe('/x?focus=a%20b')
    expect(focusKeyFrom('?focus=swappiness', swap.defsByKey)).toBe('swappiness')
    for (const bad of ['?focus=toString', '?focus=__proto__', '?focus=', '?focus=swappiness&focus=page_cluster', '?focus=%3Cimg%3E', '']) {
      expect(focusKeyFrom(bad, swap.defsByKey), bad).toBeNull()
    }
  })

  it('drops only the focus query, keeping the hash and other parameters', () => {
    expect(withoutFocus({ pathname: '/swap', search: '?focus=swappiness', hash: '#N4Ig' })).toBe('/swap#N4Ig')
    expect(withoutFocus({ pathname: '/swap', search: '?a=1&focus=x', hash: '' })).toBe('/swap?a=1')
  })

  it('opens and focuses the card, then removes the query', async () => {
    history.replaceState(null, '', '/swap?focus=page_cluster')
    wrapper = mount(TunerPage, { attachTo: document.body, props: { domain: swap }, global: { stubs: chartStubs } })
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 0))
    await flushPromises()
    expect(window.location.search).toBe('')
    expect(window.location.pathname).toBe('/swap')
    // page_cluster is an advanced card: the reveal opened it.
    expect(document.getElementById('setting-page_cluster')).not.toBeNull()
    expect(document.activeElement?.id).toBe('setting-page_cluster')
  })

  it('ignores a key that is not a setting, and still removes the query', async () => {
    history.replaceState(null, '', '/swap?focus=%3Cimg%20src%3Dx%3E')
    wrapper = mount(TunerPage, { attachTo: document.body, props: { domain: swap }, global: { stubs: chartStubs } })
    await flushPromises()
    expect(window.location.search).toBe('')
    expect(document.activeElement?.id ?? '').not.toMatch(/^setting-/)
    expect(wrapper.html()).not.toContain('<img')
  })
})
