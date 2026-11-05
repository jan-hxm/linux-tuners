// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { Chart } from 'chart.js'
import './chartSetup.js'
import { PALETTE, tint } from './palette.js'
import {
  MAIN_WIDTH,
  band,
  TIP_ROOM,
  barChartOptions,
  barKind,
  barSegment,
  firstRise,
  focusRange,
  comparisonSeries,
  hatchZone,
  lineChartOptions,
  mainSeries,
  ownerLabel,
  threshold,
  xStop,
} from './chartStyle.js'

describe('chart setup', () => {
  it('registers the shared plugins once and replaces Chart.js hover and tooltip', () => {
    for (const id of ['zones', 'endLabels', 'probe']) expect(Chart.registry.plugins.get(id), id).toBeTruthy()
    expect(Chart.defaults.plugins.tooltip.enabled).toBe(false)
    expect(Chart.defaults.events).toEqual([])
    expect(Chart.defaults.animation).toBe(false)
  })
})

describe('chart style', () => {
  it('draws the main series thick, in its owner tone, over a 10% fill', () => {
    const s = mainSeries({ data: [], label: 'swap', tone: 'mine' })
    expect(s.borderWidth).toBe(MAIN_WIDTH)
    expect(MAIN_WIDTH).toBeCloseTo(2.75)
    expect(s.borderColor).toBe(PALETTE.mine)
    expect(s.backgroundColor).toBe(tint('mine', 0.1))
    expect(s.fill).toBe('origin')
    expect(s.endLabel).toEqual({ text: 'yours', color: PALETTE.mineText, weight: 500 })
    expect(mainSeries({ data: [], label: 'x', tone: 'fit' }).endLabel.text).toBe('fits your machine')
    expect(mainSeries({ data: [], label: 'x' }).endLabel).toBeNull()
  })

  it('names the owner only for fit and mine', () => {
    expect([ownerLabel('fit'), ownerLabel('mine'), ownerLabel('ink')]).toEqual(['fits your machine', 'yours', null])
  })

  it('draws a comparison series thin, dashed and quiet', () => {
    const s = comparisonSeries({ data: [], label: 'kernel default', endLabel: 'kernel default' })
    expect(s.borderColor).toBe(PALETTE.quiet)
    expect(s.borderDash.length).toBe(2)
    expect(s.borderWidth).toBeLessThan(MAIN_WIDTH)
    expect(s.fill).toBe(false)
    expect(s.endLabel.color).toBe(PALETTE.ink2Text)
  })

  it('keeps only horizontal hairlines and passes zones and stops to the plugins', () => {
    const zones = [band('x', 10, 20), hatchZone('x', 90, 100), threshold('y', 5)]
    const stops = [xStop(1, 'At 1', ['one'])]
    const o = lineChartOptions({ x: { min: 0, max: 100, title: 'fill' }, y: { min: 0, max: 100 }, zones, stops })
    expect(o.scales.x.grid.display).toBe(false)
    expect(o.scales.y.grid.display).toBe(true)
    expect(o.scales.y.grid.color).toBe(PALETTE.rule)
    expect(o.scales.y.title.display).toBe(false)
    expect(o.scales.x.title.text).toBe('fill')
    expect(o.plugins.zones.items).toBe(zones)
    expect(o.plugins.probe.stops).toBe(stops)
    expect(zones.map((z) => z.kind)).toEqual(['band', 'hatch', 'threshold'])
    expect(hatchZone('x', 0, 1).tone).toBe('error')
  })

  it('draws bars without a grid and hatches danger segments', () => {
    const o = barChartOptions({ stacked: true, x: { min: 0, max: 100 } })
    expect(o.indexAxis).toBe('y')
    expect(o.scales.x.grid.display).toBe(false)
    expect(o.scales.y.display).toBe(false)
    const solid = barSegment({ label: 'ok', data: [1], tone: 'ink' })
    expect(solid.backgroundColor).toBe(PALETTE.ink)
    // rule is too faint on paper to carry a bar, so it becomes a quiet outline.
    const faint = barSegment({ label: 'free', data: [1], tone: 'rule' })
    expect(faint.borderColor).toBe(PALETTE.quiet)
    expect(faint.markTone).toBe('quiet')
    expect([barKind('rule'), barKind('ink'), barKind('error', true)]).toEqual(['outline', 'fill', 'hatch'])
    const danger = barSegment({ label: 'oom', data: [1], tone: 'error', hatch: true })
    expect(typeof danger.backgroundColor).toBe('function')
    expect(danger.backgroundColor.hatchTone).toBe('error')
    expect(barSegment({ label: 'two', data: [1, 2], tone: ['ink', 'quiet'] }).backgroundColor).toEqual([PALETTE.ink, PALETTE.quiet])
  })

  it('keeps room above the plot for the tooltip', () => {
    expect(lineChartOptions({ x: {}, y: {} }).layout.padding.top).toBe(TIP_ROOM)
    expect(barChartOptions({ x: {} }).layout.padding.top).toBe(TIP_ROOM)
  })

  it('focuses the axis on where the data changes', () => {
    const flatThenRise = [0, 1, 2, 3].map((i) => ({ x: i * 33, y: i === 3 ? 50 : 0 }))
    expect(firstRise(flatThenRise)).toBe(66)
    expect(firstRise([{ x: 0, y: 0 }, { x: 1, y: 0 }])).toBe(Infinity)
    // The change is at 99 of 0..100: show 98..100.
    expect(focusRange({ min: 0, max: 100, from: 99 })).toEqual({ min: 98, max: 100, zoomed: true })
    // A wide band starting at 80: a margin of half the rest, rounded down.
    expect(focusRange({ min: 0, max: 100, from: 80 })).toEqual({ min: 70, max: 100, zoomed: true })
    // Early change, or none: the whole axis.
    expect(focusRange({ min: 0, max: 100, from: 20 })).toEqual({ min: 0, max: 100, zoomed: false })
    expect(focusRange({ min: 0, max: 100, from: Infinity })).toEqual({ min: 0, max: 100, zoomed: false })
  })
})
