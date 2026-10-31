// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { markRaw } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import GraphPanel from './GraphPanel.vue'
import { useTunerStoreFor } from '@/core/createTunerStore.js'
import { swapDomain } from '@/tuners/swap/index.js'
import { TUNER_STORE_KEY, TUNER_DOMAIN_KEY } from '@/ui/useActiveTuner.js'

// mount() makes props deeply reactive; markRaw keeps the stub a plain component
// (as the views' constant tab lists are) so Vue doesn't warn.
const Stub = markRaw({ template: '<div class="chart-stub" />' })
const TABS = [
  { id: 'pressure', label: 'Pressure', blurb: 'a', component: Stub },
  { id: 'dirty', label: 'Dirty', blurb: 'b', component: Stub },
]

function mountPanel(store) {
  return mount(GraphPanel, {
    props: { tabs: TABS },
    global: { provide: { [TUNER_STORE_KEY]: store, [TUNER_DOMAIN_KEY]: swapDomain } },
  })
}

describe('GraphPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('falls back to the first tab when the store holds an unknown tab id', () => {
    const store = useTunerStoreFor(swapDomain)
    store.activeTab = 'no-such-tab' // e.g. from a stale share link
    const wrapper = mountPanel(store)

    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs[0].attributes('tabindex')).toBe('0')
    expect(tabs[0].attributes('aria-selected')).toBe('true')
    expect(wrapper.find('.chart-stub').exists()).toBe(true)
  })

  it('arrow keys still move the selection after the fallback', async () => {
    const store = useTunerStoreFor(swapDomain)
    store.activeTab = 'no-such-tab'
    const wrapper = mountPanel(store)

    await wrapper.find('[role="tablist"]').trigger('keydown', { key: 'ArrowRight' })
    expect(store.activeTab).toBe('dirty')
  })
})
