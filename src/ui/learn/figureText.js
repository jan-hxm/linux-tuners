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

function plural(unit, n) {
  if (!unit) return ''
  return n === 1 && unit.endsWith('s') ? ` ${unit.slice(0, -1)}` : ` ${unit}`
}

/**
 * One evidence result as text: a number with its unit, a string, yes/no, a
 * list, or "not measured" / "not present on this kernel".
 * @param {{ status: string, value?: unknown }} result
 * @param {string} [unit]
 */
export function formatValue(result, unit = '') {
  if (!result || result.status === 'missing') return NOT_MEASURED
  if (result.status === 'absent') return ABSENT
  if (result.status !== 'ok') return NOT_MEASURED
  const v = result.value
  if (typeof v === 'number' && Number.isFinite(v)) return `${v.toLocaleString('en-US')}${plural(unit, v)}`
  if (typeof v === 'string') return unit ? `${v} ${unit}` : v
  if (typeof v === 'boolean') return v ? 'yes' : 'no'
  if (Array.isArray(v) && v.every((x) => typeof x === 'string' || typeof x === 'number')) return v.length ? v.join(', ') : 'none'
  return NOT_MEASURED
}

/** What a ValueRef is called in a figure: its path, or the probe id without one. */
export const refName = (ref) => ref.path || ref.probe

/** "Normal.min: 4,096 pages", or "Normal.min: not measured". */
export const measuredText = (ref, evidence) => `${refName(ref)}: ${formatValue(evidence(ref), ref.unit)}`

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
 * nothing, so the page shows one caption instead (sameOnText).
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
 * measured on, or "on all N test kernels" when every image agrees.
 */
export function tipValue(ref, evidence, sameOn = 0) {
  const r = evidence(ref)
  const text = formatValue(r, ref.unit)
  if (sameOn && r?.status === 'ok') return `${text} on all ${sameOn} test kernels`
  return r?.kernel && (r.status === 'ok' || r.status === 'absent') ? `${text}, kernel ${r.kernel}` : text
}

/** The caption of a figure whose values are the same on every image. */
export const sameOnText = (count) => `Values measured on ${count} test kernels, the same on each.`

/** The line under a figure that says where its numbers come from. */
export function measuredOn(refs, evidence, imageId) {
  if (!refs.length) return ''
  const kernel = kernelOf(refs, evidence)
  return kernel ? `Values measured on ${imageId}, kernel ${kernel}.` : `No values measured on ${imageId} yet.`
}

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
  const value = card.probe ? `, measured ${itemValue(card, evidence)}` : ''
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
  return `${scale.label}, ${m.totalText}, drawn to scale: ${parts.join('; ')}.`
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
    ...(layer.nodes ?? []).filter((n) => n.probe).map(itemRef),
  ])
}

function nodeText(node, evidence) {
  const parts = [node.text, node.sub, node.probe ? `measured ${itemValue(node, evidence)}` : null]
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
    return { ...m, v: r?.status === 'ok' && isNum(r.value) ? r.value : null, text: formatValue(r, m.value.unit), result: r }
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
  return { measured, unit, from, to, marks, zones, ticks, zoom, curve, pins }
}

/** Every ValueRef a gauge shows: its marks, the zoom's whole range and the pins' own values. */
export function gaugeRefs(figure) {
  return [
    ...figure.marks.map((m) => m.value),
    ...(figure.zoom ? [figure.zoom.full] : []),
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
  if (model.measured) parts.push(sameOn ? sameOnText(sameOn) : measuredOn(gaugeRefs(figure), evidence, imageId))
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
  out.push(`Marks from the top: ${marks.join('; ')}.`, `Zones from the top: ${zones.join('; ')}.`)
  if (model.pins.length) out.push(`Settings on the scale: ${model.pins.map((p) => `${defName(p.key, defsByKey)} ${gaugePinPlace(figure, p)}`).join('; ')}.`)
  if (model.curve) {
    const events = model.curve.events.map((e) => `${e.label}${tip(e)}`)
    out.push(`A schematic curve over time, not to scale${events.length ? `: ${events.join(', then ')}` : ''}.`)
  }
  return out.join(' ')
}

// Any figure -----------------------------------------------------------------

export function figureLabel(figure, evidence, { defsByKey = {}, highlight = null } = {}) {
  if (figure.kind === 'stack') return stackLabel(figure, evidence, highlight)
  if (figure.kind === 'timeline') return timelineLabel(figure, evidence)
  if (figure.kind === 'sideBySide') return sideBySideLabel(figure, defsByKey)
  if (figure.kind === 'gauge') return gaugeLabel(figure, evidence, { defsByKey, highlight })
  return figure.title ?? ''
}

/** Every ValueRef a chapter figure shows, for the kernel switcher and the static page. */
export function figureRefs(figure) {
  if (!figure) return []
  if (figure.kind === 'stack') return stackRefs(figure)
  if (figure.kind === 'timeline') return figure.lines.map((l) => l.value)
  if (figure.kind === 'gauge') return gaugeRefs(figure)
  return []
}

/**
 * The values the margin panel shows for a pin: the refs of the layer, band
 * or node its `layer` names (a band stands for its layer), or a timeline
 * line's value. Nothing when the pin names no part of the figure.
 */
export function pinRefs(figure, pin) {
  const target = pin?.layer
  if (figure?.kind === 'gauge' && pin) {
    const drawn = (figure.pins ?? []).find((p) => p.key === pin.key)
    const zone = figure.zones.find((z) => z.id === target)
    const markIds = [
      ...(drawn ? (drawn.mark ? [drawn.mark] : [drawn.from, drawn.to]) : []),
      ...(zone ? [zone.from, zone.to] : figure.marks.some((m) => m.id === target) ? [target] : []),
    ]
    const marks = figure.marks.filter((m) => markIds.includes(m.id)).reverse()
    return [...(drawn?.value ? [drawn.value] : []), ...marks.map((m) => m.value)]
  }
  if (!target) return []
  if (figure.kind === 'stack') {
    for (const layer of figure.layers) {
      if (layer.id === target || (layer.bands ?? []).some((b) => b.id === target)) return layer.values ?? []
      const node = (layer.nodes ?? []).find((n) => n.id === target)
      if (node) return node.probe ? [itemRef(node)] : []
    }
  }
  if (figure.kind === 'timeline') {
    const line = figure.lines.find((l) => l.id === target)
    if (line) return [line.value]
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
  return /^https:\/\/[^\s]+$/.test(url) || /^\/(?!\/)[^\s]*$/.test(url) ? url : null
}
