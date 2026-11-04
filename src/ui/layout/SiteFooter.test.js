// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import SiteFooter from './SiteFooter.vue'
import { testedOnText } from './testedOn.js'

const Empty = { template: '<div />' }

async function footer(extraRoutes = []) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: Empty }, { path: '/privacy', component: Empty }, { path: '/imprint', component: Empty }, ...extraRoutes],
  })
  router.push('/')
  await router.isReady()
  const wrapper = mount(SiteFooter, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

describe('SiteFooter', () => {
  it('carries the approved author note, signed with a link to the GitHub profile', async () => {
    const wrapper = await footer()
    expect(wrapper.text()).toContain(
      'I built this after one too many forum threads that said "set it to X" and never said why, or what happens when you set it to Y. I also wanted to see what a change does, so tuners like swap draw it as a live graph. Every value here comes with its reason, so you can disagree with it.',
    )
    const sign = wrapper.get('a[href="https://github.com/jan-hxm"]')
    expect(sign.text()).toBe('jan-hxm')
    expect(sign.attributes('rel')).toContain('noopener')
  })

  it('states the testing matrix in the colophon', async () => {
    const wrapper = await footer()
    expect(wrapper.text()).toContain(`applied and read back on ${testedOnText()}`)
  })

  it('links Privacy, Imprint and the source, and Glossary only once that page exists', async () => {
    const names = (w) => w.findAll('nav[aria-label="Footer"] a').map((a) => a.text())
    expect(names(await footer())).toEqual(['Privacy', 'Imprint', 'Source on GitHub ↗', 'Sponsor ↗'])
    expect(names(await footer([{ path: '/glossary', name: 'glossary', component: Empty }]))).toEqual(['Glossary', 'Privacy', 'Imprint', 'Source on GitHub ↗', 'Sponsor ↗'])
  })

  it('links Sponsor to GitHub Sponsors in a new tab', async () => {
    const a = (await footer()).get('a[href="https://github.com/sponsors/jan-hxm"]')
    expect(a.text()).toBe('Sponsor ↗')
    expect(a.attributes('target')).toBe('_blank')
    expect(a.attributes('rel')).toContain('noopener')
  })

  it('has no consent banner or em dash', async () => {
    const wrapper = await footer()
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('—')
  })
})
