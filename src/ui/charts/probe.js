/**
 * The probe: a crosshair (line charts) or an outlined bar (bar charts) at one
 * of the chart's stops, with a tooltip in plain words. ChartFrame moves it on
 * hover, tap and the arrow keys; plugins.js draws it. Stops come from the
 * chart's raw options (`options.plugins.probe.stops`, built with
 * chartStyle.js's `xStop` / `barStop`), so the frame knows nothing about any
 * one chart.
 */

/** The stops of a Chart.js instance, read raw (unresolved) from its config. */
export function stopsOf(chart) {
  return chart?.config?.options?.plugins?.probe?.stops ?? []
}

/** A series' y at x, interpolated linearly between its points (sorted by x). */
export function valueAt(data, x) {
  if (!data?.length) return null
  if (x <= data[0].x) return data[0].x === x ? data[0].y : null
  for (let i = 1; i < data.length; i++) {
    const a = data[i - 1]
    const b = data[i]
    if (x <= b.x) return b.x === a.x ? b.y : a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x)
  }
  return null
}

/** The datasets that get a dot at an x stop, with their y at that x. */
export function dotsAt(chart, x) {
  return chart.data.datasets
    .map((ds, i) => ({ ds, i, y: ds.probeDot && chart.isDatasetVisible(i) ? valueAt(ds.data, x) : null }))
    .filter((d) => d.y !== null)
}

/** A bar element's box in pixels. */
function barBox(chart, { datasetIndex, index }) {
  const el = chart.getDatasetMeta(datasetIndex)?.data?.[index]
  if (!el) return null
  const { x, y, base, width, height } = el.getProps(['x', 'y', 'base', 'width', 'height'], true)
  const horizontal = chart.options.indexAxis === 'y'
  return horizontal
    ? { left: Math.min(x, base), right: Math.max(x, base), top: y - height / 2, bottom: y + height / 2 }
    : { left: x - width / 2, right: x + width / 2, top: Math.min(y, base), bottom: Math.max(y, base) }
}

/**
 * Where a stop sits in pixels: `x`, `y` (the main dot, or the bar's centre)
 * and, for a bar, its `box`.
 */
export function anchorOf(chart, stop) {
  if (!stop) return null
  if (stop.element) {
    const box = barBox(chart, stop.element)
    if (!box) return null
    return { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2, box }
  }
  const x = chart.scales.x.getPixelForValue(stop.x)
  const dot = dotsAt(chart, stop.x)[0]
  const y = dot ? chart.scales.y.getPixelForValue(dot.y) : (chart.chartArea.top + chart.chartArea.bottom) / 2
  return { x, y }
}

/** The index of the stop nearest a pointer at (px, py), or -1. */
export function nearestStop(chart, stops, px, py) {
  let best = -1
  let bestDistance = Infinity
  stops.forEach((stop, i) => {
    const a = anchorOf(chart, stop)
    if (!a) return
    let d
    if (a.box) {
      const inside = px >= a.box.left && px <= a.box.right && py >= a.box.top - 8 && py <= a.box.bottom + 8
      d = inside ? -1 : Math.hypot(Math.max(a.box.left - px, 0, px - a.box.right), Math.max(a.box.top - py, 0, py - a.box.bottom))
    } else d = Math.abs(a.x - px)
    if (d < bestDistance) {
      best = i
      bestDistance = d
    }
  })
  return best
}

/**
 * The stop a key moves to: Left/Right one stop, PageUp/PageDown a tenth of
 * them, Home/End the ends. `null` hides the probe (Escape); `undefined`
 * means the key isn't the probe's.
 * @param {string} key @param {number | null} current @param {number} count
 */
export function stepIndex(key, current, count) {
  if (!count) return undefined
  const big = Math.max(1, Math.round(count / 10))
  const clamp = (i) => Math.min(count - 1, Math.max(0, i))
  if (key === 'Escape') return current === null ? undefined : null
  if (current === null) {
    if (key === 'ArrowRight' || key === 'ArrowDown' || key === 'Home' || key === 'PageDown') return 0
    if (key === 'ArrowLeft' || key === 'ArrowUp' || key === 'End' || key === 'PageUp') return count - 1
    return undefined
  }
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return clamp(current + 1)
    case 'ArrowLeft':
    case 'ArrowUp':
      return clamp(current - 1)
    case 'PageDown':
      return clamp(current + big)
    case 'PageUp':
      return clamp(current - big)
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return undefined
  }
}

/** The tooltip as one announcement: its title and lines as sentences. */
export function stopText(stop) {
  return [stop.title, ...stop.lines].map((s) => s.replace(/[.:]?$/, '.')).join(' ')
}
