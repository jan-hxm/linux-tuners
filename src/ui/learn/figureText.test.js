import { describe, it, expect } from 'vitest'
import {
  answerText, answerValue, cellKinds, chooseStep, curvePath, edgeGeometry, edgeRows, figureLabel, figureRefs, formatValue, gaugeCaption,
  gaugeModel, lineLevels, niceTop, noText, numberedSources, partsMapLabel, pinRefs, plainTip, safeHref, sameOnEveryImage, sameOnText, scaleModel,
  scaleTicks, splitFootnotes, tipValue, NOT_MEASURED, NOTHING_FITS,
} from './figureText.js'
import { DEMO_DEFS, DEMO_LEARN, valueFor } from '@/learn/__fixtures__/demoKit.js'

const on = (image) => (ref) => valueFor(ref, image)
const [stackChapter, timelineChapter, sideChapter, promiseChapter, gaugeChapter] = DEMO_LEARN.chapters

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
    expect(label).toContain('Memory: Programs, Ask the kernel for memory.; Page cache, Keeps file data in spare memory.')
    expect(label).toContain('Reserve, Memory kept free for urgent requests., measured 4,000')
    // A probe that only measured "present" adds no value line.
    expect(label).toContain('Background: Worker, Frees memory in the background.')
    expect(label).not.toContain('measured yes')
    expect(label).toContain('Connections: Programs to Page cache: read files into.')
    expect(partsMapLabel(DEMO_LEARN.parts, on('arch'))).toContain('measured not measured')
  })

  it('reads a stack top down with its values and the selection', () => {
    const label = figureLabel(stackChapter.figure, on('debian-13'), { highlight: 'below-min' })
    expect(label).toMatch(/^Where the reserve sits\. Layers from the top\. Programs: /)
    expect(label).toContain('Below min: The program waits (selected)')
    expect(label).toContain('kswapd0, the worker: Frees memory in the background')
    expect(label).toContain('Normal.min: 2,000 pages')
    expect(figureLabel(stackChapter.figure, on('arch'))).toContain('Normal.min: not measured')
  })

  it('says a timeline is schematic and lists its events in time order', () => {
    const label = figureLabel(timelineChapter.figure, on('debian-13'))
    expect(label).toContain('Schematic timeline, not to scale.')
    expect(label).toContain('In order: A program stalls (It frees memory itself, and waits), then Worker wakes, then Worker sleeps.')
    expect(label).toContain('low level at 4,000 pages (The worker wakes below it)')
  })

  it('counts the cells of each side-by-side state in the legend words', () => {
    expect(figureLabel(sideChapter.figure, on('debian-13'), { defsByKey: DEMO_DEFS })).toBe(
      'Pages read per swap-in. Side by side. Batch off, demo.batch_order = 0: 1 asked for, 0 read along, 11 stays on disk, of 12. '
      + 'Batch of eight, demo.batch_order = 3: 1 asked for, 7 read along, 4 stays on disk, of 12.',
    )
    // Without a legend: lit and not lit.
    expect(figureLabel(promiseChapter.figure, on('debian-13'), { defsByKey: DEMO_DEFS })).toContain('Strict, demo.mode = strict: 6 lit, 4 not lit, of 10.')
  })

  it('names the scale bar with its shares', () => {
    const label = partsMapLabel(DEMO_LEARN.parts, on('debian-13'))
    expect(label).toContain('Memory, 3,000,000 kB, drawn to scale: Programs, 500,000 kB, 17 %: Memory the programs wrote to; Page cache, 1,000,000 kB, 33 %; Free or kernel, the rest: Everything else, free or kept by the kernel.')
  })

  it('reads a gauge from the top, with its zoom, pins and curve', () => {
    const label = figureLabel(gaugeChapter.figure, on('debian-13'), { defsByKey: DEMO_DEFS, highlight: 'min' })
    expect(label).toMatch(/^Free memory in the Normal zone\. A scale of free pages, 0 to 8,000, drawn to scale\./)
    expect(label).toContain('Marks from the top: high 6,000 pages; low 4,000 pages; min 2,000 pages: Below it a program frees memory itself (selected).')
    expect(label).toContain('Zones from the top: worker sleeps (above high); worker frees (min to high): The worker frees memory in the background; programs wait (below min)')
    expect(label).toContain('Settings on the scale: demo.floor_kbytes on min; demo.gap_factor from low to high.')
    expect(label).toContain('The thin bar is all memory, 3,000,000 kB; the bracket at its foot is the part drawn large, 1.1 % of it.')
    expect(label).toContain('A schematic curve over time, not to scale: a program waits: Free memory fell below min, then worker sleeps.')
    const schematic = figureLabel(gaugeChapter.figure, on('arch'), { defsByKey: DEMO_DEFS })
    expect(schematic).toContain('A schematic scale of free pages: the marks are not measured on this kernel.')
    expect(schematic).not.toMatch(/\d,\d{3}/)
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
    const geo = edgeGeometry(DEMO_LEARN.parts, { from: 'programs', to: 'cache' }, '4rem', '3rem')
    expect(geo.axis).toBe('x')
    expect(geo.reverse).toBe(false)
    expect(geo.style.left).toBe('calc(1 * ((100% - 2 * 4rem) / 3) + 0 * 4rem)')
    expect(geo.style.width).toBe('calc(0 * ((100% - 2 * 4rem) / 3) + 1 * 4rem)')
  })

  it('places a column edge and notes its direction', () => {
    const geo = edgeGeometry(DEMO_LEARN.parts, { from: 'worker', to: 'cache' }, '4rem', '3rem')
    expect(geo.axis).toBe('y')
    expect(geo.reverse).toBe(true)
  })

  it('draws no edge between cards that share neither a row nor a column', () => {
    expect(edgeGeometry(DEMO_LEARN.parts, { from: 'programs', to: 'worker' }, '4rem', '3rem')).toBeNull()
    expect(edgeGeometry(DEMO_LEARN.parts, { from: 'programs', to: 'nope' }, '4rem', '3rem')).toBeNull()
  })

  it('writes the phone rows as "A to B: label"', () => {
    expect(edgeRows(DEMO_LEARN.parts).map((r) => r.text)).toEqual([
      'Programs to Page cache: read files into',
      'Page cache to Reserve: leaves room for',
      'Worker to Page cache: frees',
      'Worker to Disk: writes to',
    ])
  })

  it('spaces timeline lines evenly, first on top, and maps the curve into the box', () => {
    expect(lineLevels([1, 2])).toEqual([2 / 3, 1 / 3])
    expect(curvePath([[0, 0], [0.5, 1], [1, 0.25]])).toBe('M0.00 100.00 L50.00 0.00 L100.00 75.00')
  })
})

describe('pins', () => {
  it('finds the values a pin points at by layer, band, node or line', () => {
    expect(pinRefs(stackChapter.figure, { layer: 'free-memory' })).toHaveLength(3)
    expect(pinRefs(stackChapter.figure, { layer: 'below-min' })).toHaveLength(3)
    expect(pinRefs(stackChapter.figure, { layer: 'kswapd' })).toEqual([{ probe: 'demo.worker', path: '', unit: '' }])
    expect(pinRefs(stackChapter.figure, { layer: 'app' })).toEqual([])
    expect(pinRefs(timelineChapter.figure, { layer: 'low' })).toHaveLength(1)
    expect(pinRefs(sideChapter.figure, { key: 'batch_order' })).toEqual([])
  })
})

describe('chooser steps', () => {
  const choose = stackChapter.choose
  const lastWithoutNo = [{ q: 'Is it slow?', check: 'free -m', hint: 'Look.', yes: { key: 'mode', dir: 'raise' } }]

  it('follows yes and no, and a missing no to the next question', () => {
    expect(chooseStep(choose, 0, true)).toEqual({ result: { key: 'reserve_kbytes', dir: 'raise' } })
    expect(chooseStep(choose, 0, false)).toEqual({ next: 1 })
    expect(chooseStep(choose, 1, false)).toEqual({ result: { leave: true, why: 'The reserve is doing its job, so the default fits.' } })
    expect(chooseStep(lastWithoutNo, 0, false)).toEqual({ result: NOTHING_FITS })
  })

  it('says each answer as a sentence', () => {
    expect(answerText({ key: 'reserve_kbytes', dir: 'raise' }, DEMO_DEFS)).toBe('Raise demo.reserve_kbytes.')
    expect(answerText({ key: 'zzz', dir: 'lower' }, DEMO_DEFS)).toBe('Lower zzz.')
    expect(answerText({ leave: true, why: 'it is fine.' })).toBe('Leave it as it is: it is fine.')
    expect(answerText({ key: 'mode', to: 'relaxed' }, DEMO_DEFS)).toBe('Set demo.mode to `0` (relaxed, promise more than there is).')
    expect(noText(choose, 0)).toBe('Go to question 2.')
    expect(noText(lastWithoutNo, 0)).toBe('Leave it as it is: none of these questions matched your machine.')
  })
})

describe('answer values', () => {
  it('shows what the file gets and the words the control shows', () => {
    const select = { options: [{ value: 'madvise', label: 'madvise: only memory that asks' }, { value: 'cubic', label: 'cubic (kernel default)' }, { value: 'fq', label: 'fq' }, { value: 'allowed', label: 'allowed (kernel limit)' }, { value: 'blocked', sysctlValue: '0', label: '0: blocked for everyone' }] }
    expect(answerValue(select, 'madvise')).toEqual({ shown: 'madvise', words: 'only memory that asks' })
    expect(answerValue(select, 'cubic')).toEqual({ shown: 'cubic', words: 'kernel default' })
    expect(answerValue(select, 'fq')).toEqual({ shown: 'fq', words: '' })
    expect(answerValue(select, 'blocked')).toEqual({ shown: '0', words: 'blocked for everyone' })
    const toggle = { control: 'toggle', toggleLabels: { on: 'on: merge', off: 'off: kernel default' } }
    expect(answerValue(toggle, 1)).toEqual({ shown: '1', words: 'on: merge' })
    expect(answerValue(toggle, 0)).toEqual({ shown: '0', words: 'off: kernel default' })
    expect(answerValue({ segmentLabels: ['0: off', '1: all', '2: loopback'] }, 2)).toEqual({ shown: '2', words: 'loopback' })
    expect(answerValue(null, 5)).toEqual({ shown: '5', words: '' })
  })

  it('says a to answer as a sentence with the value in code', () => {
    const defs = {
      sysrq: { sysctlName: 'kernel.sysrq', options: [{ value: 'reboot', sysctlValue: '176', label: '176: sync, remount, reboot (Ubuntu)' }] },
      odd: { sysctlName: 'demo.odd', options: [{ value: 'a`b', label: 'a`b' }] },
      plain: { sysctlName: 'demo.plain', kernelMin: 0, kernelMax: 10 },
    }
    // Words with brackets of their own follow a colon.
    expect(answerText({ key: 'sysrq', to: 'reboot' }, defs)).toBe('Set kernel.sysrq to `176`: sync, remount, reboot (Ubuntu).')
    // A backtick in the value would break the code span, so it stays plain.
    expect(answerText({ key: 'odd', to: 'a`b' }, defs)).toBe('Set demo.odd to a`b.')
    expect(answerText({ key: 'plain', to: 4 }, defs)).toBe('Set demo.plain to `4`.')
  })
})

describe('footnotes and sources', () => {
  it('splits [^id] marks out of RichText', () => {
    expect(splitFootnotes('A[^vm] b [[kswapd]].[^zones]')).toEqual([{ text: 'A' }, { note: 'vm' }, { text: ' b [[kswapd]].' }, { note: 'zones' }])
    expect(splitFootnotes('plain')).toEqual([{ text: 'plain' }])
  })

  it('numbers sources by first citation, then the rest', () => {
    expect(numberedSources(promiseChapter).map((s) => [s.id, s.n])).toEqual([['proc', 1], ['vm', 2]])
  })

  it('allows only https and same-site links', () => {
    expect(safeHref('https://docs.kernel.org/x')).toBe('https://docs.kernel.org/x')
    expect(safeHref('/swap')).toBe('/swap')
    for (const bad of ['javascript:alert(1)', '//evil.example', 'http://docs.kernel.org', 'data:text/html,x', null]) expect(safeHref(bad)).toBeNull()
  })
})

describe('values the same on every image', () => {
  const ids = ['a', 'b', 'c']
  const ok = (value) => ({ status: 'ok', value, kernel: '6.1' })
  const ref = { probe: 'demo.x' }
  it('is true only when every ref is ok with one value on every image', () => {
    expect(sameOnEveryImage([ref], ids, () => ok(10))).toBe(true)
    expect(sameOnEveryImage([ref], ids, () => ok({ min: 1, max: 2 }))).toBe(true)
    expect(sameOnEveryImage([ref], ids, (_, id) => ok(id === 'c' ? 11 : 10))).toBe(false)
    expect(sameOnEveryImage([ref], ids, (_, id) => (id === 'c' ? { status: 'absent', reason: 'x' } : ok(10)))).toBe(false)
    expect(sameOnEveryImage([ref], ids, () => ({ status: 'missing' }))).toBe(false)
  })
  it('needs values and more than one image to compare', () => {
    expect(sameOnEveryImage([], ids, () => ok(10))).toBe(false)
    expect(sameOnEveryImage([ref], ['a'], () => ok(10))).toBe(false)
  })
  it('is false for the fixture stack, which differs on one image, and says so in plain words', () => {
    const images = ['debian-13', 'ubuntu-24.04', 'fedora-43', 'debian-11', 'ubuntu-18.04']
    expect(sameOnEveryImage(stackChapter.figure.layers.flatMap((l) => l.values ?? []), images, valueFor)).toBe(false)
    expect(sameOnText(5)).toBe('Values measured on 5 test kernels, the same on each.')
  })
})

describe('figures v2 geometry', () => {
  it('rounds a scale top up and ticks it at round steps', () => {
    expect(niceTop(8492)).toBe(10000)
    expect(niceTop(20)).toBe(25)
    expect(niceTop(0)).toBe(1)
    expect(scaleTicks(0, 10000)).toEqual([0, 2500, 5000, 7500, 10000])
    expect(scaleTicks(0, 30)).toEqual([0, 10, 20, 30])
    expect(scaleTicks(5, 5)).toEqual([])
  })

  it('draws a gauge to scale from the capture, with zones, zoom, curve and pins', () => {
    const m = gaugeModel(gaugeChapter.figure, on('debian-13'))
    expect(m.measured).toBe(true)
    expect([m.from, m.to, m.unit]).toEqual([0, 8000, 'pages'])
    expect(m.marks.map((x) => x.y)).toEqual([0.25, 0.5, 0.75])
    expect(m.zones.map((z) => [z.id, z.y0, z.y1])).toEqual([['below-min', 0, 0.25], ['min-high', 0.25, 0.75], ['above-high', 0.75, 1]])
    expect(m.ticks.map((t) => t.text)).toEqual(['0', '2,000', '4,000', '6,000', '8,000'])
    // 8,000 pages of 4 kB out of 3,000,000 kB.
    expect(m.zoom.bracket.y0).toBe(0)
    expect(m.zoom.bracket.y1).toBeCloseTo(32000 / 3000000)
    // Curve level 1 is the first mark, 4 the top.
    expect(m.curve.path.startsWith('M0.00 ')).toBe(true)
    expect(m.curve.events.map((e) => [e.n, e.label])).toEqual([[1, 'a program waits'], [2, 'worker sleeps']])
    expect(m.pins).toEqual([
      expect.objectContaining({ key: 'floor_kbytes', y: 0.25 }),
      expect.objectContaining({ key: 'gap_factor', y0: 0.5, y1: 0.75 }),
    ])
    // A kernel with other marks moves them; the scale stays the range.
    expect(gaugeModel(gaugeChapter.figure, on('ubuntu-18.04')).marks.map((x) => x.y)).toEqual([0.225, 0.45, 0.675])
  })

  it('widens a range that a mark passes, and picks a round top without one', () => {
    const fig = { ...gaugeChapter.figure, range: { from: 0, to: 3000 } }
    expect(gaugeModel(fig, on('debian-13')).to).toBe(8000)
    const { range: _r, ...open } = gaugeChapter.figure
    expect(gaugeModel(open, on('debian-13')).to).toBe(8000)
  })

  it('turns a gauge into a labelled schematic when a mark is not measured', () => {
    const m = gaugeModel(gaugeChapter.figure, on('arch'))
    expect(m.measured).toBe(false)
    expect(m.marks.map((x) => x.y)).toEqual([0.25, 0.5, 0.75])
    expect(m.marks.map((x) => x.text)).toEqual([NOT_MEASURED, NOT_MEASURED, NOT_MEASURED])
    expect(m.ticks).toEqual([])
    expect(m.zoom.bracket).toBeNull()
    expect(gaugeCaption(gaugeChapter.figure, on('arch'), 'arch')).toContain('Schematic: the marks are not measured on arch, so they are evenly spaced.')
  })

  it('draws a scale bar to scale, and nothing for what is not measured', () => {
    const m = scaleModel(DEMO_LEARN.parts.scale, on('debian-13'))
    expect(m.segments.map((s) => [s.id, s.tone, s.share])).toEqual([['programs', 'ink', 500000 / 3000000], ['cache', 'fit', 1 / 3], ['rest', null, null]])
    const none = scaleModel(DEMO_LEARN.parts.scale, on('arch'))
    expect(none.total).toBeNull()
    expect(none.segments.every((s) => s.share === null)).toBe(true)
    expect(none.totalText).toBe(NOT_MEASURED)
  })

  it('marks each side-by-side cell asked, lit or off', () => {
    expect(cellKinds({ cells: 6, lit: 3, start: 1, asked: 2 })).toEqual(['off', 'lit', 'asked', 'lit', 'off', 'off'])
    expect(cellKinds({ cells: 3, lit: 2 })).toEqual(['lit', 'lit', 'off'])
  })

  it('gives a gauge pin its own value and the marks it sits on', () => {
    const fig = gaugeChapter.figure
    expect(pinRefs(fig, { key: 'floor_kbytes', layer: 'min' }).map((r) => r.path ?? r.probe)).toEqual(['demo.reserve', 'Normal.min'])
    expect(pinRefs(fig, { key: 'gap_factor', layer: 'min-high' }).map((r) => r.path)).toEqual(['Normal.high', 'Normal.low', 'Normal.min'])
    expect(figureRefs(fig)).toHaveLength(5)
  })

  it('writes a tip as plain words and its value with the kernel', () => {
    expect(plainTip('Holds `swapped out` **memory**.')).toBe('Holds swapped out memory.')
    const ref = { probe: 'demo.reserve', unit: 'kB' }
    expect(tipValue(ref, on('debian-13'))).toBe('4,000 kB, kernel 0.0.0-fixture')
    expect(tipValue(ref, on('debian-13'), 5)).toBe('4,000 kB on all 5 test kernels')
    expect(tipValue(ref, on('arch'))).toBe(NOT_MEASURED)
  })
})

describe('cardGroups', () => {
  it('lists the groups top down, cards outside bands where their rows are', async () => {
    const { cardGroups } = await import('./figureText.js')
    const parts = {
      cards: [
        { id: 'a', row: 1, col: 1 }, { id: 'b', row: 2, col: 1 }, { id: 'c', row: 3, col: 1 }, { id: 'd', row: 4, col: 1 },
      ],
      bands: [{ label: 'Middle', rows: [3, 3] }],
      edges: [],
    }
    expect(cardGroups(parts).map((g) => [g.label, g.cards.map((c) => c.id)])).toEqual([[null, ['a', 'b']], ['Middle', ['c']], [null, ['d']]])
  })
})
