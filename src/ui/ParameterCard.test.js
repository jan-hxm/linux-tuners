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

  const learnMore = (wrapper) => wrapper.findAll('button').find((b) => b.text().includes('Learn more'))
  const marginItems = (wrapper) => wrapper.get('aside > ol').findAll(':scope > li')

  it('labels the control with the plain-language title and the sysctl name', async () => {
    useTunerStoreFor(swapDomain)
    const wrapper = mountCard('swappiness')
    await nextTick()
    const ids = wrapper.get('input[type="range"]').attributes('aria-labelledby').split(' ')
    expect(ids.map((id) => wrapper.get(`#${id}`).text())).toEqual(['Swap aggressiveness', 'vm.swappiness'])
  })

  it('puts the first two layer notes in the margin, labelled, and the rest under Learn more', async () => {
    useTunerStoreFor(swapDomain)
    const wrapper = mountCard('swappiness')
    await nextTick()
    expect(wrapper.findAll('h4').map((h) => h.text())).toEqual(['What it does', 'When to change it'])
    await learnMore(wrapper).trigger('click')
    expect(wrapper.findAll('h4').map((h) => h.text())).toEqual(['What it does', 'When to change it', 'Watch out', 'Rule of thumb'])
    // Numbered on from the margin's three.
    expect(wrapper.text()).toContain('[4]Watch out')
  })

  it('shows only the parts the def has, and no Learn more when nothing is left for it', async () => {
    useTunerStoreFor(swapDomain)
    const wrapper = mountCard('dirty_expire_centisecs')
    await nextTick()
    const def = swapDomain.defsByKey.dirty_expire_centisecs
    expect(def.longDesc.watch).toBeUndefined()
    expect(wrapper.findAll('h4').map((h) => h.text())).toEqual(['What it does', 'When to change it'])
    expect(learnMore(wrapper) !== undefined).toBe(Boolean(def.tuningTip))
  })

  it.each(swapDomain.parameterKeys ?? Object.keys(swapDomain.defsByKey))('holds at most three notes in the margin for %s', async (key) => {
    const store = useTunerStoreFor(swapDomain)
    store.setHardware({ ...store.hardware, workload: 'k8s' })
    const wrapper = mountCard(key)
    await nextTick()
    const items = marginItems(wrapper)
    expect(items.length).toBeGreaterThanOrEqual(1)
    expect(items.length).toBeLessThanOrEqual(3)
    // The origin note is always the last one.
    expect(items.at(-1).text()).toContain('Kernel default')
  })

  it('renders longDesc as rich text, with glossary terms as buttons', async () => {
    useTunerStoreFor(swapDomain)
    const wrapper = mountCard('swappiness')
    await nextTick()
    const term = wrapper.findAll('button').find((b) => b.text() === 'anonymous pages')
    expect(term.attributes('aria-expanded')).toBe('false')
    expect(wrapper.text()).not.toContain('[[')
    await term.trigger('click')
    expect(wrapper.text()).toContain('Anonymous memory:')
  })

  it('explains its badges in visible text under Learn more, not in a title', async () => {
    const store = useTunerStoreFor(swapDomain)
    store.setHardware({ ...store.hardware, workload: 'k8s' })
    // vfs_cache_pressure is dangerous at 0; swappiness has the K8s note.
    for (const [key, meaning] of [['vfs_cache_pressure', 'Danger at 0'], ['swappiness', 'Kubernetes (K8s)']]) {
      const wrapper = mountCard(key)
      await nextTick()
      expect(wrapper.findAll('li[title]')).toHaveLength(0)
      expect(wrapper.text()).not.toContain(meaning)
      await learnMore(wrapper).trigger('click')
      expect(wrapper.text()).toContain(meaning)
    }
  })

  it('keeps the sources in view without opening anything', async () => {
    useTunerStoreFor(swapDomain)
    const wrapper = mountCard('swappiness')
    await nextTick()
    const docs = wrapper.find(`a[href="${swapDomain.defsByKey.swappiness.kernelDocsUrl}"]`)
    expect(docs.text()).toContain(swapDomain.docsLabel)
    expect(docs.attributes('target')).toBe('_blank')
    expect(wrapper.findAll('button').some((b) => b.text() === 'Full reference')).toBe(true)
  })
})

describe('ParameterCard [n] note toggles (REDESIGN §4 decision 7)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('makes each margin layer note a real button that opens it in place', async () => {
    useTunerStoreFor(swapDomain)
    const wrapper = mountCard('swappiness')
    await nextTick()
    const toggles = wrapper.findAll('aside button[aria-controls]').filter((b) => /^\[\d\]/.test(b.text()))
    expect(toggles.map((b) => b.text().replace(/[+−]$/, ''))).toEqual(['[1]What it does', '[2]When to change it'])
    for (const t of toggles) {
      expect(t.attributes('type')).toBe('button')
      expect(t.attributes('aria-expanded')).toBe('false')
      expect(t.classes()).toContain('min-h-11') // a 44px target
    }
    const body = wrapper.get(`#${toggles[0].attributes('aria-controls')}`)
    expect(body.classes()).not.toContain('pc-open')
    await toggles[0].trigger('click')
    expect(toggles[0].attributes('aria-expanded')).toBe('true')
    expect(body.classes()).toContain('pc-open')
    // The other note stays as it was.
    expect(toggles[1].attributes('aria-expanded')).toBe('false')
    await toggles[0].trigger('click')
    expect(body.classes()).not.toContain('pc-open')
  })

  it('has no notes, toggles or Learn more in compact view, but keeps Back to X and issues', async () => {
    const store = useTunerStoreFor(swapDomain)
    const wrapper = mount(ParameterCard, {
      props: { paramKey: 'dirty_ratio', compact: true },
      global: { provide: { [TUNER_STORE_KEY]: store, [TUNER_DOMAIN_KEY]: swapDomain } },
    })
    await nextTick()
    expect(wrapper.find('aside').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Learn more')
    store.setParam('dirty_ratio', store.params.dirty_background_ratio)
    await nextTick()
    expect(wrapper.findAll('button').find((b) => b.text().startsWith('Back to')).classes()).not.toContain('invisible')
    expect(wrapper.text()).toContain('Error:')
  })
})

describe('ParameterCard value source (Design.md §7)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  // Back to X keeps its space while hidden, so a visible one is the one without `invisible`.
  const backButton = (wrapper) => wrapper.findAll('button').find((b) => b.text().startsWith('Back to') && !b.classes('invisible'))
  const valueMark = (wrapper) => wrapper.get('.pc-num')

  it('names the kernel default beside the profile default, and goes back to the profile default', async () => {
    const store = useTunerStoreFor(swapDomain)
    store.setHardware({ ...store.hardware, workload: 'k8s' })
    const wrapper = mountCard('swappiness')
    await nextTick()
    expect(wrapper.text()).toContain('Kernel default 60. Fits your machine: 10.')
    expect(backButton(wrapper)).toBeUndefined()
    expect(valueMark(wrapper).classes()).toEqual(expect.arrayContaining(['text-fit-text', 'border-fit']))

    store.setParam('swappiness', 35)
    await nextTick()
    expect(wrapper.text()).toContain('You moved this from 10 to 35. Kernel default 60.')
    expect(valueMark(wrapper).classes()).toEqual(expect.arrayContaining(['text-mine-text', 'border-mine']))
    const back = backButton(wrapper)
    expect(back.text()).toBe('Back to 10')
    expect(back.attributes('aria-label')).toBe('Back to 10, Swap aggressiveness')
    await back.trigger('click')
    expect(store.params.swappiness).toBe(10)
    expect(backButton(wrapper)).toBeUndefined()
  })

  it('builds Back to X from the formatted profile default, without its bracket', async () => {
    const store = useTunerStoreFor(swapDomain)
    const wrapper = mountCard('min_free_kbytes')
    await nextTick()
    const main = swapDomain.formatValue(store.profileDefaults.min_free_kbytes, swapDomain.defsByKey.min_free_kbytes, store.hardware).split(' (')[0]
    expect(wrapper.findAll('button').find((b) => b.text().startsWith('Back to')).text()).toBe(`Back to ${main}`)
  })

  it('says when the kernel default is also the one that fits', async () => {
    useTunerStoreFor(swapDomain)
    const wrapper = mountCard('vfs_cache_pressure')
    await nextTick()
    expect(wrapper.text()).toContain('Kernel default 100, which also fits your machine.')
  })

  it('keeps the origin note and Back to X in the layout, so the card holds its height mid-drag', async () => {
    const store = useTunerStoreFor(swapDomain)
    const wrapper = mountCard('page_cluster')
    await nextTick()
    const height = () => [wrapper.findAll('p').length, wrapper.findAll('button').length, wrapper.findAll('li').length]
    const before = height()
    expect(wrapper.text()).toContain('Kernel default 3')
    expect(wrapper.findAll('button').find((b) => b.text().startsWith('Back to')).classes()).toContain('invisible')

    store.setParam('page_cluster', 5)
    await nextTick()
    expect(height()).toEqual(before)
    expect(backButton(wrapper)).toBeDefined()
  })

  it('draws the three marks on the scale, and the changed dot never replaces the thumb', async () => {
    const store = useTunerStoreFor(swapDomain)
    store.setHardware({ ...store.hardware, workload: 'k8s' })
    const wrapper = mountCard('swappiness')
    await nextTick()
    const left = (sel) => wrapper.get(sel).attributes('style')
    expect(left('[data-mark="default"]')).toContain('left: 30%') // 60 of 0..200
    expect(left('[data-mark="fit"]')).toContain('left: 5%') // 10
    expect(wrapper.find('[data-mark="mine"]').exists()).toBe(false)
    expect(wrapper.find('li.font-semibold').text()).toBe('0–10: latency-sensitive')

    store.setParam('swappiness', 150)
    await nextTick()
    expect(left('[data-mark="mine"]')).toContain('left: 75%')
    expect(left('[data-mark="fill"]')).toContain('width: 75%')
    expect(wrapper.findAll('input[type="range"]')).toHaveLength(1)
  })

  it('never binds a value attribute on the range input (uncontrolled, Design.md §5)', async () => {
    const store = useTunerStoreFor(swapDomain)
    const wrapper = mountCard('swappiness')
    await nextTick()
    store.setParam('swappiness', 120)
    await nextTick()
    const input = wrapper.get('input[type="range"]')
    expect(input.attributes('value')).toBeUndefined()
    expect(input.element.value).toBe('120')
  })

  it('prints the scale numbers from the range', async () => {
    useTunerStoreFor(swapDomain)
    const wrapper = mountCard('swappiness')
    await nextTick()
    const labels = wrapper.findAll('.font-mono.text-quiet.absolute').map((s) => s.text())
    expect(labels).toEqual(['0', '50', '100', '150', '200'])
  })
})
