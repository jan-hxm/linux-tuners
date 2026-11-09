// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import FigureTip from './FigureTip.vue'
import TipStrip from './TipStrip.vue'
import { HOVER_DELAY_MS, closeTip, openTip } from './tipState.js'

/** Two parts of one figure and its strip, as a figure lays them out. */
const Figure = {
  setup: () => () =>
    h('div', [
      h(FigureTip, { label: 'File cache', tip: 'Copies of files kept in RAM, so the next read **skips** the disk.', value: '97,076 kB, kernel 6.12', scope: 'fig', class: 'card', 'data-part': 'cache' }, () => 'File cache'),
      h(FigureTip, { label: 'Swap', tip: 'Space where program memory waits.', scope: 'fig', 'data-part': 'swap' }, () => 'Swap'),
      h('button', { type: 'button', 'data-outside': '' }, 'elsewhere'),
      h(TipStrip, { scope: 'fig' }),
    ]),
}

let wrapper
const bubble = () => document.body.querySelector('[data-tip]')
const part = (name) => wrapper.get(`[data-part="${name}"]`)

beforeEach(() => {
  wrapper = mount(Figure, { attachTo: document.body })
})

afterEach(() => {
  wrapper.unmount()
  closeTip()
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('FigureTip', () => {
  it('is a real button whose description is the sentence and the value', () => {
    const button = part('cache')
    expect(button.element.tagName).toBe('BUTTON')
    expect(button.attributes('type')).toBe('button')
    expect(button.classes()).toContain('card')
    const desc = document.getElementById(button.attributes('aria-describedby'))
    expect(desc.hidden).toBe(true)
    expect(desc.textContent).toBe('Copies of files kept in RAM, so the next read skips the disk. 97,076 kB, kernel 6.12')
    expect(bubble()).toBeNull()
  })

  it('opens after the mouse rests 150 ms and closes when it leaves', async () => {
    vi.useFakeTimers()
    const button = part('cache')
    await button.trigger('pointerenter', { pointerType: 'mouse' })
    vi.advanceTimersByTime(HOVER_DELAY_MS - 10)
    await nextTick()
    expect(bubble()).toBeNull()
    vi.advanceTimersByTime(10)
    await nextTick()
    expect(bubble().textContent).toContain('File cache. Copies of files kept in RAM')
    expect(bubble().querySelector('strong').textContent).toBe('skips')
    expect(bubble().getAttribute('aria-hidden')).toBe('true')
    expect(bubble().querySelector('a, button')).toBeNull()
    await button.trigger('pointerleave', { pointerType: 'mouse' })
    expect(bubble()).toBeNull()
  })

  it('does not open when the mouse passes by in under 150 ms', async () => {
    vi.useFakeTimers()
    await part('cache').trigger('pointerenter', { pointerType: 'mouse' })
    await part('cache').trigger('pointerleave', { pointerType: 'mouse' })
    vi.advanceTimersByTime(HOVER_DELAY_MS * 2)
    await nextTick()
    expect(bubble()).toBeNull()
  })

  it('opens on keyboard focus and closes on Escape and on blur', async () => {
    const button = part('cache')
    await button.trigger('focus')
    expect(bubble()).not.toBeNull()
    expect(button.attributes('data-tip-open')).toBeDefined()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(bubble()).toBeNull()
    await button.trigger('focus')
    expect(bubble()).not.toBeNull()
    await button.trigger('blur')
    expect(bubble()).toBeNull()
  })

  it('opens on a tap, closes on a second tap or a tap outside', async () => {
    const button = part('swap')
    await button.trigger('click')
    expect(bubble().textContent).toContain('Swap. Space where program memory waits.')
    await button.trigger('click')
    expect(bubble()).toBeNull()
    await button.trigger('click')
    wrapper.get('[data-outside]').element.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await nextTick()
    expect(bubble()).toBeNull()
  })

  it('keeps one tooltip open at a time', async () => {
    await part('cache').trigger('click')
    await part('swap').trigger('click')
    expect(document.body.querySelectorAll('[data-tip]')).toHaveLength(1)
    expect(bubble().textContent).toContain('Swap.')
    expect(part('cache').attributes('data-tip-open')).toBeUndefined()
  })

  it('shows the open tooltip as a strip under its figure below md', async () => {
    expect(wrapper.find('[data-tip-strip]').exists()).toBe(false)
    await part('cache').trigger('click')
    const strip = wrapper.get('[data-tip-strip]')
    expect(strip.classes()).toContain('md:hidden')
    expect(strip.attributes('aria-hidden')).toBe('true')
    expect(strip.text()).toContain('File cache. Copies of files kept in RAM')
    expect(strip.text()).toContain('97,076 kB, kernel 6.12')
    // The floating box is for md and up only.
    expect(bubble().classList.contains('hidden')).toBe(true)
    expect(bubble().classList.contains('md:block')).toBe(true)
    // Another figure's tooltip does not show in this strip.
    openTip.value = { id: 'x', scope: 'other', label: 'Other', tip: 'x.', value: '' }
    await nextTick()
    expect(wrapper.find('[data-tip-strip]').exists()).toBe(false)
  })

  it('keeps the floating box inside the viewport', async () => {
    const button = part('cache')
    button.element.getBoundingClientRect = () => ({ left: 990, right: 1020, top: 100, bottom: 130, width: 30, height: 30 })
    await button.trigger('click')
    const style = bubble().getAttribute('style')
    const left = Number(style.match(/left: (\d+)px/)[1])
    const width = Number(style.match(/width: (\d+)px/)[1])
    expect(left + width).toBeLessThanOrEqual(window.innerWidth - 8)
    expect(style).toContain('top: 138px')
  })

  it('closes when its part goes away', async () => {
    await part('cache').trigger('click')
    wrapper.unmount()
    expect(openTip.value).toBeNull()
    wrapper = mount(Figure, { attachTo: document.body })
  })
})
