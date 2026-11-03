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
import { networkDomain } from '@/tuners/network/index.js'
import { setShowAllParams, SHOW_ALL_STORAGE_KEY, setCompactParams, COMPACT_STORAGE_KEY } from '@/ui/viewerPrefs.js'

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

function mountNetwork() {
  const store = useTunerStoreFor(networkDomain)
  const wrapper = mount(ParameterPanel, {
    global: { provide: { [TUNER_STORE_KEY]: store, [TUNER_DOMAIN_KEY]: networkDomain } },
  })
  return { store, wrapper }
}

/** Every card key the panel renders, in order. */
const allCards = (wrapper) => wrapper.findAllComponents(ParameterCard).map((c) => c.props('paramKey'))
const switchNamed = (wrapper, label) =>
  wrapper.findAll('[role="switch"]').find((s) => s.element.nextElementSibling?.textContent === label)
const search = (wrapper) => wrapper.find('input[type="search"]')

describe('ParameterPanel pro tools', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    setShowAllParams(false)
    setCompactParams(false)
  })

  it('appear only on tuners with enough parameters', () => {
    const small = mountPanel().wrapper
    expect(search(small).exists()).toBe(false)
    expect(small.findAll('[role="switch"]')).toHaveLength(1)
    const { wrapper } = mountNetwork()
    expect(search(wrapper).exists()).toBe(true)
    expect(switchNamed(wrapper, 'Changed only')).toBeDefined()
    expect(switchNamed(wrapper, 'Compact')).toBeDefined()
  })

  it('filters across tiers and hides the sections it empties', async () => {
    const { wrapper } = mountNetwork()
    expect(allCards(wrapper)).not.toContain('rmem_max')

    await search(wrapper).setValue('Largest receive')
    expect(allCards(wrapper)).toEqual(['rmem_max'])
    expect(wrapper.find('#section-panel-queues').exists()).toBe(false)
    expect(advancedButton(wrapper, 'buffers')).toBeUndefined()
    expect(wrapper.text()).toContain('1 parameter shown')

    await search(wrapper).setValue('net.core')
    const keys = allCards(wrapper)
    expect(keys).toEqual(expect.arrayContaining(['rmem_max', 'wmem_max', 'somaxconn', 'netdev_max_backlog', 'default_qdisc']))
    expect(keys).not.toContain('tcp_fin_timeout')
  })

  it('opens collapsed sections and disables "Show all" while filtering', async () => {
    const { wrapper } = mountNetwork()
    const header = wrapper.find('[aria-controls="section-panel-buffers"][aria-expanded]')
    await header.trigger('click')
    expect(wrapper.find('#section-panel-buffers').exists()).toBe(false)

    await search(wrapper).setValue('Largest receive')
    expect(allCards(wrapper)).toEqual(['rmem_max'])
    expect(switchNamed(wrapper, 'Show all parameters').attributes('disabled')).toBeDefined()

    await search(wrapper).setValue('')
    expect(wrapper.find('#section-panel-buffers').exists()).toBe(false)
    expect(switchNamed(wrapper, 'Show all parameters').attributes('disabled')).toBeUndefined()
  })

  it('says so when nothing matches, and clears from there', async () => {
    const { wrapper } = mountNetwork()
    await search(wrapper).setValue('zzzz-nothing')
    expect(allCards(wrapper)).toEqual([])
    expect(wrapper.text()).toContain('No parameter matches "zzzz-nothing".')

    const clear = wrapper.findAll('button').find((b) => b.text() === 'Clear filter')
    await clear.trigger('click')
    expect(search(wrapper).element.value).toBe('')
    expect(allCards(wrapper).length).toBeGreaterThan(0)
    expect(advancedButton(wrapper, 'buffers')).toBeDefined()
  })

  it('shows only changed values behind "Changed only", and keeps one edited back until a bulk change', async () => {
    const { store, wrapper } = mountNetwork()
    await switchNamed(wrapper, 'Changed only').trigger('click')
    expect(allCards(wrapper)).toEqual([])
    expect(wrapper.text()).toContain('No parameter differs from the default for your profile yet.')

    const stock = store.params.tcp_fin_timeout
    store.setParam('tcp_fin_timeout', stock + 5)
    await nextTick()
    expect(allCards(wrapper)).toEqual(['tcp_fin_timeout'])

    store.setParam('tcp_fin_timeout', stock)
    await nextTick()
    expect(allCards(wrapper)).toEqual(['tcp_fin_timeout'])

    store.resetToHardwareDefaults()
    await nextTick()
    expect(allCards(wrapper)).toEqual([])

    await search(wrapper).setValue('rmem')
    expect(wrapper.text()).toContain('No changed parameter matches "rmem".')
  })

  it('switches the cards to compact and remembers it in this browser', async () => {
    const { wrapper } = mountNetwork()
    const card = () => wrapper.findComponent(ParameterCard)
    const shortDesc = () => networkDomain.defsByKey[card().props('paramKey')].shortDesc
    expect(card().text()).toContain(shortDesc())

    await switchNamed(wrapper, 'Compact').trigger('click')
    expect(localStorage.getItem(COMPACT_STORAGE_KEY)).toBe('1')
    expect(card().props('compact')).toBe(true)
    expect(card().text()).not.toContain(shortDesc())
    expect(card().text()).not.toContain('Learn more')

    await switchNamed(wrapper, 'Compact').trigger('click')
    expect(localStorage.getItem(COMPACT_STORAGE_KEY)).toBeNull()
  })

  it('never makes a small tuner compact, even when the viewer chose it', () => {
    setCompactParams(true)
    const { wrapper } = mountPanel()
    expect(wrapper.findComponent(ParameterCard).props('compact')).toBe(false)
  })
})
