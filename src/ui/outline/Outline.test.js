// @vitest-environment happy-dom
// The settings outline (Design.md §7 "Settings outline"), mounted in the real
// TunerPage for a tuner with graphs (swap) and one without (security).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import TunerPage from '@/ui/TunerPage.vue'
import { useTunerStoreFor } from '@/core/createTunerStore.js'
import { swapDomain } from '@/tuners/swap/index.js'
import { securityDomain } from '@/tuners/security/index.js'
import { TUNER_DOMAINS } from '@/tuners/domains.js'
import { setShowAllParams } from '@/ui/viewerPrefs.js'
import { railStartsExpanded, settingsColumnRem } from './useOutline.js'

const CHARTS = TUNER_DOMAINS.flatMap((d) => d.graphTabs.map((t) => t.component.__name))
const stubs = Object.fromEntries(CHARTS.map((name) => [name, { template: '<div />' }]))

let wrapper

async function mountPage(domain) {
  wrapper = mount(TunerPage, { props: { domain }, attachTo: document.body, global: { stubs } })
  await flushPromises()
  return { wrapper, store: useTunerStoreFor(domain) }
}

const rail = () => wrapper.find('nav[aria-label="Settings outline"]')
const toggle = () => rail().find('button[aria-expanded]')

async function expandRail() {
  if (toggle().attributes('aria-expanded') === 'false') await toggle().trigger('click')
}

/** The groups and settings the panel shows, from the defs. */
function shownInPanel(domain) {
  return [...document.querySelectorAll('#tune section[aria-labelledby^="section-title-"]')].map((section) => ({
    title: section.querySelector('h3').textContent.trim(),
    settings: [...section.querySelectorAll('[id^="setting-"]')].map((el) => domain.defsByKey[el.id.slice('setting-'.length)].title),
  }))
}

/** The groups and settings the rail lists. */
function shownInRail() {
  const tune = rail().findAll('ol > li').find((li) => li.find('a').text().includes('Tune'))
  return tune.findAll(':scope > ul > li').map((li) => ({
    title: li.find('a').text(),
    settings: li.findAll('ul a').map((a) => a.text()),
  }))
}

beforeEach(() => {
  setActivePinia(createPinia())
  setShowAllParams(false)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe.each([
  ['swap', swapDomain],
  ['security', securityDomain],
])('settings outline on %s', (id, domain) => {
  it('lists the steps, the groups and every card shown, from the defs', async () => {
    await mountPage(domain)
    await expandRail()
    expect(rail().findAll('ol > li > a').map((a) => a.text().replace(/^\d+/, ''))).toEqual(['Preset', 'Tune', 'Export'])
    const panel = shownInPanel(domain)
    expect(panel.length).toBeGreaterThan(0)
    expect(shownInRail()).toEqual(panel)
  })

  it('collapses to a ruler of ticks and back with one aria-expanded button', async () => {
    await mountPage(domain)
    await expandRail()
    expect(toggle().attributes('aria-expanded')).toBe('true')
    await toggle().trigger('click')
    expect(toggle().attributes('aria-expanded')).toBe('false')
    const ticks = rail().findAll('a').filter((a) => a.find('[data-tick]').exists())
    expect(ticks.length).toBe(document.querySelectorAll('#tune [id^="setting-"]').length)
    expect(ticks[0].attributes('aria-label')).toBe(domain.defsByKey[domain.sections[0].keys[0]].title)
    await toggle().trigger('click')
    expect(toggle().attributes('aria-expanded')).toBe('true')
  })

  it('moves focus to the card picked', async () => {
    await mountPage(domain)
    await expandRail()
    const key = domain.sections[1].keys.find((k) => domain.defsByKey[k].tier === 'essential')
    const link = rail().find(`a[href="#setting-${key}"]`)
    await link.trigger('click')
    expect(document.activeElement?.id).toBe(`setting-${key}`)
  })
})

describe('settings outline', () => {
  it('marks the card in view with aria-current, following the scroll spy', async () => {
    window.innerHeight = 1000 // the spy's line is at 300px
    const tops = {
      hardware: -3000, preset: -2000, tune: -1500, export: 4000,
      'group-memory-reclaim': -1200, 'setting-swappiness': -900, 'setting-vfs_cache_pressure': 100,
    }
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
      const top = tops[this.id] ?? 3000
      return { top, bottom: this.id === 'tune' ? 3000 : top + 400, left: 0, right: 0, width: 0, height: 400 }
    })
    await mountPage(swapDomain)
    await expandRail()
    const scroll = async () => {
      window.dispatchEvent(new Event('scroll'))
      await new Promise((resolve) => requestAnimationFrame(resolve))
      await nextTick()
    }
    await scroll()
    const current = () => rail().findAll('[aria-current="location"]').map((a) => a.attributes('href'))
    expect(current()).toEqual(['#setting-vfs_cache_pressure'])

    tops['setting-vfs_cache_pressure'] = 500
    await scroll()
    expect(current()).toEqual(['#setting-swappiness'])

    // The collapsed ruler marks the same card.
    await toggle().trigger('click')
    expect(current()).toEqual(['#setting-swappiness'])

    // Back in the preset step, the step is current and no card is.
    Object.assign(tops, { preset: 100, tune: 2000 })
    await scroll()
    await toggle().trigger('click')
    expect(current()).toEqual(['#preset'])
  })

  it('shows the mine dot on a changed setting and the issue mark with its words', async () => {
    const { store } = await mountPage(swapDomain)
    await expandRail()
    store.setParam('swappiness', store.params.swappiness === 10 ? 20 : 10)
    store.setParam('dirty_background_ratio', store.params.dirty_ratio)
    await nextTick()
    const link = (key) => rail().find(`a[href="#setting-${key}"]`)
    expect(link('swappiness').find('[data-mark="mine"]').exists()).toBe(true)
    expect(link('swappiness').attributes('aria-label')).toBe(`${swapDomain.defsByKey.swappiness.title}, changed by you`)
    expect(link('vfs_cache_pressure').find('[data-mark="mine"]').exists()).toBe(false)
    const level = store.issuesByParam.dirty_background_ratio.some((i) => i.level === 'error') ? 'error' : 'warn'
    expect(link('dirty_background_ratio').find(`[data-mark="${level}"]`).exists()).toBe(true)
    expect(link('dirty_background_ratio').attributes('aria-label')).toMatch(level === 'error' ? /, error$/ : /, warning$/)
  })

  it('opens hidden advanced settings from their "+N" line and focuses the first', async () => {
    await mountPage(swapDomain)
    await expandRail()
    const more = rail().findAll('button').find((b) => b.text() === '+3 advanced')
    expect(more).toBeTruthy()
    await more.trigger('click')
    await flushPromises()
    expect(document.querySelector('#setting-min_free_kbytes')).not.toBeNull()
    expect(document.activeElement?.id).toBe('setting-min_free_kbytes')
    expect(rail().findAll('button').some((b) => b.text() === '+3 advanced')).toBe(false)
    // The panel's own button agrees.
    const panelButton = [...document.querySelectorAll('#section-panel-memory-reclaim button')].find((b) => /advanced/.test(b.textContent))
    expect(panelButton.getAttribute('aria-expanded')).toBe('true')
  })

  it('lists a collapsed group as one line that opens it', async () => {
    await mountPage(securityDomain)
    await expandRail()
    const section = securityDomain.sections[0]
    await wrapper.find(`#section-title-${section.id} button`).trigger('click')
    const line = rail().findAll('button').find((b) => /^\+\d+ settings?$/.test(b.text()))
    expect(line.text()).toBe(`+${section.keys.length} settings`)
    await line.trigger('click')
    await flushPromises()
    expect(wrapper.find(`#section-title-${section.id} button`).attributes('aria-expanded')).toBe('true')
    expect(document.activeElement?.id).toBe(`setting-${section.keys[0]}`)
  })

  it('below xl, opens the same list in a drawer that closes and focuses the card picked', async () => {
    await mountPage(swapDomain)
    const opener = wrapper.findAll('button').find((b) => b.text() === 'Outline' && b.attributes('aria-haspopup'))
    await opener.trigger('click')
    await nextTick()
    const dialog = document.querySelector('[role="dialog"][aria-label="Settings outline"]')
    expect(dialog).not.toBeNull()
    expect(opener.attributes('aria-expanded')).toBe('true')
    dialog.querySelector('a[href="#setting-dirty_ratio"]').click()
    await flushPromises()
    expect(document.querySelector('[role="dialog"][aria-label="Settings outline"]')).toBeNull()
    expect(document.activeElement?.id).toBe('setting-dirty_ratio')

    // Escape closes it and puts focus back on the button.
    await opener.trigger('click')
    await nextTick()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(document.activeElement).toBe(opener.element)
  })
})

describe('railStartsExpanded', () => {
  // The width the rail and the steps share: PAGE_WIDTH (86rem with 2rem
  // gutters from lg up) at 1280, 1440 and 1920px.
  const shared = (px) => Math.min(px, 86 * 16) / 16 - 4

  it('starts collapsed beside graphs at 1280 and expanded from 1440', () => {
    expect(railStartsExpanded(shared(1280), true)).toBe(false)
    expect(settingsColumnRem(shared(1280), true, false)).toBe(43.5)
    expect(railStartsExpanded(shared(1440), true)).toBe(true)
    expect(settingsColumnRem(shared(1440), true, true)).toBe(40)
    expect(railStartsExpanded(shared(1920), true)).toBe(true)
  })

  it('starts expanded at every xl width without graphs', () => {
    expect(railStartsExpanded(shared(1280), false)).toBe(true)
    expect(settingsColumnRem(shared(1280), false, true)).toBe(62)
  })
})
