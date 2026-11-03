// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PresetSelector from './PresetSelector.vue'
import { useTunerStoreFor } from '@/core/createTunerStore.js'
import { differingKeys } from '@/core/valueTypes.js'
import { swapDomain } from '@/tuners/swap/index.js'
import { TUNER_STORE_KEY, TUNER_DOMAIN_KEY } from '@/ui/useActiveTuner.js'

function mountSelector(store) {
  return mount(PresetSelector, {
    global: { provide: { [TUNER_STORE_KEY]: store, [TUNER_DOMAIN_KEY]: swapDomain } },
  })
}

describe('PresetSelector change preview', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('shows what a preset would change without a title tooltip, and only on request', async () => {
    const store = useTunerStoreFor(swapDomain)
    const wrapper = mountSelector(store)
    expect(wrapper.find('[title]').exists()).toBe(false)

    const preset = swapDomain.presets.find((p) => differingKeys(swapDomain.defsByKey, p.values, store.params).length)
    const keys = differingKeys(swapDomain.defsByKey, preset.values, store.params)
    const toggle = wrapper.find(`button[aria-label^="${preset.label}:"]`)
    const panel = wrapper.find(`#${toggle.attributes('aria-controls')}`)
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(panel.text()).toBe('')

    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(store.activePreset).not.toBe(preset.id) // previewing doesn't apply
    expect(panel.findAll('li')).toHaveLength(keys.length)
    for (const key of keys) expect(panel.text()).toContain(swapDomain.defsByKey[key].sysctlName)

    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(panel.text()).toBe('')
  })

  it('closes the preview and drops the toggle once the preset is applied', async () => {
    const store = useTunerStoreFor(swapDomain)
    const wrapper = mountSelector(store)
    const preset = swapDomain.presets.find((p) => differingKeys(swapDomain.defsByKey, p.values, store.params).length)
    const toggle = () => wrapper.find(`button[aria-label^="${preset.label}:"]`)
    await toggle().trigger('click')
    const panel = wrapper.find(`#${toggle().attributes('aria-controls')}`)

    const chip = wrapper.findAll('button').find((b) => b.text().startsWith(preset.label))
    await chip.trigger('click')
    expect(store.activePreset).toBe(preset.id)
    expect(panel.text()).toBe('')
    expect(toggle().exists()).toBe(false)
  })

  it('says which preset is active with aria-pressed, not only with colour', async () => {
    const store = useTunerStoreFor(swapDomain)
    const wrapper = mountSelector(store)
    const chips = () => wrapper.findAll('button[aria-pressed]')
    expect(chips().map((b) => b.attributes('aria-pressed'))).toEqual(swapDomain.presets.map(() => 'false'))
    const preset = swapDomain.presets[1]
    await chips()[1].trigger('click')
    expect(store.activePreset).toBe(preset.id)
    expect(chips().map((b) => b.attributes('aria-pressed'))).toEqual(swapDomain.presets.map((p) => String(p === preset)))
  })
})
