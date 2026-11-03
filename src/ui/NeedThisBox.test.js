// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import NeedThisBox from './NeedThisBox.vue'
import { LIVE_TUNERS } from '@/tuners/registry.js'

describe('NeedThisBox', () => {
  it('shows the registry text and the role labels for a tuner with a role list', () => {
    const wrapper = mount(NeedThisBox, { props: { tunerId: 'sysv-ipc' } })
    const t = LIVE_TUNERS.find((x) => x.id === 'sysv-ipc')
    expect(wrapper.text()).toContain(t.setup.why)
    expect(wrapper.text()).toContain(t.setup.defaultsFine)
    expect(wrapper.text()).toContain('Database.')
  })

  it('says every machine for a tuner recommended for all roles', () => {
    const wrapper = mount(NeedThisBox, { props: { tunerId: 'swap' } })
    expect(wrapper.text()).toContain('Every kind of machine.')
  })

  it('collapses with a real button that reports aria-expanded', async () => {
    const wrapper = mount(NeedThisBox, { props: { tunerId: 'network' } })
    const button = wrapper.find('button')
    expect(button.attributes('aria-expanded')).toBe('true')
    const body = wrapper.find(`#${button.attributes('aria-controls')}`)
    expect(body.element.style.display).not.toBe('none')
    await button.trigger('click')
    expect(button.attributes('aria-expanded')).toBe('false')
    expect(body.element.style.display).toBe('none')
  })

  it('renders every live tuner without em dashes', () => {
    for (const t of LIVE_TUNERS) {
      const wrapper = mount(NeedThisBox, { props: { tunerId: t.id } })
      expect(wrapper.find('button').exists(), t.id).toBe(true)
      expect(wrapper.text(), t.id).not.toContain(String.fromCharCode(0x2014))
    }
  })
})
