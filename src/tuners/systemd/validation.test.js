import { describe, it, expect } from 'vitest'
import { validate, hasBlockingIssue } from './validation.js'
import { deriveDefaults } from './calculations.js'
import { DEFAULT_SYSTEMD_SPEC } from './profile.js'

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
    expect(issues.find((i) => i.id === 'nofile-soft-gt-hard').fix).toBe(
      'Lower the DefaultLimitNOFILE soft limit to 524288 or less, or raise the hard limit to 600000 or more.',
    )
    expect(hasBlockingIssue(issues)).toBe(true)
  })

  it('blocks when MemoryHigh is above MemoryMax', () => {
    const { hw, params } = setup('general', { memory_high: 90, memory_max: 80 })
    const issues = validate(hw, params)
    expect(issues.find((i) => i.id === 'memhigh-gt-memmax').fix).toBe('Lower MemoryHigh below 80%, or raise MemoryMax above 90%.')
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

  it('warns about a starving system.slice quota down to the slider minimum', () => {
    const { hw, params } = setup('general', { cpu_quota: 10 })
    expect(ids(validate(hw, params))).toContain('cpuquota-starves-system')
  })

  describe('facts from earlier setup steps', () => {
    const FACT_IDS = ['nofile-above-nr-open', 'tasks-above-kernel-limit']

    it('raises nothing on the tuner page, where there are no facts', () => {
      const { hw, params } = setup('general', { default_limit_nofile_hard: 1048576, tasks_max: DEFAULT_SYSTEMD_SPEC.pidMax })
      expect(ids(validate(hw, params)).filter((id) => FACT_IDS.includes(id))).toEqual([])
    })

    it('warns when the NOFILE hard limit passes fs.nr_open', () => {
      const { hw, params } = setup('general', { default_limit_nofile_hard: 1048576 })
      expect(ids(validate(hw, params, { nrOpen: 1048576 }))).not.toContain('nofile-above-nr-open')
      const issue = validate(hw, params, { nrOpen: 524288 }).find((i) => i.id === 'nofile-above-nr-open')
      expect(issue).toMatchObject({ level: 'warn', blocking: false, params: ['default_limit_nofile_hard'] })
    })

    it('warns when a task cap passes the smaller of pid_max and threads-max, naming only those above', () => {
      const { hw, params } = setup('general', { default_tasks_max: 100000, tasks_max: 20000 })
      const facts = { pidMax: 4194304, threadsMax: 131072 }
      expect(ids(validate(hw, params, facts))).not.toContain('tasks-above-kernel-limit')
      const issue = validate(hw, params, { ...facts, threadsMax: 65536 }).find((i) => i.id === 'tasks-above-kernel-limit')
      expect(issue).toMatchObject({ level: 'warn', blocking: false, params: ['default_tasks_max'] })
      expect(issue.message).toContain('65536')
      expect(validate(hw, params, { pidMax: 16384 }).find((i) => i.id === 'tasks-above-kernel-limit').params)
        .toEqual(['default_tasks_max', 'tasks_max'])
    })
  })
})
