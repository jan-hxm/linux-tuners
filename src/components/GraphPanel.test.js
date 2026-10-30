// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import GraphPanel from './GraphPanel.vue'
import { useTunerStore } from '../stores/tuner.js'

const Stub = { template: '<div class="chart-stub" />' }
const TABS = [
  { id: 'pressure', label: 'Pressure', blurb: 'a', component: Stub },
  { id: 'dirty', label: 'Dirty', blurb: 'b', component: Stub },
]

describe('GraphPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('falls back to the first tab when the store holds an unknown tab id', () => {
    const store = useTunerStore()
    store.activeTab = 'no-such-tab' // e.g. from a stale share link
    const wrapper = mount(GraphPanel, { props: { tabs: TABS } })

    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs[0].attributes('tabindex')).toBe('0')
    expect(tabs[0].attributes('aria-selected')).toBe('true')
    expect(wrapper.find('.chart-stub').exists()).toBe(true)
  })

  it('arrow keys still move the selection after the fallback', async () => {
    const store = useTunerStore()
    store.activeTab = 'no-such-tab'
    const wrapper = mount(GraphPanel, { props: { tabs: TABS } })

    await wrapper.find('[role="tablist"]').trigger('keydown', { key: 'ArrowRight' })
    expect(store.activeTab).toBe('dirty')
  })
})
