// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import ParameterPanel from './ParameterPanel.vue'
import ParameterCard from './ParameterCard.vue'
import { useTunerStoreFor } from '@/core/createTunerStore.js'
import { swapDomain } from '@/tuners/swap/index.js'
import { TUNER_STORE_KEY, TUNER_DOMAIN_KEY } from '@/ui/useActiveTuner.js'
import { setShowAllParams, SHOW_ALL_STORAGE_KEY } from '@/ui/showAllParams.js'

function mountPanel() {
  const store = useTunerStoreFor(swapDomain)
  const wrapper = mount(ParameterPanel, {
    global: { provide: { [TUNER_STORE_KEY]: store, [TUNER_DOMAIN_KEY]: swapDomain } },
  })
  return { store, wrapper }
}

/** The card keys rendered in one section. */
function cardsIn(wrapper, sectionId) {
  return wrapper.find(`#section-panel-${sectionId}`).findAllComponents(ParameterCard).map((c) => c.props('paramKey'))
}

const advancedButton = (wrapper, sectionId) =>
  wrapper.find(`#section-panel-${sectionId}`).findAll('button').find((b) => /advanced/.test(b.text()))

describe('ParameterPanel tiers', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    setShowAllParams(false)
  })

  it('shows the essential cards and hides the advanced ones behind a button', async () => {
    const { wrapper } = mountPanel()
    expect(cardsIn(wrapper, 'memory-reclaim')).toEqual(['swappiness', 'vfs_cache_pressure'])
    const button = advancedButton(wrapper, 'memory-reclaim')
    expect(button.text()).toBe('Show 3 advanced')
    expect(button.attributes('aria-expanded')).toBe('false')

    await button.trigger('click')
    expect(cardsIn(wrapper, 'memory-reclaim')).toEqual(swapDomain.sections[0].keys)
    expect(advancedButton(wrapper, 'memory-reclaim').text()).toBe('Hide advanced')
    expect(advancedButton(wrapper, 'memory-reclaim').attributes('aria-expanded')).toBe('true')
  })

  it('never hides an advanced value a preset or the user changed', async () => {
    const { store, wrapper } = mountPanel()
    store.applyPreset('k8s-node', swapDomain.presetsById['k8s-node'].values)
    await nextTick()
    expect(cardsIn(wrapper, 'memory-reclaim')).toEqual(expect.arrayContaining(['min_free_kbytes', 'watermark_scale_factor']))

    store.resetToHardwareDefaults()
    await nextTick()
    store.setParam('page_cluster', 0)
    await nextTick()
    expect(cardsIn(wrapper, 'memory-reclaim')).toContain('page_cluster')
    expect(advancedButton(wrapper, 'memory-reclaim').text()).toBe('Show 2 advanced')
  })

  it('keeps a card that was edited back to its default until the next bulk change', async () => {
    const { store, wrapper } = mountPanel()
    const stock = store.params.page_cluster
    store.setParam('page_cluster', 0)
    await nextTick()
    store.setParam('page_cluster', stock)
    await nextTick()
    expect(cardsIn(wrapper, 'memory-reclaim')).toContain('page_cluster')

    store.resetToHardwareDefaults()
    await nextTick()
    expect(cardsIn(wrapper, 'memory-reclaim')).not.toContain('page_cluster')
  })

  it('shows the advanced cards of a section the profile leaves no essential card', () => {
    const domain = {
      ...swapDomain,
      visibleKeys: (section) => section.keys.filter((k) => swapDomain.defsByKey[k].tier === 'advanced'),
    }
    const store = useTunerStoreFor(swapDomain)
    const wrapper = mount(ParameterPanel, {
      global: { provide: { [TUNER_STORE_KEY]: store, [TUNER_DOMAIN_KEY]: domain } },
    })
    expect(cardsIn(wrapper, 'memory-reclaim')).toEqual(['min_free_kbytes', 'watermark_scale_factor', 'page_cluster'])
    expect(advancedButton(wrapper, 'memory-reclaim')).toBeUndefined()
  })

  it('shows every card behind the switch and remembers it in this browser', async () => {
    const { wrapper } = mountPanel()
    const toggle = wrapper.find('[role="switch"]')
    expect(toggle.attributes('aria-checked')).toBe('false')

    await toggle.trigger('click')
    expect(toggle.attributes('aria-checked')).toBe('true')
    expect(localStorage.getItem(SHOW_ALL_STORAGE_KEY)).toBe('1')
    for (const section of swapDomain.sections) {
      expect(advancedButton(wrapper, section.id)).toBeUndefined()
    }
    expect(cardsIn(wrapper, 'dirty-writeback')).toEqual(swapDomain.sections[1].keys)

    await toggle.trigger('click')
    expect(localStorage.getItem(SHOW_ALL_STORAGE_KEY)).toBeNull()
  })
})
