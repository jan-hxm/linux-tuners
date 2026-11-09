// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PartsMap from './PartsMap.vue'
import StackFigure from './StackFigure.vue'
import Timeline from './Timeline.vue'
import SideBySide from './SideBySide.vue'
import Gauge from './Gauge.vue'
import { closeTip } from './tipState.js'
import { DEMO_DEFS, DEMO_LEARN, valueFor } from '@/learn/__fixtures__/demoKit.js'

const on = (image) => (ref) => valueFor(ref, image)
const [stackChapter, timelineChapter, sideChapter, promiseChapter, gaugeChapter] = DEMO_LEARN.chapters

/** An image the fixture has no capture for. */
const UNCAPTURED = 'arch'

afterEach(() => closeTip())

/**
 * The figure root: role figure with a label from the data. Its only parts
 * a screen reader reaches are buttons; everything else is aria-hidden, and
 * no button sits inside a hidden box.
 */
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

/** No digit in a text that is "not measured" where evidence is missing. */
const noNumbers = (text) => expect(text).not.toMatch(/\d{2,}/)

describe('PartsMap', () => {
  const mountMap = (image = 'debian-13') => mount(PartsMap, { props: { parts: DEMO_LEARN.parts, evidence: on(image), imageId: image } })

  it('renders compact cards on the grid, the bands behind them and the connectors', () => {
    const w = mountMap()
    const root = figureRoot(w)
    expect(root.attributes('aria-label')).toContain('Connections: Programs to Page cache: read files into.')
    const grid = w.get('[data-layout="grid"]')
    expect(grid.classes()).toEqual(expect.arrayContaining(['hidden', 'md:grid']))
    // A band label column comes first, so cards move one column right.
    expect(grid.attributes('style')).toContain('grid-template-columns: 6rem repeat(3, minmax(0, 1fr))')
    const cache = w.get('[data-card="cache"]')
    expect(cache.element.tagName).toBe('BUTTON')
    expect(cache.attributes('style')).toContain('grid-column: 3')
    expect(w.get('[data-card="worker"]').classes()).toEqual(expect.arrayContaining(['border-fit', 'bg-fit-tint']))
    expect(w.findAll('[data-band]').map((b) => b.text())).toEqual(['Memory', 'Background'])
    expect(w.findAll('[data-edge]')).toHaveLength(4)
    expect(w.get('[data-card="reserve"]').text()).toContain('4,000')
    // Title and value only on the card; what it does is its description.
    expect(cache.text()).not.toContain('Keeps file data')
    const desc = w.get(`#${cache.attributes('aria-describedby')}`)
    expect(desc.text()).toBe('Keeps file data in spare memory. 1,000,000 kB, kernel 0.0.0-fixture')
    expect(desc.attributes('hidden')).toBeDefined()
  })

  it('is a list below md, with the connections as "A to B: label" rows', () => {
    const w = mountMap()
    const list = w.get('[data-layout="list"]')
    expect(list.classes()).toContain('md:hidden')
    expect(list.text()).toContain('Worker to Disk: writes to')
    expect(list.text()).toContain('Background')
    expect(list.findAll('button').map((b) => b.text())).toContain('Page cache1,000,000 kB')
  })

  it('draws the scale bar to scale, with the legend as tooltip buttons', () => {
    const w = mountMap()
    expect(w.get('[data-scale-total]').text()).toBe('3,000,000 kB')
    expect(w.get('[data-segment="programs"]').attributes('style')).toContain('width: 16.666')
    expect(w.get('[data-segment="programs"]').classes()).toContain('bg-ink')
    expect(w.get('[data-segment="cache"]').classes()).toContain('bg-fit')
    expect(w.get('[data-legend="programs"]').element.tagName).toBe('BUTTON')
    expect(w.get('[data-legend="programs"]').text()).toBe('Programs500,000 kB, 17 %')
    // A segment with no tip and no value is plain text; the rest with a tip is a button.
    expect(w.get('[data-legend="rest"]').element.tagName).toBe('BUTTON')
    expect(w.get('[role="figure"]').attributes('aria-label')).toContain('Memory, 3,000,000 kB, drawn to scale')
  })

  it('puts the picture after the figure as ordinary text', () => {
    const w = mountMap()
    const picture = w.findAll('p').at(-1)
    expect(picture.text()).toMatch(/^Picture it: Programs ask for memory/)
    expect(picture.element.closest('[role="figure"]')).toBeNull()
  })

  it('says "not measured" without a capture, and draws no share', () => {
    const w = mountMap(UNCAPTURED)
    expect(w.get('[data-card="reserve"]').text()).toContain('not measured')
    noNumbers(w.get('[data-card="reserve"]').text())
    expect(w.get('[role="figure"]').attributes('aria-label')).toContain('Reserve, Memory kept free for urgent requests., measured not measured')
    expect(w.find('[data-segment]').exists()).toBe(false)
    expect(w.get('[data-scale-total]').text()).toBe('not measured')
    noNumbers(w.get('[data-scale]').text())
  })
})

describe('StackFigure', () => {
  const mountStack = (props = {}) => mount(StackFigure, { props: { figure: stackChapter.figure, evidence: on('debian-13'), imageId: 'debian-13', ...props } })

  it('renders each layer as a row with its label, bands, nodes and values', () => {
    const w = mountStack()
    figureRoot(w)
    expect(w.findAll('[data-layer]').map((l) => l.attributes('data-layer'))).toEqual(['programs', 'free-memory', 'disk'])
    expect(w.findAll('[data-band]').map((b) => b.text())).toEqual(['Above high', 'Low to high', 'Below min'])
    // A band or node with a tip is a button; one without is drawing.
    expect(w.get('[data-band="below-min"]').element.tagName).toBe('BUTTON')
    expect(w.get('[data-node="kswapd"]').element.tagName).toBe('BUTTON')
    expect(w.get('[data-node="app"]').attributes('aria-hidden')).toBe('true')
    expect(w.get('[data-node="kswapd"]').text()).not.toContain('yes')
    // Missing on a kernel, it says so.
    const absent = mount(StackFigure, { props: { figure: stackChapter.figure, evidence: (ref) => (ref.probe === 'demo.worker' ? { status: 'absent', reason: 'x', kernel: '4.15' } : valueFor(ref, 'debian-13')) } })
    expect(absent.get('[data-node="kswapd"]').text()).toContain('not present on this kernel')
    absent.unmount()
    expect(w.text()).toContain('Normal.min: 2,000 pages')
    expect(w.text()).toContain('Values measured on debian-13, kernel 0.0.0-fixture.')
  })

  it('stacks the label over the row below md', () => {
    const row = mountStack().get('[data-layer="free-memory"]')
    expect(row.classes()).toEqual(expect.arrayContaining(['grid-cols-1', 'md:grid-cols-[7.5rem_minmax(0,1fr)]']))
  })

  it('highlights the selected band or layer in fit-tint', async () => {
    const w = mountStack({ highlight: 'below-min' })
    expect(w.get('[data-band="below-min"]').classes()).toEqual(expect.arrayContaining(['bg-fit-tint', 'border-fit']))
    expect(w.get('[data-band="above-high"]').classes()).not.toContain('bg-fit-tint')
    expect(w.get('[role="figure"]').attributes('aria-label')).toContain('Below min: The program waits (selected)')
    await w.setProps({ highlight: 'programs' })
    expect(w.get('[data-layer="programs"]').classes()).toContain('bg-fit-tint')
  })

  it('says "not measured" without a capture', () => {
    const w = mountStack({ evidence: on(UNCAPTURED), imageId: UNCAPTURED })
    expect(w.text()).toContain('Normal.min: not measured')
    expect(w.get('[data-node="kswapd"]').text()).toContain('not measured')
    expect(w.text()).toContain(`No values measured on ${UNCAPTURED} yet.`)
    noNumbers(w.get('[data-layer="free-memory"]').text())
  })
})

describe('Timeline', () => {
  const mountTimeline = (image = 'debian-13') => mount(Timeline, { props: { figure: timelineChapter.figure, evidence: on(image), imageId: image } })

  it('draws the curve from the data, dashed lines with values and numbered events', () => {
    const w = mountTimeline()
    figureRoot(w)
    expect(w.get('[data-curve]').attributes('d')).toBe('M0.00 10.00 L30.00 50.00 L45.00 70.00 L50.00 75.00 L70.00 40.00 L100.00 15.00')
    const lines = w.findAll('[data-line]')
    expect(lines.map((l) => l.attributes('stroke-dasharray'))).toEqual(['4 3', '4 3'])
    expect(w.text()).toContain('low level: 4,000 pages')
    expect(w.text()).toContain('high level: 6,000 pages')
    // Events are numbered in time order: the stall at 0.4 is the first.
    expect(w.get('[data-event="1"]').classes()).toContain('stroke-error')
    expect(w.get('[data-event="2"]').classes()).toContain('stroke-fit')
    expect(w.text()).toContain('Schematic: the shape and the order are real, the distances are not.')
    // An event or line with a tip is a button in the list under the plot.
    expect(w.findAll('button').map((b) => b.text())).toEqual(['A program stalls', 'low level'])
  })

  it('says "not measured" without a capture', () => {
    const w = mountTimeline(UNCAPTURED)
    expect(w.text()).toContain('low level: not measured')
    expect(w.get('[role="figure"]').attributes('aria-label')).toContain('low level at not measured')
  })
})

describe('SideBySide', () => {
  it('fills the asked-for cell in ink, the others lit in fit, and outlines the rest', () => {
    const w = mount(SideBySide, { props: { figure: sideChapter.figure, evidence: on('debian-13'), defsByKey: DEMO_DEFS } })
    expect(w.get('[role="img"]').attributes('aria-label')).toContain('1 asked for, 7 read along, 4 stays on disk, of 12')
    const [first, second] = w.findAll('[data-state]')
    expect(first.findAll('[data-cell]').map((c) => c.attributes('data-cell')).slice(0, 4)).toEqual(['off', 'off', 'asked', 'off'])
    expect(second.findAll('[data-cell="asked"]')).toHaveLength(1)
    expect(second.findAll('[data-cell="lit"]')).toHaveLength(7)
    expect(second.findAll('[data-cell="off"]')).toHaveLength(4)
    expect(second.get('[data-cell="asked"]').classes()).toContain('bg-ink')
    expect(second.get('[data-cell="lit"]').classes()).toContain('bg-fit')
    expect(second.get('[data-cell="off"]').classes()).toEqual(expect.arrayContaining(['border', 'border-rule-strong', 'bg-paper']))
    expect(first.text()).toContain('demo.batch_order = 0')
    expect(w.get('[data-legend]').text()).toBe('asked forread alongstays on disk')
    expect(w.text()).toContain('Checked on real kernels by the VM test "on a swap file it reads ahead at the default and not at 0".')
    // The cells wrap on a phone.
    expect(first.get('.flex-wrap.gap-1').exists()).toBe(true)
  })

  it('says lit and not lit without a legend, and names the probe that backs it', () => {
    const w = mount(SideBySide, { props: { figure: promiseChapter.figure, evidence: on('debian-13'), defsByKey: DEMO_DEFS } })
    expect(w.get('[data-legend]').text()).toBe('litnot lit')
    expect(w.text()).toContain('Checked on real kernels by the probe demo.zram.')
  })
})

describe('Gauge', () => {
  const mountGauge = (image = 'debian-13', props = {}) =>
    mount(Gauge, { props: { figure: gaugeChapter.figure, evidence: on(image), imageId: image, defsByKey: DEMO_DEFS, ...props } })
  const topOf = (w, sel) => w.get(sel).attributes('style').match(/top: ([\d.]+)%/)?.[1]

  it('draws the marks and zones to scale from the capture, with ticks and an axis', () => {
    const w = mountGauge()
    figureRoot(w)
    expect(w.get('[data-figure="gauge"]').attributes('data-measured')).toBeDefined()
    expect(topOf(w, '[data-mark="min"]')).toBe('75')
    expect(topOf(w, '[data-mark="high"]')).toBe('25')
    expect(w.get('[data-mark="min"]').classes()).toContain('bg-error')
    expect(w.get('[data-zone="min-high"]').attributes('style')).toContain('bottom: 25%; height: 50%')
    expect(w.get('[data-zone="min-high"]').classes()).toContain('bg-fit-tint')
    expect(w.findAll('[data-tick]').map((t) => t.text())).toEqual(['0', '2,000', '4,000', '6,000', '8,000'])
    expect(w.get('[data-axis]').text()).toBe('free pages, 0 to 8,000')
    expect(w.get('[data-mark-label="min"]').text()).toBe('min2,000')
    expect(w.get('[data-mark-label="min"]').element.tagName).toBe('BUTTON')
    expect(w.get('[data-mark-label="low"]').attributes('aria-hidden')).toBe('true')
    expect(w.text()).toContain('Drawn to scale.')
  })

  it('moves the marks with the kernel', () => {
    const w = mountGauge('ubuntu-18.04')
    expect(topOf(w, '[data-mark="min"]')).toBe('77.5')
  })

  it('beside it, a thin bar of the whole range with a bracket on the part drawn large', () => {
    const w = mountGauge()
    expect(w.find('[data-zoom-bar]').exists()).toBe(true)
    const bracket = w.get('[data-zoom-bracket]').attributes('style')
    expect(bracket).toContain('bottom: 0%')
    expect(bracket).toContain('1.0666')
    expect(w.text()).toContain('The thin bar is all memory, 3,000,000 kB; the bracket at its foot is the part drawn large, 1.1 % of it.')
  })

  it('draws the pins on their mark and gap as pressed-state buttons that select', async () => {
    const w = mountGauge('debian-13', { selectedKey: 'floor_kbytes', controls: 'panel' })
    const pins = w.findAll('[data-gauge-pin]')
    expect(pins.map((p) => p.attributes('aria-pressed'))).toEqual(['true', 'false'])
    expect(pins[0].attributes('aria-controls')).toBe('panel')
    expect(pins[0].attributes('style')).toContain('top: 75%')
    expect(pins[1].attributes('style')).toContain('top: 37.5%')
    expect(w.get('[data-gauge-pins]').classes()).toEqual(expect.arrayContaining(['hidden', 'md:block']))
    await pins[1].trigger('click')
    expect(w.emitted('select')).toEqual([['gap_factor']])
  })

  it('names the zones beside it from md and as a key below md', () => {
    const w = mountGauge()
    expect(w.get('[data-gauge-zones]').classes()).toContain('md:block')
    expect(w.get('[data-zone-label="below-min"]').element.tagName).toBe('BUTTON')
    expect(w.get('[data-zone-label="below-min"]').classes()).toContain('text-error')
    const key = w.get('[data-gauge-key]')
    expect(key.classes()).toContain('md:hidden')
    expect(key.findAll('li').map((li) => li.find('button, span[aria-hidden="true"]:not(.size-3)').text())).toEqual(['worker sleeps', 'worker frees', 'programs wait'])
  })

  it('draws the schematic curve on the same heights, with numbered events', () => {
    const w = mountGauge()
    expect(w.get('[data-curve]').attributes('d')).toMatch(/^M0\.00 /)
    expect(w.findAll('[data-curve-event]').map((e) => e.text())).toEqual(['1', '2'])
    expect(w.get('[data-gauge-curve]').text()).toContain('time (schematic)')
    expect(w.get('[data-gauge-curve]').findAll('button').map((b) => b.text())).toEqual(['a program waits'])
  })

  it('is a labelled schematic where the marks are not measured, with no numbers', () => {
    const w = mountGauge(UNCAPTURED)
    expect(w.get('[data-figure="gauge"]').attributes('data-measured')).toBeUndefined()
    expect(topOf(w, '[data-mark="min"]')).toBe('75')
    expect(topOf(w, '[data-mark="low"]')).toBe('50')
    expect(w.find('[data-tick]').exists()).toBe(false)
    expect(w.find('[data-zoom-bracket]').exists()).toBe(false)
    expect(w.get('[data-axis]').text()).toBe('free pages, schematic')
    expect(w.text()).toContain('Schematic: the marks are not measured on arch, so they are evenly spaced.')
    noNumbers(w.get('[data-scale]').text())
    expect(w.get('[role="figure"]').attributes('aria-label')).not.toMatch(/\d,\d{3}/)
  })
})
