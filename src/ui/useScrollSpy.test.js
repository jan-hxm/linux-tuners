// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest'
import { defineComponent, h } from 'vue'
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
})
