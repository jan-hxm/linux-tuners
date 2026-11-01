import { describe, it, expect } from 'vitest'
import { VALUE_TYPES, valueTypeOf, differingKeys } from './valueTypes.js'

const RANGE = { min: 0, max: 100 }
const INT = { key: 'n' }
const BOOL = { key: 'b', type: 'bool' }
const ENUM = { key: 'cc', type: 'enum', kernelDefault: 'cubic', options: [{ value: 'cubic', label: 'CUBIC' }, { value: 'bbr', label: 'BBR' }] }
const TUPLE = { key: 'mem', type: 'tuple', length: 3 }

/** Untrusted inputs no type may accept as-is. */
const HOSTILE = [undefined, null, true, {}, '1\nvm.x = 1', 'bbr\n', NaN, Infinity]

describe('valueTypeOf', () => {
  it('defaults to int and refuses unknown or inherited type names', () => {
    expect(valueTypeOf(INT)).toBe(VALUE_TYPES.int)
    for (const type of ['float', 'toString', '__proto__']) {
      expect(() => valueTypeOf({ key: 'x', type }), type).toThrow()
    }
  })
})

describe('int', () => {
  const t = VALUE_TYPES.int
  it('restores finite numbers rounded, and nothing else', () => {
    expect(t.restore(60.4, INT)).toBe(60)
    for (const raw of [...HOSTILE, '60', [60]]) expect(t.restore(raw, INT), String(raw)).toBeUndefined()
  })
  it('clamps and rounds into the range', () => {
    expect([-5, 60.5, 1e308].map((v) => t.clamp(v, INT, RANGE))).toEqual([0, 61, 100])
  })
  it('formats integers only', () => {
    expect(t.format(-1, INT)).toBe('-1')
    for (const v of [1.5, NaN, '1', null]) expect(() => t.format(v, INT), String(v)).toThrow()
  })
})

describe('bool', () => {
  const t = VALUE_TYPES.bool
  it('holds any number to 0 or 1, whatever the range', () => {
    expect([-3, 0.4, 0.6, 7].map((v) => t.clamp(v, BOOL, { min: 0, max: 10 }))).toEqual([0, 0, 1, 1])
    expect(t.restore(true, BOOL)).toBeUndefined()
  })
  it('formats 0 and 1 only', () => {
    expect(t.format(1, BOOL)).toBe('1')
    expect(() => t.format(2, BOOL)).toThrow()
  })
})

describe('enum', () => {
  const t = VALUE_TYPES.enum
  it('restores listed values only', () => {
    expect(t.restore('bbr', ENUM)).toBe('bbr')
    for (const raw of [...HOSTILE, 'reno', 'toString', 0]) expect(t.restore(raw, ENUM), String(raw)).toBeUndefined()
  })
  it('clamps an unlisted value to the default and refuses to format one', () => {
    expect(t.clamp('reno', ENUM, RANGE)).toBe('cubic')
    expect(t.format('bbr', ENUM)).toBe('bbr')
    expect(() => t.format('reno', ENUM)).toThrow()
  })
})

describe('tuple', () => {
  const t = VALUE_TYPES.tuple
  it('restores arrays of the right length, rounded', () => {
    expect(t.restore([1.4, 2, 3], TUPLE)).toEqual([1, 2, 3])
    for (const raw of [...HOSTILE, [1, 2], [1, 2, 3, 4], [1, '2', 3], [1, null, 3]]) {
      expect(t.restore(raw, TUPLE), JSON.stringify(raw)).toBeUndefined()
    }
  })
  it('clamps each element and formats space-separated', () => {
    expect(t.clamp([-1, 50, 500], TUPLE, RANGE)).toEqual([0, 50, 100])
    expect(t.format([4096, 131072, 6291456], TUPLE)).toBe('4096 131072 6291456')
    expect(() => t.format([1, 2], TUPLE)).toThrow()
    expect(() => t.format([1, 2.5, 3], TUPLE)).toThrow()
  })
  it('clamps each element to its own range when the range names them', () => {
    const range = { ...RANGE, elements: [{ min: 0, max: 10 }, { min: 20, max: 30 }, { min: 0, max: 100 }] }
    expect(t.clamp([50, 0, 500], TUPLE, range)).toEqual([10, 20, 100])
  })
  it('compares element-wise', () => {
    expect(t.equals([1, 2, 3], [1, 2, 3])).toBe(true)
    expect(t.equals([1, 2, 3], [1, 2, 4])).toBe(false)
  })
})

describe('differingKeys', () => {
  it('lists the preset keys whose value differs, by type', () => {
    const defsByKey = { n: INT, mem: TUPLE }
    expect(differingKeys(defsByKey, { n: 1, mem: [1, 2, 3] }, { n: 1, mem: [1, 2, 3] })).toEqual([])
    expect(differingKeys(defsByKey, { n: 1, mem: [1, 2, 3] }, { n: 2, mem: [1, 2, 3] })).toEqual(['n'])
  })
})
