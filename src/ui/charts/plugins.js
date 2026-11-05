/**
 * The Chart.js plugins behind the chart look (chartStyle.js), registered once
 * in chartSetup.js. Each reads plain data from the chart's raw config and
 * names tones, never colours:
 *
 * - `zones`: bands, hatched danger zones and dashed thresholds, under the series.
 * - `endLabels`: a series' short end label, right-aligned above its last point.
 * - `probe`: the crosshair with a dot on each series, or the outline around
 *   the probed bar, at the stop ChartFrame set in `chart.$probe`.
 */
import { tone, tint } from './palette.js'
import { BAND_ALPHA, THRESHOLD_DASH, hatchPattern } from './chartStyle.js'
import { anchorOf, dotsAt, stopsOf } from './probe.js'
import { FONT_SANS } from '../theme.js'

const raw = (chart, id) => chart.config.options?.plugins?.[id] ?? {}

/** The pixel span of [from, to] on a scale, clipped to the chart area. */
function span(chart, axis, from, to) {
  const scale = chart.scales[axis]
  const { left, right, top, bottom } = chart.chartArea
  const a = scale.getPixelForValue(from)
  const b = scale.getPixelForValue(to)
  if (axis === 'x') {
    const l = Math.max(left, Math.min(a, b))
    const r = Math.min(right, Math.max(a, b))
    return r > l ? { x: l, y: top, w: r - l, h: bottom - top } : null
  }
  const t = Math.max(top, Math.min(a, b))
  const bt = Math.min(bottom, Math.max(a, b))
  return bt > t ? { x: left, y: t, w: right - left, h: bt - t } : null
}

export const zonesPlugin = {
  id: 'zones',
  beforeDatasetsDraw(chart) {
    const items = raw(chart, 'zones').items ?? []
    if (!items.length) return
    const { ctx } = chart
    const { left, right, top, bottom } = chart.chartArea
    ctx.save()
    for (const z of items) {
      if (z.kind === 'threshold') {
        const p = chart.scales[z.axis].getPixelForValue(z.at)
        if (!Number.isFinite(p)) continue
        ctx.strokeStyle = tone(z.tone)
        ctx.lineWidth = 1.5
        ctx.setLineDash(THRESHOLD_DASH)
        ctx.beginPath()
        if (z.axis === 'x') {
          if (p < left || p > right) continue
          ctx.moveTo(p, top)
          ctx.lineTo(p, bottom)
        } else {
          if (p < top || p > bottom) continue
          ctx.moveTo(left, p)
          ctx.lineTo(right, p)
        }
        ctx.stroke()
        ctx.setLineDash([])
        continue
      }
      const s = span(chart, z.axis, z.from, z.to)
      if (!s) continue
      ctx.fillStyle = z.kind === 'hatch' ? hatchPattern(ctx, z.tone) : tint(z.tone, BAND_ALPHA)
      ctx.fillRect(s.x, s.y, s.w, s.h)
    }
    ctx.restore()
  },
}

export const endLabelsPlugin = {
  id: 'endLabels',
  afterDatasetsDraw(chart) {
    const labels = chart.data.datasets
      .map((ds, i) => {
        const last = chart.getDatasetMeta(i).data.at(-1)
        return ds.endLabel && last && chart.isDatasetVisible(i) ? { ...ds.endLabel, y: last.y - 9 } : null
      })
      .filter(Boolean)
      .sort((a, b) => a.y - b.y)
    if (!labels.length) return
    const { ctx } = chart
    const { right, top } = chart.chartArea
    // Keep labels 16px apart and inside the plot.
    let prev = -Infinity
    for (const l of labels) {
      l.y = Math.max(l.y, top + 12, prev + 16)
      prev = l.y
    }
    ctx.save()
    ctx.textAlign = 'right'
    ctx.textBaseline = 'alphabetic'
    for (const l of labels) {
      ctx.font = `${l.weight} 13px ${FONT_SANS.join(', ')}`
      // A paper halo, so a label stays legible where it crosses a line.
      ctx.lineWidth = 4
      ctx.strokeStyle = tone('paper')
      ctx.strokeText(l.text, right - 2, l.y)
      ctx.fillStyle = l.color
      ctx.fillText(l.text, right - 2, l.y)
    }
    ctx.restore()
  },
}

export const probePlugin = {
  id: 'probe',
  afterUpdate(chart) {
    chart.$probe?.refresh?.()
  },
  afterDraw(chart) {
    const index = chart.$probe?.index
    if (index === undefined || index === null) return
    const stop = stopsOf(chart)[index]
    const a = anchorOf(chart, stop)
    if (!a) return
    const { ctx } = chart
    const { top, bottom } = chart.chartArea
    ctx.save()
    ctx.strokeStyle = tone('ink')
    if (a.box) {
      ctx.lineWidth = 2
      ctx.strokeRect(a.box.left - 1, a.box.top - 1, a.box.right - a.box.left + 2, a.box.bottom - a.box.top + 2)
    } else {
      ctx.lineWidth = 1
      ctx.setLineDash([2, 3])
      ctx.beginPath()
      ctx.moveTo(a.x, top)
      ctx.lineTo(a.x, bottom)
      ctx.stroke()
      ctx.setLineDash([])
      for (const d of dotsAt(chart, stop.x)) {
        ctx.beginPath()
        ctx.arc(a.x, chart.scales.y.getPixelForValue(d.y), 5, 0, Math.PI * 2)
        ctx.fillStyle = tone('paper')
        ctx.fill()
        ctx.lineWidth = 2.5
        ctx.strokeStyle = d.ds.borderColor
        ctx.stroke()
      }
    }
    ctx.restore()
  },
}
