// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import SiteHeader from './SiteHeader.vue'
import { LIVE_TUNERS } from '@/tuners/registry.js'

const Empty = { template: '<div />' }

async function headerAt(path) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: Empty }, { path: '/privacy', component: Empty }, { path: '/setup', component: Empty }, ...LIVE_TUNERS.map((t) => ({ path: t.path, component: Empty }))],
  })
  router.push(path)
  await router.isReady()
  const wrapper = mount(SiteHeader, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

const current = (wrapper) => wrapper.findAll('nav [aria-current="page"]').map((a) => a.text())

describe('SiteHeader', () => {
  it('marks "All tuners" as the current page on the landing page', async () => {
    const wrapper = await headerAt('/')
    expect(current(wrapper)).toEqual(['All tuners'])
    expect(wrapper.get('nav a[href="/"]').classes()).toContain('!border-ink')
  })

  it('marks only the tuner on a tuner page', async () => {
    const tuner = LIVE_TUNERS[0]
    const wrapper = await headerAt(tuner.path)
    expect(current(wrapper)).toEqual([tuner.navLabel])
    expect(wrapper.get('nav a[href="/"]').classes()).not.toContain('!border-ink')
  })

  it('marks nothing on a page outside the nav', async () => {
    expect(current(await headerAt('/privacy'))).toEqual([])
  })

  it('puts every live tuner in the nav, one click away', async () => {
    const wrapper = await headerAt('/')
    const links = wrapper.findAll('nav a').map((a) => [a.text(), a.attributes('href')])
    expect(links).toEqual([['All tuners', '/'], ...LIVE_TUNERS.map((t) => [t.navLabel, t.path])])
  })

  it('offers one primary Start setup link to the guided setup', async () => {
    const wrapper = await headerAt('/')
    const start = wrapper.findAll('a').filter((a) => a.text() === 'Start setup')
    expect(start).toHaveLength(1)
    expect(start[0].attributes('href')).toBe('/setup')
  })

  it('fades an edge only while there are more links past it', async () => {
    const wrapper = await headerAt('/')
    const nav = wrapper.get('nav').element
    Object.defineProperty(nav, 'scrollWidth', { value: 900 })
    Object.defineProperty(nav, 'clientWidth', { value: 300 })
    const fades = () => wrapper.findAll('[data-fade]').map((f) => f.attributes('data-fade'))

    nav.scrollLeft = 0
    await wrapper.get('nav').trigger('scroll')
    expect(fades()).toEqual(['after'])
    nav.scrollLeft = 300
    await wrapper.get('nav').trigger('scroll')
    expect(fades()).toEqual(['before', 'after'])
    nav.scrollLeft = 600
    await wrapper.get('nav').trigger('scroll')
    expect(fades()).toEqual(['before'])
  })
})
