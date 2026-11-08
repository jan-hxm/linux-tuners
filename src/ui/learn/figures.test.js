// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PartsMap from './PartsMap.vue'
import StackFigure from './StackFigure.vue'
import Timeline from './Timeline.vue'
import SideBySide from './SideBySide.vue'
// Until L1 merges: the local copy of the fixture and valueFor (PROGRESS.md).
import { DEMO_DEFS, DEMO_LEARN } from './__fixtures__/demo.learn.js'
import { valueFor } from './__fixtures__/valueFor.js'

const on = (image) => (ref) => valueFor(ref, image)
const [stackChapter, timelineChapter, sideChapter] = DEMO_LEARN.chapters

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
    expect(root.attributes('aria-label')).toContain('Connections: Programs to Page cache: read files.')
    const grid = w.get('[data-layout="grid"]')
    expect(grid.classes()).toEqual(expect.arrayContaining(['hidden', 'md:grid']))
    // A band label column comes first, so cards move one column right.
    expect(grid.attributes('style')).toContain('grid-template-columns: 7.5rem repeat(2, minmax(0, 1fr))')
    expect(w.get('[data-card="cache"]').attributes('style')).toContain('grid-column: 3')
    expect(w.get('[data-card="cache"]').classes()).toEqual(expect.arrayContaining(['border-fit', 'bg-fit-tint']))
    expect(w.findAll('[data-band]').map((b) => b.text())).toEqual(['RAM', 'DISK'])
    expect(w.findAll('[data-edge]')).toHaveLength(3)
    expect(w.get('[data-card="cache"]').text()).toContain('67,584')
  })

  it('is a list below md, with the connections as "A to B: label" rows', () => {
    const w = mountMap()
    const list = w.get('[data-layout="list"]')
    expect(list.classes()).toContain('md:hidden')
    expect(list.text()).toContain('Page cache to Reclaim: when low')
    expect(list.text()).toContain('RAM')
  })

  it('puts the picture after the image as ordinary text', () => {
    const w = mountMap()
    const picture = w.findAll('p').at(-1)
    expect(picture.text()).toMatch(/^Picture it: Think of a desk/)
    expect(picture.element.closest('[role="img"]')).toBeNull()
  })

  it('says "not measured" without a capture', () => {
    const w = mountMap('debian-11')
    expect(w.get('[data-card="cache"]').text()).toContain('not measured')
    noNumbers(w.get('[data-card="cache"]').text())
    expect(w.get('[role="img"]').attributes('aria-label')).toContain('Page cache, keeps file data, measured not measured')
  })
})

describe('StackFigure', () => {
  const mountStack = (props = {}) => mount(StackFigure, { props: { figure: stackChapter.figure, evidence: on('debian-13'), imageId: 'debian-13', ...props } })

  it('renders each layer as a row with its label, bands, nodes and values', () => {
    const w = mountStack()
    imageRoot(w)
    expect(w.findAll('[data-layer]').map((l) => l.attributes('data-layer'))).toEqual(['levels', 'threads'])
    expect(w.findAll('[data-band]').map((b) => b.text())).toEqual(['Above high', 'Low to high', 'Below min'])
    expect(w.get('[data-node="kswapd"]').text()).toContain('yes')
    expect(w.text()).toContain('Normal.min: 4,096 pages')
    expect(w.text()).toContain('Values measured on debian-13, kernel 6.12.48+deb13-amd64.')
  })

  it('stacks the label over the row below md', () => {
    const row = mountStack().get('[data-layer="levels"]')
    expect(row.classes()).toEqual(expect.arrayContaining(['grid-cols-1', 'md:grid-cols-[7.5rem_minmax(0,1fr)]']))
  })

  it('highlights the selected band or layer in fit-tint', async () => {
    const w = mountStack({ highlight: 'below-min' })
    expect(w.get('[data-band="below-min"]').classes()).toEqual(expect.arrayContaining(['bg-fit-tint', 'border-fit']))
    expect(w.get('[data-band="above-high"]').classes()).not.toContain('bg-fit-tint')
    expect(w.get('[role="img"]').attributes('aria-label')).toContain('Below min (selected)')
    await w.setProps({ highlight: 'threads' })
    expect(w.get('[data-layer="threads"]').classes()).toContain('bg-fit-tint')
  })

  it('says "not measured" without a capture', () => {
    const w = mountStack({ evidence: on('ubuntu-18.04'), imageId: 'ubuntu-18.04' })
    expect(w.text()).toContain('Normal.min: not measured')
    expect(w.get('[data-node="kswapd"]').text()).toContain('not measured')
    expect(w.text()).toContain('No values measured on ubuntu-18.04 yet.')
    noNumbers(w.get('[data-layer="levels"]').text())
  })
})

describe('Timeline', () => {
  const mountTimeline = (image = 'debian-13') => mount(Timeline, { props: { figure: timelineChapter.figure, evidence: on(image), imageId: image } })

  it('draws the curve from the data, dashed lines with values and numbered events', () => {
    const w = mountTimeline()
    imageRoot(w)
    expect(w.get('[data-curve]').attributes('d')).toBe('M0.00 90.00 L30.00 50.00 L50.00 30.00 L60.00 70.00 L100.00 80.00')
    const lines = w.findAll('[data-line]')
    expect(lines.map((l) => l.attributes('stroke-dasharray'))).toEqual(['4 3', '4 3'])
    expect(w.text()).toContain('Writers wait: 67,584 kB')
    expect(w.text()).toContain('Background writing: 5,120 pages')
    expect(w.get('[data-event="2"]').classes()).toContain('stroke-error')
    expect(w.text()).toContain('Schematic: the shape and the order are real, the distances are not.')
  })

  it('says "not measured" without a capture', () => {
    const w = mountTimeline('ubuntu-24.04')
    expect(w.text()).toContain('Writers wait: not measured')
    expect(w.get('[role="img"]').attributes('aria-label')).toContain('Writers wait at not measured')
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
    expect(first.text()).toContain('demo.delta = 0')
    expect(w.text()).toContain('Checked on real kernels by the VM test "swap readahead follows page-cluster".')
    // The cells wrap on a phone.
    expect(first.get('.flex-wrap.gap-1').exists()).toBe(true)
  })
})
