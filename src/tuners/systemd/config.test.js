import { describe, it, expect } from 'vitest'
import { generateConfig, swapMaxBytes, systemdSize } from './config.js'
import { combineFiles } from '@/core/output/files.js'
import { deriveDefaults } from './calculations.js'
import { DEFAULT_SYSTEMD_SPEC } from './profile.js'

const NOW = new Date('2026-06-07T00:00:00Z')

function gen(workload = 'general', overrides = {}, hwOverrides = {}) {
  const hardware = { ...DEFAULT_SYSTEMD_SPEC, workload, ...hwOverrides }
  const params = { ...deriveDefaults(hardware), ...overrides }
  return combineFiles(generateConfig({ hardware, params, now: NOW }))
}

describe('systemd generateConfig', () => {
  // Measured in VMs: systemd 258 logs that it ignores DefaultCPUAccounting=,
  // and systemd 237 on cgroup v1 rejects MemorySwapMax=0 (vm/README.md).
  it('writes the cgroup-version-specific directives only where they work', () => {
    const v2 = gen('database')
    expect(v2).not.toMatch(/^DefaultCPUAccounting=/m)
    expect(v2).toMatch(/^MemorySwapMax=0$/m)
    const v1 = gen('database', {}, { cgroupVersion: 'v1' })
    expect(v1).toMatch(/^DefaultCPUAccounting=(yes|no)$/m)
    expect(v1).not.toMatch(/^MemorySwapMax=/m)
    expect(v1).toContain('# MemorySwapMax: left out, it needs cgroup v2')
  })

  // systemd scales MemorySwapMax=N% by RAM, but its man page says by swap
  // size, so a swap cap between 0 and 100% is written as a byte size.
  it('writes a partial swap cap as bytes of the profile RAM, not a percentage', () => {
    const out = gen('general', { memory_swap_max: 25 }, { ramGiB: 16 })
    expect(out).toMatch(/^MemorySwapMax=4G$/m)
    expect(out).toContain('# MemorySwapMax: swap budget, 25% of 16 GiB RAM')
    expect(out).not.toMatch(/^MemorySwapMax=.*%/m)
    expect(gen('general', { memory_swap_max: 10 }, { ramGiB: 3 })).toMatch(/^MemorySwapMax=307M$/m)
    expect(swapMaxBytes(1, { ramGiB: 0.01 })).toBe(1024 * 1024)
  })

  it('emits both drop-in files with their target paths', () => {
    const out = gen('general')
    expect(out).toContain('/etc/systemd/system.conf.d/99-resource-tuning.conf')
    expect(out).toContain('/etc/systemd/system/system.slice.d/50-resources.conf')
    expect(out).toContain('[Manager]')
    expect(out).toContain('[Slice]')
  })

  it('writes the manager defaults as yes/no + soft:hard + size suffix', () => {
    const out = gen('general')
    expect(out).toContain('DefaultMemoryAccounting=yes')
    expect(out).toContain('DefaultIOAccounting=no')
    expect(out).toContain('DefaultLimitNOFILE=1024:524288')
    expect(out).toContain('DefaultLimitMEMLOCK=8M')
  })

  it('leaves unset slice limits as comments, not directives', () => {
    const out = gen('general') // no memory/quota limits by default
    expect(out).toContain('# CPUQuota: unset (no hard CPU limit)')
    expect(out).toContain('# MemoryMax: unset (infinity')
    expect(out).not.toMatch(/^MemoryMax=/m)
  })

  it('emits percentage memory limits and MemorySwapMax=0 for a database', () => {
    const out = gen('database')
    expect(out).toContain('MemoryHigh=85%')
    expect(out).toContain('MemoryMax=95%')
    expect(out).toContain('MemorySwapMax=0')
    expect(out).toContain('DefaultLimitMEMLOCK=256M')
  })

  it('targets the chosen slice in the slice drop-in path', () => {
    const out = gen('general', {}, { targetSlice: 'user.slice' })
    expect(out).toContain('/etc/systemd/system/user.slice.d/50-resources.conf')
  })

  it('emits a CPUQuota directive in percent when capped', () => {
    const out = gen('general', { cpu_quota: 400 }, { cpuCores: 8 })
    expect(out).toContain('CPUQuota=400%')
  })
})

describe('systemdSize', () => {
  it('renders byte counts with systemd suffixes', () => {
    expect(systemdSize(8388608)).toBe('8M')
    expect(systemdSize(268435456)).toBe('256M')
    expect(systemdSize(1073741824)).toBe('1G')
    expect(systemdSize(0)).toBe('0')
  })
})
