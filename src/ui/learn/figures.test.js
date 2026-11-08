// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PartsMap from './PartsMap.vue'
import StackFigure from './StackFigure.vue'
import Timeline from './Timeline.vue'
import SideBySide from './SideBySide.vue'
import { DEMO_DEFS, DEMO_LEARN, valueFor } from '@/learn/__fixtures__/demoKit.js'

const on = (image) => (ref) => valueFor(ref, image)
const [stackChapter, timelineChapter, sideChapter, promiseChapter] = DEMO_LEARN.chapters

/** An image the fixture has no capture for. */
const UNCAPTURED = 'arch'

/** The figure's image root: role img, a label from the data, the drawing hidden. */
function imageRoot(wrapper) {
  const root = wrapper.get('[role="img"]')
  expect(root.attributes('aria-label').length).toBeGreaterThan(20)
  for (const child of root.element.children) expect(child.getAttribute('aria-hidden')).toBe('true')
  return root
}

/** No digit in a text that is "not measured" where evidence is missing. */
const noNumbers = (text) => expect(text).not.toMatch(/\d{2,}/)

describe('PartsMap', () => {
  const mountMap = (image = 'debian-13') => mount(PartsMap, { props: { parts: DEMO_LEARN.parts, evidence: on(image), imageId: image } })

  it('renders the cards on the grid, the bands behind them and the connectors', () => {
    const w = mountMap()
    const root = imageRoot(w)
    expect(root.attributes('aria-label')).toContain('Connections: Programs to Page cache: read files into.')
    const grid = w.get('[data-layout="grid"]')
    expect(grid.classes()).toEqual(expect.arrayContaining(['hidden', 'md:grid']))
    // A band label column comes first, so cards move one column right.
    expect(grid.attributes('style')).toContain('grid-template-columns: 7.5rem repeat(3, minmax(0, 1fr))')
    expect(w.get('[data-card="cache"]').attributes('style')).toContain('grid-column: 3')
    expect(w.get('[data-card="worker"]').classes()).toEqual(expect.arrayContaining(['border-fit', 'bg-fit-tint']))
    expect(w.findAll('[data-band]').map((b) => b.text())).toEqual(['Memory', 'Background'])
    expect(w.findAll('[data-edge]')).toHaveLength(4)
    expect(w.get('[data-card="reserve"]').text()).toContain('4,000')
  })

  it('is a list below md, with the connections as "A to B: label" rows', () => {
    const w = mountMap()
    const list = w.get('[data-layout="list"]')
    expect(list.classes()).toContain('md:hidden')
    expect(list.text()).toContain('Worker to Disk: writes to')
    expect(list.text()).toContain('Background')
  })

  it('puts the picture after the image as ordinary text', () => {
    const w = mountMap()
    const picture = w.findAll('p').at(-1)
    expect(picture.text()).toMatch(/^Picture it: Programs ask for memory/)
    expect(picture.element.closest('[role="img"]')).toBeNull()
  })

  it('says "not measured" without a capture', () => {
    const w = mountMap(UNCAPTURED)
    expect(w.get('[data-card="reserve"]').text()).toContain('not measured')
    noNumbers(w.get('[data-card="reserve"]').text())
    expect(w.get('[role="img"]').attributes('aria-label')).toContain('Reserve, Memory kept free for urgent requests., measured not measured')
  })
})

describe('StackFigure', () => {
  const mountStack = (props = {}) => mount(StackFigure, { props: { figure: stackChapter.figure, evidence: on('debian-13'), imageId: 'debian-13', ...props } })

  it('renders each layer as a row with its label, bands, nodes and values', () => {
    const w = mountStack()
    imageRoot(w)
    expect(w.findAll('[data-layer]').map((l) => l.attributes('data-layer'))).toEqual(['programs', 'free-memory', 'disk'])
    expect(w.findAll('[data-band]').map((b) => b.text())).toEqual([
      'Above high: nothing to do',
      'Between low and high: the worker frees memory',
      'Below min: the program waits',
    ])
    expect(w.get('[data-node="kswapd"]').text()).toContain('yes')
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
    expect(w.get('[role="img"]').attributes('aria-label')).toContain('Below min: the program waits (selected)')
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
    imageRoot(w)
    expect(w.get('[data-curve]').attributes('d')).toBe('M0.00 10.00 L30.00 50.00 L45.00 70.00 L50.00 75.00 L70.00 40.00 L100.00 15.00')
    const lines = w.findAll('[data-line]')
    expect(lines.map((l) => l.attributes('stroke-dasharray'))).toEqual(['4 3', '4 3'])
    expect(w.text()).toContain('low level: 4,000 pages')
    expect(w.text()).toContain('high level: 6,000 pages')
    // Events are numbered in time order: the stall at 0.4 is the first.
    expect(w.get('[data-event="1"]').classes()).toContain('stroke-error')
    expect(w.get('[data-event="2"]').classes()).toContain('stroke-fit')
    expect(w.text()).toContain('Schematic: the shape and the order are real, the distances are not.')
  })

  it('says "not measured" without a capture', () => {
    const w = mountTimeline(UNCAPTURED)
    expect(w.text()).toContain('low level: not measured')
    expect(w.get('[role="img"]').attributes('aria-label')).toContain('low level at not measured')
  })
})

describe('SideBySide', () => {
  it('renders one row of cells per state, the first lit dark and the rest light', () => {
    const w = mount(SideBySide, { props: { figure: sideChapter.figure, evidence: on('debian-13'), defsByKey: DEMO_DEFS } })
    imageRoot(w)
    const [first, second] = w.findAll('[data-state]')
    expect(first.findAll('[data-cell="lit"]')).toHaveLength(1)
    expect(first.findAll('[data-cell="off"]')).toHaveLength(7)
    expect(second.findAll('[data-cell="lit"]')).toHaveLength(8)
    expect(second.findAll('[data-cell]')[0].classes()).toContain('bg-fit')
    expect(second.findAll('[data-cell]')[1].classes()).toContain('bg-fit-tint')
    expect(first.text()).toContain('demo.batch_order = 0')
    expect(w.text()).toContain('Checked on real kernels by the VM test "on a swap file it reads ahead at the default and not at 0".')
    // The cells wrap on a phone.
    expect(first.get('.flex-wrap.gap-1').exists()).toBe(true)
  })

  it('names the probe that backs a state', () => {
    const w = mount(SideBySide, { props: { figure: promiseChapter.figure, evidence: on('debian-13'), defsByKey: DEMO_DEFS } })
    expect(w.text()).toContain('Checked on real kernels by the probe demo.zram.')
  })
})
