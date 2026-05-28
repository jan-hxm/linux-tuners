import { describe, it, expect } from 'vitest'
import { pressureCurve, watermarkBars, dirtyTimeline, impactSummary } from './simulation.js'
import { deriveDefaults } from './calculations.js'
import { DEFAULT_HARDWARE } from './parameters.js'

const baseHw = { ...DEFAULT_HARDWARE }
const baseParams = deriveDefaults(baseHw)

describe('pressureCurve', () => {
  it('produces a sample at every percent from 0 to 100', () => {
    const c = pressureCurve(baseHw, baseParams)
    expect(c.points).toHaveLength(101)
    expect(c.points[0].memFill).toBe(0)
    expect(c.points[100].memFill).toBe(100)
  })

  it('keeps swap usage at 0 when no swap is configured', () => {
    const hw = { ...baseHw, swapGiB: 0 }
    const c = pressureCurve(hw, baseParams)
    expect(c.noSwap).toBe(true)
    expect(c.points.every((p) => p.swapUsage === 0)).toBe(true)
  })

  it('swappiness=10 gives a flatter curve than swappiness=100 at the same memFill', () => {
    // Use K8s-style watermarks so the reclaim region is wide enough to compare at
    // memFill=85; with the kernel-default wsf=10 the kswapd band sits at ~99% fill.
    const wideHw = { ...baseHw, workload: 'k8s' }
    const wideParams = { min_free_kbytes: 262144, watermark_scale_factor: 2000 }
    const flat = pressureCurve(wideHw, { ...baseParams, ...wideParams, swappiness: 10 })
    const steep = pressureCurve(wideHw, { ...baseParams, ...wideParams, swappiness: 100 })
    const flatAt85 = flat.points.find((p) => p.memFill === 85).swapUsage
    const steepAt85 = steep.points.find((p) => p.memFill === 85).swapUsage
    expect(steepAt85).toBeGreaterThan(flatAt85)
  })

  it('widens the kswapd zone when watermark_scale_factor increases', () => {
    const narrow = pressureCurve(baseHw, { ...baseParams, watermark_scale_factor: 10 })
    const wide = pressureCurve(baseHw, { ...baseParams, watermark_scale_factor: 2000 })
    const narrowBand = narrow.lowFillPct - narrow.highFillPct
    const wideBand = wide.lowFillPct - wide.highFillPct
    expect(wideBand).toBeGreaterThan(narrowBand)
  })
})

describe('watermarkBars', () => {
  it('partitions the bar into four segments that sum to total RAM', () => {
    const b = watermarkBars(baseHw, baseParams)
    const sum = b.segments.reduce((acc, s) => acc + s.mib, 0)
    expect(sum).toBeCloseTo(b.totalMiB, 0)
  })

  it('renders a /proc/zoneinfo-style snippet with min/low/high/free fields', () => {
    const b = watermarkBars(baseHw, baseParams)
    expect(b.zoneInfoSnippet).toMatch(/min\s+\d+/)
    expect(b.zoneInfoSnippet).toMatch(/low\s+\d+/)
    expect(b.zoneInfoSnippet).toMatch(/high\s+\d+/)
    expect(b.zoneInfoSnippet).toMatch(/pages free\s+\d+/)
  })
})

describe('dirtyTimeline', () => {
  it('emits a sample per second from 0 to 120', () => {
    const t = dirtyTimeline(baseHw, baseParams)
    expect(t.points).toHaveLength(121)
    expect(t.points[0].t).toBe(0)
    expect(t.points[120].t).toBe(120)
  })

  it('eventually reaches the stall ceiling at default ratios under constant write pressure', () => {
    const t = dirtyTimeline(baseHw, baseParams)
    // 0.5% per second, default bg=10, ratio=20 → should hit ceiling well before 120s.
    expect(t.stallReached).toBe(true)
  })

  it('tighter ratios stall earlier', () => {
    const loose = dirtyTimeline(baseHw, { ...baseParams, dirty_background_ratio: 40, dirty_ratio: 60 })
    const tight = dirtyTimeline(baseHw, { ...baseParams, dirty_background_ratio: 2, dirty_ratio: 5 })
    const looseFirstStall = loose.points.findIndex((p) => p.stall)
    const tightFirstStall = tight.points.findIndex((p) => p.stall)
    // -1 means "never stalled" — both should stall, but tight earlier.
    expect(tightFirstStall).toBeGreaterThanOrEqual(0)
    expect(tightFirstStall).toBeLessThan(looseFirstStall === -1 ? Infinity : looseFirstStall)
  })

  it('emits no flush events when periodic writeback is disabled', () => {
    const t = dirtyTimeline(baseHw, { ...baseParams, dirty_writeback_centisecs: 0 })
    expect(t.flushEvents).toEqual([])
  })
})

describe('impactSummary', () => {
  it('classifies swap as "none" when swap size is 0', () => {
    const s = impactSummary({ ...baseHw, swapGiB: 0 }, baseParams)
    expect(s.find((m) => m.id === 'swap-aggressiveness').band).toBe('none')
  })

  it('raises OOM risk to "high" when min_free_kbytes is dangerously low', () => {
    const s = impactSummary(baseHw, { ...baseParams, min_free_kbytes: 4096 })
    expect(s.find((m) => m.id === 'oom-risk').band).toBe('high')
  })

  it('reports kswapd runway in MiB matching the watermark window', () => {
    const s = impactSummary(baseHw, baseParams)
    const runway = s.find((m) => m.id === 'kswapd-runway')
    expect(runway.value).toMatch(/MiB$/)
  })
})