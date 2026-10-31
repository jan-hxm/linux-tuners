import { describe, it, expect } from 'vitest'
import {
  profileDefaults,
  profileSchema,
  normalizeField,
  isFieldDisabled,
  matchesRule,
  profileProblems,
} from './profile.js'

const SIZE = { key: 'ramGiB', type: 'number', label: 'RAM', min: 0.25, max: 64, step: 1 / 1024, default: 16 }
const CORES = { key: 'cores', type: 'number', label: 'Cores', min: 1, max: 64, step: 1, default: 8 }
const DEVICE = {
  key: 'device',
  type: 'choice',
  control: 'cards',
  label: 'Device',
  options: [{ value: 'ssd', label: 'SSD' }, { value: 'hdd', label: 'HDD' }],
  default: 'ssd',
  disabledWhen: { field: 'cores', equals: 0 },
}
const KERNEL = { key: 'kernel', type: 'text', label: 'Kernel', pattern: /^[\w.+-]{0,32}$/, default: null }
const FIELDS = [SIZE, CORES, DEVICE, KERNEL]

describe('profileDefaults / profileSchema', () => {
  it('builds the defaults and one restore rule per field', () => {
    expect(profileDefaults(FIELDS)).toEqual({ ramGiB: 16, cores: 8, device: 'ssd', kernel: null })
    expect(profileSchema(FIELDS)).toEqual({
      ramGiB: { min: 0.25, max: 64, step: 1 / 1024 },
      cores: { min: 1, max: 64, step: 1 },
      device: ['ssd', 'hdd'],
      kernel: KERNEL.pattern,
    })
  })
})

describe('normalizeField', () => {
  it('snaps and clamps numbers the way a restored link does', () => {
    expect(normalizeField(SIZE, 0.3)).toBe(307 / 1024)
    expect(normalizeField(SIZE, '2')).toBe(2)
    expect(normalizeField(SIZE, 1e9)).toBe(64)
    expect(normalizeField(SIZE, 0)).toBe(0.25)
    expect(normalizeField(CORES, 3.7)).toBe(4)
  })

  it('falls back to the minimum for an empty or unparseable number', () => {
    expect(normalizeField(CORES, '')).toBe(1)
    expect(normalizeField(CORES, 'abc')).toBe(1)
    expect(normalizeField(CORES, Infinity)).toBe(1)
  })

  it('trims text, maps blank optional text to null and rejects what the pattern rejects', () => {
    expect(normalizeField(KERNEL, ' 6.6 ')).toBe('6.6')
    expect(normalizeField(KERNEL, '   ')).toBeNull()
    expect(normalizeField(KERNEL, '6.6 foo')).toBeUndefined()
    expect(normalizeField(KERNEL, 'x'.repeat(33))).toBeUndefined()
  })

  it('accepts only listed choices', () => {
    expect(normalizeField(DEVICE, 'hdd')).toBe('hdd')
    expect(normalizeField(DEVICE, 'nvme')).toBeUndefined()
    expect(normalizeField(DEVICE, 'toString')).toBeUndefined()
  })
})

describe('matchesRule', () => {
  it('allows null only when the default is null', () => {
    expect(matchesRule(null, KERNEL.pattern, null)).toBe(true)
    expect(matchesRule(null, ['ssd'], 'ssd')).toBe(false)
  })

  it('rejects numeric strings and out-of-range numbers', () => {
    expect(matchesRule('16', { min: 0, max: 64 }, 16)).toBe(false)
    expect(matchesRule(65, { min: 0, max: 64 }, 16)).toBe(false)
  })
})

describe('isFieldDisabled', () => {
  it('compares a numeric draft value as a number', () => {
    expect(isFieldDisabled(DEVICE, { cores: '0' })).toBe(true)
    expect(isFieldDisabled(DEVICE, { cores: 2 })).toBe(false)
    expect(isFieldDisabled(SIZE, {})).toBe(false)
  })
})

describe('profileProblems', () => {
  it('accepts a sound field list', () => {
    expect(profileProblems(FIELDS)).toEqual([])
  })

  it('reports duplicate keys, unknown shapes and defaults the rule rejects', () => {
    expect(profileProblems([SIZE, SIZE])).toContain('profile has a duplicate field key')
    expect(profileProblems([{ ...SIZE, type: 'slider' }])[0]).toMatch(/unknown type/)
    expect(profileProblems([{ ...DEVICE, control: 'dial' }]).join()).toMatch(/unknown control/)
    expect(profileProblems([{ ...DEVICE, default: 'nvme' }]).join()).toMatch(/default its rule rejects/)
    expect(profileProblems([{ ...SIZE, default: 100 }]).join()).toMatch(/default its rule rejects/)
    expect(profileProblems([{ ...KERNEL, pattern: '.*' }]).join()).toMatch(/RegExp/)
    expect(profileProblems([DEVICE]).join()).toMatch(/unknown field/)
  })
})
