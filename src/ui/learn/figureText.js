/**
 * The words and geometry of the learning-page figures (Design.md §5
 * "Learning pages > Figures"), as plain JS so the Vue components and the
 * prerendered page (L5, src/static) say the same thing. Everything is built
 * from the guide's data and the evidence; nothing here knows a tuner.
 *
 * `evidence` is always a function `ref => result`, where result is
 * valueFor()'s `{ status, value, kernel, capturedAt }` or
 * `{ status: 'missing' }` (src/learn/evidence.js). A value that isn't `ok`
 * is never shown as a number.
 */

import { parseRichText } from '../richText.js'

export const NOT_MEASURED = 'not measured'
export const ABSENT = 'not present on this kernel'

/** A ValueRef for a card's or node's bare `probe` id. */
export const probeRef = (probe) => ({ probe, path: '', unit: '' })

/** The ValueRef of a card or node: its `probe`, with its `path` and `unit` when it has them. */
export const itemRef = (item) => ({ probe: item.probe, path: item.path ?? '', unit: item.unit ?? '' })

/** A card's or node's measured value as text. */
export const itemValue = (item, evidence) => {
  const ref = itemRef(item)
  return formatValue(evidence(ref), ref.unit)
}

/**
 * The value line a card or node shows, or '' for none. A probe that only
 * measured "this part exists" (true) adds nothing the drawn part doesn't
 * already say, so it shows no line; a part missing on the kernel still says so.
 */
export const shownItemValue = (item, evidence) => {
  if (!item.probe) return ''
  const r = evidence(itemRef(item))
  return r?.status === 'ok' && r.value === true ? '' : itemValue(item, evidence)
}

function plural(unit, n) {
  if (!unit) return ''
  return n === 1 && unit.endsWith('s') ? ` ${unit.slice(0, -1)}` : ` ${unit}`
}

/** Units counted in bytes, with how many bytes one of them is ('kB' is the kernel's KiB). */
export const BYTE_UNITS = Object.freeze({ bytes: 1, kB: 1024 })
export const isByteUnit = (unit) => typeof unit === 'string' && Object.hasOwn(BYTE_UNITS, unit)
const BINARY = ['bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB']

/** A number to one decimal where that helps: 94.8, 6, 1,024. */
const shortNum = (x) => (Number.isInteger(x) ? x.toLocaleString('en-US') : Math.abs(x) < 100 ? (Math.round(x * 10) / 10).toLocaleString('en-US') : Math.round(x).toLocaleString('en-US'))

/**
 * A size in a byte unit as people read it: 6291456 bytes is "6 MiB", 97076 kB
 * "94.8 MiB", 128 kB "128 KiB". The kernel's kB is 1024 bytes.
 */
export function humanBytes(v, unit) {
  const b = v * BYTE_UNITS[unit]
  let k = unit === 'kB' ? 1 : 0
  while (k < BINARY.length - 1 && Math.abs(b) >= 1024 ** (k + 1)) k++
  const x = b / 1024 ** k
  if (k === 0) return `${x.toLocaleString('en-US')} ${x === 1 ? 'byte' : 'bytes'}`
  return `${shortNum(x)} ${BINARY[k]}`
}

/** A number with its unit as measured, singular for one: "6,291,456 bytes". */
const exactNumber = (v, unit) => `${v.toLocaleString('en-US')}${plural(unit, v)}`

/**
 * One evidence result as text: a number with its unit, a string, yes/no, a
 * list, or "not measured" / "not present on this kernel". A number in bytes
 * or kB reads in KiB, MiB or GiB; `exact` adds the number as measured after
 * it, "6 MiB (6,291,456 bytes)", for the tooltip, the panel and the static page.
 * @param {{ status: string, value?: unknown }} result
 * @param {string} [unit]
 * @param {{ exact?: boolean }} [opts]
 */
export function formatValue(result, unit = '', { exact = false } = {}) {
  if (!result || result.status === 'missing') return NOT_MEASURED
  if (result.status === 'absent') return ABSENT
  if (result.status !== 'ok') return NOT_MEASURED
  const v = result.value
  if (typeof v === 'number' && Number.isFinite(v)) {
    const raw = exactNumber(v, unit)
    if (!isByteUnit(unit)) return raw
    const human = humanBytes(v, unit)
    return exact && human !== raw ? `${human} (${raw})` : human
  }
  if (typeof v === 'string') {
    // A whole number too big for a double (fs.file-max, shmmax) stays a
    // string in the evidence; group its digits so it reads as a number.
    const text = /^\d{16,}$/.test(v) ? BigInt(v).toLocaleString('en-US') : v
    return unit ? `${text} ${unit}` : text
  }
  if (typeof v === 'boolean') return v ? 'yes' : 'no'
  if (Array.isArray(v) && v.every((x) => typeof x === 'string' || typeof x === 'number')) return v.length ? v.join(', ') : 'none'
  return NOT_MEASURED
}

/** What a ValueRef is called in a figure: its label, else its path, else the probe id. */
export const refName = (ref) => ref.label || ref.path || ref.probe

/**
 * Whether a ValueRef is an example (`{ example, unit, label }`): a value the
 * guide typed in to show the idea, the same on every image, never measured.
 */
export const isExample = (ref) => ref !== null && typeof ref === 'object' && Object.hasOwn(ref, 'example')

/** "min: 2,000 pages", "min: not measured" or "RAM: 16 GiB (example)"; `exact` as in formatValue. */
export const measuredText = (ref, evidence, { exact = false } = {}) =>
  `${refName(ref)}: ${formatValue(evidence(ref), ref.unit, { exact })}${isExample(ref) ? ' (example)' : ''}`

/** A ref named by the part that shows it, unless it has a label of its own. */
export const named = (ref, label) => (ref && !ref.label && label ? { ...ref, label } : ref)

/**
 * The kernel the figure's values were measured on: the first `ok` or
 * `absent` result's kernel, or null when none of them was measured.
 * @param {object[]} refs
 * @param {(ref: object) => object} evidence
 */
export function kernelOf(refs, evidence) {
  for (const ref of refs) {
    const r = evidence(ref)
    if (r && (r.status === 'ok' || r.status === 'absent') && r.kernel) return r.kernel
  }
  return null
}

/**
 * Whether every image measured the same thing for every ref: each ref is
 * `ok` with one value on all of them. A kernel picker would then change
 * nothing, so the page shows one caption instead (sameOnText). Pass the
 * measured refs only: an example is the same everywhere by definition.
 * @param {object[]} refs
 * @param {string[]} imageIds
 * @param {(ref: object, imageId: string) => object} valueAt
 */
export function sameOnEveryImage(refs, imageIds, valueAt) {
  if (!refs.length || imageIds.length < 2) return false
  return refs.every((ref) => {
    const results = imageIds.map((id) => valueAt(ref, id))
    if (!results.every((r) => r?.status === 'ok')) return false
    const first = JSON.stringify(results[0].value)
    return results.every((r) => JSON.stringify(r.value) === first)
  })
}

/** A tip (`does`) as plain words, for labels and descriptions: its markup gone. */
export const plainTip = (tip) => (typeof tip === 'string' ? parseRichText(tip).map((seg) => seg.text).join('') : '')

/**
 * The value line of a part's tooltip: its value with the kernel it was
 * measured on, "on all N test kernels" when every image agrees, or
 * "example" for an example value.
 */
export function tipValue(ref, evidence, sameOn = 0) {
  const r = evidence(ref)
  const text = formatValue(r, ref.unit, { exact: true })
  if (isExample(ref)) return `${text}, example`
  if (sameOn && r?.status === 'ok') return `${text} on all ${sameOn} test kernels`
  return r?.kernel && (r.status === 'ok' || r.status === 'absent') ? `${text}, kernel ${r.kernel}` : text
}

/** The caption of a figure whose values are the same on every image. */
export const sameOnText = (count) => `Values measured on ${count} test kernels, the same on each.`

/** The caption of a figure whose values are all examples. */
export const EXAMPLES_TEXT = 'Example values, to show the idea.'

/** A list in a sentence: "a", "a and b", "a, b and c". */
const andList = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`)

/**
 * The line under a figure that says where its numbers come from: "Measured
 * on Debian 13, kernel 6.12.48.", the same-on-every-kernel caption when
 * `sameOn` counts the images, "Example values, to show the idea." when every
 * value is an example, and for a mix the examples by name first ("RAM and
 * File cache are examples, to show the idea. The rest is measured on ...").
 * `image` is the name the reader sees (the image's label).
 */
export function measuredOn(refs, evidence, image, sameOn = 0) {
  if (!refs.length) return ''
  const measured = refs.filter((r) => !isExample(r))
  if (!measured.length) return EXAMPLES_TEXT
  const kernel = kernelOf(measured, evidence)
  const examples = [...new Set(refs.filter(isExample).map(refName))]
  if (!examples.length) {
    if (sameOn) return sameOnText(sameOn)
    return kernel ? `Measured on ${image}, kernel ${kernel}.` : `Not measured on ${image} yet.`
  }
  const rest = sameOn ? `the same on all ${sameOn} test kernels` : kernel ? `measured on ${image}, kernel ${kernel}` : `not measured on ${image} yet`
  return `${andList(examples)} ${examples.length > 1 ? 'are examples' : 'is an example'}, to show the idea. The rest is ${rest}.`
}

/**
 * Which values a drawing shows are examples, as a sentence, or '' for none:
 * "Example values, to show the idea." when all are, else "RAM is an
 * example, to show the idea."
 */
export function examplesNote(refs) {
  const examples = [...new Set(refs.filter(isExample).map(refName))]
  if (!examples.length) return ''
  if (examples.length === refs.length) return EXAMPLES_TEXT
  return `${andList(examples)} ${examples.length > 1 ? 'are examples' : 'is an example'}, to show the idea.`
}

/** The refs of a figure that are measured, not examples: what the kernel buttons switch. */
export const measuredRefs = (refs) => refs.filter((r) => !isExample(r))

// Parts map ------------------------------------------------------------------

/** Columns and rows the cards occupy. */
export function gridSize(parts) {
  return {
    cols: Math.max(1, ...parts.cards.map((c) => c.col)),
    rows: Math.max(1, ...parts.cards.map((c) => c.row)),
  }
}

/** The cards grouped by band, in reading order, for the phone list and the label. */
export function cardGroups(parts) {
  const order = [...parts.cards].sort((a, b) => a.row - b.row || a.col - b.col)
  const bands = parts.bands ?? []
  const groups = bands.map((band) => ({
    label: band.label,
    cards: order.filter((c) => c.row >= band.rows[0] && c.row <= band.rows[1]),
  }))
  const banded = new Set(groups.flatMap((g) => g.cards.map((c) => c.id)))
  // Cards outside every band, grouped by run of rows, so the list reads top down.
  const rest = []
  for (const card of order.filter((c) => !banded.has(c.id))) {
    const last = rest.at(-1)
    const inBand = (row) => bands.some((b) => row >= b.rows[0] && row <= b.rows[1])
    if (last && !Array.from({ length: card.row - last.cards.at(-1).row }, (_, i) => last.cards.at(-1).row + i + 1).some(inBand)) last.cards.push(card)
    else rest.push({ label: null, cards: [card] })
  }
  const first = (g) => Math.min(...g.cards.map((c) => c.row))
  return [...groups, ...rest].filter((g) => g.cards.length).sort((a, b) => first(a) - first(b))
}

/** "A to B: label" for each edge, by the cards' titles. */
export function edgeRows(parts) {
  const title = (id) => parts.cards.find((c) => c.id === id)?.title ?? id
  return parts.edges.map((e) => ({ ...e, text: `${title(e.from)} to ${title(e.to)}: ${e.label}` }))
}

function cardText(card, evidence) {
  const shown = shownItemValue(card, evidence)
  const value = shown ? `, measured ${shown}` : ''
  return `${card.title}, ${plainTip(card.does)}${value}`
}

export function partsMapLabel(parts, evidence) {
  const groups = cardGroups(parts).map((g) => {
    const cards = g.cards.map((c) => cardText(c, evidence)).join('; ')
    return g.label ? `${g.label}: ${cards}.` : `${cards}.`
  })
  const edges = edgeRows(parts).map((e) => e.text)
  return [
    `Parts map. ${groups.join(' ')}`,
    edges.length ? `Connections: ${edges.join('. ')}.` : '',
    parts.scale ? scaleLabel(parts.scale, evidence) : '',
  ].filter(Boolean).join(' ')
}

// Scale bar --------------------------------------------------------------------

/** The fills of a scale bar's measured segments, in order; the rest is hatched. */
export const SCALE_TONES = Object.freeze(['ink', 'fit', 'quiet'])

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)

/** A share of a whole as a percentage, one decimal under 10 %. */
export const percent = (share) => `${(share * 100).toFixed(share < 0.1 ? 1 : 0)} %`

/**
 * A scale bar (`parts.scale`) on one image: each measured segment's share of
 * the total, drawn to scale. A total or segment that isn't measured has no
 * share (null), so nothing is drawn for it and its text says "not measured";
 * shares that add up past the total are scaled down to fit.
 */
export function scaleModel(scale, evidence) {
  const totalResult = evidence(scale.total)
  const total = totalResult?.status === 'ok' && isNum(totalResult.value) && totalResult.value > 0 ? totalResult.value : null
  let measured = 0
  const segments = scale.segments.map((seg) => {
    if (!seg.value) return { ...seg, rest: true, tone: null, share: null, text: '', ref: null }
    const r = evidence(seg.value)
    const v = r?.status === 'ok' && isNum(r.value) && r.value >= 0 ? r.value : null
    return { ...seg, rest: false, tone: SCALE_TONES[measured++] ?? 'quiet', share: total !== null && v !== null ? v / total : null, text: formatValue(r, seg.value.unit), ref: seg.value }
  })
  const sum = segments.reduce((a, seg) => a + (seg.share ?? 0), 0)
  if (sum > 1) for (const seg of segments) if (seg.share !== null) seg.share /= sum
  return { label: scale.label, total, totalText: formatValue(totalResult, scale.total.unit), segments }
}

/** Every ValueRef a scale bar reads. */
export const scaleRefs = (scale) => [scale.total, ...scale.segments.filter((seg) => seg.value).map((seg) => seg.value)]

export function scaleLabel(scale, evidence) {
  const m = scaleModel(scale, evidence)
  const parts = m.segments.map((seg) => {
    const tip = seg.does ? `: ${plainTip(seg.does).replace(/\.$/, '')}` : ''
    if (seg.rest) return `${seg.label}, the rest${tip}`
    return `${seg.label}, ${seg.text}${seg.share !== null ? `, ${percent(seg.share)}` : ''}${tip}`
  })
  const note = examplesNote(scaleRefs(scale))
  return `${scale.label}, ${m.totalText}, drawn to scale: ${parts.join('; ')}.${note ? ` ${note}` : ''}`
}

/**
 * Where an edge sits on the overlay over the card grid, as CSS lengths built
 * from the grid's tracks (equal columns, equal rows) and the gaps, so it
 * needs no measuring and no per-guide pixels. Edges join cards that share a
 * row or a column (the contract suite checks); any other edge returns null.
 * @returns {{ axis: 'x'|'y', reverse: boolean, style: Record<string,string> } | null}
 */
export function edgeGeometry(parts, edge, gapX, gapY) {
  const from = parts.cards.find((c) => c.id === edge.from)
  const to = parts.cards.find((c) => c.id === edge.to)
  if (!from || !to || from === to) return null
  const { cols, rows } = gridSize(parts)
  const w = `((100% - ${cols - 1} * ${gapX}) / ${cols})`
  const h = `((100% - ${rows - 1} * ${gapY}) / ${rows})`
  if (from.row === to.row) {
    const [a, b] = [Math.min(from.col, to.col), Math.max(from.col, to.col)]
    return {
      axis: 'x',
      reverse: from.col > to.col,
      style: {
        left: `calc(${a} * ${w} + ${a - 1} * ${gapX})`,
        width: `calc(${b - a - 1} * ${w} + ${b - a} * ${gapX})`,
        top: `calc(${from.row - 1} * (${h} + ${gapY}) + ${h} / 2)`,
      },
    }
  }
  if (from.col === to.col) {
    const [a, b] = [Math.min(from.row, to.row), Math.max(from.row, to.row)]
    return {
      axis: 'y',
      reverse: from.row > to.row,
      style: {
        top: `calc(${a} * ${h} + ${a - 1} * ${gapY})`,
        height: `calc(${b - a - 1} * ${h} + ${b - a} * ${gapY})`,
        left: `calc(${from.col - 1} * (${w} + ${gapX}) + ${w} / 2)`,
      },
    }
  }
  return null
}

// Stack ----------------------------------------------------------------------

/** Every ValueRef a stack shows: the layers' values and the nodes' probes. */
export function stackRefs(figure) {
  return figure.layers.flatMap((layer) => [
    ...(layer.values ?? []),
    ...(layer.nodes ?? []).filter((n) => n.probe).map((n) => named(itemRef(n), n.text)),
  ])
}

function nodeText(node, evidence) {
  const shown = shownItemValue(node, evidence)
  const parts = [node.text, node.sub, shown ? `measured ${shown}` : null]
  const does = node.does ? `: ${plainTip(node.does).replace(/\.$/, '')}` : ''
  return `${parts.filter(Boolean).join(', ')}${does}`
}

const bandText = (band) => (band.does ? `${band.text}: ${plainTip(band.does).replace(/\.$/, '')}` : band.text)

export function stackLabel(figure, evidence, highlight = null) {
  const layers = figure.layers.map((layer) => {
    const items = layer.kind === 'bands'
      ? (layer.bands ?? []).map((b) => (b.id === highlight ? `${bandText(b)} (selected)` : bandText(b)))
      : (layer.nodes ?? []).map((n) => (n.id === highlight ? `${nodeText(n, evidence)} (selected)` : nodeText(n, evidence)))
    const values = (layer.values ?? []).map((r) => measuredText(r, evidence))
    const name = layer.id === highlight ? `${layer.label} (selected)` : layer.label
    return `${name}: ${[...items, ...values].join('; ')}.`
  })
  return `${figure.title}. Layers from the top. ${layers.join(' ')}`
}

// Timeline -------------------------------------------------------------------

/**
 * Where each line sits, 0 (bottom) to 1 (top). The figure is schematic, so
 * the lines are spaced evenly in the order the guide lists them, first at the
 * top: line i of n at (n - i) / (n + 1). Their measured values are labels,
 * not positions, so a missing capture never moves the picture.
 */
export const lineLevels = (lines) => lines.map((_, i) => (lines.length - i) / (lines.length + 1))

/** The curve as an SVG path in a 0..100 box, y pointing down. */
export function curvePath(curve) {
  return curve
    .map(([t, level], i) => `${i ? 'L' : 'M'}${(t * 100).toFixed(2)} ${((1 - level) * 100).toFixed(2)}`)
    .join(' ')
}

export function timelineLabel(figure, evidence) {
  const lines = figure.lines.map((l) => `${l.label} at ${formatValue(evidence(l.value), l.value.unit)}${l.does ? ` (${plainTip(l.does).replace(/\.$/, '')})` : ''}`)
  const events = [...figure.events].sort((a, b) => a.at - b.at).map((e) => (e.does ? `${e.label} (${plainTip(e.does).replace(/\.$/, '')})` : e.label))
  return [
    `${figure.title}. Schematic timeline, not to scale.`,
    lines.length ? `Lines from the top: ${lines.join('; ')}.` : '',
    events.length ? `In order: ${events.join(', then ')}.` : '',
  ].filter(Boolean).join(' ')
}

// Side by side ---------------------------------------------------------------

export const settingText = (setting, defsByKey = {}) => `${defName(setting.key, defsByKey)} = ${setting.value}`

/** The words for a side-by-side's cells: the figure's legend, or plain lit and not lit. */
export function sideBySideLegend(figure) {
  return { asked: 'asked for', lit: 'lit', off: 'not lit', ...(figure.legend ?? {}) }
}

/**
 * Each cell of a state: 'asked' (the one the request was for), 'lit' or
 * 'off'. Lit cells run from `start` (0 when unset).
 */
export function cellKinds(state) {
  const start = state.start ?? 0
  return Array.from({ length: state.cells }, (_, i) => {
    if (i < start || i >= start + state.lit) return 'off'
    return i === state.asked ? 'asked' : 'lit'
  })
}

/** "1 asked for, 7 read along, 4 stays on disk" for one state. */
export function cellCounts(state, legend) {
  const kinds = cellKinds(state)
  const n = (k) => kinds.filter((x) => x === k).length
  return [n('asked') ? `${n('asked')} ${legend.asked}` : null, `${n('lit')} ${legend.lit}`, `${n('off')} ${legend.off}`].filter(Boolean).join(', ')
}

export function sideBySideLabel(figure, defsByKey = {}) {
  const legend = sideBySideLegend(figure)
  const states = figure.states.map((s) => `${s.label}, ${settingText(s.setting, defsByKey)}: ${cellCounts(s, legend)}, of ${s.cells}`)
  return `${figure.title}. Side by side. ${states.join('. ')}.`
}

export function backedByText(backedBy) {
  if (!backedBy) return ''
  if (backedBy.vmTest) return `Checked on real kernels by the VM test "${backedBy.vmTest}".`
  if (backedBy.probe) return `Checked on real kernels by the probe ${backedBy.probe}.`
  return ''
}

// Gauge ----------------------------------------------------------------------

/** A round number at least 15 % above v, for the top of a scale: 8,492 gives 10,000. */
export function niceTop(v) {
  if (!(v > 0)) return 1
  const raw = v * 1.15
  const p = 10 ** Math.floor(Math.log10(raw))
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= raw - 1e-9) return m * p
  return 10 * p
}

/** Tick values from `from` to `to` at a round step, at most five steps. */
export function scaleTicks(from, to) {
  const span = to - from
  if (!(span > 0)) return []
  const raw = span / 4
  const p = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((x) => x >= raw - 1e-9)
  const out = []
  for (let v = Math.ceil(from / step - 1e-9) * step; v <= to + 1e-9; v += step) out.push(Number(v.toPrecision(12)))
  return out
}

const clamp01 = (x) => Math.min(1, Math.max(0, x))
const fmt = (v) => v.toLocaleString('en-US')

/**
 * A gauge on one image, everything as a height 0 (foot) to 1 (top) on one
 * scale. When every mark is measured and in order, the scale runs over
 * `range` (or 0 to niceTop of the top mark, widened to hold every mark) and
 * the marks sit at their values; otherwise it is a schematic with the marks
 * evenly spaced, no ticks and no zoom bracket, and nothing reads as a number.
 */
export function gaugeModel(figure, evidence) {
  const unit = figure.marks[0]?.value?.unit ?? ''
  const marks = figure.marks.map((m) => {
    const r = evidence(m.value)
    const v = r?.status === 'ok' && isNum(r.value) ? r.value : null
    return { ...m, v, text: formatValue(r, m.value.unit), num: v === null ? formatValue(r, m.value.unit) : fmt(v), result: r }
  })
  const values = marks.map((m) => m.v)
  const measured = values.length > 0 && values.every((v) => v !== null) && values.every((v, i) => i === 0 || v >= values[i - 1])
  let from = 0
  let to = 1
  if (measured) {
    const lo = Math.min(...values)
    const hi = Math.max(...values)
    from = Math.min(figure.range?.from ?? 0, lo)
    to = figure.range?.to ?? niceTop(hi)
    if (hi > to) to = niceTop(hi)
    if (to <= from) to = from + niceTop(Math.abs(from) || 1)
  }
  const at = (v) => clamp01((v - from) / (to - from))
  marks.forEach((m, i) => (m.y = measured ? at(m.v) : (i + 1) / (marks.length + 1)))
  const yOf = (id) => marks.find((m) => m.id === id)?.y
  const zones = figure.zones.map((z) => ({ ...z, y0: z.from ? yOf(z.from) ?? 0 : 0, y1: z.to ? yOf(z.to) ?? 1 : 1 }))
  const ticks = measured ? scaleTicks(from, to).map((v) => ({ value: v, y: at(v), text: fmt(v) })) : []

  let zoom = null
  if (figure.zoom) {
    const r = evidence(figure.zoom.full)
    const full = r?.status === 'ok' && isNum(r.value) && r.value > 0 ? r.value / (figure.zoom.fullPerUnit ?? 1) : null
    const bracket = measured && full !== null ? { y0: clamp01(from / full), y1: clamp01(to / full) } : null
    zoom = { label: figure.zoom.label, text: formatValue(r, figure.zoom.full.unit), bracket }
  }

  let curve = null
  if (figure.curve) {
    // Level 0 is the foot, k the k-th mark, marks + 1 the top.
    const knots = [0, ...marks.map((m) => m.y), 1]
    const levelY = (level) => {
      const i = Math.min(Math.floor(level), knots.length - 2)
      return knots[i] + (knots[i + 1] - knots[i]) * (level - i)
    }
    const pts = figure.curve.points.map(([t, level]) => [t, levelY(level)])
    const yAt = (t) => {
      if (t <= pts[0][0]) return pts[0][1]
      for (let i = 1; i < pts.length; i++) {
        const [t1, y1] = pts[i]
        const [t0, y0] = pts[i - 1]
        if (t <= t1) return t1 === t0 ? y1 : y0 + ((y1 - y0) * (t - t0)) / (t1 - t0)
      }
      return pts.at(-1)[1]
    }
    curve = {
      path: pts.map(([t, y], i) => `${i ? 'L' : 'M'}${(t * 100).toFixed(2)} ${((1 - y) * 100).toFixed(2)}`).join(' '),
      events: [...(figure.curve.events ?? [])].sort((a, b) => a.at - b.at).map((e, i) => ({ ...e, n: i + 1, x: e.at, y: yAt(e.at) })),
    }
  }

  const pins = (figure.pins ?? []).map((p) => (p.mark ? { ...p, y: yOf(p.mark) } : { ...p, y0: yOf(p.from), y1: yOf(p.to) }))

  // The fill from the foot to one value, drawn only on a gauge drawn to scale.
  let level = null
  if (figure.level) {
    const r = evidence(figure.level.value)
    const v = r?.status === 'ok' && isNum(r.value) ? r.value : null
    level = { ...figure.level, v, y: measured && v !== null ? at(v) : null, text: formatValue(r, figure.level.value.unit), num: v === null ? formatValue(r, figure.level.value.unit) : fmt(v) }
  }
  return { measured, unit, from, to, marks, zones, ticks, zoom, level, curve, pins }
}

/** Every ValueRef a gauge shows: its marks, the zoom's whole range, the level and the pins' own values. */
export function gaugeRefs(figure) {
  return [
    ...figure.marks.map((m) => m.value),
    ...(figure.zoom ? [figure.zoom.full] : []),
    ...(figure.level ? [figure.level.value] : []),
    ...(figure.pins ?? []).filter((p) => p.value).map((p) => p.value),
  ]
}

/** Where a gauge pin sits, in words: "on min" or "from min to high". */
export function gaugePinPlace(figure, pin) {
  const name = (id) => figure.marks.find((m) => m.id === id)?.label ?? id
  return pin.mark ? `on ${name(pin.mark)}` : `from ${name(pin.from)} to ${name(pin.to)}`
}

/** The axis line under a gauge: "free pages, 0 to 10,000", or that it is a schematic. */
export function gaugeAxisText(figure, model) {
  return model.measured ? `${figure.axis}, ${fmt(model.from)} to ${fmt(model.to)}${model.unit && !figure.axis.endsWith(model.unit) ? ` ${model.unit}` : ''}` : `${figure.axis}, schematic`
}

/** A label inside a sentence: its first letter lower case, so "All RAM" reads "all RAM". */
export const inSentence = (label) => (label ? label[0].toLowerCase() + label.slice(1) : '')

/** What the zoom bar shows, as a sentence, or '' without a zoom. */
export function zoomText(figure, model) {
  if (!model.zoom) return ''
  const { label, text, bracket } = model.zoom
  if (!bracket) return `The thin bar is ${inSentence(label)}, ${text}.`
  return `The thin bar is ${inSentence(label)}, ${text}; the bracket at its foot is the part drawn large, ${percent(bracket.y1 - bracket.y0)} of it.`
}

/** The caption under a gauge: where its numbers come from, or why it is a schematic. */
export function gaugeCaption(figure, evidence, imageId, sameOn = 0) {
  const model = gaugeModel(figure, evidence)
  const parts = [`${figure.title}.`]
  if (!model.measured) parts.push(`Schematic: the marks are not measured on ${imageId}, so they are evenly spaced.`)
  else parts.push('Drawn to scale.')
  const zoom = zoomText(figure, model)
  if (zoom) parts.push(zoom)
  if (figure.curve) parts.push('The curve is schematic: its shape and order are real, the times are not.')
  if (model.measured) parts.push(measuredOn(gaugeRefs(figure), evidence, imageId, sameOn))
  return parts.filter(Boolean).join(' ')
}

export function gaugeLabel(figure, evidence, { defsByKey = {}, highlight = null } = {}) {
  const model = gaugeModel(figure, evidence)
  const tip = (x) => (x.does ? `: ${plainTip(x.does).replace(/\.$/, '')}` : '')
  const sel = (id) => (id === highlight ? ' (selected)' : '')
  const marks = [...model.marks].reverse().map((m) => `${m.label} ${m.text}${tip(m)}${sel(m.id)}`)
  const name = (id) => model.marks.find((m) => m.id === id)?.label ?? id
  const zones = [...model.zones]
    .sort((a, b) => b.y1 - a.y1 || b.y0 - a.y0)
    .map((z) => `${z.label} (${z.from ? (z.to ? `${name(z.from)} to ${name(z.to)}` : `above ${name(z.from)}`) : `below ${name(z.to)}`})${tip(z)}${sel(z.id)}`)
  const out = [
    `${figure.title}.`,
    model.measured ? `A scale of ${gaugeAxisText(figure, model)}, drawn to scale.` : `A schematic scale of ${figure.axis}: the marks are not measured on this kernel.`,
  ]
  const zoom = zoomText(figure, model)
  if (zoom) out.push(zoom)
  if (model.level?.y != null) out.push(`Filled to ${inSentence(model.level.label)}, ${model.level.text}${tip(model.level)}.`)
  out.push(`Marks from the top: ${marks.join('; ')}.`, `Zones from the top: ${zones.join('; ')}.`)
  if (model.pins.length) out.push(`Settings on the scale: ${model.pins.map((p) => `${defName(p.key, defsByKey)} ${gaugePinPlace(figure, p)}`).join('; ')}.`)
  if (model.curve) {
    const events = model.curve.events.map((e) => `${e.label}${tip(e)}`)
    out.push(`A schematic curve over time, not to scale${events.length ? `: ${events.join(', then ')}` : ''}.`)
  }
  return out.join(' ')
}

// Compare ----------------------------------------------------------------------

/**
 * The powers of `base` a log axis from base^lo to base^hi ticks at: every
 * s-th power, s the smallest step that keeps it to five ticks (for bytes 1 to 5
 * or 10 powers of two, so 4 KiB, 16 KiB, ... or 1 KiB, 1 MiB, 1 GiB).
 * Every tick lies on the axis.
 */
export function logTicks(lo, hi, base = 10) {
  const steps = base === 2 ? [1, 2, 3, 4, 5, 10] : [1, 2, 3]
  const count = (s) => Math.floor(hi / s) - Math.ceil(lo / s) + 1
  const s = steps.find((x) => count(x) <= 5) ?? steps.at(-1)
  const out = []
  for (let e = Math.ceil(lo / s) * s; e <= hi; e += s) out.push(e)
  return out
}

const COMPACT = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })

/** A tick's words: a size for a byte unit, "10K" or "1M" for big numbers, else the number. */
export function tickText(v, unit) {
  if (isByteUnit(unit)) return humanBytes(v, unit)
  return Math.abs(v) >= 10000 ? COMPACT.format(v) : fmt(v)
}

function readNumber(ref, evidence, unit) {
  const result = evidence(ref)
  const v = result?.status === 'ok' && isNum(result.value) ? result.value : null
  const status = v !== null ? 'ok' : result?.status === 'absent' ? 'absent' : 'missing'
  return { v, status, result, text: formatValue(result, unit) }
}

/**
 * A compare figure on one image: one bar per item on one shared scale,
 * `linear` from 0 to a round top, or `log` from the power of 2 (bytes) or 10
 * below the smallest value (one further down when it is a power itself, so
 * its bar never has zero length) to the one at or above the largest. A bar's `x` is its
 * end, 0 to 1; a bar that is not measured has no `x` and keeps its row as a
 * labelled gap, never a zero bar. Marks are vertical lines on the same scale.
 */
export function compareModel(figure, evidence) {
  const unit = figure.bars[0]?.value?.unit ?? ''
  const pinsOf = (kind, id) => (figure.pins ?? []).filter((p) => p[kind] === id).map((p) => p.key)
  const bars = figure.bars.map((b) => ({ ...b, ...readNumber(b.value, evidence, unit), pins: pinsOf('bar', b.id) }))
  const marks = (figure.marks ?? []).map((m) => ({ ...m, ...readNumber(m.value, evidence, unit), pins: pinsOf('mark', m.id) }))
  const values = [...bars, ...marks].map((x) => x.v).filter((v) => v !== null)
  const log = figure.scale === 'log'
  let at = () => 0
  let ticks = []
  let from = 0
  let to = 1
  let measured = false
  if (log) {
    const pos = values.filter((v) => v > 0)
    if (pos.length) {
      measured = true
      const base = isByteUnit(unit) ? 2 : 10
      const lg = (v) => Math.log(v) / Math.log(base)
      const least = lg(Math.min(...pos))
      // Start one power lower when the smallest value sits on a power or
      // within a fifth of a power above it (1,024 on a base-10 axis), so its
      // bar has a visible length instead of a sliver.
      const lo = least - Math.floor(least + 1e-9) < 0.2 ? Math.floor(least + 1e-9) - 1 : Math.floor(least)
      let hi = Math.ceil(lg(Math.max(...pos)) - 1e-9)
      if (hi <= lo) hi = lo + 1
      from = base ** lo
      to = base ** hi
      at = (v) => (v > 0 ? clamp01((lg(v) - lo) / (hi - lo)) : 0)
      ticks = logTicks(lo, hi, base).map((e) => base ** e)
    }
  } else if (values.length) {
    measured = true
    const max = Math.max(0, ...values)
    // A byte unit ticks at round numbers of the unit it reads in (KiB, MiB, ...).
    let per = 1
    if (isByteUnit(unit)) {
      const mult = BYTE_UNITS[unit]
      let k = unit === 'kB' ? 1 : 0
      while (k < BINARY.length - 1 && max * mult >= 1024 ** (k + 1)) k++
      per = 1024 ** k / mult
    }
    const top = niceTop(max / per)
    to = top * per
    at = (v) => clamp01(v / to)
    ticks = scaleTicks(0, top).map((t) => t * per)
  }
  for (const x of [...bars, ...marks]) x.x = measured && x.v !== null ? at(x.v) : null
  const groups = figure.groups?.length
    ? figure.groups.map((g) => ({ ...g, bars: bars.filter((b) => b.group === g.id) }))
    : [{ id: null, label: null, bars }]
  return {
    log, unit, measured, from, to, bars, marks, groups,
    ticks: ticks.map((v) => ({ value: v, x: at(v), text: tickText(v, unit) })),
  }
}

/** The axis line under a compare figure: "buffer size, log scale, 4 KiB to 8 MiB". */
export function compareAxisText(figure, model) {
  if (!model.measured) return `${figure.axis}, not measured`
  const unit = !isByteUnit(model.unit) && model.unit && !figure.axis.endsWith(model.unit) ? ` ${model.unit}` : ''
  return `${figure.axis}, ${model.log ? 'log scale, ' : ''}${tickText(model.from, model.unit)} to ${tickText(model.to, model.unit)}${unit}`
}

/** A drawn pin's own value, named by its setting, or none. */
const pinValueRefs = (pins, defsByKey) => pins.filter((p) => p?.value).map((p) => named(p.value, defName(p.key, defsByKey)))

/** Every ValueRef a compare figure shows, each named by its bar or mark, and its pins' own values by their setting. */
export const compareRefs = (figure, defsByKey = {}) => [
  ...figure.bars.map((b) => named(b.value, b.label)),
  ...(figure.marks ?? []).map((m) => named(m.value, m.label)),
  ...pinValueRefs(figure.pins ?? [], defsByKey),
]

/** Where a setting drawn on a compare figure sits: "on Default" or "on the socket limit line". */
export function comparePinPlace(figure, pin) {
  if (pin.bar) return `on ${figure.bars.find((b) => b.id === pin.bar)?.label ?? pin.bar}`
  return `on the ${inSentence(figure.marks?.find((m) => m.id === pin.mark)?.label ?? pin.mark)} line`
}

export function compareCaption(figure, evidence, imageId, sameOn = 0) {
  const model = compareModel(figure, evidence)
  const parts = [`${figure.title}.`]
  if (!model.measured) parts.push(`No values measured on ${imageId} yet, so no bars are drawn.`)
  else {
    if (model.log) {
      const step = model.ticks.length > 1 ? Math.round(model.ticks[1].value / model.ticks[0].value) : 0
      parts.push(step ? `Log scale: each tick is ${fmt(step)} times the one before.` : 'Log scale.')
    } else parts.push('Drawn to scale.')
    parts.push(measuredOn(compareRefs(figure), evidence, imageId, sameOn))
  }
  return parts.join(' ')
}

export function compareLabel(figure, evidence, { defsByKey = {}, highlight = null } = {}) {
  const model = compareModel(figure, evidence)
  const tip = (x) => (x.does ? `: ${plainTip(x.does).replace(/\.$/, '')}` : '')
  const sel = (id) => (id === highlight ? ' (selected)' : '')
  const groups = model.groups.map((g) => {
    const bars = g.bars.map((b) => `${b.label} ${b.text}${tip(b)}${sel(b.id)}`).join('; ')
    return g.label ? `${g.label}${tip(g)}${sel(g.id)}: ${bars}.` : `${bars}.`
  })
  const out = [`${figure.title}.`, `Bars on a ${model.log ? 'log' : 'linear'} scale of ${compareAxisText(figure, model)}.`, ...groups]
  if (model.marks.length) out.push(`Lines across the bars: ${model.marks.map((m) => `${m.label} at ${m.text}${tip(m)}${sel(m.id)}`).join('; ')}.`)
  if (figure.pins?.length) out.push(`Settings drawn: ${figure.pins.map((p) => `${defName(p.key, defsByKey)} ${comparePinPlace(figure, p)}`).join('; ')}.`)
  return out.join(' ')
}

// Tree -------------------------------------------------------------------------

/**
 * The nodes of a tree figure top down, each with its depth (0 the root), its
 * parent, whether it is its parent's last child and, for the connector
 * lines, `rails`: for each level from 1 to depth - 1, whether the line of
 * that level runs on past this row (its node there has a later sibling).
 */
export function treeNodes(figure) {
  const out = []
  const walk = (node, depth, parent, last, rails) => {
    if (!node || typeof node !== 'object') return
    out.push({ ...node, depth, parent, last, rails })
    const kids = Array.isArray(node.children) ? node.children : []
    const next = depth > 0 ? [...rails, !last] : rails
    kids.forEach((child, i) => walk(child, depth + 1, node, i === kids.length - 1, next))
  }
  walk(figure.root, 0, null, true, [])
  return out
}

/** A tree node's value line, or '' for none; a probe that only says "exists" shows none. */
export function treeValue(node, evidence) {
  if (!node.value) return ''
  const r = evidence(node.value)
  return r?.status === 'ok' && r.value === true ? '' : formatValue(r, node.value.unit)
}

export const treeRefs = (figure, defsByKey = {}) => [
  ...treeNodes(figure).filter((n) => n.value).map((n) => named(n.value, n.label)),
  ...pinValueRefs(figure.pins ?? [], defsByKey),
]

export function treePinPlace(figure, pin) {
  return `on ${treeNodes(figure).find((n) => n.id === pin.node)?.label ?? pin.node}`
}

export function treeCaption(figure, evidence, imageId, sameOn = 0) {
  const refs = treeRefs(figure)
  if (!refs.length) return `${figure.title}.`
  return `${figure.title}. ${measuredOn(refs, evidence, imageId, sameOn)}`
}

export function treeLabel(figure, evidence, { defsByKey = {}, highlight = null } = {}) {
  const nodes = treeNodes(figure)
  const items = nodes.map((n) => {
    const value = treeValue(n, evidence)
    const tip = n.does ? `: ${plainTip(n.does).replace(/\.$/, '')}` : ''
    const where = n.parent ? `, in ${n.parent.label}` : ', at the top'
    return `${n.label}${value ? ` ${value}` : ''}${where}${tip}${n.id === highlight ? ' (selected)' : ''}`
  })
  const out = [`${figure.title}. A tree from the top: ${items.join('; ')}.`]
  if (figure.pins?.length) out.push(`Settings drawn: ${figure.pins.map((p) => `${defName(p.key, defsByKey)} ${treePinPlace(figure, p)}`).join('; ')}.`)
  return out.join(' ')
}

// Modes ------------------------------------------------------------------------

/** Whether a modes option is a range of numbers (`min`, optional `max`) rather than one value. */
export const isRangeOption = (o) => o !== null && typeof o === 'object' && Object.hasOwn(o, 'min')

/** A range option's numbers in words: "1 or more", "1 to 5". */
export const rangeText = (o) => (o.max === undefined ? `${fmt(o.min)} or more` : `${fmt(o.min)} to ${fmt(o.max)}`)

/** The key a segment is known by in the page (v-for and data-segment): its value, or its range "1-5" or "1+". */
const segKey = (o) => (isRangeOption(o) ? (o.max === undefined ? `${o.min}+` : `${o.min}-${o.max}`) : String(o.value))

const NUMERIC = /^-?\d+(\.\d+)?$/

/**
 * A modes row's segments on one image: its options, the one whose value
 * equals the measured value lit (compared as text, so 0 and "0" match), or
 * the range (`min` to `max`) the number falls in. With `bits`, every option
 * whose bit is set in the value lights (176 lights 16, 32 and 128), and an
 * option of 0 lights only for 0. A value, or bits, that no option names add
 * one more lit segment labelled with the raw value, so a value is never
 * silently dropped. A value not measured lights nothing.
 * @returns {{ key: string, value: unknown, label: string, does?: string, lit: boolean, extra: boolean }[]}
 */
export function modeSegments(row, result) {
  const segs = row.options.map((o) => ({ ...o, key: segKey(o), lit: false, extra: false }))
  if (result?.status !== 'ok') return segs
  const v = result.value
  const raw = typeof v === 'string' || typeof v === 'number' ? String(v) : formatValue(result)
  if (row.bits) {
    const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v) : NaN
    if (!Number.isSafeInteger(n) || n < 0) return [...segs, { key: raw, value: v, label: raw, lit: true, extra: true }]
    let rest = n
    for (const s of segs) {
      const bit = Number(s.value)
      if (bit === 0) s.lit = n === 0
      else if (Math.floor(n / bit) % 2 === 1) {
        s.lit = true
        rest -= bit
      }
    }
    if (rest > 0) segs.push({ key: String(rest), value: rest, label: String(rest), lit: true, extra: true })
    return segs
  }
  const n = typeof v === 'number' ? v : typeof v === 'string' && NUMERIC.test(v.trim()) ? Number(v) : NaN
  const match = segs.find((s) => (isRangeOption(s) ? Number.isFinite(n) && n >= s.min && (s.max === undefined || n <= s.max) : String(s.value) === raw))
  if (match) match.lit = true
  else segs.push({ key: raw, value: v, label: raw, lit: true, extra: true })
  return segs
}

/** The setting a modes row draws (its `pin`, a key or `{ key, value }`), or null. */
export const rowPinKey = (row) => (row?.pin && typeof row.pin === 'object' ? row.pin.key : row?.pin) ?? null

/** A modes figure on one image: its rows with their segments, grouped as the figure says. */
export function modesModel(figure, evidence) {
  const rows = figure.rows.map((row) => {
    const result = evidence(row.value)
    const status = result?.status === 'ok' ? 'ok' : result?.status === 'absent' ? 'absent' : 'missing'
    const segments = modeSegments(row, result)
    const lit = segments.filter((s) => s.lit).map((s) => s.label)
    const valueText = formatValue(result, row.value.unit)
    return { ...row, status, segments, valueText, text: status === 'ok' ? lit.join(' + ') || 'none' : valueText }
  })
  const groups = figure.groups?.length
    ? figure.groups.map((g) => ({ ...g, rows: rows.filter((r) => r.group === g.id) }))
    : [{ id: null, label: null, rows }]
  return { rows, groups, measured: rows.some((r) => r.status === 'ok') }
}

export const modesRefs = (figure, defsByKey = {}) => [
  ...figure.rows.map((r) => named(r.value, r.label)),
  ...pinValueRefs(figure.rows.map((r) => (r.pin && typeof r.pin === 'object' ? r.pin : null)), defsByKey),
]

export function modesCaption(figure, evidence, imageId, sameOn = 0) {
  const lit = figure.rows.every((r) => isExample(r.value)) ? 'The lit segment is the example value.' : 'The lit segment is the value measured.'
  return `${figure.title}. ${lit} ${measuredOn(modesRefs(figure), evidence, imageId, sameOn)}`
}

export function modesLabel(figure, evidence, { defsByKey = {}, highlight = null } = {}) {
  const model = modesModel(figure, evidence)
  const tip = (x) => (x.does ? ` (${plainTip(x.does).replace(/\.$/, '')})` : '')
  const sel = (id) => (id === highlight ? ' (selected)' : '')
  const rowText = (r) => {
    const pin = rowPinKey(r)
    const name = `${r.label}${tip(r)}${sel(r.id)}${pin ? `, set by ${defName(pin, defsByKey)}` : ''}`
    if (r.status !== 'ok') return `${name}: ${r.options.map((o) => o.label).join(', ')}; ${r.text}`
    const set = (s) => (isRangeOption(s) ? ` (set, ${modeNumber(r)})` : ' (set)')
    const segs = r.segments.map((s) => `${s.label}${s.extra ? ' (set, not a listed value)' : s.lit ? set(s) : ''}${s.extra ? '' : tip(s)}`)
    return `${name}: ${segs.join(', ')}`
  }
  const groups = model.groups.map((g) => {
    const rows = g.rows.map(rowText).join('; ')
    return g.label ? `${g.label}${tip(g)}${sel(g.id)}: ${rows}.` : `${rows}.`
  })
  return [`${figure.title}. One row per setting, the value set lit.`, ...groups].join(' ')
}

/** A modes row's value as a number with its unit, for a lit range ("15,000"). */
const modeNumber = (row) => row.valueText ?? ''

// Any figure -----------------------------------------------------------------

export function figureLabel(figure, evidence, { defsByKey = {}, highlight = null } = {}) {
  if (figure.kind === 'stack') return stackLabel(figure, evidence, highlight)
  if (figure.kind === 'timeline') return timelineLabel(figure, evidence)
  if (figure.kind === 'sideBySide') return sideBySideLabel(figure, defsByKey)
  if (figure.kind === 'gauge') return gaugeLabel(figure, evidence, { defsByKey, highlight })
  if (figure.kind === 'compare') return compareLabel(figure, evidence, { defsByKey, highlight })
  if (figure.kind === 'tree') return treeLabel(figure, evidence, { defsByKey, highlight })
  if (figure.kind === 'modes') return modesLabel(figure, evidence, { defsByKey, highlight })
  return figure.title ?? ''
}

/**
 * Every ValueRef a chapter figure shows, for the kernel switcher and the
 * static page, each named by the part that shows it (a mark, a bar, a node)
 * unless it has a `label` of its own; a gauge pin's own value by its setting.
 */
export function figureRefs(figure, defsByKey = {}) {
  if (!figure) return []
  if (figure.kind === 'stack') return stackRefs(figure)
  if (figure.kind === 'timeline') return figure.lines.map((l) => named(l.value, l.label))
  if (figure.kind === 'gauge') {
    return [
      ...figure.marks.map((m) => named(m.value, m.label)),
      ...(figure.zoom ? [named(figure.zoom.full, figure.zoom.label)] : []),
      ...(figure.level ? [named(figure.level.value, figure.level.label)] : []),
      ...(figure.pins ?? []).filter((p) => p.value).map((p) => named(p.value, defName(p.key, defsByKey))),
    ]
  }
  if (figure.kind === 'compare') return compareRefs(figure, defsByKey)
  if (figure.kind === 'tree') return treeRefs(figure, defsByKey)
  if (figure.kind === 'modes') return modesRefs(figure, defsByKey)
  return []
}

/**
 * The settings a figure draws itself (a gauge's, compare's or tree's `pins`),
 * whose buttons in the row under it show only below md. A modes row's `pin`
 * is not drawn in the row, where its long name would crowd the options: its
 * button stays in the row under the figure at every width, and the row of
 * the pressed setting is highlighted.
 * @returns {string[]}
 */
export function drawnPinKeys(figure) {
  if (!figure) return []
  if (figure.kind === 'gauge' || figure.kind === 'compare' || figure.kind === 'tree') return (figure.pins ?? []).map((p) => p.key)
  return []
}

/**
 * The values the margin panel shows for a pin: the refs of the part its
 * `layer` names (a band stands for its layer, a group for its bars or rows)
 * and, on a figure that draws the setting, the part it is drawn on. A drawn
 * pin with a `value` of its own shows that value, named by its setting, in
 * place of the part it sits on (a gauge keeps its marks as well, which say
 * where the setting acts). Nothing when the pin names no part of the figure.
 */
export function pinRefs(figure, pin, defsByKey = {}) {
  const target = pin?.layer
  if (figure?.kind === 'gauge' && pin) {
    const drawn = (figure.pins ?? []).find((p) => p.key === pin.key)
    const zone = figure.zones.find((z) => z.id === target)
    const markIds = [
      ...(drawn ? (drawn.mark ? [drawn.mark] : [drawn.from, drawn.to]) : []),
      ...(zone ? [zone.from, zone.to] : figure.marks.some((m) => m.id === target) ? [target] : []),
    ]
    const marks = figure.marks.filter((m) => markIds.includes(m.id)).reverse()
    return [...(drawn?.value ? [named(drawn.value, defName(drawn.key, defsByKey))] : []), ...marks.map((m) => named(m.value, m.label))]
  }
  if (figure?.kind === 'compare' && pin) {
    const drawn = (figure.pins ?? []).find((p) => p.key === pin.key)
    const at = drawn?.bar ?? drawn?.mark
    const own = drawn?.value ? [named(drawn.value, defName(drawn.key, defsByKey))] : []
    const ids = [own.length ? null : at, target].filter(Boolean)
    const parts = [...figure.bars, ...(figure.marks ?? [])]
    const out = []
    for (const id of ids) {
      const inGroup = figure.bars.filter((b) => b.group === id)
      for (const part of inGroup.length ? inGroup : parts.filter((x) => x.id === id)) if (!out.includes(part) && !(own.length && part.id === at)) out.push(part)
    }
    return [...own, ...out.map((x) => named(x.value, x.label))]
  }
  if (figure?.kind === 'tree' && pin) {
    const drawn = (figure.pins ?? []).find((p) => p.key === pin.key)
    const own = drawn?.value ? [named(drawn.value, defName(drawn.key, defsByKey))] : []
    const ids = new Set([own.length ? null : drawn?.node, target].filter(Boolean))
    if (own.length) ids.delete(drawn.node)
    return [...own, ...treeNodes(figure).filter((n) => ids.has(n.id) && n.value).map((n) => named(n.value, n.label))]
  }
  if (figure?.kind === 'modes' && pin) {
    const out = []
    for (const r of figure.rows) {
      const drawn = rowPinKey(r) === pin.key
      const own = drawn && typeof r.pin === 'object' && r.pin.value ? named(r.pin.value, defName(pin.key, defsByKey)) : null
      if (own) out.push(own)
      else if (drawn || r.id === target || (target && r.group === target)) out.push(named(r.value, r.label))
    }
    return out
  }
  if (!target) return []
  if (figure.kind === 'stack') {
    for (const layer of figure.layers) {
      if (layer.id === target || (layer.bands ?? []).some((b) => b.id === target)) return layer.values ?? []
      const node = (layer.nodes ?? []).find((n) => n.id === target)
      if (node) return node.probe ? [named(itemRef(node), node.text)] : []
    }
  }
  if (figure.kind === 'timeline') {
    const line = figure.lines.find((l) => l.id === target)
    if (line) return [named(line.value, line.label)]
  }
  return []
}

// Settings, answers and sources ------------------------------------------------

/** The name a def shows on its card (its sysctl name, directive or path), or the key. */
export function defName(key, defsByKey = {}) {
  const def = Object.hasOwn(defsByKey, key) ? defsByKey[key] : null
  return def?.sysctlName ?? key
}

export function defTitle(key, defsByKey = {}) {
  const def = Object.hasOwn(defsByKey, key) ? defsByKey[key] : null
  return def?.title ?? ''
}

/**
 * How a `to` answer's value reads: what the file gets (an option's
 * sysctlValue, else its value) and the words its control shows for it (an
 * option's label, a toggle's on or off label, a segment's label), with the
 * leading "<value>: " or the "<value> (...)" wrapping taken off, so
 * "madvise: only memory that asks for it" reads as madvise and "only memory
 * that asks for it". `words` is '' when the label only repeats the value.
 */
export function answerValue(def, to) {
  const option = Array.isArray(def?.options) ? def.options.find((o) => o.value === to) : null
  const shown = String(option ? (option.sysctlValue ?? option.value) : to)
  let label = ''
  if (option) label = option.label ?? ''
  else if (def?.control === 'toggle' && def.toggleLabels) label = (to === 1 ? def.toggleLabels.on : to === 0 ? def.toggleLabels.off : '') ?? ''
  else if (Array.isArray(def?.segmentLabels)) label = def.segmentLabels[to] ?? ''
  let words = String(label).trim()
  for (const v of new Set([shown, String(to)])) {
    if (words === v) words = ''
    else if (words.startsWith(`${v}: `)) words = words.slice(v.length + 2)
    else if (words.startsWith(`${v} (`) && words.endsWith(')')) words = words.slice(v.length + 2, -1)
  }
  return { shown, words: words.trim() }
}

/** A code span for RichText, or plain text when the value holds a backtick. */
const codeSpan = (s) => (s.includes('`') ? s : `\`${s}\``)

/**
 * What an Answer tells the reader to do, as one sentence of RichText (a `to`
 * value is a code span, and a `leave` answer's `why` is RichText already).
 */
export function answerText(answer, defsByKey = {}) {
  if (!answer) return ''
  if (answer.leave) return `Leave it as it is: ${String(answer.why).replace(/\.$/, '')}.`
  const name = defName(answer.key, defsByKey)
  if (Object.hasOwn(answer, 'to')) {
    const def = Object.hasOwn(defsByKey, answer.key) ? defsByKey[answer.key] : null
    const { shown, words } = answerValue(def, answer.to)
    const said = words.replace(/\.$/, '')
    // Words that hold brackets of their own follow a colon, not more brackets.
    const tail = !said ? '' : /[()]/.test(said) ? `: ${said}` : ` (${said})`
    return `Set ${name} to ${codeSpan(shown)}${tail}.`
  }
  const verb = answer.dir === 'raise' ? 'Raise' : 'Lower'
  return `${verb} ${name}.`
}

/** What a missing `no` on the last question leads to. */
export const NOTHING_FITS = { leave: true, why: 'none of these questions matched your machine' }

/**
 * The chooser's next step after an answer: `{ result }` or `{ next }`.
 * A missing `no` goes on to the next question, and past the last one to
 * NOTHING_FITS.
 */
export function chooseStep(choose, index, yes) {
  const q = choose[index]
  const answer = yes ? q.yes : q.no
  if (answer) return { result: answer }
  if (index + 1 < choose.length) return { next: index + 1 }
  return { result: NOTHING_FITS }
}

/** What "No" leads to, as text for the printable flow. */
export function noText(choose, index, defsByKey = {}) {
  const q = choose[index]
  if (q.no) return answerText(q.no, defsByKey)
  if (index + 1 < choose.length) return `Go to question ${index + 2}.`
  return answerText(NOTHING_FITS, defsByKey)
}

const FOOTNOTE = /\[\^([a-z0-9-]+)\]/g

/**
 * Splits `[^id]` footnote marks out of a RichText string, since RichText
 * itself doesn't know them: `[{ text }, { note: id }, { text }, ...]`.
 */
export function splitFootnotes(text) {
  const out = []
  let last = 0
  for (const m of text.matchAll(FOOTNOTE)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) })
    out.push({ note: m[1] })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last) })
  return out
}

/**
 * Numbers for a chapter's sources: the ones the body cites in order of first
 * mark, then any others in the order `sources` lists them.
 * @returns {{ id: string, n: number, url: string, label: string }[]}
 */
export function numberedSources(chapter) {
  const sources = chapter.sources ?? {}
  const ids = []
  for (const para of chapter.body ?? []) {
    for (const part of splitFootnotes(para)) if (part.note && Object.hasOwn(sources, part.note) && !ids.includes(part.note)) ids.push(part.note)
  }
  for (const id of Object.keys(sources)) if (!ids.includes(id)) ids.push(id)
  return ids.map((id, i) => ({ id, n: i + 1, url: sources[id].url, label: sources[id].label }))
}

/** The host a source link points to, for "Source: docs.kernel.org". */
export function hostOf(url) {
  try {
    return new URL(url).host
  } catch {
    return ''
  }
}

/**
 * A link the figures may render: an absolute https URL (a source, written in
 * the guide) or a same-site path (the "Tune it" link). Anything else, such as
 * `javascript:` or a protocol-relative `//host`, gives null and no link.
 */
export function safeHref(url) {
  if (typeof url !== 'string') return null
  // A same-origin path, never "//host" or "/\host" (browsers read both as another host).
  return /^https:\/\/[^\s\\]+$/.test(url) || /^\/(?![/\\])[^\s\\]*$/.test(url) ? url : null
}
