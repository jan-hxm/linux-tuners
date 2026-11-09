// Figures v3 (Design.md §5 "Learning pages > Figures"): readable values
// (labels, byte units), and the compare, tree and modes figures' words and
// geometry, on the fixture guide's captures.
import { describe, it, expect } from 'vitest'
import {
  ABSENT, NOT_MEASURED, compareAxisText, compareCaption, compareLabel, compareModel, drawnPinKeys, figureLabel, figureRefs, formatValue,
  humanBytes, logTicks, measuredText, modeSegments, modesCaption, modesLabel, modesModel, pinRefs, rangeText, refName, sameOnEveryImage, tickText,
  treeCaption, treeLabel, treeNodes,
} from './figureText.js'
import { DEMO_DEFS, DEMO_IMAGES, DEMO_LEARN, valueFor } from '@/learn/__fixtures__/demoKit.js'

const on = (image) => (ref) => valueFor(ref, image)
const chapter = (id) => DEMO_LEARN.chapters.find((c) => c.id === id)
const compare = chapter('comparing-sizes').figure
const tree = chapter('sharing-the-cpu').figure
const modes = chapter('picking-a-mode').figure
const ok = (value) => ({ status: 'ok', value })
const IMAGE_IDS = DEMO_IMAGES.map((i) => i.id)

describe('readable values', () => {
  it('writes byte sizes in KiB, MiB or GiB, one decimal where it helps', () => {
    expect(humanBytes(6291456, 'bytes')).toBe('6 MiB')
    expect(humanBytes(97076, 'kB')).toBe('94.8 MiB')
    expect(humanBytes(128, 'kB')).toBe('128 KiB')
    expect(humanBytes(1536, 'bytes')).toBe('1.5 KiB')
    expect(humanBytes(512, 'bytes')).toBe('512 bytes')
    expect(humanBytes(1, 'bytes')).toBe('1 byte')
    expect(humanBytes(3000000, 'kB')).toBe('2.9 GiB')
  })

  it('keeps the number as measured when asked, and other units as they were', () => {
    expect(formatValue(ok(6291456), 'bytes')).toBe('6 MiB')
    expect(formatValue(ok(6291456), 'bytes', { exact: true })).toBe('6 MiB (6,291,456 bytes)')
    expect(formatValue(ok(512), 'bytes', { exact: true })).toBe('512 bytes')
    expect(formatValue(ok(2000), 'pages', { exact: true })).toBe('2,000 pages')
    expect(formatValue(ok(1), 'pages')).toBe('1 page')
    expect(formatValue(ok('4096 131072 6291456'), 'bytes')).toBe('4096 131072 6291456 bytes')
    expect(formatValue({ status: 'absent' }, 'bytes', { exact: true })).toBe(ABSENT)
  })

  it('names a ref by its label, else its path, else its probe', () => {
    expect(refName({ probe: 'a.b', path: 'x', label: 'Largest buffer' })).toBe('Largest buffer')
    expect(refName({ probe: 'a.b', path: 'x' })).toBe('x')
    expect(refName({ probe: 'a.b', path: '' })).toBe('a.b')
    const ref = { probe: 'demo.bufSizes', path: '2', unit: 'bytes', label: 'Largest buffer' }
    expect(measuredText(ref, on('debian-13'))).toBe('Largest buffer: 6 MiB')
    expect(measuredText(ref, on('debian-13'), { exact: true })).toBe('Largest buffer: 6 MiB (6,291,456 bytes)')
  })

  it('names every figure ref by the part that shows it', () => {
    const refs = figureRefs(compare)
    expect(refs.map((r) => r.label)).toEqual(['Smallest', 'Start', 'Largest buffer', 'Extra per socket', 'Asked-for ceiling', 'A program asks', 'Auto tuning'])
    const gauge = chapter('reading-the-gauge').figure
    expect(figureRefs(gauge, DEMO_DEFS).map((r) => r.label)).toEqual(['min', 'low', 'high', 'All memory', 'Free now', 'demo.floor_kbytes'])
  })
})

describe('compare', () => {
  it('ticks a log axis at powers it reaches, at most five', () => {
    expect(logTicks(12, 24, 2)).toEqual([12, 15, 18, 21, 24])
    expect(logTicks(12, 23, 2)).toEqual([12, 15, 18, 21])
    expect(logTicks(4, 7, 10)).toEqual([4, 5, 6, 7])
    expect(logTicks(0, 12, 10)).toEqual([0, 3, 6, 9, 12])
    expect(tickText(2 ** 20, 'bytes')).toBe('1 MiB')
    expect(tickText(1e6, 'tasks')).toBe('1M')
    expect(tickText(100, 'tasks')).toBe('100')
  })

  it('draws the bars on a shared log scale from the capture', () => {
    const m = compareModel(compare, on('debian-13'))
    // 4 KiB is a power of two itself, so the axis starts one power lower and its bar has a length.
    expect(m).toMatchObject({ log: true, measured: true, from: 2048, to: 16777216 })
    expect(m.ticks.map((t) => t.text)).toEqual(['4 KiB', '32 KiB', '256 KiB', '2 MiB', '16 MiB'])
    for (const t of m.ticks) expect(t.value >= m.from && t.value <= m.to).toBe(true)
    const x = Object.fromEntries(m.bars.map((b) => [b.id, b.x]))
    expect(x['buf-min']).toBeCloseTo(1 / 13)
    expect(x['buf-total']).toBe(1)
    expect(x['buf-start']).toBeCloseTo(6 / 13)
    expect(m.marks[0].x).toBeCloseTo((Math.log2(212992) - 11) / 13)
    expect(m.marks[0].pins).toEqual(['buf_max'])
    expect(m.groups.map((g) => [g.id, g.bars.length])).toEqual([['per-socket', 3], ['whole-system', 1]])
    expect(compareAxisText(compare, m)).toBe('buffer size, log scale, 2 KiB to 16 MiB')
    expect(compareCaption(compare, on('debian-13'), 'Debian 13')).toBe(
      'Receive buffer sizes. Log scale: each tick is 8 times the one before. A program asks and Auto tuning are examples, to show the idea. The rest is measured on Debian 13, kernel 0.0.0-fixture.',
    )
    // The example line sits at its value like a measured one.
    expect(m.marks[1]).toMatchObject({ id: 'ask', text: '1 MiB' })
    expect(m.marks[1].x).toBeCloseTo((20 - 11) / 13)
  })

  it('follows the kernel, and keeps an absent bar as a labelled gap, never a zero bar', () => {
    const m = compareModel(compare, on('ubuntu-18.04'))
    const total = m.bars.find((b) => b.id === 'buf-total')
    expect(total).toMatchObject({ status: 'absent', x: null, text: ABSENT })
    expect(m.bars.find((b) => b.id === 'buf-start').text).toBe('85.3 KiB')
    expect(m.to).toBe(2 ** 23)
    expect(m.ticks.at(-1).value).toBeLessThanOrEqual(m.to)
  })

  it('draws a linear scale at round numbers of the unit it reads in', () => {
    const fig = { kind: 'compare', title: 'Read ahead', axis: 'read ahead', scale: 'linear', bars: [{ id: 'a', label: 'SSD', value: { probe: 'x', unit: 'kB' } }, { id: 'b', label: 'HDD', value: { probe: 'y', unit: 'kB' } }] }
    const m = compareModel(fig, (ref) => ok(ref.probe === 'x' ? 128 : 256))
    expect(m.ticks.map((t) => t.text)).toEqual(['0 KiB', '100 KiB', '200 KiB', '300 KiB'])
    expect(m.bars.map((b) => b.x)).toEqual([128 / 300, 256 / 300])
    const plain = compareModel({ ...fig, bars: fig.bars.map((b) => ({ ...b, value: { ...b.value, unit: 'tasks' } })) }, (ref) => ok(ref.probe === 'x' ? 23000 : 4194304))
    expect(plain.to).toBe(5e6)
    expect(plain.ticks.map((t) => t.text)).toEqual(['0', '2M', '4M'])
  })

  it('draws no bars and no axis where nothing is measured, and says so', () => {
    const measuredOnly = { ...compare, marks: compare.marks.slice(0, 1), pins: compare.pins.slice(0, 2) }
    const m = compareModel(measuredOnly, on('arch'))
    expect(m.measured).toBe(false)
    expect(m.ticks).toEqual([])
    expect(m.bars.every((b) => b.x === null && b.text === NOT_MEASURED)).toBe(true)
    expect(compareCaption(measuredOnly, on('arch'), 'arch')).toContain('No values measured on arch yet')
    expect(compareLabel(measuredOnly, on('arch'))).not.toMatch(/\d{3,}/)
    // An example still draws, so the scale has something to hold.
    expect(compareModel(compare, on('arch')).marks[1].x).toBe(1)
  })

  it('reads the bars, the lines and the drawn settings in its label', () => {
    const label = compareLabel(compare, on('debian-13'), { defsByKey: DEMO_DEFS, highlight: 'buf-largest' })
    expect(label).toContain('Bars on a log scale of buffer size, log scale, 2 KiB to 16 MiB.')
    expect(label).toContain('Each socket: Sizes the kernel gives each new socket, and lets it grow to: Smallest 4 KiB: A socket keeps at least this much')
    expect(label).toContain('Largest 6 MiB: Automatic tuning grows a busy socket up to this (selected)')
    expect(label).toContain('Lines across the bars: Asked-for ceiling at 208 KiB')
    expect(label).toContain('Settings drawn: demo.buf_sizes on Largest; demo.buf_max on the asked-for ceiling line; demo.buf_auto on Largest.')
  })

  it('gives a pin the bars of its group or the line it sits on', () => {
    const [sizes, max, auto] = chapter('comparing-sizes').pins
    expect(pinRefs(compare, sizes).map((r) => r.label)).toEqual(['Largest buffer', 'Smallest', 'Start'])
    expect(pinRefs(compare, max).map((r) => r.label)).toEqual(['Asked-for ceiling'])
    // A pin with a value of its own shows that, not the bar it sits on.
    expect(pinRefs(compare, auto, DEMO_DEFS)).toEqual([{ example: 1, unit: '', label: 'Auto tuning' }])
    const unnamed = { ...compare, pins: [{ key: 'buf_max', bar: 'buf-total', value: { probe: 'demo.bufMax', unit: 'bytes' } }] }
    expect(pinRefs(unnamed, { key: 'buf_max', layer: 'buf-total' }, DEMO_DEFS)).toEqual([{ probe: 'demo.bufMax', unit: 'bytes', label: 'demo.buf_max' }])
  })
})

describe('tree', () => {
  it('lists the nodes top down with their depth and the connector rails', () => {
    const nodes = treeNodes(tree)
    expect(nodes.map((n) => [n.id, n.depth, n.last])).toEqual([
      ['root-slice', 0, true], ['system-slice', 1, false], ['web-service', 2, false], ['db-service', 2, true], ['user-slice', 1, true], ['login', 2, true],
    ])
    // Under the system slice the level-1 line runs on to the user slice; under the user slice it has ended.
    expect(nodes.find((n) => n.id === 'web-service').rails).toEqual([true])
    expect(nodes.find((n) => n.id === 'login').rails).toEqual([false])
  })

  it('reads each node with its value, its parent and the drawn setting', () => {
    const label = treeLabel(tree, on('debian-13'), { defsByKey: DEMO_DEFS, highlight: 'system-slice' })
    expect(label).toContain('Root slice, at the top: Holds every process on the machine')
    expect(label).toContain('System services 100, in Root slice: Holds the services the system starts (selected)')
    expect(label).toContain('Settings drawn: CPUWeight on System services.')
    expect(treeLabel(tree, on('debian-11'))).toContain(`User sessions ${ABSENT}, in Root slice`)
  })

  it('gives a pin the value of the node it sits on, or its own', () => {
    const pin = chapter('sharing-the-cpu').pins[0]
    expect(pinRefs(tree, pin)).toEqual([{ probe: 'demo.sliceWeight', unit: '', label: 'System CPU weight' }])
    const own = { ...tree, pins: [{ ...tree.pins[0], value: { example: 200, unit: '', label: 'A heavier slice' } }] }
    expect(pinRefs(own, pin, DEMO_DEFS)).toEqual([{ example: 200, unit: '', label: 'A heavier slice' }])
    expect(pinRefs(own, { ...pin, layer: 'user-slice' }, DEMO_DEFS).map((r) => r.label)).toEqual(['A heavier slice', 'User sessions'])
  })

  it('reads an example node like a measured one, and says which values are examples', () => {
    expect(treeLabel(tree, on('debian-13'))).toContain('Your login 100, in User sessions')
    expect(treeCaption(tree, on('debian-13'), 'Debian 13')).toBe(
      'Where a service runs. Login CPU weight is an example, to show the idea. The rest is measured on Debian 13, kernel 0.0.0-fixture.',
    )
  })
})

describe('modes', () => {
  const row = (options, extra = {}) => ({ options: options.map((value) => ({ value, label: String(value) })), ...extra })
  const lit = (segs) => segs.filter((s) => s.lit).map((s) => s.label)

  it('lights the option that equals the value, as text or number', () => {
    expect(lit(modeSegments(row(['always', 'madvise', 'never']), ok('madvise')))).toEqual(['madvise'])
    expect(lit(modeSegments(row([0, 1, 2]), ok('2')))).toEqual(['2'])
    expect(lit(modeSegments(row(['0', '1']), ok(1)))).toEqual(['1'])
  })

  it('adds a lit segment with the raw value when no option matches', () => {
    const segs = modeSegments(row([0, 1]), ok(438))
    expect(segs.at(-1)).toMatchObject({ label: '438', lit: true, extra: true })
    expect(lit(segs)).toEqual(['438'])
  })

  it('lights every set bit of a bits row, and the bits no option names as one more', () => {
    const bits = row([0, 2, 4, 8, 16, 32, 64, 128, 256], { bits: true })
    expect(lit(modeSegments(bits, ok(176)))).toEqual(['16', '32', '128'])
    expect(lit(modeSegments(bits, ok(0)))).toEqual(['0'])
    expect(lit(modeSegments(bits, ok(438)))).toEqual(['2', '4', '16', '32', '128', '256'])
    const rest = modeSegments(bits, ok(177))
    expect(rest.at(-1)).toMatchObject({ label: '1', lit: true, extra: true })
    expect(lit(modeSegments(bits, ok('16')))).toEqual(['16'])
    expect(lit(modeSegments(bits, ok('x')))).toEqual(['x'])
  })

  it('lights the range a number falls in, and a number no option holds as one more', () => {
    const ranged = { options: [{ value: 0, label: 'blocked' }, { min: 1, label: 'allowed' }] }
    expect(lit(modeSegments(ranged, ok(0)))).toEqual(['blocked'])
    expect(lit(modeSegments(ranged, ok(15000)))).toEqual(['allowed'])
    expect(lit(modeSegments(ranged, ok('15000')))).toEqual(['allowed'])
    const bounded = { options: [{ min: 1, max: 9, label: 'few' }, { min: 10, max: 99, label: 'many' }] }
    expect(lit(modeSegments(bounded, ok(9)))).toEqual(['few'])
    expect(lit(modeSegments(bounded, ok(10)))).toEqual(['many'])
    expect(modeSegments(bounded, ok(100)).at(-1)).toMatchObject({ label: '100', lit: true, extra: true })
    expect(modeSegments(bounded, ok('lots')).at(-1)).toMatchObject({ label: 'lots', lit: true, extra: true })
    expect(modeSegments(ranged, ok(1)).map((s) => s.key)).toEqual(['0', '1+'])
    expect(modeSegments(bounded, ok(1)).map((s) => s.key)).toEqual(['1-9', '10-99'])
    expect(rangeText({ min: 1 })).toBe('1 or more')
    expect(rangeText({ min: 1000, max: 3999 })).toBe('1,000 to 3,999')
  })

  it('lights nothing where the value is absent or not measured', () => {
    expect(lit(modeSegments(row(['a', 'b']), { status: 'absent', reason: 'no disk' }))).toEqual([])
    expect(lit(modeSegments(row(['a', 'b']), { status: 'missing' }))).toEqual([])
    const m = modesModel(modes, on('debian-11'))
    expect(m.rows.find((r) => r.id === 'hdd-scheduler')).toMatchObject({ status: 'absent', text: ABSENT })
  })

  it('follows the kernel, by group', () => {
    const m = modesModel(modes, on('ubuntu-18.04'))
    expect(m.groups.map((g) => g.rows.map((r) => [r.id, r.text]))).toEqual([
      [['page-mode', 'when asked'], ['key-mask', '1'], ['reserve-size', 'small']],
      [['ssd-scheduler', 'none'], ['hdd-scheduler', 'bfq']],
    ])
    expect(modesModel(modes, on('debian-13')).rows[2].text).toBe('large')
    expect(modesModel(modes, on('debian-13')).rows[1].text).toBe('console level + keyboard + sync + remount read-only + reboot + nice real-time')
  })

  it('reads the rows, the value set and the settings in its label', () => {
    const label = modesLabel(modes, on('fedora-43'), { defsByKey: DEMO_DEFS, highlight: 'disks' })
    expect(label).toContain('Kernel: Huge pages (When the kernel backs memory with huge pages), set by demo.page_mode: always (set), when asked (Only memory a program marks for it), never')
    expect(label).toContain('Disks (Each disk picks its own scheduler) (selected): SSD, set by demo.scheduler: none, mq-deadline (set), bfq')
    expect(modesLabel(modes, on('ubuntu-18.04'))).toContain('1 (set, not a listed value)')
    expect(modesLabel(modes, on('debian-11'))).toContain(`Hard disk: none, mq-deadline, bfq, kyber; ${ABSENT}`)
    // A lit range says the number it holds.
    expect(modesLabel(modes, on('debian-13'))).toContain('Reserve: none, small, large (set, 4,000) (Four thousand kB or more)')
  })

  it('gives a pin its row, or every row of the group it names, or its own value', () => {
    const pins = chapter('picking-a-mode').pins
    expect(pinRefs(modes, pins[0]).map((r) => r.label)).toEqual(['Huge pages'])
    // The SSD row draws the scheduler with an example of its own, which stands in for the row's value.
    expect(pinRefs(modes, pins[2], DEMO_DEFS).map((r) => r.label)).toEqual(['Fast disk choice', 'Hard disk'])
  })

  it('says when every lit value is an example', () => {
    const examples = { ...modes, rows: [{ ...modes.rows[0], value: { example: 'never', unit: '', label: 'Huge pages' } }] }
    expect(modesCaption(examples, on('debian-13'), 'Debian 13')).toBe('Modes set on this kernel. The lit segment is the example value. Example values, to show the idea.')
    expect(lit(modesModel(examples, on('debian-13')).rows[0].segments)).toEqual(['never'])
  })
})

describe('any v3 figure', () => {
  it('names the settings each figure draws itself', () => {
    expect(drawnPinKeys(compare)).toEqual(['buf_sizes', 'buf_max', 'buf_auto'])
    expect(drawnPinKeys(tree)).toEqual(['unit_weight'])
    // A modes row's setting stays in the row under the figure, out of the crowded row.
    expect(drawnPinKeys(modes)).toEqual([])
    expect(drawnPinKeys(chapter('keeping-a-reserve').figure)).toEqual([])
  })

  it('has a label for each kind, and the kernel switcher where the values differ', () => {
    for (const fig of [compare, tree, modes]) {
      expect(figureLabel(fig, on('debian-13'), { defsByKey: DEMO_DEFS }).length).toBeGreaterThan(60)
      expect(sameOnEveryImage(figureRefs(fig), IMAGE_IDS, valueFor)).toBe(false)
    }
    const steady = { ...modes, rows: modes.rows.slice(3, 4) }
    expect(sameOnEveryImage(figureRefs(steady), IMAGE_IDS, valueFor)).toBe(false)
    const same = { ...tree, root: { ...tree.root, children: [tree.root.children[0]] } }
    expect(sameOnEveryImage(figureRefs(same), IMAGE_IDS, valueFor)).toBe(true)
  })

  it('has no em dash in any label', () => {
    for (const image of IMAGE_IDS) for (const fig of [compare, tree, modes]) expect(figureLabel(fig, on(image), { defsByKey: DEMO_DEFS })).not.toContain('—')
  })
})

describe('compare log axis start', () => {
  const fig = (values) => ({
    kind: 'compare', title: 't', axis: 'files', scale: 'log',
    bars: values.map((v, i) => ({ id: `b${i}`, label: `B${i}`, value: { example: v, unit: '', label: `B${i}` } })),
  })
  const ex = (ref) => ({ status: 'ok', value: ref.example })
  it('starts a power lower when the smallest value is just above a power, so its bar has a length', () => {
    // 1,024 sits a fifth of a power above 1,000: the axis starts at 100.
    expect(compareModel(fig([1024, 524288]), ex).from).toBe(100)
    // 3,000 is well above 1,000: the axis starts at 1,000.
    expect(compareModel(fig([3000, 524288]), ex).from).toBe(1000)
  })
})
