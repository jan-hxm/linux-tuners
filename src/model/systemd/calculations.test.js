import { describe, it, expect } from 'vitest'
import { deriveDefaults, rangeFor, cpuQuotaNoLimit } from './calculations.js'
import { DEFAULT_SYSTEMD_SPEC } from './parameters.js'

function spec(overrides = {}) {
  return { ...DEFAULT_SYSTEMD_SPEC, ...overrides }
}

describe('systemd deriveDefaults', () => {
  it('uses systemd stock accounting defaults for a general server', () => {
    const p = deriveDefaults(spec({ workload: 'general' }))
    expect(p.default_memory_accounting).toBe(1)
    expect(p.default_tasks_accounting).toBe(1)
    expect(p.default_cpu_accounting).toBe(0)
    expect(p.default_io_accounting).toBe(0)
    expect(p.default_ip_accounting).toBe(0)
  })

  it('derives DefaultTasksMax as 15% of kernel.pid_max', () => {
    const p = deriveDefaults(spec({ pidMax: 4194304 }))
    expect(p.default_tasks_max).toBe(Math.round(4194304 * 0.15))
  })

  it('leaves slice controls unset (no limit) by default', () => {
    const p = deriveDefaults(spec({ cpuCores: 8, workload: 'general' }))
    expect(p.cpu_weight).toBe(100)
    expect(p.io_weight).toBe(100)
    expect(p.cpu_quota).toBe(cpuQuotaNoLimit(spec({ cpuCores: 8 }))) // 800 = no limit
    expect(p.memory_high).toBe(100)
    expect(p.memory_max).toBe(100)
    expect(p.memory_swap_max).toBe(100)
  })

  it('protects host RAM and enables accounting for container hosts', () => {
    const p = deriveDefaults(spec({ workload: 'container-host' }))
    expect(p.default_cpu_accounting).toBe(1)
    expect(p.default_io_accounting).toBe(1)
    expect(p.default_limit_nofile_hard).toBe(1048576)
    expect(p.memory_high).toBe(80)
    expect(p.memory_max).toBe(90)
    expect(p.memory_high).toBeLessThan(p.memory_max)
  })

  it('pins databases out of swap and raises mlock', () => {
    const p = deriveDefaults(spec({ workload: 'database' }))
    expect(p.memory_swap_max).toBe(0)
    expect(p.default_limit_memlock).toBeGreaterThan(8388608)
  })
})

describe('systemd rangeFor', () => {
  it('caps CPUQuota at cores × 100%', () => {
    expect(rangeFor('cpu_quota', spec({ cpuCores: 4 })).max).toBe(400)
    expect(rangeFor('cpu_quota', spec({ cpuCores: 1 })).max).toBe(100)
  })

  it('caps task limits at kernel.pid_max', () => {
    expect(rangeFor('tasks_max', spec({ pidMax: 131072 })).max).toBe(131072)
    expect(rangeFor('default_tasks_max', spec({ pidMax: 131072 })).max).toBe(131072)
  })

  it('caps memlock at total RAM', () => {
    // 16 GiB > the 1 GiB def max, so the def max wins.
    expect(rangeFor('default_limit_memlock', spec({ ramGiB: 16 })).max).toBe(1073741824)
    // A tiny RAM host narrows the range below the def max.
    expect(rangeFor('default_limit_memlock', spec({ ramGiB: 0.5 })).max).toBeLessThan(1073741824)
  })

  it('uses kernel min/max for percentage controls', () => {
    expect(rangeFor('memory_max', spec())).toEqual({ min: 0, max: 100 })
    expect(rangeFor('cpu_weight', spec())).toEqual({ min: 1, max: 10000 })
  })
})
