import { describe, it, expect } from 'vitest'
import { h } from 'vue'
import { mount } from '@vue/test-utils'
import RichText from './RichText.vue'
import { GLOSSARY } from './glossary.js'

/** In a paragraph, as the cards and About render it, so text() reads the whole line. */
const mountText = (text) => mount({ render: () => h('p', h(RichText, { text })) }, { attachTo: document.body })

describe('glossary terms in RichText (Design.md §7)', () => {
  it('renders a term as a collapsed button that controls its definition', () => {
    const wrapper = mountText('Under pressure the kernel must [[reclaim]] memory.')
    const button = wrapper.get('button')
    expect(button.text()).toBe('reclaim')
    expect(button.attributes('type')).toBe('button')
    expect(button.attributes('aria-expanded')).toBe('false')
    expect(button.attributes('title')).toBeUndefined()
    const panel = wrapper.get(`#${button.attributes('aria-controls')}`)
    expect(panel.isVisible()).toBe(false)
    // The label stays in the sentence; the hidden definition follows it.
    expect(wrapper.text()).toMatch(/^Under pressure the kernel must reclaimReclaim: .* memory\.$/)
    wrapper.unmount()
  })

  it('opens the definition inline on click and closes it on a second click', async () => {
    const wrapper = mountText('See [[dirty pages|dirty-page]].')
    const button = wrapper.get('button')
    await button.trigger('click')
    expect(button.attributes('aria-expanded')).toBe('true')
    const panel = wrapper.get(`#${button.attributes('aria-controls')}`)
    expect(panel.isVisible()).toBe(true)
    expect(panel.text()).toBe(`${GLOSSARY['dirty-page'].term}: ${GLOSSARY['dirty-page'].definition}`)
    await button.trigger('click')
    expect(button.attributes('aria-expanded')).toBe('false')
    expect(panel.isVisible()).toBe(false)
    wrapper.unmount()
  })

  it('closes on Escape without letting the key reach an enclosing dialog', async () => {
    const wrapper = mountText('[[cgroup]]')
    let reached = 0
    const onKey = () => { reached++ }
    document.body.addEventListener('keydown', onKey)
    const button = wrapper.get('button')
    await button.trigger('click')
    await button.trigger('keydown', { key: 'Escape' })
    expect(button.attributes('aria-expanded')).toBe('false')
    expect(reached).toBe(0)
    // Closed, Escape passes through as usual.
    await button.trigger('keydown', { key: 'Escape' })
    expect(reached).toBe(1)
    document.body.removeEventListener('keydown', onKey)
    wrapper.unmount()
  })

  it('gives each term its own definition id', () => {
    const wrapper = mountText('[[page cache]] and [[page cache]]')
    const ids = wrapper.findAll('button').map((b) => b.attributes('aria-controls'))
    expect(new Set(ids).size).toBe(2)
    wrapper.unmount()
  })

  it('shows an unknown id as plain text', () => {
    const wrapper = mountText('a [[no such term]] here')
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.text()).toBe('a no such term here')
    wrapper.unmount()
  })
})
