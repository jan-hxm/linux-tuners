import { describe, it, expect } from 'vitest'
import { nearestStop, stepIndex, stopText, valueAt } from './probe.js'

/** A chart double: x and y map 1:1 to pixels, one series. */
const fakeChart = (data) => ({
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
})
