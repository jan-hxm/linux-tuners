// @vitest-environment happy-dom
// The axe sweep of src/a11y.test.js, over the learning-page figures: every
// fixture chapter in each of its states (each pin, each open tooltip, each
// kernel, the chooser's result) and the parts map, with the viewer's scheme set to light and to
// dark. happy-dom has no stylesheet, so contrast isn't measured here (the
// tokens are, in ui/theme.test.js) and both schemes check structure; the
// browser pass in Design.md §7 covers the rest. The guide pages themselves
// are in the route sweeps (src/a11y.test.js, src/views/learn.test.js).
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { h } from 'vue'
import axe from 'axe-core'
import ChapterView from './ChapterView.vue'
import PartsMap from './PartsMap.vue'
import { storedKernel } from './kernelPref.js'
import { DEMO_DEFS, DEMO_IMAGES, DEMO_LEARN, valueFor } from '@/learn/__fixtures__/demoKit.js'

async function violations() {
  const { violations } = await axe.run(document, { resultTypes: ['violations'], rules: { 'color-contrast': { enabled: false } } })
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(' ')}`))
}

/** A page around the chapters, as a guide page would give them: one main and an h1. */
const Page = {
  props: ['chapters'],
  setup: (props) => () =>
    h('main', [
      h('h1', DEMO_LEARN.title),
      h(PartsMap, { parts: DEMO_LEARN.parts, evidence: (ref) => valueFor(ref, 'debian-13'), imageId: 'debian-13' }),
      ...props.chapters.map((chapter) =>
        h(ChapterView, { chapter, images: DEMO_IMAGES, valueFor, defsByKey: DEMO_DEFS, tuneHref: (key) => `/demo?key=${key}` }),
      ),
    ]),
}

let wrapper

function setScheme(dark) {
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    matches: dark && query.includes('dark'),
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    onchange: null,
    dispatchEvent: () => false,
  }))
}

beforeEach(() => {
  document.documentElement.lang = 'en'
  document.title = 'Learn'
  storedKernel.value = null
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('learning figures axe sweep', { timeout: 30_000 }, () => {
  it.each([['light', false], ['dark', true]])('has no serious or critical violation in any state (%s)', async (_name, dark) => {
    setScheme(dark)
    wrapper = mount(Page, { props: { chapters: DEMO_LEARN.chapters }, attachTo: document.body })
    await flushPromises()
    expect(await violations()).toEqual([])

    // Each pin, then no pin.
    for (const pins of wrapper.findAll('[data-pins]')) {
      for (const pin of pins.findAll('button')) await pin.trigger('click')
      await pins.findAll('button').at(-1).trigger('click')
    }
    expect(await violations()).toEqual([])

    // Every figure tooltip open in turn (figure parts, scale legend, gauge
    // marks and zones, compare bars, tree nodes, mode segments), and every
    // pin drawn on a gauge, compare or tree figure (a modes row's stays in the row under it).
    for (const kind of ['compare', 'tree', 'modes']) expect(wrapper.find(`[data-figure="${kind}"]`).exists(), kind).toBe(true)
    const tips = wrapper.findAll('button[aria-describedby]')
    expect(tips.length).toBeGreaterThan(20)
    for (const tip of tips) {
      await tip.trigger('click')
      expect(document.body.querySelector('[data-tip]')).not.toBeNull()
    }
    expect(await violations()).toEqual([])
    const drawn = wrapper.findAll('[data-gauge-pin], [data-figure-pin]')
    expect(drawn.length).toBeGreaterThanOrEqual(6)
    for (const pin of drawn) await pin.trigger('click')
    expect(await violations()).toEqual([])

    // Each kernel on the figures that show the buttons, the ones without a
    // capture too (absent bars, nodes and modes among them).
    for (const button of wrapper.get('[data-kernels]').findAll('button')) {
      await button.trigger('click')
      expect(await violations()).toEqual([])
    }

    // Every chooser's result.
    for (const chooser of wrapper.findAll('[data-chooser]')) {
      const yes = chooser.findAll('button').find((b) => b.text() === 'Yes')
      await yes.trigger('click')
    }
    await flushPromises()
    expect(await violations()).toEqual([])
  })
})
