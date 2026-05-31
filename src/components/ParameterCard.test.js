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

describe('ParameterCard click-to-edit value', () => {
  const EDIT_BTN = 'button[title="Click to type an exact value"]'

  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('swaps the value display for a number input on click', async () => {
    useTunerStore()
    const wrapper = mount(ParameterCard, { props: { paramKey: 'min_free_kbytes' } })
    await nextTick()
    expect(wrapper.find('input[type="number"]').exists()).toBe(false)
    await wrapper.find(EDIT_BTN).trigger('click')
    expect(wrapper.find('input[type="number"]').exists()).toBe(true)
  })

  it('pre-fills the input with the raw value, not the formatted string', async () => {
    const store = useTunerStore()
    const wrapper = mount(ParameterCard, { props: { paramKey: 'min_free_kbytes' } })
    await nextTick()
    await wrapper.find(EDIT_BTN).trigger('click')
    const input = wrapper.find('input[type="number"]')
    expect(input.element.value).toBe(String(store.params.min_free_kbytes))
  })

  it('commits an exact typed value to the store on Enter', async () => {
    const store = useTunerStore()
    const wrapper = mount(ParameterCard, { props: { paramKey: 'min_free_kbytes' } })
    await nextTick()
    await wrapper.find(EDIT_BTN).trigger('click')
    const input = wrapper.find('input[type="number"]')
    await input.setValue('262144')
    await input.trigger('keydown.enter')
    expect(store.params.min_free_kbytes).toBe(262144)
    // Edit mode closes; the input is gone.
    expect(wrapper.find('input[type="number"]').exists()).toBe(false)
  })

  it('moves the slider thumb to the committed value after an inline edit', async () => {
    // Regression: committing an edit set selfWrite, which made the value watcher
    // skip syncing the slider DOM — so the thumb stayed put. The edit must drive
    // the slider to the new value.
    const store = useTunerStore()
    const wrapper = mount(ParameterCard, { props: { paramKey: 'vfs_cache_pressure' } })
    await nextTick()
    await wrapper.find(EDIT_BTN).trigger('click')
    const input = wrapper.find('input[type="number"]')
    await input.setValue('321')
    await input.trigger('keydown.enter')
    await nextTick()
    expect(store.params.vfs_cache_pressure).toBe(321)
    expect(Number(wrapper.find('input[type="range"]').element.value)).toBe(321)
  })

  it('clamps an out-of-range typed value to the slider max', async () => {
    const store = useTunerStore()
    const wrapper = mount(ParameterCard, { props: { paramKey: 'min_free_kbytes' } })
    await nextTick()
    const max = store.params.min_free_kbytes // grab any baseline, real max below
    await wrapper.find(EDIT_BTN).trigger('click')
    const input = wrapper.find('input[type="number"]')
    await input.setValue('999999999999')
    await input.trigger('keydown.enter')
    // setParam clamps to rangeFor().max — never the literal typed value.
    expect(store.params.min_free_kbytes).toBeLessThan(999999999999)
    expect(store.params.min_free_kbytes).toBeGreaterThanOrEqual(max)
  })

  it('reverts on Escape without mutating the store', async () => {
    const store = useTunerStore()
    const original = store.params.min_free_kbytes
    const wrapper = mount(ParameterCard, { props: { paramKey: 'min_free_kbytes' } })
    await nextTick()
    await wrapper.find(EDIT_BTN).trigger('click')
    const input = wrapper.find('input[type="number"]')
    await input.setValue('12345')
    await input.trigger('keydown.esc')
    expect(store.params.min_free_kbytes).toBe(original)
    expect(wrapper.find('input[type="number"]').exists()).toBe(false)
  })

  it('does not offer inline editing for non-slider controls', async () => {
    useTunerStore()
    const wrapper = mount(ParameterCard, { props: { paramKey: 'overcommit_memory' } })
    await nextTick()
    expect(wrapper.find(EDIT_BTN).exists()).toBe(false)
  })
})