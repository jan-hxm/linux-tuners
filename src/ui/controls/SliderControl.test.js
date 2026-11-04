// @vitest-environment happy-dom
// The slider on its own, as the landing page's live specimen uses it: no
// store, the value held by the caller (Design.md §7).
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import SliderControl from './SliderControl.vue'
import MarkKey from './MarkKey.vue'
import MarkGlyph from './MarkGlyph.vue'

const def = { key: 'x', step: 1, kernelDefault: 60, zones: [{ label: 'low', min: 0, max: 50 }, { label: 'high', min: 51, max: 200 }] }
const range = { min: 0, max: 200 }

function mountSlider(props = {}) {
  return mount(SliderControl, {
    props: { def, value: 100, range, labelId: 'l', valueText: '100', ...props },
  })
}

describe('SliderControl', () => {
  it('draws the fit bar only when given a fit value, and the dot only when changed', async () => {
    const plain = mountSlider()
    expect(plain.find('[data-mark="default"]').exists()).toBe(true)
    expect(plain.find('[data-mark="fit"]').exists()).toBe(false)
    expect(plain.find('[data-mark="mine"]').exists()).toBe(false)

    const w = mountSlider({ fitValue: 100 })
    expect(w.get('[data-mark="fit"]').attributes('style')).toContain('left: 50%')
    await w.setProps({ value: 40, changed: true })
    expect(w.get('[data-mark="mine"]').attributes('style')).toContain('left: 20%')
    // The thumb is still the input's; the dot is a separate mark.
    expect(w.findAll('input[type="range"]')).toHaveLength(1)
  })

  it('leaves a mark outside the range off the scale', () => {
    const w = mountSlider({ fitValue: 500, def: { ...def, kernelDefault: -1 } })
    expect(w.find('[data-mark="fit"]').exists()).toBe(false)
    expect(w.find('[data-mark="default"]').exists()).toBe(false)
  })

  it('sits the fit bar beside the default tick when they share a value', () => {
    const w = mountSlider({ fitValue: 60 })
    expect(w.get('[data-mark="fit"]').classes()).toContain('translate-x-px')
    expect(w.get('[data-mark="default"]').classes()).toContain('-translate-x-1/2')
  })

  it('emits update on input and leaves the DOM value alone (uncontrolled)', async () => {
    const w = mountSlider()
    await nextTick()
    const el = w.get('input[type="range"]').element
    expect(el.value).toBe('100')
    el.value = '42'
    el.dispatchEvent(new Event('input'))
    expect(w.emitted('update')).toEqual([[42]])
    await w.setProps({ value: 42 })
    expect(el.value).toBe('42')
    expect(w.get('input[type="range"]').attributes('value')).toBeUndefined()
    // An outside change moves the thumb.
    await w.setProps({ value: 7 })
    expect(el.value).toBe('7')
  })

  it('keeps the same elements whatever the value, so it never changes height', async () => {
    const w = mountSlider({ fitValue: 100 })
    const count = () => w.findAll('*').length
    const before = count()
    await w.setProps({ value: 180 })
    expect(count()).toBe(before)
    await w.setProps({ value: 0 })
    expect(count()).toBe(before)
  })

  it('emphasises the zone that holds the value', async () => {
    const w = mountSlider({ value: 20 })
    expect(w.get('li.font-semibold').text()).toBe('low')
    await w.setProps({ value: 120 })
    expect(w.get('li.font-semibold').text()).toBe('high')
  })
})

describe('MarkKey and MarkGlyph', () => {
  it('names the three marks, with the domain default label', () => {
    expect(mount(MarkKey).text()).toBe(['Kernel default', 'Fits your machine', 'Changed by you'].join(''))
    expect(mount(MarkKey, { props: { defaultLabel: 'systemd default' } }).text()).toContain('systemd default')
  })

  it('draws each mark as a decorative shape', () => {
    for (const kind of ['default', 'fit', 'mine']) {
      const g = mount(MarkGlyph, { props: { kind } })
      expect(g.attributes('aria-hidden')).toBe('true')
    }
    expect(mount(MarkGlyph, { props: { kind: 'mine' } }).classes()).toContain('rounded-full')
  })
})
