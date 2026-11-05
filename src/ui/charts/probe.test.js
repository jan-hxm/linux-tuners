import { describe, it, expect } from 'vitest'
import { nearestStop, placeTip, stepIndex, stopText, valueAt } from './probe.js'

/** A chart double: x and y map 1:1 to pixels, one series. */
const fakeChart = (data) => ({
  width: 100,
  height: 100,
  data: { datasets: [{ data, probeDot: true }] },
  isDatasetVisible: () => true,
  scales: { x: { getPixelForValue: (v) => v }, y: { getPixelForValue: (v) => v } },
  chartArea: { top: 0, bottom: 100, left: 0, right: 100 },
})

describe('probe', () => {
  it('interpolates a series between its points', () => {
    const data = [
      { x: 0, y: 0 },
      { x: 10, y: 100 },
    ]
    expect(valueAt(data, 0)).toBe(0)
    expect(valueAt(data, 5)).toBe(50)
    expect(valueAt(data, 11)).toBeNull()
  })

  it('picks the stop nearest the pointer', () => {
    const chart = fakeChart([
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ])
    const stops = [0, 40, 80].map((x) => ({ x, title: '', lines: [] }))
    expect(nearestStop(chart, stops, 55, 50)).toBe(1)
    expect(nearestStop(chart, stops, 75, 0)).toBe(2)
  })

  it('steps with the arrow, page and end keys, clamped', () => {
    expect(stepIndex('ArrowRight', null, 5)).toBe(0)
    expect(stepIndex('ArrowLeft', null, 5)).toBe(4)
    expect(stepIndex('ArrowRight', 1, 5)).toBe(2)
    expect(stepIndex('ArrowRight', 4, 5)).toBe(4)
    expect(stepIndex('ArrowLeft', 0, 5)).toBe(0)
    expect(stepIndex('PageDown', 0, 100)).toBe(10)
    expect(stepIndex('End', 0, 5)).toBe(4)
    expect(stepIndex('Home', 3, 5)).toBe(0)
    expect(stepIndex('Escape', 3, 5)).toBeNull()
    expect(stepIndex('Escape', null, 5)).toBeUndefined()
    expect(stepIndex('Tab', 3, 5)).toBeUndefined()
    expect(stepIndex('ArrowRight', null, 0)).toBeUndefined()
  })

  it('reads a stop as sentences', () => {
    expect(stopText({ title: 'At 80% memory fill', lines: ['32% of swap in use', 'In the kswapd band.'] })).toBe(
      'At 80% memory fill. 32% of swap in use. In the kswapd band.',
    )
  })

  // y pixels are the values here, so a series at y=v sits v px from the top.
  const overlaps = (t, w, h, x, y) => x >= t.left && x <= t.left + w && y >= t.top && y <= t.top + h

  it('floats the tooltip in the top corner farthest from the crosshair', () => {
    const chart = fakeChart([{ x: 0, y: 90 }, { x: 100, y: 90 }])
    expect(placeTip(chart, { x: 80, title: '', lines: [] }, 30, 20)).toEqual({ left: 4, top: 4 })
    expect(placeTip(chart, { x: 10, title: '', lines: [] }, 30, 20)).toEqual({ left: 66, top: 4 })
  })

  it('moves the tooltip off the point it describes', () => {
    // A wide tooltip and a point in the top corner: the top spot would cover it.
    const chart = fakeChart([{ x: 0, y: 5 }, { x: 100, y: 5 }])
    const stop = { x: 50, title: '', lines: [] }
    const t = placeTip(chart, stop, 60, 20)
    expect(overlaps(t, 60, 20, 50, 5)).toBe(false)
    expect(t.top).toBe(76)
  })

  it('puts the tooltip below the frame when a bar fills the plot', () => {
    const el = { getProps: () => ({ x: 100, base: 0, y: 50, height: 90, width: 0 }) }
    const chart = { ...fakeChart([]), options: { indexAxis: 'y' }, getDatasetMeta: () => ({ data: [el] }) }
    expect(placeTip(chart, { element: { datasetIndex: 0, index: 0 }, title: '', lines: [] }, 40, 20).top).toBe(104)
  })
})
