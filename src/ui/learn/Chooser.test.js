// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import Chooser from './Chooser.vue'
import DecisionFlow from './DecisionFlow.vue'
import { DEMO_DEFS, DEMO_LEARN } from '@/learn/__fixtures__/demoKit.js'

const choose = DEMO_LEARN.chapters[0].choose
/** The fixture's `to` answer: the promise mode set to a named value. */
const chooseTo = DEMO_LEARN.chapters.find((ch) => ch.choose.some((q) => q.yes.to !== undefined)).choose
/** A last question without a `no`: the contract suite refuses it, but the chooser must still end. */
const lastWithoutNo = [{ q: 'Is it slow?', check: 'free -m', hint: 'Look at the available column.', yes: { key: 'mode', dir: 'raise' } }]
const button = (w, text) => w.findAll('button').find((b) => b.text() === text)
const mountChooser = (props = {}) =>
  mount(Chooser, { attachTo: document.body, props: { choose, defsByKey: DEMO_DEFS, tuneHref: (key) => `/demo?key=${key}`, ...props } })

describe('Chooser', () => {
  it('asks one question at a time with how to check it', () => {
    const w = mountChooser()
    expect(w.get('[data-question]').text()).toBe(choose[0].q)
    expect(w.text()).toContain('Question 1 of 2')
    expect(w.text()).toContain(`How to check: ${choose[0].check} ${choose[0].hint}`)
    expect(w.findAll('button').map((b) => [b.text(), b.attributes('type')])).toEqual([['Yes', 'button'], ['No', 'button']])
    w.unmount()
  })

  it('goes on to the next question on a missing no and reads it out', async () => {
    const w = mountChooser()
    const no = button(w, 'No')
    no.element.focus()
    await no.trigger('click')
    await flushPromises()
    expect(w.get('[data-question]').text()).toBe(choose[1].q)
    expect(w.get('[aria-live="polite"]').text()).toBe(`Question 2 of 2: ${choose[1].q}`)
    // The buttons stay in place, so focus stays on the one pressed.
    expect(document.activeElement).toBe(no.element)
    w.unmount()
  })

  it('shows the result with the setting, a tuner link and Start over', async () => {
    const w = mountChooser()
    await button(w, 'Yes').trigger('click')
    await flushPromises()
    const result = w.get('[data-result]')
    expect(result.classes()).toEqual(expect.arrayContaining(['bg-fit-tint', 'border-fit']))
    expect(result.text()).toContain('Raise demo.reserve_kbytes.')
    expect(result.text()).toContain('Free memory reserve')
    expect(result.get('a').attributes('href')).toBe('/demo?key=reserve_kbytes')
    expect(result.get('a').text()).toBe('Open it in the tuner')
    expect(w.get('[aria-live="polite"]').text()).toBe('Result: Raise demo.reserve_kbytes.')
    expect(document.activeElement?.textContent).toBe('Start over')
    await button(w, 'Start over').trigger('click')
    await flushPromises()
    expect(w.get('[data-question]').text()).toBe(choose[0].q)
    expect(document.activeElement?.textContent).toBe('Yes')
    w.unmount()
  })

  it('names the value of a to answer, in code, and links the setting in the tuner', async () => {
    const w = mountChooser({ choose: chooseTo })
    await button(w, 'Yes').trigger('click')
    await flushPromises()
    const result = w.get('[data-result]')
    expect(result.text()).toContain('Set demo.mode to 0 (relaxed, promise more than there is).')
    expect(result.get('code').text()).toBe('0')
    expect(result.text()).toContain('Promise mode')
    expect(result.get('a').attributes('href')).toBe('/demo?key=mode')
    // The live line reads the words, without the code span's backticks.
    expect(w.get('[aria-live="polite"]').text()).toBe('Result: Set demo.mode to 0 (relaxed, promise more than there is).')
    w.unmount()
  })

  it('leaves the settings alone past the last question, with no tuner link', async () => {
    const w = mountChooser({ choose: lastWithoutNo })
    await button(w, 'No').trigger('click')
    await flushPromises()
    expect(w.get('[data-result]').text()).toContain('Leave it as it is: none of these questions matched your machine.')
    expect(w.get('[data-result]').find('a').exists()).toBe(false)
    w.unmount()
  })
})

describe('DecisionFlow', () => {
  it('lists every question with where yes and no lead', () => {
    const w = mount(DecisionFlow, { props: { choose, defsByKey: DEMO_DEFS } })
    const items = w.findAll('li')
    expect(items).toHaveLength(2)
    expect(items[0].text()).toContain('Yes: Raise demo.reserve_kbytes.')
    expect(items[0].text()).toContain('No: Go to question 2.')
    expect(items[1].text()).toContain('Yes: Lower demo.reserve_kbytes.')
    expect(items[1].text()).toContain('No: Leave it as it is: The reserve is doing its job, so the default fits.')
  })

  it('names the value of a to answer, in code', () => {
    const w = mount(DecisionFlow, { props: { choose: chooseTo, defsByKey: DEMO_DEFS } })
    const item = w.get('li')
    expect(item.text()).toContain('Yes: Set demo.mode to 0 (relaxed, promise more than there is).')
    expect(item.text()).not.toContain('`')
    expect(item.findAll('code').map((c) => c.text())).toContain('0')
  })
})
