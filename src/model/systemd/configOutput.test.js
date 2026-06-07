import { describe, it, expect } from 'vitest'
import { generateConfig, systemdSize } from './configOutput.js'
import { deriveDefaults } from './calculations.js'
import { DEFAULT_SYSTEMD_SPEC } from './parameters.js'

const NOW = new Date('2026-06-07T00:00:00Z')

function gen(workload = 'general', overrides = {}, hwOverrides = {}) {
  const hardware = { ...DEFAULT_SYSTEMD_SPEC, workload, ...hwOverrides }
  const params = { ...deriveDefaults(hardware), ...overrides }
  return generateConfig({ hardware, params, now: NOW })
}

describe('systemd generateConfig', () => {
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
