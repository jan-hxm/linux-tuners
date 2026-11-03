// @vitest-environment happy-dom
// (Pin the DOM environment explicitly rather than relying solely on
// environmentMatchGlobs — with a shared module graph across node + happy-dom
// files, glob-based env selection can race when files batch into one worker.)
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import ParameterCard from './ParameterCard.vue'
import { useTunerStoreFor } from '@/core/createTunerStore.js'
import { swapDomain } from '@/tuners/swap/index.js'
import { TUNER_STORE_KEY, TUNER_DOMAIN_KEY } from '@/ui/useActiveTuner.js'

function mountCard(paramKey) {
  return mount(ParameterCard, {
    props: { paramKey },
    global: { provide: { [TUNER_STORE_KEY]: useTunerStoreFor(swapDomain), [TUNER_DOMAIN_KEY]: swapDomain } },
  })
}

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
    useTunerStoreFor(swapDomain) // initialise defaults
    const wrapper = mountCard(key)
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
    const store = useTunerStoreFor(swapDomain)
    const wrapper = mountCard('vfs_cache_pressure')
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
    useTunerStoreFor(swapDomain)
    const wrapper = mountCard('vfs_cache_pressure')
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
    const store = useTunerStoreFor(swapDomain)
    const wrapper = mountCard('vfs_cache_pressure')
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
    useTunerStoreFor(swapDomain)
    const wrapper = mountCard('min_free_kbytes')
    await nextTick()
    expect(wrapper.find('input[type="number"]').exists()).toBe(false)
    await wrapper.find(EDIT_BTN).trigger('click')
    expect(wrapper.find('input[type="number"]').exists()).toBe(true)
  })

  it('pre-fills the input with the raw value, not the formatted string', async () => {
    const store = useTunerStoreFor(swapDomain)
    const wrapper = mountCard('min_free_kbytes')
    await nextTick()
    await wrapper.find(EDIT_BTN).trigger('click')
    const input = wrapper.find('input[type="number"]')
    expect(input.element.value).toBe(String(store.params.min_free_kbytes))
  })

  it('commits an exact typed value to the store on Enter', async () => {
    const store = useTunerStoreFor(swapDomain)
    const wrapper = mountCard('min_free_kbytes')
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
    const store = useTunerStoreFor(swapDomain)
    const wrapper = mountCard('vfs_cache_pressure')
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
    const store = useTunerStoreFor(swapDomain)
    const wrapper = mountCard('min_free_kbytes')
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

  it('rounds a fractional typed value, which sysctl would reject', async () => {
    const store = useTunerStoreFor(swapDomain)
    const wrapper = mountCard('swappiness')
    await nextTick()
    await wrapper.find(EDIT_BTN).trigger('click')
    const input = wrapper.find('input[type="number"]')
    await input.setValue('60.6')
    await input.trigger('keydown.enter')
    expect(store.params.swappiness).toBe(61)
  })

  it('reverts on Escape without mutating the store', async () => {
    const store = useTunerStoreFor(swapDomain)
    const original = store.params.min_free_kbytes
    const wrapper = mountCard('min_free_kbytes')
    await nextTick()
    await wrapper.find(EDIT_BTN).trigger('click')
    const input = wrapper.find('input[type="number"]')
    await input.setValue('12345')
    await input.trigger('keydown.esc')
    expect(store.params.min_free_kbytes).toBe(original)
    expect(wrapper.find('input[type="number"]').exists()).toBe(false)
  })

  it('does not offer inline editing for non-slider controls', async () => {
    useTunerStoreFor(swapDomain)
    const wrapper = mountCard('overcommit_memory')
    await nextTick()
    expect(wrapper.find(EDIT_BTN).exists()).toBe(false)
  })
})

describe('ParameterCard K8s context badge gating', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('hides the K8s badge and note when the workload is not k8s', async () => {
    const store = useTunerStoreFor(swapDomain)
    store.hardware.workload = 'general'
    // swappiness has a k8sNote, so it is the badge-bearing card.
    const wrapper = mountCard('swappiness')
    await nextTick()
    expect(wrapper.text()).not.toContain('K8s')
  })

  it('shows the K8s badge when the workload is k8s', async () => {
    const store = useTunerStoreFor(swapDomain)
    store.hardware.workload = 'k8s'
    const wrapper = mountCard('swappiness')
    await nextTick()
    expect(wrapper.text()).toContain('K8s')
  })
})
describe('ParameterCard layers (Design.md §7)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('labels the control with the plain-language title and the sysctl name', async () => {
    useTunerStoreFor(swapDomain)
    const wrapper = mountCard('swappiness')
    await nextTick()
    const ids = wrapper.get('input[type="range"]').attributes('aria-labelledby').split(' ')
    expect(ids.map((id) => wrapper.get(`#${id}`).text())).toEqual(['Swap aggressiveness', 'vm.swappiness'])
  })

  it('shows longDesc in labelled parts under Learn more, and only the parts the def has', async () => {
    useTunerStoreFor(swapDomain)
    const wrapper = mountCard('dirty_expire_centisecs')
    await wrapper.findAll('button').find((b) => b.text().includes('Learn more')).trigger('click')
    const headings = wrapper.findAll('h4').map((h) => h.text())
    expect(headings).toEqual(['What it does', 'When to change it'])
  })

  it('explains its badges in visible text under Learn more, not in a title', async () => {
    const store = useTunerStoreFor(swapDomain)
    store.setHardware({ ...store.hardware, workload: 'k8s' })
    // vfs_cache_pressure is dangerous at 0; swappiness has the K8s note.
    for (const [key, meaning] of [['vfs_cache_pressure', 'Danger at 0:'], ['swappiness', 'Kubernetes (K8s):']]) {
      const wrapper = mountCard(key)
      await nextTick()
      expect(wrapper.findAll('li[title]')).toHaveLength(0)
      expect(wrapper.text()).not.toContain(meaning)
      await wrapper.findAll('button').find((b) => b.text().includes('Learn more')).trigger('click')
      expect(wrapper.text()).toContain(meaning)
    }
  })
})

describe('ParameterCard value source (Design.md §7)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const resetButton = (wrapper) => wrapper.findAll('button').find((b) => b.text() === 'Reset')

  it('names the kernel default beside the profile default, and resets to the profile default', async () => {
    const store = useTunerStoreFor(swapDomain)
    store.setHardware({ ...store.hardware, workload: 'k8s' })
    const wrapper = mountCard('swappiness')
    await nextTick()
    expect(wrapper.text()).toContain('Kernel default 60 · for your profile 10')
    expect(resetButton(wrapper)).toBeUndefined()

    store.setParam('swappiness', 35)
    await nextTick()
    const reset = resetButton(wrapper)
    expect(reset.attributes('aria-label')).toBe('Reset Swap aggressiveness to 10')
    await reset.trigger('click')
    expect(store.params.swappiness).toBe(10)
    expect(resetButton(wrapper)).toBeUndefined()
  })

  it('marks the kernel default on the track and emphasises the zone holding the value', async () => {
    const store = useTunerStoreFor(swapDomain)
    store.setHardware({ ...store.hardware, workload: 'k8s' })
    const wrapper = mountCard('swappiness')
    await nextTick()
    expect(wrapper.find('span[aria-hidden="true"].absolute').exists()).toBe(true)
    expect(wrapper.find('li.font-semibold').text()).toBe('0–10: latency-sensitive')
  })
})
