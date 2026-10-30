// @vitest-environment happy-dom
// Smoke test: each tuner view mounts through TunerPage with no Vue warnings
// or console errors, and renders its page copy and About content from data.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import SwapTunerView from './SwapTunerView.vue'
import SystemdTunerView from './SystemdTunerView.vue'
import { swapDomain } from '@/domains/swap/index.js'
import { systemdDomain } from '@/domains/systemd/index.js'

// Chart.js needs a real canvas; the charts have their own tests.
const CHARTS = ['PressureChart', 'WatermarkChart', 'DirtyChart', 'CpuShareChart', 'MemoryBudgetChart', 'TasksChart']
const stubs = Object.fromEntries(CHARTS.map((name) => [name, { template: `<div class="chart-stub" data-chart="${name}" />` }]))

describe.each([
  ['swap', SwapTunerView, swapDomain],
  ['systemd', SystemdTunerView, systemdDomain],
])('%s view', (_id, View, domain) => {
  let warn
  let error

  beforeEach(() => {
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

  it('shows the About content without a toggle', () => {
    const wrapper = mount(View, { global: { stubs } })
    expect(wrapper.find('#about button').exists()).toBe(false)
    expect(wrapper.find('#about h3').text()).toBe(domain.about.sections[0].title)
    wrapper.unmount()
  })
})
