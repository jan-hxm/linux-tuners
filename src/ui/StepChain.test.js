// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StepChain from './StepChain.vue'

const steps = (extra = {}) =>
  ['a', 'b', 'c'].map((id, i) => ({ id, label: `Step ${id}`, mark: `0${i + 1}`, ...extra[id] }))

describe('StepChain', () => {
  it('renders links when the steps have them, the current one thick and marked', () => {
    const wrapper = mount(StepChain, {
      props: { steps: steps({ a: { href: '#a' }, b: { href: '#b' }, c: { href: '#c' } }), current: 1, currentAttr: 'location' },
    })
    const items = wrapper.findAll('a')
    expect(items.map((a) => a.attributes('href'))).toEqual(['#a', '#b', '#c'])
    expect(items.map((a) => a.attributes('aria-current'))).toEqual([undefined, 'location', undefined])
    expect(items[1].classes()).toEqual(expect.arrayContaining(['border-t-4', 'border-fit']))
    // Behind the reader darker than ahead.
    expect(items[0].classes()).toContain('border-rule-strong')
    expect(items[2].classes()).toContain('border-rule')
  })

  it('marks no step past the last one', () => {
    const wrapper = mount(StepChain, { props: { steps: steps({ a: { href: '#a' }, b: { href: '#b' }, c: { href: '#c' } }), current: 3 } })
    expect(wrapper.findAll('[aria-current]')).toHaveLength(0)
  })

  it('renders buttons without links and says each status in text', async () => {
    const wrapper = mount(StepChain, {
      props: {
        steps: steps({
          b: { status: { label: 'Blocked', mark: '×', cls: 'text-error', seg: 'border-error', error: true } },
          c: { status: { label: 'Skipped', mark: '–', cls: 'text-quiet', seg: 'border-dashed border-rule-strong' } },
        }),
        current: 1,
      },
    })
    const buttons = wrapper.findAll('button')
    expect(buttons.map((b) => b.attributes('type'))).toEqual(['button', 'button', 'button'])
    expect(buttons[1].attributes('aria-current')).toBe('step')
    expect(buttons[1].classes()).toContain('border-error')
    expect(buttons[1].text()).toContain('Blocked')
    expect(buttons[2].classes()).toEqual(expect.arrayContaining(['border-dashed', 'border-rule-strong']))
    await buttons[2].trigger('click')
    expect(wrapper.emitted('select')).toEqual([[2]])
  })
})
