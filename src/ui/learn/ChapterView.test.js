// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ChapterView from './ChapterView.vue'
import { KERNEL_STORAGE_KEY, storedKernel } from './kernelPref.js'
// Until L1 merges: the local copy of the fixture and valueFor (PROGRESS.md).
import { DEMO_DEFS, DEMO_IMAGES, DEMO_LEARN } from './__fixtures__/demo.learn.js'
import { valueFor } from './__fixtures__/valueFor.js'

const [stackChapter, timelineChapter, sideChapter] = DEMO_LEARN.chapters

const mountChapter = (chapter = stackChapter, props = {}) =>
  mount(ChapterView, {
    attachTo: document.body,
    props: { chapter, images: DEMO_IMAGES, valueFor, defsByKey: DEMO_DEFS, tuneHref: (key) => `/demo?key=${key}`, ...props },
  })

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
    expect(order).toEqual(['oneLine', 'picture', 'figure', 'body', 'settings', 'chooser', 'flow', 'symptoms', 'look', 'sources'])
    expect(wrapper.get('section').attributes('id')).toBe('when-reclaim-starts')
    expect(wrapper.get('h2').text()).toBe('When reclaim starts')
    expect(wrapper.findAll('h3').map((h) => h.text())).toEqual(['Settings here', 'Should you change it?', "What you notice if it's wrong", 'Look on your machine', 'Sources'])
    expect(wrapper.get('[data-part="picture"]').text()).toContain('Where the picture stops: A gauge empties')
    expect(wrapper.get('[data-part="symptoms"]').text()).toContain('Too low')
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
      ['Source [1]', '#when-reclaim-starts-source-zones'],
      ['Source [2]', '#when-reclaim-starts-source-vm'],
    ])
    expect(body.get('button').text()).toBe('kswapd') // the glossary term
    expect(body.get('code').text()).toBe('demo.alpha')
    expect(body.text()).not.toContain('[^')
    expect(wrapper.get('#when-reclaim-starts-source-zones').text()).toContain('[1] Physical memory')
    // The margin repeats each paragraph's sources beside it.
    expect(body.findAll('ul').map((u) => u.text())).toEqual([expect.stringContaining('Physical memory'), expect.stringContaining('Documentation for /proc/sys/vm')])
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
    expect(panel.text()).toContain('demo.alpha')
    expect(panel.text()).toContain('Alpha level')
    expect(panel.text()).toContain('Moves all three marks up or down together.')
    expect(panel.text()).toContain('Normal.min: 4,096 pages')
    expect(panel.text()).toContain('Debian 13, kernel 6.12.48+deb13-amd64')
    expect(panel.text()).toContain('cat /proc/zoneinfo')
    expect(panel.get('a[target="_blank"]').attributes('href')).toBe('https://docs.kernel.org/admin-guide/sysctl/vm.html')
    expect(panel.findAll('a').at(-1).attributes('href')).toBe('/demo?key=alpha')
    expect(wrapper.get('[data-layer="levels"]').classes()).toContain('bg-fit-tint')

    await buttons[1].trigger('click')
    expect(buttons.map((b) => b.attributes('aria-pressed'))).toEqual(['false', 'true'])
    expect(wrapper.get('[data-band="below-min"]').classes()).toContain('bg-fit-tint')
    expect(panel.text()).toContain('demo.beta')
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
    expect(wrapper.get('[data-pin-panel]').text()).toContain('Normal.min: 3,900 pages')
    // A second chapter on the page shows the same kernel.
    const other = mountChapter(timelineChapter)
    expect(other.get('[data-kernels] [aria-pressed="true"]').text()).toBe('Fedora 43')
    other.unmount()
  })

  it('says "not measured" where an image has no capture', async () => {
    wrapper = mountChapter()
    await wrapper.findAll('[data-kernels] button')[1].trigger('click')
    const panel = wrapper.get('[data-pin-panel]')
    expect(panel.text()).toContain('Normal.min: not measured')
    expect(panel.text()).toContain('Not measured on Ubuntu 24.04 yet')
    expect(wrapper.get('[data-part="figure"] [role="img"]').attributes('aria-label')).not.toMatch(/\d,\d{3}/)
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
    wrapper = mountChapter(stackChapter, { tuneHref: () => 'javascript:alert(1)', defsByKey: { alpha: { ...DEMO_DEFS.alpha, kernelDocsUrl: 'http://x' } } })
    await flushPromises()
    expect(wrapper.html()).not.toContain('javascript:')
    expect(wrapper.html()).not.toContain('http://x')
    expect(wrapper.text()).not.toContain('Tune it')
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
