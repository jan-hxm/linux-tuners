import { describe, it, expect } from 'vitest'
import {
  answerText, chooseStep, curvePath, edgeGeometry, edgeRows, figureLabel, formatValue, lineLevels, noText,
  numberedSources, partsMapLabel, pinRefs, safeHref, splitFootnotes, NOT_MEASURED, NOTHING_FITS,
} from './figureText.js'
// Until L1 merges: the local copy of the fixture and valueFor (PROGRESS.md).
import { DEMO_DEFS, DEMO_LEARN } from './__fixtures__/demo.learn.js'
import { valueFor } from './__fixtures__/valueFor.js'

const on = (image) => (ref) => valueFor(ref, image)
const [stackChapter, timelineChapter, sideChapter] = DEMO_LEARN.chapters

describe('formatValue', () => {
  it('writes numbers with their unit and a singular for one', () => {
    expect(formatValue({ status: 'ok', value: 4096 }, 'pages')).toBe('4,096 pages')
    expect(formatValue({ status: 'ok', value: 1 }, 'pages')).toBe('1 page')
    expect(formatValue({ status: 'ok', value: true })).toBe('yes')
    expect(formatValue({ status: 'ok', value: ['allocstall_normal'] })).toBe('allocstall_normal')
  })

  it('never shows a number for a value that is not ok', () => {
    expect(formatValue({ status: 'missing' }, 'pages')).toBe(NOT_MEASURED)
    expect(formatValue({ status: 'absent', value: 5 })).toBe('not present on this kernel')
    expect(formatValue({ status: 'ok', value: { Normal: 1 } })).toBe(NOT_MEASURED)
    expect(formatValue({ status: 'ok', value: Number.NaN })).toBe(NOT_MEASURED)
    expect(formatValue(undefined)).toBe(NOT_MEASURED)
  })
})

describe('labels built from the data', () => {
  it('names every card, band and connection of the parts map', () => {
    const label = partsMapLabel(DEMO_LEARN.parts, on('debian-13'))
    expect(label).toContain('RAM: Programs, ask for memory; Page cache, keeps file data, measured 67,584')
    expect(label).toContain('DISK: Disk, holds files and swap.')
    expect(label).toContain('Connections: Programs to Page cache: read files.')
    expect(partsMapLabel(DEMO_LEARN.parts, on('debian-11'))).toContain('measured not measured')
  })

  it('reads a stack top down with its values and the selection', () => {
    const label = figureLabel(stackChapter.figure, on('debian-13'), { highlight: 'below-min' })
    expect(label).toMatch(/^Free memory in one zone\. Layers from the top\. Free pages: /)
    expect(label).toContain('Below min (selected)')
    expect(label).toContain('Normal.min: 4,096 pages')
    expect(figureLabel(stackChapter.figure, on('ubuntu-24.04'))).toContain('Normal.min: not measured')
  })

  it('says a timeline is schematic and lists its events in time order', () => {
    const label = figureLabel(timelineChapter.figure, on('debian-13'))
    expect(label).toContain('Schematic timeline, not to scale.')
    expect(label).toContain('In order: background writing starts, then writers wait.')
  })

  it('counts the lit cells of each side-by-side state', () => {
    expect(figureLabel(sideChapter.figure, on('debian-13'), { defsByKey: DEMO_DEFS }))
      .toBe('Pages read per fault. Side by side. Cluster 0, demo.delta = 0: 1 of 8 lit. Cluster 3, demo.delta = 3: 8 of 8 lit.')
  })

  it('has no em dash in any label', () => {
    const labels = [
      partsMapLabel(DEMO_LEARN.parts, on('debian-13')),
      ...DEMO_LEARN.chapters.map((c) => figureLabel(c.figure, on('debian-13'), { defsByKey: DEMO_DEFS })),
    ]
    for (const l of labels) expect(l).not.toContain('—')
  })
})

describe('geometry', () => {
  it('places a row edge between the facing card edges, from the grid tracks', () => {
    const geo = edgeGeometry(DEMO_LEARN.parts, { from: 'apps', to: 'cache' }, '4rem', '3rem')
    expect(geo.axis).toBe('x')
    expect(geo.reverse).toBe(false)
    expect(geo.style.left).toBe('calc(1 * ((100% - 1 * 4rem) / 2) + 0 * 4rem)')
    expect(geo.style.width).toBe('calc(0 * ((100% - 1 * 4rem) / 2) + 1 * 4rem)')
  })

  it('places a column edge and notes its direction', () => {
    const geo = edgeGeometry(DEMO_LEARN.parts, { from: 'disk', to: 'reclaim' }, '4rem', '3rem')
    expect(geo.axis).toBe('y')
    expect(geo.reverse).toBe(true)
  })

  it('draws no edge between cards that share neither a row nor a column', () => {
    expect(edgeGeometry(DEMO_LEARN.parts, { from: 'apps', to: 'disk' }, '4rem', '3rem')).toBeNull()
    expect(edgeGeometry(DEMO_LEARN.parts, { from: 'apps', to: 'nope' }, '4rem', '3rem')).toBeNull()
  })

  it('writes the phone rows as "A to B: label"', () => {
    expect(edgeRows(DEMO_LEARN.parts).map((r) => r.text)).toEqual([
      'Programs to Page cache: read files',
      'Page cache to Reclaim: when low',
      'Reclaim to Disk: writes out',
    ])
  })

  it('spaces timeline lines evenly, first on top, and maps the curve into the box', () => {
    expect(lineLevels([1, 2])).toEqual([2 / 3, 1 / 3])
    expect(curvePath([[0, 0], [0.5, 1], [1, 0.25]])).toBe('M0.00 100.00 L50.00 0.00 L100.00 75.00')
  })
})

describe('pins', () => {
  it('finds the values a pin points at by layer, band, node or line', () => {
    expect(pinRefs(stackChapter.figure, { layer: 'levels' })).toHaveLength(2)
    expect(pinRefs(stackChapter.figure, { layer: 'below-min' })).toHaveLength(2)
    expect(pinRefs(stackChapter.figure, { layer: 'kswapd' })).toEqual([{ probe: 'demo.kswapd', path: '', unit: '' }])
    expect(pinRefs(stackChapter.figure, { layer: 'direct' })).toEqual([])
    expect(pinRefs(timelineChapter.figure, { layer: 'soft' })).toHaveLength(1)
    expect(pinRefs(sideChapter.figure, { key: 'delta' })).toEqual([])
  })
})

describe('chooser steps', () => {
  const choose = stackChapter.choose

  it('follows yes and no, and a missing no to the next question', () => {
    expect(chooseStep(choose, 0, true)).toEqual({ result: { key: 'alpha', dir: 'raise' } })
    expect(chooseStep(choose, 0, false)).toEqual({ next: 1 })
    expect(chooseStep(choose, 1, false)).toEqual({ result: { key: 'beta', dir: 'lower' } })
    expect(chooseStep(timelineChapter.choose, 0, false)).toEqual({ result: NOTHING_FITS })
  })

  it('says each answer as a sentence', () => {
    expect(answerText({ key: 'alpha', dir: 'raise' }, DEMO_DEFS)).toBe('Raise demo.alpha.')
    expect(answerText({ key: 'zzz', dir: 'lower' }, DEMO_DEFS)).toBe('Lower zzz.')
    expect(answerText({ leave: true, why: 'it is fine.' })).toBe('Leave it as it is: it is fine.')
    expect(noText(choose, 0)).toBe('Go to question 2.')
    expect(noText(timelineChapter.choose, 0)).toBe('Leave it as it is: none of these questions matched your machine.')
  })
})

describe('footnotes and sources', () => {
  it('splits [^id] marks out of RichText', () => {
    expect(splitFootnotes('A[^vm] b [[kswapd]].[^zones]')).toEqual([{ text: 'A' }, { note: 'vm' }, { text: ' b [[kswapd]].' }, { note: 'zones' }])
    expect(splitFootnotes('plain')).toEqual([{ text: 'plain' }])
  })

  it('numbers sources by first citation, then the rest', () => {
    expect(numberedSources(stackChapter).map((s) => [s.id, s.n])).toEqual([['zones', 1], ['vm', 2]])
  })

  it('allows only https and same-site links', () => {
    expect(safeHref('https://docs.kernel.org/x')).toBe('https://docs.kernel.org/x')
    expect(safeHref('/swap')).toBe('/swap')
    for (const bad of ['javascript:alert(1)', '//evil.example', 'http://docs.kernel.org', 'data:text/html,x', null]) expect(safeHref(bad)).toBeNull()
  })
})
