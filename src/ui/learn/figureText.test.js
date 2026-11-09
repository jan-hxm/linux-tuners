import { describe, it, expect } from 'vitest'
import {
  answerText, answerValue, chooseStep, curvePath, edgeGeometry, edgeRows, figureLabel, formatValue, lineLevels, noText,
  numberedSources, partsMapLabel, pinRefs, safeHref, sameOnEveryImage, sameOnText, splitFootnotes, NOT_MEASURED, NOTHING_FITS,
} from './figureText.js'
import { DEMO_DEFS, DEMO_LEARN, valueFor } from '@/learn/__fixtures__/demoKit.js'

const on = (image) => (ref) => valueFor(ref, image)
const [stackChapter, timelineChapter, sideChapter, promiseChapter] = DEMO_LEARN.chapters

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
    expect(label).toContain('Background: Worker, Frees memory in the background., measured yes')
    expect(label).toContain('Connections: Programs to Page cache: read files into.')
    expect(partsMapLabel(DEMO_LEARN.parts, on('arch'))).toContain('measured not measured')
  })

  it('reads a stack top down with its values and the selection', () => {
    const label = figureLabel(stackChapter.figure, on('debian-13'), { highlight: 'below-min' })
    expect(label).toMatch(/^Where the reserve sits\. Layers from the top\. Programs: /)
    expect(label).toContain('Below min: the program waits (selected)')
    expect(label).toContain('Normal.min: 2,000 pages')
    expect(figureLabel(stackChapter.figure, on('arch'))).toContain('Normal.min: not measured')
  })

  it('says a timeline is schematic and lists its events in time order', () => {
    const label = figureLabel(timelineChapter.figure, on('debian-13'))
    expect(label).toContain('Schematic timeline, not to scale.')
    expect(label).toContain('In order: A program stalls, then Worker wakes, then Worker sleeps.')
  })

  it('counts the lit cells of each side-by-side state', () => {
    expect(figureLabel(sideChapter.figure, on('debian-13'), { defsByKey: DEMO_DEFS }))
      .toBe('Pages read per swap-in. Side by side. Batch off, demo.batch_order = 0: 1 of 8 lit. Batch of eight, demo.batch_order = 3: 8 of 8 lit.')
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
