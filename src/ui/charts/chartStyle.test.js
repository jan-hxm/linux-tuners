// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { Chart } from 'chart.js'
import './chartSetup.js'
import { PALETTE, tint } from './palette.js'
import {
  MAIN_WIDTH,
  band,
  barChartOptions,
  barSegment,
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
    const solid = barSegment({ label: 'ok', data: [1], tone: 'rule' })
    expect(solid.backgroundColor).toBe(PALETTE.rule)
    const danger = barSegment({ label: 'oom', data: [1], tone: 'error', hatch: true })
    expect(typeof danger.backgroundColor).toBe('function')
    expect(danger.backgroundColor.hatchTone).toBe('error')
    expect(barSegment({ label: 'two', data: [1, 2], tone: ['ink', 'quiet'] }).backgroundColor).toEqual([PALETTE.ink, PALETTE.quiet])
  })
})
