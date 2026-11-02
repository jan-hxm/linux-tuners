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
    routes: [{ path: '/', component: Empty }, { path: '/privacy', component: Empty }, ...LIVE_TUNERS.map((t) => ({ path: t.path, component: Empty }))],
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
    expect(wrapper.get('nav a[href="/"]').classes()).toContain('bg-sky-700')
  })

  it('marks only the tuner on a tuner page', async () => {
    const tuner = LIVE_TUNERS[0]
    const wrapper = await headerAt(tuner.path)
    expect(current(wrapper)).toEqual([tuner.navLabel])
    expect(wrapper.get('nav a[href="/"]').classes()).not.toContain('bg-sky-700')
  })

  it('marks nothing on a page outside the nav', async () => {
    expect(current(await headerAt('/privacy'))).toEqual([])
  })
})
