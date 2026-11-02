// @vitest-environment happy-dom
// Smoke test: each tuner's route component (the shared TunerPage, rendered for
// its domain) mounts with no Vue warnings or console errors, and renders its
// page copy, About content and profile form from data.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { TUNER_VIEWS } from '@/router.js'
import { TUNER_DOMAINS } from './domains.js'
import { defineTuner, assertTuner } from '@/core/defineTuner.js'
import TunerPage from '@/ui/TunerPage.vue'

// Chart.js needs a real canvas; the charts have their own tests. Every graph
// tab's component is stubbed by its SFC name.
const CHARTS = TUNER_DOMAINS.flatMap((d) => d.graphTabs.map((t) => t.component.__name))
const stubs = Object.fromEntries(CHARTS.map((name) => [name, { template: `<div class="chart-stub" data-chart="${name}" />` }]))

describe.each(TUNER_DOMAINS.map((d) => [d.id, d]))('%s view', (id, domain) => {
  let warn
  let error
  let View

  beforeEach(async () => {
    View = await TUNER_VIEWS[id]()
    setActivePinia(createPinia())
    history.replaceState(null, '', '/')
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    error = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('mounts without warnings or errors', () => {
    const wrapper = mount(View, { global: { stubs } })
    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('renders the hero, the four steps and the About content from data', () => {
    const wrapper = mount(View, { global: { stubs } })
    expect(wrapper.find('h1').text()).toBe(domain.page.title)
    for (const id of [domain.page.profileStep.id, 'preset', 'tune', 'export', 'about']) {
      expect(wrapper.find(`#${id}`).exists(), id).toBe(true)
    }
    expect(wrapper.text()).toContain(domain.page.exportStep.subtitle)
    expect(wrapper.find('#about').text()).toContain(domain.about.heading)
    // Inline markup renders as elements, never as literal markup characters.
    expect(wrapper.find('header code').exists()).toBe(true)
    expect(wrapper.text()).not.toMatch(/`|\*\*/)
    wrapper.unmount()
  })

  it.runIf(domain.graphTabs.length)('links the mobile impact bar to the graph panel', () => {
    const wrapper = mount(View, { global: { stubs } })
    const href = wrapper.find('[aria-label="Live impact summary"] a').attributes('href')
    expect(wrapper.find(`#tune ${href}`).find('[role="tablist"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('renders the profile form from the field list', () => {
    const wrapper = mount(View, { global: { stubs } })
    const step = wrapper.find(`#${domain.page.profileStep.id}`)
    expect(step.findAll('h2').map((h) => h.text())).toContain(domain.profile.title)
    expect(step.find('button[type="submit"]').text()).toBe(domain.profile.applyLabel)
    for (const field of domain.profile.fields) expect(step.text(), field.key).toContain(field.label)
    wrapper.unmount()
  })

  it('shows the About content without a toggle', () => {
    const wrapper = mount(View, { global: { stubs } })
    expect(wrapper.find('#about button').exists()).toBe(false)
    expect(wrapper.find('#about h3').text()).toBe(domain.about.sections[0].title)
    wrapper.unmount()
  })
})

describe('a tuner without graphs', () => {
  // The swap domain with its graphs and simulation left out of the spec.
  const { graphTabs, defaultTab, simulation, ...spec } = TUNER_DOMAINS.find((d) => d.id === 'swap')
  const domain = defineTuner(spec)

  beforeEach(() => {
    setActivePinia(createPinia())
    history.replaceState(null, '', '/')
  })

  it('defaults to no tabs and no default tab', () => {
    expect(domain.graphTabs).toEqual([])
    expect(domain.defaultTab).toBeNull()
    expect(() => assertTuner(domain)).not.toThrow()
  })

  it('rejects a default tab with no tabs, or one that names no tab', () => {
    expect(() => defineTuner({ ...spec, defaultTab: 'pressure' })).toThrow(/no graph tabs/)
    expect(() => defineTuner({ ...spec, graphTabs, defaultTab: 'nope' })).toThrow(/not a graph tab/)
    expect(defineTuner({ ...spec, graphTabs }).defaultTab).toBe(graphTabs[0].id)
  })

  it('renders a full-width tune step with no graph panel or impact bar', () => {
    const wrapper = mount(TunerPage, { props: { domain }, global: { stubs } })
    const tune = wrapper.find('#tune')
    expect(tune.find('[role="tablist"]').exists()).toBe(false)
    expect(tune.find('.lg\:col-span-3').exists()).toBe(false)
    expect(tune.text()).toContain(domain.sections[0].title)
    expect(wrapper.find('[aria-label="Live impact summary"]').exists()).toBe(false)
    expect(wrapper.find('.h-16.lg\:hidden').exists()).toBe(false)
    wrapper.unmount()
  })
})
