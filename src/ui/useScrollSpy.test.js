// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest'
import { defineComponent, h, ref, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useScrollSpy } from './useScrollSpy.js'

const IDS = ['one', 'two', 'three']

/** Places the sections at the given viewport tops, each 100px tall. */
function layout(tops) {
  IDS.forEach((id, i) => {
    document.getElementById(id).getBoundingClientRect = () => ({ top: tops[i], bottom: tops[i] + 100 })
  })
  window.dispatchEvent(new Event('scroll'))
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

function mountSpy() {
  let active
  const wrapper = mount(
    defineComponent({
      setup() {
        active = useScrollSpy(IDS, { line: 0.5 })
        return () => h('div', IDS.map((id) => h('section', { id })))
      },
    }),
    { attachTo: document.body },
  )
  return { wrapper, active: () => active.value }
}

describe('useScrollSpy', () => {
  let wrapper
  afterEach(() => wrapper?.unmount())

  it('follows the last section whose top has passed the line', async () => {
    window.innerHeight = 1000
    const spy = mountSpy()
    wrapper = spy.wrapper

    await layout([600, 800, 1000])
    expect(spy.active()).toBe('one') // above every section: the first counts

    await layout([100, 450, 700])
    expect(spy.active()).toBe('two')

    await layout([-500, -300, 450])
    expect(spy.active()).toBe('three')

    await layout([-900, -700, -200])
    expect(spy.active()).toBe(null) // past the end of the last one
  })

  it('follows a list of ids that changes, measuring again after the DOM updates', async () => {
    window.innerHeight = 1000
    const ids = ref(['one', 'two'])
    let active
    wrapper = mount(
      defineComponent({
        setup() {
          active = useScrollSpy(() => ids.value, { line: 0.5 })
          return () => h('div', ids.value.map((id) => h('section', { id })))
        },
      }),
      { attachTo: document.body },
    )
    const tops = { one: -300, two: 100, three: 300 }
    const measure = () => {
      for (const id of ids.value) {
        const el = document.getElementById(id)
        el.getBoundingClientRect = () => ({ top: tops[id], bottom: tops[id] + 1000 })
      }
    }
    measure()
    window.dispatchEvent(new Event('scroll'))
    await new Promise((resolve) => requestAnimationFrame(resolve))
    expect(active.value).toBe('two')

    ids.value = ['one', 'two', 'three']
    await nextTick()
    measure()
    await new Promise((resolve) => requestAnimationFrame(resolve))
    expect(active.value).toBe('three')
  })
})
