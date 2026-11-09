// @vitest-environment happy-dom
// The compare, tree and modes figures (Design.md §5 "Learning pages >
// Figures"), mounted on the fixture guide's captures.
import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import CompareFigure from './CompareFigure.vue'
import TreeFigure from './TreeFigure.vue'
import ModesFigure from './ModesFigure.vue'
import ChapterView from './ChapterView.vue'
import { closeTip } from './tipState.js'
import { storedKernel } from './kernelPref.js'
import { ABSENT } from './figureText.js'
import { DEMO_DEFS, DEMO_IMAGES, DEMO_LEARN, valueFor } from '@/learn/__fixtures__/demoKit.js'

const on = (image) => (ref) => valueFor(ref, image)
const chapter = (id) => DEMO_LEARN.chapters.find((c) => c.id === id)

afterEach(() => {
  closeTip()
  storedKernel.value = null
})

/** The figure root: role figure, labelled from the data, with no button inside a hidden box. */
function figureRoot(wrapper) {
  const root = wrapper.get('[role="figure"]')
  expect(root.attributes('aria-label').length).toBeGreaterThan(20)
  const walk = (el) => {
    for (const child of el.children) {
      if (child.getAttribute('aria-hidden') === 'true') expect(child.querySelector('button')).toBeNull()
      else if (child.tagName !== 'BUTTON' && !child.hidden) walk(child)
    }
  }
  walk(root.element)
  return root
}

const mountFigure = (component, id, image = 'debian-13', props = {}) =>
  mount(component, { props: { figure: chapter(id).figure, evidence: on(image), imageId: image, defsByKey: DEMO_DEFS, ...props } })

describe('CompareFigure', () => {
  it('draws one bar per item on the shared log scale, with ticks the axis reaches', () => {
    const w = mountFigure(CompareFigure, 'comparing-sizes')
    expect(figureRoot(w).attributes('data-scale')).toBe('log')
    expect(w.findAll('[data-bar]').map((b) => b.attributes('data-bar'))).toEqual(['buf-min', 'buf-start', 'buf-largest', 'buf-total'])
    expect(w.get('[data-bar="buf-total"] [data-bar-fill]').attributes('style')).toContain('width: 100%')
    // The smallest value still has a length: the axis starts one power below it.
    expect(w.get('[data-bar="buf-min"] [data-bar-fill]').attributes('style')).toContain('width: 7.69')
    expect(w.get('[data-bar="buf-start"] [data-bar-fill]').classes()).toContain('bg-fit')
    expect(w.findAll('[data-tick]').map((t) => t.text())).toEqual(['4 KiB', '32 KiB', '256 KiB', '2 MiB', '16 MiB'])
    expect(w.get('[data-bar="buf-largest"] [data-bar-value]').text()).toBe('6 MiB')
    expect(w.get('[data-axis]').text()).toBe('buffer size, log scale, 2 KiB to 16 MiB')
    expect(w.findAll('[data-group]').map((g) => g.attributes('data-group'))).toEqual(['per-socket', 'whole-system'])
    // The mark is a line across every bar, named above them.
    expect(w.findAll('[data-mark-line]')).toHaveLength(4)
    expect(w.get('[data-mark-label="ceiling"]').text()).toContain('208 KiB')
  })

  it('puts what a bar does and its exact value in its description', () => {
    const w = mountFigure(CompareFigure, 'comparing-sizes')
    const tip = w.get('[data-bar-label="buf-largest"]')
    expect(tip.element.tagName).toBe('BUTTON')
    expect(w.get(`#${tip.attributes('aria-describedby')}`).text()).toBe('Automatic tuning grows a busy socket up to this. 6 MiB (6,291,456 bytes), kernel 0.0.0-fixture')
  })

  it('keeps an absent bar as a labelled gap, and follows the kernel', () => {
    const w = mountFigure(CompareFigure, 'comparing-sizes', 'ubuntu-18.04')
    const total = w.get('[data-bar="buf-total"]')
    expect(total.attributes('data-status')).toBe('absent')
    expect(total.find('[data-bar-fill]').exists()).toBe(false)
    expect(total.get('[data-bar-gap]').text()).toBe(ABSENT)
    expect(w.get('[data-bar="buf-start"] [data-bar-value]').text()).toBe('85.3 KiB')
  })

  it('draws no bar and no number where nothing is measured', () => {
    const w = mountFigure(CompareFigure, 'comparing-sizes', 'arch')
    expect(w.findAll('[data-bar-fill]')).toHaveLength(0)
    expect(w.findAll('[data-tick]')).toHaveLength(0)
    expect(w.get('[role="figure"]').attributes('aria-label')).not.toMatch(/\d{3,}/)
  })

  it('draws its settings beside their bar and line, as pressed-state buttons from md up', async () => {
    const w = mountFigure(CompareFigure, 'comparing-sizes', 'debian-13', { selectedKey: 'buf_max', controls: 'panel' })
    const pins = w.findAll('[data-figure-pin]')
    expect(pins.map((p) => p.attributes('data-figure-pin'))).toEqual(['buf_max', 'buf_sizes'])
    expect(pins[0].attributes('aria-pressed')).toBe('true')
    expect(pins[0].attributes('aria-controls')).toBe('panel')
    expect(pins[1].attributes('aria-label')).toBe('demo.buf_sizes, on Largest')
    expect(pins[0].classes()).toContain('md:inline-flex')
    await pins[1].trigger('click')
    expect(w.emitted('select')).toEqual([['buf_sizes']])
  })

  it('highlights the selected bar, line or group', () => {
    const w = mountFigure(CompareFigure, 'comparing-sizes', 'debian-13', { highlight: 'per-socket' })
    expect(w.get('[data-group="per-socket"]').classes()).toContain('bg-fit-tint')
    const m = mountFigure(CompareFigure, 'comparing-sizes', 'debian-13', { highlight: 'ceiling' })
    expect(m.findAll('[data-mark-line]')[0].classes()).toContain('bg-fit')
  })
})

describe('TreeFigure', () => {
  it('draws the nodes indented by level, with their values and connectors', () => {
    const w = mountFigure(TreeFigure, 'sharing-the-cpu')
    figureRoot(w)
    expect(w.findAll('[data-node]').map((n) => [n.attributes('data-node'), n.attributes('data-depth')])).toEqual([
      ['root-slice', '0'], ['system-slice', '1'], ['web-service', '2'], ['db-service', '2'], ['user-slice', '1'], ['login', '2'],
    ])
    expect(w.get('[data-node="web-service"]').attributes('style')).toContain('padding-left: 3.5rem')
    expect(w.get('[data-node-box="system-slice"]').text()).toContain('100')
    expect(w.get('[data-node-box="system-slice"]').element.tagName).toBe('BUTTON')
    expect(w.get('[data-node-box="web-service"]').attributes('aria-hidden')).toBe('true')
  })

  it('says where a node is missing on this kernel', () => {
    const w = mountFigure(TreeFigure, 'sharing-the-cpu', 'debian-11')
    expect(w.get('[data-node-box="user-slice"]').text()).toContain(ABSENT)
  })

  it('draws its setting beside its node, and highlights the selected node', async () => {
    const w = mountFigure(TreeFigure, 'sharing-the-cpu', 'debian-13', { highlight: 'system-slice', selectedKey: 'unit_weight' })
    expect(w.get('[data-node-box="system-slice"]').classes()).toContain('bg-fit-tint')
    const pin = w.get('[data-figure-pin="unit_weight"]')
    expect(pin.attributes('aria-label')).toBe('CPUWeight, on System services')
    await pin.trigger('click')
    expect(w.emitted('select')).toEqual([['unit_weight']])
  })
})

describe('ModesFigure', () => {
  const lit = (w, row) => w.get(`[data-row="${row}"]`).findAll('[data-lit]').map((s) => s.text())

  it('lights the measured option of each row, every set bit, by group', () => {
    const w = mountFigure(ModesFigure, 'picking-a-mode')
    figureRoot(w)
    expect(w.findAll('[data-group]').map((g) => g.attributes('data-group'))).toEqual(['kernel', 'disks'])
    expect(lit(w, 'page-mode')).toEqual(['when asked'])
    expect(lit(w, 'key-mask')).toEqual(['console level', 'keyboard', 'sync', 'remount read-only', 'reboot', 'nice real-time'])
    expect(lit(w, 'ssd-scheduler')).toEqual(['mq-deadline'])
    expect(w.get('[data-row="page-mode"] [data-lit]').classes()).toEqual(expect.arrayContaining(['bg-ink', 'text-paper']))
  })

  it('adds the raw value as a segment when no option names it', () => {
    const w = mountFigure(ModesFigure, 'picking-a-mode', 'ubuntu-18.04')
    const extra = w.get('[data-row="key-mask"] [data-extra]')
    expect(extra.text()).toBe('1')
    expect(lit(w, 'key-mask')).toEqual(['1'])
  })

  it('lights nothing and says so where the value is absent', () => {
    const w = mountFigure(ModesFigure, 'picking-a-mode', 'debian-11')
    expect(w.get('[data-row="hdd-scheduler"]').attributes('data-status')).toBe('absent')
    expect(lit(w, 'hdd-scheduler')).toEqual([])
    expect(w.get('[data-row="hdd-scheduler"] [data-row-status]').text()).toBe(ABSENT)
  })

  it('says a lit option with a tip is set, and draws each row setting at its end', async () => {
    const w = mountFigure(ModesFigure, 'picking-a-mode', 'debian-13', { selectedKey: 'scheduler', highlight: 'disks' })
    const seg = w.get('[data-row="page-mode"] [data-segment="madvise"]')
    expect(seg.element.tagName).toBe('BUTTON')
    expect(w.get(`#${seg.attributes('aria-describedby')}`).text()).toBe('Only memory a program marks for it. Set on this kernel.')
    expect(w.findAll('[data-figure-pin]').map((p) => p.attributes('data-figure-pin'))).toEqual(['page_mode', 'key_mask', 'scheduler'])
    expect(w.get('[data-figure-pin="scheduler"]').attributes('aria-pressed')).toBe('true')
    expect(w.get('[data-group="disks"]').classes()).toContain('bg-fit-tint')
    await w.get('[data-figure-pin="key_mask"]').trigger('click')
    expect(w.emitted('select')).toEqual([['key_mask']])
  })
})

describe('ChapterView with a v3 figure', () => {
  const mountChapter = (id) => mount(ChapterView, { props: { chapter: chapter(id), images: DEMO_IMAGES, valueFor, defsByKey: DEMO_DEFS } })

  it.each(['comparing-sizes', 'sharing-the-cpu', 'picking-a-mode'])('%s: the drawn pins select the chapter pin and the row keeps them for phones', async (id) => {
    const w = mountChapter(id)
    expect(w.find('[data-kernels]').exists()).toBe(true)
    const drawn = w.findAll('[data-figure-pin]')
    expect(drawn.length).toBeGreaterThan(0)
    expect(drawn[0].attributes('aria-controls')).toBe(w.get('[data-pin-panel]').attributes('id'))
    for (const b of w.findAll('[data-pins] button')) expect(b.classes()).toContain('md:hidden')
    // A press on the selected pin clears it; a press on another selects that one.
    const target = drawn.find((d) => d.attributes('aria-pressed') === 'false') ?? drawn[0]
    if (target.attributes('aria-pressed') === 'true') {
      await target.trigger('click')
      expect(w.get('[data-pin-panel]').text()).toContain('Pick a setting')
    }
    await target.trigger('click')
    const key = target.attributes('data-figure-pin')
    expect(w.get(`[data-figure-pin="${key}"]`).attributes('aria-pressed')).toBe('true')
    expect(w.get('[data-pin-panel]').text()).toContain(DEMO_DEFS[key].sysctlName)
  })

  it('shows the values a compare pin points at, by name and exact', async () => {
    const w = mountChapter('comparing-sizes')
    const panel = w.get('[data-pin-panel]').text()
    expect(panel).toContain('Largest buffer: 6 MiB (6,291,456 bytes)')
    expect(panel).toContain('Smallest: 4 KiB (4,096 bytes)')
  })
})
