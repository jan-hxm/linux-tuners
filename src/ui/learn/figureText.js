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
  const rest = order.filter((c) => !banded.has(c.id))
  return rest.length ? [...groups, { label: null, cards: rest }] : groups
}

/** "A to B: label" for each edge, by the cards' titles. */
export function edgeRows(parts) {
  const title = (id) => parts.cards.find((c) => c.id === id)?.title ?? id
  return parts.edges.map((e) => ({ ...e, text: `${title(e.from)} to ${title(e.to)}: ${e.label}` }))
}

function cardText(card, evidence) {
  const value = card.probe ? `, measured ${itemValue(card, evidence)}` : ''
  return `${card.title}, ${card.does}${value}`
}

export function partsMapLabel(parts, evidence) {
  const groups = cardGroups(parts).map((g) => {
    const cards = g.cards.map((c) => cardText(c, evidence)).join('; ')
    return g.label ? `${g.label}: ${cards}.` : `${cards}.`
  })
  const edges = edgeRows(parts).map((e) => e.text)
  return [`Parts map. ${groups.join(' ')}`, edges.length ? `Connections: ${edges.join('. ')}.` : ''].filter(Boolean).join(' ')
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
  return parts.filter(Boolean).join(', ')
}

export function stackLabel(figure, evidence, highlight = null) {
  const layers = figure.layers.map((layer) => {
    const items = layer.kind === 'bands'
      ? (layer.bands ?? []).map((b) => (b.id === highlight ? `${b.text} (selected)` : b.text))
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
  const lines = figure.lines.map((l) => `${l.label} at ${formatValue(evidence(l.value), l.value.unit)}`)
  const events = [...figure.events].sort((a, b) => a.at - b.at).map((e) => e.label)
  return [
    `${figure.title}. Schematic timeline, not to scale.`,
    lines.length ? `Lines from the top: ${lines.join('; ')}.` : '',
    events.length ? `In order: ${events.join(', then ')}.` : '',
  ].filter(Boolean).join(' ')
}

// Side by side ---------------------------------------------------------------

export const settingText = (setting, defsByKey = {}) => `${defName(setting.key, defsByKey)} = ${setting.value}`

export function sideBySideLabel(figure, defsByKey = {}) {
  const states = figure.states.map((s) => `${s.label}, ${settingText(s.setting, defsByKey)}: ${s.lit} of ${s.cells} lit`)
  return `${figure.title}. Side by side. ${states.join('. ')}.`
}

export function backedByText(backedBy) {
  if (!backedBy) return ''
  if (backedBy.vmTest) return `Checked on real kernels by the VM test "${backedBy.vmTest}".`
  if (backedBy.probe) return `Checked on real kernels by the probe ${backedBy.probe}.`
  return ''
}

// Any figure -----------------------------------------------------------------

export function figureLabel(figure, evidence, { defsByKey = {}, highlight = null } = {}) {
  if (figure.kind === 'stack') return stackLabel(figure, evidence, highlight)
  if (figure.kind === 'timeline') return timelineLabel(figure, evidence)
  if (figure.kind === 'sideBySide') return sideBySideLabel(figure, defsByKey)
  return figure.title ?? ''
}

/**
 * The values the margin panel shows for a pin: the refs of the layer, band
 * or node its `layer` names (a band stands for its layer), or a timeline
 * line's value. Nothing when the pin names no part of the figure.
 */
export function pinRefs(figure, pin) {
  const target = pin?.layer
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
