import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import ParameterCard from './ParameterCard.vue'
import { useTunerStore } from '../stores/tuner.js'

const SLIDER_KEYS = [
  'swappiness',
  'min_free_kbytes',
  'watermark_scale_factor',
  'vfs_cache_pressure',
  'dirty_ratio',
  'dirty_background_ratio',
  'dirty_expire_centisecs',
  'dirty_writeback_centisecs',
  'overcommit_ratio',
]

describe('ParameterCard slider rendering', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it.each(SLIDER_KEYS)('renders a single working <input type="range"> for %s', async (key) => {
    useTunerStore() // initialise defaults
    const wrapper = mount(ParameterCard, { props: { paramKey: key } })
    await nextTick() // onMounted sets the initial DOM value
    const inputs = wrapper.findAll('input[type="range"]')
    expect(inputs).toHaveLength(1)
    const el = inputs[0].element
    expect(el.disabled).toBe(false)
    expect(el.readOnly).toBe(false)
    expect(Number(el.min)).toBeLessThan(Number(el.max))
    const v = Number(el.value)
    expect(v).toBeGreaterThanOrEqual(Number(el.min))
    expect(v).toBeLessThanOrEqual(Number(el.max))
  })

  it('@input on the slider commits to the Pinia store', async () => {
    const store = useTunerStore()
    const wrapper = mount(ParameterCard, { props: { paramKey: 'vfs_cache_pressure' } })
    await nextTick()
    const input = wrapper.find('input[type="range"]')
    await input.setValue('42')
    expect(store.params.vfs_cache_pressure).toBe(42)
  })

  it('does not write back to the DOM value when the user drags (uncontrolled pattern)', async () => {
    // Reproduces the Chromium drag-cancel bug: under a `:value="value"` binding,
    // every input event would rewrite the DOM value attribute mid-drag and cancel
    // the active pointer capture. Our uncontrolled pattern must leave the DOM
    // alone for user-originated input.
    useTunerStore()
    const wrapper = mount(ParameterCard, { props: { paramKey: 'vfs_cache_pressure' } })
    await nextTick()
    const input = wrapper.find('input[type="range"]')
    const el = input.element
    // Simulate a drag tick: user moves the thumb to 42 themselves.
    el.value = '42'
    el.dispatchEvent(new Event('input'))
    await nextTick()
    // The slider DOM must still show 42; the store update must NOT have rewritten it.
    expect(el.value).toBe('42')
  })

  it('writes external store changes to the slider DOM (e.g. preset apply)', async () => {
    const store = useTunerStore()
    const wrapper = mount(ParameterCard, { props: { paramKey: 'vfs_cache_pressure' } })
    await nextTick()
    const el = wrapper.find('input[type="range"]').element
    // External commit (mimics applyPreset): change the store directly.
    store.params.vfs_cache_pressure = 250
    await nextTick()
    expect(Number(el.value)).toBe(250)
  })

})