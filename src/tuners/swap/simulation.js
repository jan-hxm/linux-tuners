/**
 * Pure simulation math for the three GraphPanel tabs.
 *
 * Important: these are *teaching models*, not kernel-accurate predictions.
 * The goal is for the user to see the SHAPE of how each vm.* parameter affects
 * system behaviour, so they understand the tradeoffs they're making with the
 * sliders. Every function here is a pure mapping from (hardware, params) →
 * chart data with no side effects, so the `useSimulation` composable can wrap
 * them in `computed` for cheap reactivity.
 */

import { watermarkLevelsMiB } from './calculations.js'

const PRESSURE_SAMPLES = 101 // memory fill from 0% to 100% in 1% steps
const DIRTY_SECONDS = 120
// Synthetic workload constants picked so a default config (bg=10, ratio=20)
// hits the stall regime well inside the 120 s window. They're not calibrated
// against any specific real workload — the goal is for slider movement to be
// visibly meaningful on the chart.
const DIRTY_WRITE_RATE_PCT_PER_S = 1.0
const DIRTY_BG_FLUSH_EFFICIENCY = 0.6 // bg flusher absorbs 60% of incoming rate

/**
 * Tab 1: swap pressure curve.
 *
 * Maps memory fill % (0..100) to estimated swap usage % (0..100). Three regimes:
 *   - below the high watermark: kernel sees plenty of free memory, swap idle
 *   - between high and low watermark: kswapd is awake, reclaiming asynchronously;
 *     how much of that reclaim hits anonymous pages (= swap) is governed by
 *     swappiness
 *   - below the low watermark: direct reclaim, applications stall, swap fills
 *     aggressively
 *
 * The watermark_scale_factor widens the kswapd band — visible as a wider shaded
 * region in the chart and a gentler swap-onset slope.
 *
 * @param {import('./parameters.js').HardwareSpec} hw
 * @param {import('./parameters.js').ParameterValues} params
 */
export function pressureCurve(hw, params) {
  const totalMiB = hw.ramGiB * 1024
  const minMiB = params.min_free_kbytes / 1024
  const windowMiB = (totalMiB * params.watermark_scale_factor) / 10000
  const lowMiB = minMiB + windowMiB
  const highMiB = lowMiB + windowMiB

  // Express the three thresholds as memory-fill percentages so the chart's
  // x-axis (mem fill %) and the threshold lines share a coordinate space.
  const highFillPct = clampPct(100 * (1 - highMiB / totalMiB))
  const lowFillPct = clampPct(100 * (1 - lowMiB / totalMiB))
  const minFillPct = clampPct(100 * (1 - minMiB / totalMiB))

  const swapBias = params.swappiness / 100 // 0..2 — kernel-allowed range
  const noSwap = hw.swapGiB === 0

  /** @type {{ memFill: number, swapUsage: number }[]} */
  const points = []
  for (let i = 0; i < PRESSURE_SAMPLES; i++) {
    const memFill = (i * 100) / (PRESSURE_SAMPLES - 1)
    let swapUsage = 0
    if (!noSwap) {
      if (memFill < highFillPct) {
        swapUsage = 0
      } else if (memFill < lowFillPct) {
        // Linear ramp within kswapd band, scaled by swappiness/100.
        const t = (memFill - highFillPct) / Math.max(0.01, lowFillPct - highFillPct)
        swapUsage = 50 * t * swapBias
      } else {
        // Direct reclaim: steeper ramp from the 50%*swapBias the kswapd band ended at.
        const startedAt = 50 * swapBias
        const t = (memFill - lowFillPct) / Math.max(0.01, minFillPct - lowFillPct)
        swapUsage = startedAt + (100 - startedAt) * Math.min(1, t * Math.max(0.5, swapBias))
      }
    }
    points.push({ memFill, swapUsage: clampPct(swapUsage) })
  }

  return {
    points,
    highFillPct,
    lowFillPct,
    minFillPct,
    oomFillPct: 100, // beyond min watermark = OOM territory
    noSwap,
  }
}

/**
 * Tab 2: watermark zone breakdown.
 *
 * Returns the three watermark heights and the usable region as MiB. The chart
 * renders these as a horizontal stacked bar.
 *
 * Also produces a /proc/zoneinfo-style code block for users who recognise the
 * format from the K8s blog illustration.
 *
 * @param {import('./parameters.js').HardwareSpec} hw
 * @param {import('./parameters.js').ParameterValues} params
 */
export function watermarkBars(hw, params) {
  const lv = watermarkLevelsMiB(hw.ramGiB, params.min_free_kbytes, params.watermark_scale_factor)
  const totalMiB = hw.ramGiB * 1024
  return {
    minMiB: lv.minMiB,
    lowMiB: lv.lowMiB,
    highMiB: lv.highMiB,
    usableMiB: lv.usableMiB,
    totalMiB,
    // Segment widths for the stacked bar.
    segments: [
      { label: 'reserved (≤ min)', mib: lv.minMiB, color: '#dc2626' },
      { label: 'direct-reclaim (min → low)', mib: lv.lowMiB - lv.minMiB, color: '#d97706' },
      { label: 'kswapd (low → high)', mib: lv.highMiB - lv.lowMiB, color: '#0ea5e9' },
      { label: 'usable (> high)', mib: lv.usableMiB, color: '#16a34a' },
    ],
    zoneInfoSnippet: renderZoneInfo(lv, totalMiB),
  }
}

function renderZoneInfo(lv, totalMiB) {
  const pages = (mib) => Math.round((mib * 1024) / 4) // 4 KiB pages
  return [
    'Node 0, zone   Normal',
    `  pages free     ${pages(lv.usableMiB).toString().padStart(7)}`,
    `        min      ${pages(lv.minMiB).toString().padStart(7)}`,
    `        low      ${pages(lv.lowMiB).toString().padStart(7)}`,
    `        high     ${pages(lv.highMiB).toString().padStart(7)}`,
    `        managed  ${pages(totalMiB).toString().padStart(7)}`,
  ].join('\n')
}

/**
 * Tab 3: dirty writeback timeline.
 *
 * Simulates a synthetic constant-write-rate workload over 120 seconds. Dirty
 * pages accumulate at DIRTY_WRITE_RATE_PCT_PER_S; the flusher kicks in when
 * dirty crosses dirty_background_ratio; writes synchronously stall at
 * dirty_ratio.
 *
 * @param {import('./parameters.js').HardwareSpec} hw
 * @param {import('./parameters.js').ParameterValues} params
 */
export function dirtyTimeline(hw, params) {
  const bg = params.dirty_background_ratio
  const ceiling = params.dirty_ratio
  // dirty_writeback_centisecs = 0 disables periodic writeback entirely. We
  // model that as "background flusher never wakes", so dirty rises straight
  // through bg until the ceiling stalls it.
  const periodicEnabled = params.dirty_writeback_centisecs > 0
  // Expire (centisecs) sets when pages are eligible. Shorter expire = more
  // aggressive even sub-bg flushing. Normalise to a small proactive flush rate.
  const expireSec = params.dirty_expire_centisecs / 100
  const proactiveFlush = expireSec < 5 ? DIRTY_WRITE_RATE_PCT_PER_S * 0.3 : 0

  /** @type {{ t: number, dirty: number, stall: boolean }[]} */
  const points = []
  /** @type {number[]} */
  const flushEvents = []
  let dirty = 0
  let lastFlushAt = -Infinity
  const flushInterval = periodicEnabled ? Math.max(1, params.dirty_writeback_centisecs / 100) : 9999

  for (let t = 0; t <= DIRTY_SECONDS; t++) {
    const writeIn = DIRTY_WRITE_RATE_PCT_PER_S
    let flushOut = 0
    let stall = false

    if (dirty >= ceiling) {
      dirty = ceiling
      flushOut = writeIn // forced 1:1 flush as writes stall
      stall = true
    } else if (dirty >= bg && periodicEnabled) {
      // Background flusher absorbs most but not all of the incoming rate;
      // the gap is what makes dirty keep climbing toward the ratio ceiling.
      flushOut = writeIn * DIRTY_BG_FLUSH_EFFICIENCY
    } else if (periodicEnabled) {
      flushOut = proactiveFlush
    }

    if (periodicEnabled && t - lastFlushAt >= flushInterval && dirty > 0) {
      flushEvents.push(t)
      lastFlushAt = t
    }

    dirty = Math.max(0, dirty + writeIn - flushOut)
    points.push({ t, dirty: Math.min(ceiling, dirty), stall })
  }

  return {
    points,
    flushEvents,
    bgLine: bg,
    ratioLine: ceiling,
    stallReached: points.some((p) => p.stall),
  }
}

/**
 * Summary metrics derived from current params, shown as small cards under the
 * chart. Each metric is a value plus a qualitative band ('low'/'med'/'high')
 * for colour-coding.
 *
 * @param {import('./parameters.js').HardwareSpec} hw
 * @param {import('./parameters.js').ParameterValues} params
 */
export function impactSummary(hw, params) {
  const lv = watermarkLevelsMiB(hw.ramGiB, params.min_free_kbytes, params.watermark_scale_factor)
  const kswapdRunwayMiB = lv.highMiB - lv.lowMiB

  // Swap aggressiveness: combines swappiness and swap availability.
  let swapBand = 'low'
  if (hw.swapGiB === 0) swapBand = 'none'
  else if (params.swappiness > 100) swapBand = 'high'
  else if (params.swappiness > 30) swapBand = 'med'

  // OOM risk: narrow kswapd runway + tight dirty_ratio + low min_free pushes risk up.
  const runwayPct = (kswapdRunwayMiB / (hw.ramGiB * 1024)) * 100
  let oomBand = 'low'
  if (runwayPct < 1 || params.min_free_kbytes < 8192) oomBand = 'high'
  else if (runwayPct < 3) oomBand = 'med'

  // kswapd runway band: the chart shows this band visually too.
  let runwayBand = 'low'
  if (runwayPct >= 5) runwayBand = 'high'
  else if (runwayPct >= 2) runwayBand = 'med'

  return [
    {
      id: 'swap-aggressiveness',
      label: 'Swap aggressiveness',
      value: hw.swapGiB === 0 ? 'no swap' : `swappiness ${params.swappiness}`,
      band: swapBand,
    },
    {
      id: 'oom-risk',
      label: 'OOM risk',
      value: oomBand === 'high' ? 'elevated' : oomBand === 'med' ? 'moderate' : 'low',
      band: oomBand,
    },
    {
      id: 'kswapd-runway',
      label: 'kswapd runway',
      value: `${kswapdRunwayMiB.toLocaleString()} MiB`,
      band: runwayBand,
    },
  ]
}

function clampPct(v) {
  if (!Number.isFinite(v)) return 0
  return Math.max(0, Math.min(100, v))
}