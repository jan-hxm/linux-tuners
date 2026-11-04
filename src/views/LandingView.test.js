// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import LandingView from './LandingView.vue'
import { LIVE_TUNERS, PLANNED_TUNERS } from '@/tuners/registry.js'
import { MACHINE_ROLES, tunersForRole } from '@/core/machineRoles.js'
import { TUNER_DOMAINS } from '@/tuners/domains.js'
import { swapDomain } from '@/tuners/swap/index.js'
import { LANDING_EXAMPLE } from '@/tuners/swap/profile.js'
import { tunerFacts } from '@/ui/landing.js'

const Empty = { template: '<div />' }

// No IntersectionObserver: the table loads its numbers on mount.
beforeEach(() => vi.stubGlobal('IntersectionObserver', undefined))
afterEach(() => vi.unstubAllGlobals())

async function landingAt(path) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: LandingView }, { path: '/setup', component: Empty }, ...LIVE_TUNERS.map((t) => ({ path: t.path, component: Empty }))],
  })
  router.push(path)
  await router.isReady()
  const wrapper = mount({ template: '<RouterView />' }, { global: { plugins: [router], stubs: { AdSlot: true } }, attachTo: document.body })
  await flushPromises()
  return { wrapper, router }
}

const routeEl = (wrapper) => wrapper.get('[data-route]')
const routeTitles = (wrapper) => routeEl(wrapper).findAll('ol > li a').map((a) => a.text())
const titles = (tuners) => tuners.map((t) => t.title)
const radios = (wrapper) => wrapper.findAll('[role="radio"]')
const checked = (wrapper) => radios(wrapper).filter((b) => b.attributes('aria-checked') === 'true').map((b) => b.text())
const setupHrefs = (wrapper) => wrapper.findAll('a').filter((a) => a.text().startsWith('Start guided setup')).map((a) => a.attributes('href'))

describe('LandingView role picker', () => {
  it('shows every live tuner in setup order with no role picked', async () => {
    const { wrapper } = await landingAt('/')
    expect(routeTitles(wrapper)).toEqual(titles(LIVE_TUNERS))
    expect(checked(wrapper)).toEqual(['Any machine'])
    expect(routeEl(wrapper).text()).toContain(`Any machine: all ${LIVE_TUNERS.length} tuners, in setup order.`)
    expect(wrapper.text()).not.toContain(LIVE_TUNERS[0].setup.why)
    expect(wrapper.text()).not.toContain('Usually fine to leave')
  })

  it('shows the route for a picked role, with why lines, and the rest as fine to leave', async () => {
    const { wrapper, router } = await landingAt('/')
    await radios(wrapper).find((b) => b.text() === 'Desktop or workstation').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ role: 'desktop' })

    const { recommended, optional } = tunersForRole(LIVE_TUNERS, 'desktop')
    expect(optional.length).toBeGreaterThan(0)
    expect(routeTitles(wrapper)).toEqual(titles(recommended))
    expect(routeEl(wrapper).find('ol > li').text()).toMatch(/^01/)
    for (const t of recommended) expect(routeEl(wrapper).text()).toContain(t.setup.why)
    const fine = routeEl(wrapper).findAll('p').find((p) => p.text().startsWith('Usually fine to leave'))
    expect(fine.findAll('a').map((a) => a.text())).toEqual(titles(optional))
    expect(wrapper.get('[aria-live="polite"]').text()).toBe(`Desktop or workstation: ${recommended.length} tuners, in this order.`)
  })

  it('reads the role from the link and goes back to every tuner on "Any machine"', async () => {
    const { wrapper, router } = await landingAt('/?role=database')
    expect(checked(wrapper)).toEqual(['Database'])
    await radios(wrapper).find((b) => b.text() === 'Any machine').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({})
    expect(routeTitles(wrapper)).toEqual(titles(LIVE_TUNERS))
  })

  it('treats an unknown or repeated role in the link as no role', async () => {
    for (const path of ['/?role=admin', '/?role=database&role=desktop', '/?role=<b>x</b>']) {
      const { wrapper } = await landingAt(path)
      expect(checked(wrapper), path).toEqual(['Any machine'])
      expect(routeTitles(wrapper), path).toEqual(titles(LIVE_TUNERS))
    }
  })

  it('moves the selection and the focus with the arrow keys, wrapping at the ends', async () => {
    const { wrapper, router } = await landingAt('/')
    const labels = ['Any machine', ...MACHINE_ROLES.map((r) => r.label)]
    const press = async (key) => {
      await radios(wrapper).find((b) => b.attributes('aria-checked') === 'true').trigger('keydown', { key })
      await flushPromises()
    }
    // One tab stop: the checked radio.
    expect(radios(wrapper).map((b) => b.attributes('tabindex'))).toEqual(labels.map((_, i) => (i === 0 ? '0' : '-1')))

    await press('ArrowDown')
    expect(checked(wrapper)).toEqual([labels[1]])
    expect(router.currentRoute.value.query).toEqual({ role: MACHINE_ROLES[0].value })
    expect(document.activeElement?.textContent?.trim()).toBe(labels[1])
    await press('End')
    expect(checked(wrapper)).toEqual([labels.at(-1)])
    await press('ArrowRight')
    expect(checked(wrapper)).toEqual([labels[0]])
    await press('ArrowUp')
    expect(checked(wrapper)).toEqual([labels.at(-1)])
    await press('Home')
    expect(checked(wrapper)).toEqual([labels[0]])
    expect(radios(wrapper).find((b) => b.attributes('aria-checked') === 'true').attributes('tabindex')).toBe('0')
  })

  it('starts the guided setup with the picked role, and with none before a pick', async () => {
    expect(setupHrefs((await landingAt('/')).wrapper)).toEqual(['/setup'])
    expect(setupHrefs((await landingAt('/?role=vm-host')).wrapper)).toEqual(['/setup?role=vm-host'])
  })

  // REDESIGN §4 decision 6: never a primary action below content whose
  // length depends on data. The button comes right after the roles, before
  // the route, for every role.
  it('puts "Start guided setup" after the role list and before the route', async () => {
    for (const role of [null, ...MACHINE_ROLES.map((r) => r.value)]) {
      const { wrapper } = await landingAt(role ? `/?role=${role}` : '/')
      const button = wrapper.get('[data-setup-button]').element
      const group = wrapper.get('[role="radiogroup"]').element
      const list = routeEl(wrapper).get('ol').element
      const before = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
      expect(before(group, button), String(role)).toBe(true)
      expect(before(button, list), String(role)).toBe(true)
      expect(group.contains(button) || list.contains(button), String(role)).toBe(false)
    }
  })
})

describe('LandingView specimen', () => {
  const def = swapDomain.defsByKey[LANDING_EXAMPLE.key]
  const fit = swapDomain.deriveDefaults(LANDING_EXAMPLE.hardware)[LANDING_EXAMPLE.key]

  it('uses an example whose fit sits apart from the kernel default', () => {
    expect(fit).not.toBe(def.kernelDefault)
  })

  it('shows the real setting with the value that fits the example machine', async () => {
    const { wrapper } = await landingAt('/')
    await vi.waitFor(() => expect(wrapper.find('figure').exists()).toBe(true))
    const figure = wrapper.get('figure')
    expect(figure.text()).toContain(def.title)
    expect(figure.text()).toContain(`${def.sysctlName} = ${fit}`)
    expect(figure.text()).toContain(`Kernel default ${def.kernelDefault}`)
    expect(figure.text()).toContain(`Fits your machine ${fit}`)
    const slider = figure.get('input[type="range"]')
    expect(slider.attributes('aria-valuetext')).toBe(String(fit))
    expect(slider.attributes('min')).toBe(String(swapDomain.rangeFor(LANDING_EXAMPLE.key, LANDING_EXAMPLE.hardware).min))
    // The comparison in "Why" quotes the same value.
    expect(wrapper.get('#how').text()).toContain(`${def.sysctlName} = ${fit}`)
  })

  it('keeps a moved value to itself: no store, no URL change', async () => {
    const { wrapper, router } = await landingAt('/?role=database')
    await vi.waitFor(() => expect(wrapper.find('figure input[type="range"]').exists()).toBe(true))
    const before = router.currentRoute.value.fullPath
    const changedMark = () => wrapper.get('figure').findAll('li').find((li) => li.text() === 'Changed by you')
    expect(changedMark().classes()).toContain('invisible')

    const slider = wrapper.get('figure input[type="range"]')
    slider.element.value = '20'
    await slider.trigger('input')
    await flushPromises()
    expect(wrapper.get('figure').text()).toContain(`${def.sysctlName} = 20`)
    expect(wrapper.get('figure').text()).toContain(`You moved this from ${fit} to 20.`)
    expect(changedMark().classes()).not.toContain('invisible')
    expect(router.currentRoute.value.fullPath).toBe(before)

    await wrapper.get('figure').findAll('button').find((b) => b.text() === `Back to ${fit}`).trigger('click')
    expect(wrapper.get('figure').text()).toContain(`${def.sysctlName} = ${fit}`)
    expect(router.currentRoute.value.fullPath).toBe(before)
  })
})

describe('LandingView tuner table', () => {
  it('lists every live tuner with its question, link, setting count and files', async () => {
    const { wrapper } = await landingAt('/')
    const region = wrapper.get('#tuners [role="region"]')
    expect(region.attributes('tabindex')).toBe('0')
    expect(region.attributes('aria-label')).toBeTruthy()
    await vi.waitFor(() => expect(region.get('table').attributes('aria-busy')).toBe('false'))

    const rows = region.findAll('tbody tr')
    expect(rows).toHaveLength(LIVE_TUNERS.length)
    LIVE_TUNERS.forEach((t, i) => {
      const domain = TUNER_DOMAINS.find((d) => d.id === t.id)
      const cells = rows[i].findAll('td')
      expect(cells[0].get('a').text()).toBe(t.question)
      expect(cells[0].get('a').attributes('href')).toBe(t.path)
      expect(cells[1].text()).toBe(t.title)
      expect(cells[2].text()).toBe(String(domain.parameterKeys.length))
      expect(cells[3].findAll('span').map((s) => s.text())).toEqual(tunerFacts(domain).writes)
    })
  })

  it('names the planned tuners under the table', async () => {
    const { wrapper } = await landingAt('/')
    for (const t of PLANNED_TUNERS) expect(wrapper.get('#tuners').text()).toContain(t.title)
  })
})

describe('LandingView page content', () => {
  it('puts the ad after the tuner table', async () => {
    const { wrapper } = await landingAt('/')
    const html = wrapper.html()
    expect(html.indexOf('ad-slot-stub')).toBeGreaterThan(html.indexOf('</table>'))
  })

  it('says it is free and sends nothing, and has no Available badge', async () => {
    const { wrapper } = await landingAt('/')
    expect(wrapper.text()).toContain('Free. Runs in your browser. Nothing is sent anywhere.')
    expect(wrapper.text()).not.toContain('Available')
    expect(wrapper.text()).not.toContain('—')
  })

  it('has one h1 and links its hero buttons to the role picker and the table', async () => {
    const { wrapper } = await landingAt('/?role=web')
    expect(wrapper.findAll('h1')).toHaveLength(1)
    const href = (label) => wrapper.findAll('a').find((a) => a.text() === label).attributes('href')
    expect(href('Pick your machine type')).toBe('/?role=web#start')
    expect(href('Browse tuners')).toBe('/?role=web#tuners')
    expect(wrapper.find('#start').exists() && wrapper.find('#tuners').exists()).toBe(true)
  })
})
