import { describe, it, expect } from 'vitest'
import { settingsSummary } from './settingsSummary.js'

describe('settingsSummary', () => {
  it('counts the settings that fit and the ones changed by you', () => {
    expect(settingsSummary(['a', 'b', 'c', 'd'], ['b', 'x'])).toBe('4 settings. 3 fit your machine, 1 changed by you.')
    expect(settingsSummary(['a', 'b'], ['a'])).toBe('2 settings. 1 fits your machine, 1 changed by you.')
  })

  it('says all, both or the one when nothing or everything changed', () => {
    expect(settingsSummary(['a', 'b', 'c', 'd', 'e'], [])).toBe('5 settings. All fit your machine.')
    expect(settingsSummary(['a', 'b'], [])).toBe('2 settings. Both fit your machine.')
    expect(settingsSummary(['a'], [])).toBe('1 setting. Fits your machine.')
    expect(settingsSummary(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe('3 settings. All changed by you.')
    expect(settingsSummary(['a', 'b'], ['a', 'b'])).toBe('2 settings. Both changed by you.')
    expect(settingsSummary(['a'], ['a'])).toBe('1 setting. Changed by you.')
    expect(settingsSummary([], [])).toBe('0 settings.')
  })
})
