// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import LandingView from './LandingView.vue'
import { LIVE_TUNERS } from '@/tuners/registry.js'
import { tunersForRole } from '@/core/machineRoles.js'

const Empty = { template: '<div />' }

async function landingAt(path) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: LandingView }, { path: '/setup', component: Empty }, ...LIVE_TUNERS.map((t) => ({ path: t.path, component: Empty }))],
  })
  router.push(path)
  await router.isReady()
  const wrapper = mount({ template: '<RouterView />' }, { global: { plugins: [router], stubs: { AdSlot: true } } })
  await flushPromises()
  return { wrapper, router }
}

const cardTitles = (section) => section.findAll('h3').map((h) => h.text())
const titles = (tuners) => tuners.map((t) => t.title)
const sections = (wrapper) => wrapper.findAll('section > section').filter((s) => s.find('a h3').exists())
const checked = (wrapper) => wrapper.findAll('[role="radio"][aria-checked="true"]').map((b) => b.text())

describe('LandingView role picker', () => {
  it('shows every live tuner in setup order with no role picked', async () => {
    const { wrapper } = await landingAt('/')
    const [only, ...rest] = sections(wrapper)
    expect(rest).toEqual([])
    expect(cardTitles(only)).toEqual(titles(LIVE_TUNERS))
    expect(checked(wrapper)).toEqual(['Any machine'])
    expect(wrapper.text()).not.toContain(LIVE_TUNERS[0].setup.why)
  })

  it('splits the cards for a picked role, with why lines and step numbers on the recommended ones', async () => {
    const { wrapper, router } = await landingAt('/')
    await wrapper.findAll('[role="radio"]').find((b) => b.text() === 'Desktop or workstation').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ role: 'desktop' })

    const { recommended, optional } = tunersForRole(LIVE_TUNERS, 'desktop')
    const [main, rest] = sections(wrapper)
    expect(cardTitles(main)).toEqual(titles(recommended))
    expect(cardTitles(rest)).toEqual(titles(optional))
    expect(main.find('ol').exists()).toBe(true)
    expect(main.text()).toContain('Step 1')
    for (const t of recommended) expect(main.text()).toContain(t.setup.why)
    expect(rest.text()).toContain('Optional for this machine')
    expect(wrapper.get('[aria-live="polite"]').text()).toContain(`${recommended.length} tuners in setup order`)
  })

  it('reads the role from the link and goes back to every card on "Any machine"', async () => {
    const { wrapper, router } = await landingAt('/?role=database')
    expect(checked(wrapper)).toEqual(['Database'])
    await wrapper.findAll('[role="radio"]').find((b) => b.text() === 'Any machine').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({})
    expect(sections(wrapper)).toHaveLength(1)
  })

  it('treats an unknown or repeated role in the link as no role', async () => {
    for (const path of ['/?role=admin', '/?role=database&role=desktop', '/?role=<b>x</b>']) {
      const { wrapper } = await landingAt(path)
      expect(checked(wrapper), path).toEqual(['Any machine'])
      expect(sections(wrapper), path).toHaveLength(1)
    }
  })

  it('starts the guided setup with the picked role, and with none before a pick', async () => {
    const setupHrefs = (wrapper) => wrapper.findAll('a').filter((a) => a.text().startsWith('Start guided setup')).map((a) => a.attributes('href'))
    expect(setupHrefs((await landingAt('/')).wrapper)).toEqual(['/setup'])
    expect(setupHrefs((await landingAt('/?role=vm-host')).wrapper)).toEqual(['/setup?role=vm-host', '/setup?role=vm-host'])
  })
})
