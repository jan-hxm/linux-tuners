import { describe, it, expect } from 'vitest'
import { validate, hasBlockingIssue } from './validation.js'
import { deriveDefaults } from './calculations.js'

const baseHw = {
  ramGiB: 16,
  swapGiB: 8,
  swapDevice: 'nvme-ssd',
  workload: 'general',
  cgroupVersion: 'v2',
  kernelVersion: null,
}

function paramsFor(overrides = {}) {
  return { ...deriveDefaults(baseHw), ...overrides }
}

describe('validate', () => {
  it('returns no issues for a sensible default config', () => {
    const issues = validate(baseHw, paramsFor())
    const blocking = issues.filter((i) => i.blocking)
    expect(blocking).toEqual([])
  })

  it('flags dirty_background_ratio >= dirty_ratio as a blocking error', () => {
    const issues = validate(baseHw, paramsFor({ dirty_background_ratio: 20, dirty_ratio: 20 }))
    expect(issues.find((i) => i.id === 'dirtybg-ge-dirty')).toMatchObject({ blocking: true, level: 'error' })
    expect(hasBlockingIssue(issues)).toBe(true)
  })

  it('flags writeback > expire as a blocking error', () => {
    const issues = validate(baseHw, paramsFor({ dirty_writeback_centisecs: 4000, dirty_expire_centisecs: 3000 }))
    expect(issues.find((i) => i.id === 'writeback-gt-expire')).toMatchObject({ blocking: true })
  })

  it('does not flag writeback=0 (periodic disabled) against expire', () => {
    const issues = validate(baseHw, paramsFor({ dirty_writeback_centisecs: 0 }))
    expect(issues.find((i) => i.id === 'writeback-gt-expire')).toBeUndefined()
  })

  it('warns when swappiness exceeds the device cap', () => {
    const hw = { ...baseHw, swapDevice: 'hdd' }
    const issues = validate(hw, paramsFor({ swappiness: 150 }))
    const cap = issues.find((i) => i.id === 'swappiness-above-device-cap')
    expect(cap).toBeDefined()
    expect(cap.blocking).toBe(false)
    expect(issues.find((i) => i.id === 'swappiness-on-hdd')).toBeDefined()
  })

  it('warns when swappiness=0 paired with a narrow watermark window', () => {
    const issues = validate(baseHw, paramsFor({ swappiness: 0, watermark_scale_factor: 10 }))
    expect(issues.find((i) => i.id === 'swappiness-zero-narrow-watermark')).toBeDefined()
  })

  it('warns when min_free_kbytes is below 8 MiB', () => {
    const issues = validate(baseHw, paramsFor({ min_free_kbytes: 4096 }))
    expect(issues.find((i) => i.id === 'min-free-too-low')).toBeDefined()
  })

  it('warns when min_free_kbytes exceeds 5% of RAM', () => {
    // 5% of 16 GiB = 838860 kB → set well above
    const issues = validate(baseHw, paramsFor({ min_free_kbytes: 2_000_000 }))
    expect(issues.find((i) => i.id === 'min-free-too-high')).toBeDefined()
  })

  it('warns on strict overcommit + panic_on_oom combo', () => {
    const issues = validate(baseHw, paramsFor({ overcommit_memory: 2, panic_on_oom: 1 }))
    expect(issues.find((i) => i.id === 'strict-overcommit-and-panic')).toBeDefined()
  })

  it('warns on vfs_cache_pressure=0', () => {
    const issues = validate(baseHw, paramsFor({ vfs_cache_pressure: 0 }))
    expect(issues.find((i) => i.id === 'vfs-pressure-zero')).toBeDefined()
  })

  it('shows an info banner when swap is disabled but swappiness > 0', () => {
    const hw = { ...baseHw, swapGiB: 0 }
    // Force swappiness > 0 to trigger the info banner (deriveDefaults zeros it).
    const issues = validate(hw, paramsFor({ swappiness: 30 }))
    const info = issues.find((i) => i.id === 'no-swap-but-swappiness')
    expect(info).toBeDefined()
    expect(info.level).toBe('info')
  })

  it('warns on network swap regardless of other values', () => {
    const hw = { ...baseHw, swapDevice: 'network' }
    const issues = validate(hw, paramsFor())
    expect(issues.find((i) => i.id === 'network-swap')).toBeDefined()
  })
})