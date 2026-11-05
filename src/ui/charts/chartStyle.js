/**
 * The chart look (Design.md §7 "Charts"), built once: every chart describes
 * its series, zones and probe stops as data through these helpers, and the
 * plugins in `plugins.js` draw the zones, end labels and probe from it. A
 * chart never sets a colour, width or dash of its own.
 *
 * - The main series: a 2.75px line in its owner's tone (`fit` when the value
 *   fits the machine, `mine` once the visitor changed it, else `ink`) over a
 *   soft fill of the same tone at 10%.
 * - A comparison series (the kernel default): a thin dashed `quiet` line.
 * - A range (a band, a danger zone) is a shaded stripe or, for danger, an
 *   `error` hatch; a single threshold stays a dashed line.
 * - Only horizontal hairlines in `rule`; mono 13px ticks in `quiet`.
 * - Probe stops: where the crosshair can rest, each with the plain words its
 *   tooltip says (ChartFrame shows them on hover, tap and arrow keys).
 */
import { DARK, LIGHT, tint, tone, textTone } from './palette.js'
import { contrast } from '../theme.js'

export const MAIN_WIDTH = 2.75
export const COMPARISON_DASH = [4, 4]
export const THRESHOLD_DASH = [4, 4]
/** Alpha of the area under the main series, and of a shaded band. */
export const AREA_ALPHA = 0.1
export const BAND_ALPHA = 0.14
/**
 * Room above the plot for the probe's tooltip (ChartFrame puts it there, so
 * it never covers the plot or the point it describes).
 */
export const TIP_ROOM = 72
/** The contrast a mark that carries meaning needs against paper (WCAG 1.4.11). */
export const MARK_CONTRAST = 3

/** True when a tone is strong enough on paper, in both schemes, to carry meaning as a fill. */
export function isMarkTone(name) {
  return [LIGHT, DARK].every((set) => contrast(set[name], set.paper) >= MARK_CONTRAST)
}

/** The end label's words for the main series, by its owner tone. */
export function ownerLabel(name) {
  return { fit: 'fits your machine', mine: 'yours' }[name] ?? null
}

/**
 * @param {{ data: {x:number,y:number}[], tone?: string, label: string, endLabel?: string|null, tension?: number }} o
 */
export function mainSeries({ data, tone: name = 'ink', label, endLabel = ownerLabel(name), tension = 0.2 }) {
  return {
    label,
    data,
    borderColor: tone(name),
    backgroundColor: tint(name, AREA_ALPHA),
    borderWidth: MAIN_WIDTH,
    borderJoinStyle: 'round',
    pointRadius: 0,
    pointHoverRadius: 0,
    fill: 'origin',
    tension,
    // Read raw by plugins.js (Chart.js ignores keys it doesn't know).
    endLabel: endLabel ? { text: endLabel, color: textTone(name), weight: 500 } : null,
    probeDot: true,
    order: 0,
  }
}

/** @param {{ data: {x:number,y:number}[], label: string, endLabel?: string|null, tension?: number }} o */
export function comparisonSeries({ data, label, endLabel = null, tension = 0.2 }) {
  return {
    label,
    data,
    borderColor: tone('quiet'),
    borderDash: COMPARISON_DASH,
    borderWidth: 1.5,
    pointRadius: 0,
    pointHoverRadius: 0,
    fill: false,
    tension,
    endLabel: endLabel ? { text: endLabel, color: textTone('quiet'), weight: 400 } : null,
    probeDot: true,
    order: 1,
  }
}

/**
 * One segment of a stacked bar, or a plain bar. A danger segment is hatched
 * in its tone; the others are solid. A tone too faint on paper to carry
 * meaning (`rule`) becomes an outlined segment instead: a `quiet` border over
 * a soft fill, so every bar meets 3:1 in both schemes. `markTone` names the
 * tone that carries the bar (its fill, or its border). A paper hairline
 * separates solid neighbours. `tone` may be one tone per bar (a plain,
 * unstacked dataset).
 * @param {{ label: string, data: number[], tone: string | string[], hatch?: boolean, stack?: string }} o
 */
export function barSegment({ label, data, tone: name, hatch = false, stack }) {
  const names = Array.isArray(name) ? name : [name]
  const look = names.map((n) => {
    if (hatch) return { fill: hatchFill(n), border: tone(n), width: 1, mark: n }
    if (isMarkTone(n)) return { fill: tone(n), border: tone('paper'), width: { right: 2 }, mark: n }
    return { fill: tint('quiet', BAND_ALPHA), border: tone('quiet'), width: 1.5, mark: 'quiet' }
  })
  const pick = (key) => (Array.isArray(name) ? look.map((l) => l[key]) : look[0][key])
  return {
    label,
    data,
    backgroundColor: pick('fill'),
    borderColor: pick('border'),
    borderWidth: pick('width'),
    borderSkipped: false,
    maxBarThickness: 44,
    markTone: pick('mark'),
    ...(stack ? { stack } : {}),
  }
}

/** The legend swatch kind for a bar segment drawn by `barSegment`. */
export function barKind(name, hatch = false) {
  return hatch ? 'hatch' : isMarkTone(name) ? 'fill' : 'outline'
}

/** The legend swatch tone for a bar segment drawn by `barSegment`. */
export const barLegendTone = (name, hatch = false) => (hatch || isMarkTone(name) ? name : 'quiet')

/**
 * The part of an axis worth showing, from the data: when everything before
 * `from` (the first point or zone of interest) is flat and takes most of the
 * width, start a margin before it so the change gets the room. The margin is
 * half the span still shown (at least `minMargin`), and the start is rounded
 * down to a whole `step`. Returns `{ min, max, zoomed }`.
 * @param {{ min: number, max: number, from: number, minMargin?: number, step?: number, keepWhole?: number }} o
 */
export function focusRange({ min, max, from, minMargin = 1, step = 1, keepWhole = 0.35 }) {
  if (!Number.isFinite(from) || from <= min + (max - min) * keepWhole) return { min, max, zoomed: false }
  const start = Math.max(min, Math.floor((from - Math.max((max - from) * 0.5, minMargin)) / step) * step)
  return { min: start, max, zoomed: start > min }
}

/** The x of the last flat point before a series first rises above its start. */
export function firstRise(data) {
  const i = data.findIndex((p) => p.y > data[0].y)
  return i <= 0 ? Infinity : data[i - 1].x
}

/** A range on one axis, shaded in a tone. Zones are drawn under the series. */
export const band = (axis, from, to, toneName = 'quiet') => ({ kind: 'band', axis, from, to, tone: toneName })
/** A danger range on one axis, hatched in a tone (error by default). */
export const hatchZone = (axis, from, to, toneName = 'error') => ({ kind: 'hatch', axis, from, to, tone: toneName })
/** A single value on one axis, as a dashed line. */
export const threshold = (axis, at, toneName = 'quiet') => ({ kind: 'threshold', axis, at, tone: toneName })

/**
 * A probe stop at a value on the x axis: the crosshair rests there, with a dot
 * on every series. `title` and `lines` are the tooltip's plain words.
 * @param {number} x @param {string} title @param {string[]} lines
 */
export const xStop = (x, title, lines) => ({ x, title, lines })
/** A probe stop on one bar (a dataset's element), which gets an ink outline. */
export const barStop = (datasetIndex, index, title, lines) => ({ element: { datasetIndex, index }, title, lines })

/** The axis along the bottom: no vertical grid, an ink baseline. */
export function bottomAxis({ min, max, title, stepSize, format, type = 'linear' } = {}) {
  return {
    type,
    min,
    max,
    grid: { display: false },
    border: { display: true, color: tone('ink') },
    title: title ? { display: true, text: title } : { display: false },
    ticks: {
      ...(stepSize ? { stepSize } : {}),
      ...(format ? { callback: format } : {}),
      maxRotation: 0,
      padding: 6,
    },
  }
}

/** The value axis on the left: horizontal `rule` hairlines, no axis line. */
export function sideAxis({ min, max, title, stepSize, format } = {}) {
  return {
    type: 'linear',
    min,
    max,
    grid: { display: true, color: tone('rule'), drawTicks: false, lineWidth: 1 },
    border: { display: false },
    title: title ? { display: true, text: title } : { display: false },
    ticks: {
      ...(stepSize ? { stepSize } : {}),
      ...(format ? { callback: format } : {}),
      padding: 8,
      maxTicksLimit: 6,
      // A max with headroom (link speed + 5%) isn't a tick of its own.
      includeBounds: false,
    },
  }
}

const BASE = { responsive: true, maintainAspectRatio: false, animation: false }

/**
 * Options for a line chart: x along the bottom, y up the side, zones drawn
 * under the series, and the probe's stops.
 */
export function lineChartOptions({ x, y, zones = [], stops = [] }) {
  return {
    ...BASE,
    parsing: false,
    layout: { padding: { top: TIP_ROOM, right: 4 } },
    scales: { x: bottomAxis(x), y: sideAxis(y) },
    plugins: { zones: { items: zones }, probe: { stops } },
  }
}

/**
 * Options for a horizontal bar chart (`indexAxis: 'y'`): the values along the
 * bottom, the categories hidden unless `categories` names them.
 */
export function barChartOptions({ x, stacked = false, categories = false, stops = [] }) {
  return {
    ...BASE,
    indexAxis: 'y',
    layout: { padding: { top: TIP_ROOM } },
    scales: {
      x: { ...bottomAxis(x), stacked },
      y: { stacked, display: categories, grid: { display: false }, border: { display: false } },
    },
    plugins: { zones: { items: [] }, probe: { stops } },
  }
}

// One pattern per canvas context and colour.
const patterns = new WeakMap()

/**
 * A diagonal hatch in a tone, as a canvas pattern for that context. Falls
 * back to a soft fill where the canvas has no 2D context (tests).
 * @param {CanvasRenderingContext2D} ctx @param {string} name @param {number} [strength] line alpha
 */
export function hatchPattern(ctx, name, strength = 0.55) {
  const color = tint(name, strength)
  if (!ctx || typeof document === 'undefined') return color
  let byColor = patterns.get(ctx)
  if (!byColor) patterns.set(ctx, (byColor = new Map()))
  if (byColor.has(color)) return byColor.get(color)
  const size = 7
  const tile = document.createElement('canvas')
  tile.width = size
  tile.height = size
  const t = tile.getContext?.('2d')
  if (!t || !ctx.createPattern) return color
  t.strokeStyle = color
  t.lineWidth = 1.25
  // Two strokes so the lines join across tile edges.
  t.beginPath()
  t.moveTo(0, size)
  t.lineTo(size, 0)
  t.moveTo(-1, 1)
  t.lineTo(1, -1)
  t.moveTo(size - 1, size + 1)
  t.lineTo(size + 1, size - 1)
  t.stroke()
  const pattern = ctx.createPattern(tile, 'repeat') ?? color
  byColor.set(color, pattern)
  return pattern
}

/** A scriptable backgroundColor that hatches a bar in a tone. */
export function hatchFill(name) {
  const fill = (context) => hatchPattern(context.chart.ctx, name, 0.9)
  fill.hatchTone = name
  return fill
}
