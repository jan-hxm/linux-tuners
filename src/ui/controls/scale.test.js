import { describe, it, expect } from 'vitest'
import { pctOf, inRange, tickLabel, scaleTicks } from './scale.js'

describe('pctOf / inRange', () => {
  it('places a value on its range and clamps outside it', () => {
    expect(pctOf(50, { min: 0, max: 200 })).toBe(25)
    expect(pctOf(-5, { min: 0, max: 200 })).toBe(0)
    expect(pctOf(500, { min: 0, max: 200 })).toBe(100)
    expect(pctOf(5, { min: 5, max: 5 })).toBe(0)
    expect(pctOf(null, { min: 0, max: 10 })).toBe(0)
  })

  it('only counts finite numbers inside the range', () => {
    expect(inRange(0, { min: 0, max: 10 })).toBe(true)
    expect(inRange(11, { min: 0, max: 10 })).toBe(false)
    expect(inRange(null, { min: 0, max: 10 })).toBe(false)
    expect(inRange('5', { min: 0, max: 10 })).toBe(false)
  })
})

describe('tickLabel', () => {
  it('prints small numbers as they are and shortens large ones', () => {
    expect(tickLabel(0)).toBe('0')
    expect(tickLabel(9999)).toBe('9999')
    expect(tickLabel(50000)).toBe('50k')
    expect(tickLabel(1500000)).toBe('1.5M')
    expect(tickLabel(2147483647)).toBe('2.1G')
  })
})

describe('scaleTicks', () => {
  const labels = (r) => scaleTicks(r).major.filter((t) => t.label).map((t) => t.label)

  it('numbers about four even intervals', () => {
    expect(labels({ min: 0, max: 200 })).toEqual(['0', '50', '100', '150', '200'])
    expect(labels({ min: 0, max: 6 })).toEqual(['0', '2', '4', '6'])
    expect(labels({ min: 0, max: 1 })).toEqual(['0', '1'])
  })

  it('always ticks both ends, and drops an end number crowded by a major tick', () => {
    const t = scaleTicks({ min: 1, max: 10000 })
    expect(t.major[0]).toMatchObject({ value: 1, pct: 0 })
    expect(t.major.at(-1)).toMatchObject({ value: 10000, pct: 100 })
    expect(t.major[0].label).toBe('1') // the first major tick, 2500, is a quarter away
    // 4000 sits 2.4% from 4096, so the end keeps its tick but not its number.
    const crowded = scaleTicks({ min: 16, max: 4096 })
    expect(crowded.major.at(-1)).toMatchObject({ value: 4096, label: '' })
    const big = scaleTicks({ min: 0, max: 2147483647 })
    expect(big.major.at(-1).value).toBe(2147483647)
    for (const m of big.major) expect(m.label.length).toBeLessThanOrEqual(5)
  })

  it('never prints two numbers on top of each other', () => {
    for (const r of [{ min: 1, max: 10000 }, { min: 3, max: 97 }, { min: 0, max: 2147483647 }, { min: 16, max: 4096 }, { min: 1, max: 9 }]) {
      const pcts = scaleTicks(r).major.filter((t) => t.label).map((t) => t.pct)
      for (let i = 1; i < pcts.length; i++) expect(pcts[i] - pcts[i - 1], JSON.stringify(r)).toBeGreaterThanOrEqual(10)
    }
  })

  it('adds whole minor ticks between the major ones, never on them', () => {
    const { major, minor } = scaleTicks({ min: 0, max: 200 })
    expect(minor).toHaveLength(19 - 3) // every 10 from 10 to 190, less 50, 100 and 150
    const majors = new Set(major.map((m) => m.pct))
    expect(minor.some((p) => majors.has(p))).toBe(false)
    expect(scaleTicks({ min: 0, max: 1 }).minor).toEqual([])
  })

  it('handles an empty range', () => {
    expect(scaleTicks({ min: 4, max: 4 }).major).toHaveLength(1)
  })
})
