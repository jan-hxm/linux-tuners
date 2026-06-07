import { describe, it, expect } from 'vitest'
import { validate, hasBlockingIssue } from './validation.js'
import { deriveDefaults } from './calculations.js'
import { DEFAULT_SYSTEMD_SPEC } from './parameters.js'

function setup(workload = 'general', overrides = {}) {
  const hw = { ...DEFAULT_SYSTEMD_SPEC, workload }
  const params = { ...deriveDefaults(hw), ...overrides }
  return { hw, params }
}

function ids(issues) {
  return issues.map((i) => i.id)
}

describe('systemd validate', () => {
  it('is clean for a plain general-server profile', () => {
    const { hw, params } = setup('general')
    expect(hasBlockingIssue(validate(hw, params))).toBe(false)
  })

  it('blocks when the NOFILE soft limit exceeds the hard limit', () => {
    const { hw, params } = setup('general', {
      default_limit_nofile_soft: 600000,
      default_limit_nofile_hard: 524288,
    })
    const issues = validate(hw, params)
    expect(ids(issues)).toContain('nofile-soft-gt-hard')
    expect(hasBlockingIssue(issues)).toBe(true)
  })

  it('blocks when MemoryHigh is above MemoryMax', () => {
    const { hw, params } = setup('general', { memory_high: 90, memory_max: 80 })
    const issues = validate(hw, params)
    expect(ids(issues)).toContain('memhigh-gt-memmax')
    expect(hasBlockingIssue(issues)).toBe(true)
  })

  it('warns on cgroup v1', () => {
    const { hw, params } = setup('general')
    const issues = validate({ ...hw, cgroupVersion: 'v1' }, params)
    expect(ids(issues)).toContain('cgroup-v1')
  })

  it('warns when memory limits are set without memory accounting', () => {
    const { hw, params } = setup('general', { default_memory_accounting: 0, memory_max: 80 })
    expect(ids(validate(hw, params))).toContain('memlimit-without-accounting')
  })

  it('surfaces an info note when a slice is pinned out of swap', () => {
    const { hw, params } = setup('database')
    const issues = validate(hw, params)
    expect(ids(issues)).toContain('swap-disabled-for-slice')
    expect(hasBlockingIssue(issues)).toBe(false)
  })
})
