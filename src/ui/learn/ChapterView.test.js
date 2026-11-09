// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ChapterView from './ChapterView.vue'
import { KERNEL_STORAGE_KEY, storedKernel } from './kernelPref.js'
import { DEMO_DEFS, DEMO_DOCS, DEMO_IMAGES, DEMO_LEARN, valueFor } from '@/learn/__fixtures__/demoKit.js'

const [stackChapter, timelineChapter, sideChapter, , gaugeChapter] = DEMO_LEARN.chapters

const mountChapter = (chapter = stackChapter, props = {}) =>
  mount(ChapterView, {
    attachTo: document.body,
    props: { chapter, images: DEMO_IMAGES, valueFor, defsByKey: DEMO_DEFS, tuneHref: (key) => `/demo?key=${key}`, ...props },
  })

const chapterLook = () => stackChapter.look.cmd

let wrapper
beforeEach(() => {
  localStorage.clear()
  storedKernel.value = null
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('ChapterView', () => {
  it('renders the nine parts in the template order', () => {
    wrapper = mountChapter()
    const order = wrapper.findAll('[data-part]').map((el) => el.attributes('data-part'))
    // Each thing once: no "Settings here" (the pin panel explains a setting) and the look command in its own part only.
    expect(order).toEqual(['oneLine', 'picture', 'figure', 'body', 'chooser', 'flow', 'symptoms', 'look', 'sources'])
    expect(wrapper.get('section').attributes('id')).toBe('keeping-a-reserve')
    expect(wrapper.get('h2').text()).toBe('Keeping a reserve')
    expect(wrapper.findAll('h3').map((h) => h.text())).toEqual(['Should you change it?', "What you notice if it's wrong", 'Look on your machine', 'Sources'])
    expect(wrapper.text().split(chapterLook()).length - 1).toBe(1)
    expect(wrapper.get('[data-part="picture"]').text()).toContain('Where the picture stops: The picture stops at the drawer')
    expect(wrapper.get('[data-part="symptoms"]').text()).toContain('Too low')
  })

  it('renders RichText markup in every chapter, never the raw marks', async () => {
    for (const chapter of DEMO_LEARN.chapters) {
      wrapper = mountChapter(chapter)
      // Open the first pin so its `here` text is on the page too.
      const pin = wrapper.find('[data-pins] button')
      if (pin.exists()) await pin.trigger('click')
      const text = wrapper.text()
      expect(text, chapter.id).not.toMatch(/\[\[|\]\]|\*\*|`/)
      // look.for is a whole sentence: shown as written, no doubled full stop.
      const look = wrapper.get('[data-part="look"]').text()
      expect(look, chapter.id).not.toContain('Look for')
      expect(look, chapter.id).not.toMatch(/[^.]\.\.(?!\.)/)
      wrapper.unmount()
      wrapper = null
    }
  })

  it('prints the decision flow instead of the chooser', () => {
    wrapper = mountChapter()
    expect(wrapper.get('[data-part="chooser"]').classes()).toContain('print:hidden')
    expect(wrapper.get('[data-part="flow"]').classes()).toEqual(expect.arrayContaining(['hidden', 'print:block']))
  })

  it('renders footnote marks as numbered links to the sources, and RichText around them', () => {
    wrapper = mountChapter()
    const body = wrapper.get('[data-part="body"]')
    const marks = body.findAll('a[href^="#"]')
    expect(marks.map((a) => [a.text(), a.attributes('href')])).toEqual([
      ['Source [1]', '#keeping-a-reserve-source-vm'],
      ['Source [1]', '#keeping-a-reserve-source-vm'],
      ['Source [1]', '#keeping-a-reserve-source-vm'],
    ])
    expect(body.get('button').text()).toContain('watermark') // the glossary term
    expect(body.get('code').text()).toBe('kswapd')
    expect(body.findAll('strong').map((s) => s.text())).toContain('reserve')
    expect(body.text()).not.toContain('[^')
    expect(wrapper.get('#keeping-a-reserve-source-vm').text()).toContain('[1] Documentation for /proc/sys/vm')
    // The margin repeats each paragraph's sources beside it.
    expect(body.findAll('ul').map((u) => u.text())).toEqual([
      expect.stringContaining('Documentation for /proc/sys/vm'),
      expect.stringContaining('Documentation for /proc/sys/vm'),
    ])
  })

  it('selects the first pin and shows its panel, live and labelled', async () => {
    wrapper = mountChapter()
    const pins = wrapper.get('[data-pins]')
    expect(pins.attributes('role')).toBe('group')
    const buttons = pins.findAll('button')
    expect(buttons.map((b) => b.attributes('aria-pressed'))).toEqual(['true', 'false'])
    const panel = wrapper.get('[data-pin-panel]')
    expect(panel.attributes('aria-live')).toBe('polite')
    expect(buttons[0].attributes('aria-controls')).toBe(panel.attributes('id'))
    expect(panel.text()).toContain('demo.reserve_kbytes')
    expect(panel.text()).toContain('Free memory reserve')
    expect(panel.text()).toContain('Sets the size of the reserve, which moves all three levels.')
    expect(panel.text()).toContain('Normal.min: 2,000 pages')
    expect(panel.text()).toContain('Debian 13, kernel 0.0.0-fixture')
    expect(panel.text()).not.toContain('/proc/zoneinfo')
    expect(panel.get('a[target="_blank"]').attributes('href')).toBe(DEMO_DOCS)
    expect(panel.findAll('a').at(-1).attributes('href')).toBe('/demo?key=reserve_kbytes')
    expect(wrapper.get('[data-layer="free-memory"]').classes()).toContain('bg-fit-tint')

    await buttons[1].trigger('click')
    expect(buttons.map((b) => b.attributes('aria-pressed'))).toEqual(['false', 'true'])
    expect(wrapper.get('[data-layer="free-memory"]').classes()).not.toContain('bg-fit-tint')
    expect(panel.text()).toContain('demo.fill_ratio')
    await buttons[1].trigger('click')
    expect(panel.text()).toBe('Pick a setting to see what it changes here.')
  })

  it('switches the kernel with pressed buttons and remembers it', async () => {
    wrapper = mountChapter()
    const group = wrapper.get('[data-kernels]')
    expect(group.attributes('role')).toBe('group')
    expect(group.attributes('aria-labelledby')).toBeTruthy()
    const buttons = group.findAll('button')
    expect(buttons.map((b) => b.text())).toEqual(DEMO_IMAGES.map((i) => i.label))
    expect(buttons.map((b) => b.attributes('aria-pressed'))).toEqual(['true', 'false', 'false', 'false', 'false'])
    await buttons[2].trigger('click')
    expect(localStorage.getItem(KERNEL_STORAGE_KEY)).toBe('fedora-43')
    expect(buttons[2].attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-pin-panel]').text()).toContain('Fedora 43, kernel 0.0.2-fixture')
    // A second chapter on the page shows the same kernel.
    const other = mountChapter(timelineChapter)
    expect(other.get('[data-kernels] [aria-pressed="true"]').text()).toBe('Fedora 43')
    other.unmount()
  })

  it('drops the kernel buttons when every image measured the same values', () => {
    // Every image reports what Debian 13 does.
    const same = (ref) => valueFor(ref, 'debian-13')
    wrapper = mountChapter(stackChapter, { valueFor: same })
    expect(wrapper.find('[data-kernels]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Measured on')
    expect(wrapper.get('[data-part="figure"]').text()).toContain('Values measured on 5 test kernels, the same on each.')
    expect(wrapper.get('[data-pin-panel]').text()).toContain('The same on all 5 test kernels')
  })

  it('says "not measured" where an image has no capture', async () => {
    const partial = (ref, imageId) => (imageId === 'ubuntu-24.04' ? { status: 'missing' } : valueFor(ref, imageId))
    wrapper = mountChapter(stackChapter, { valueFor: partial })
    await wrapper.findAll('[data-kernels] button')[1].trigger('click')
    const panel = wrapper.get('[data-pin-panel]')
    expect(panel.text()).toContain('Normal.min: not measured')
    expect(panel.text()).toContain('Not measured on Ubuntu 24.04 yet')
    expect(wrapper.get('[data-part="figure"] [role="figure"]').attributes('aria-label')).not.toMatch(/\d,\d{3}/)
  })

  it('ignores a stored image that is not in the list', () => {
    localStorage.setItem(KERNEL_STORAGE_KEY, '<img src=x>')
    storedKernel.value = '<img src=x>'
    wrapper = mountChapter()
    expect(wrapper.get('[data-kernels] [aria-pressed="true"]').text()).toBe('Debian 13')
    expect(wrapper.html()).not.toContain('<img src=x>')
  })

  it('has no kernel switcher where the figure shows no capture', () => {
    wrapper = mountChapter(sideChapter)
    expect(wrapper.find('[data-kernels]').exists()).toBe(false)
    expect(wrapper.get('[data-figure="sideBySide"]').exists()).toBe(true)
  })

  it('drops links that are not https or same-site', async () => {
    const defsByKey = { ...DEMO_DEFS, reserve_kbytes: { ...DEMO_DEFS.reserve_kbytes, kernelDocsUrl: 'http://x' } }
    wrapper = mountChapter(stackChapter, { tuneHref: () => 'javascript:alert(1)', defsByKey })
    await flushPromises()
    expect(wrapper.html()).not.toContain('javascript:')
    expect(wrapper.html()).not.toContain('http://x')
    expect(wrapper.text()).not.toContain('Tune it')
  })

  it('reaches every pin\'s here text through the pin buttons and the panel', async () => {
    for (const chapter of DEMO_LEARN.chapters) {
      wrapper = mountChapter(chapter)
      const panel = wrapper.get('[data-pin-panel]')
      for (const pin of chapter.pins) {
        const button = wrapper.findAll('[data-pins] button').find((b) => b.text().includes(DEMO_DEFS[pin.key].sysctlName))
        if (button.attributes('aria-pressed') !== 'true') await button.trigger('click')
        expect(panel.text(), pin.key).toContain(pin.here)
      }
      wrapper.unmount()
      wrapper = null
    }
  })

  it('draws a gauge\'s pins on the scale and selects them like the row', async () => {
    wrapper = mountChapter(gaugeChapter)
    const drawn = wrapper.findAll('[data-gauge-pin]')
    expect(drawn.map((b) => b.attributes('data-gauge-pin'))).toEqual(['floor_kbytes', 'gap_factor'])
    expect(drawn[0].attributes('aria-pressed')).toBe('true')
    expect(drawn[0].attributes('aria-controls')).toBe(wrapper.get('[data-pin-panel]').attributes('id'))
    expect(drawn[1].attributes('aria-label')).toBe('demo.gap_factor, from low to high')
    // The row keeps them for phones only.
    for (const b of wrapper.findAll('[data-pins] button')) expect(b.classes()).toContain('md:hidden')
    await drawn[1].trigger('click')
    const panel = wrapper.get('[data-pin-panel]')
    expect(panel.text()).toContain('Sets the gap between the marks.')
    expect(panel.text()).toContain('high: 6,000 pages')
    expect(wrapper.findAll('[data-gauge-pin]')[1].attributes('aria-pressed')).toBe('true')
    expect(wrapper.findAll('[data-pins] button')[1].attributes('aria-pressed')).toBe('true')
  })

  it('renders every fixture chapter without a stray em dash', () => {
    for (const chapter of DEMO_LEARN.chapters) {
      const w = mountChapter(chapter)
      expect(w.text()).not.toContain('—')
      for (const el of w.findAll('[aria-label]')) expect(el.attributes('aria-label')).not.toContain('—')
      w.unmount()
    }
  })
})
