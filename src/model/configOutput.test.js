import { describe, it, expect } from 'vitest'
import { generateConfig } from './configOutput.js'
import { DEFAULT_HARDWARE } from './parameters.js'
import { deriveDefaults } from './calculations.js'

const fixedDate = new Date('2026-05-28T00:00:00Z')

function baseOpts(overrides = {}) {
  return {
    hardware: { ...DEFAULT_HARDWARE },
    params: deriveDefaults(DEFAULT_HARDWARE),
    presetLabel: null,
    customised: false,
    now: fixedDate,
    ...overrides,
  }
}

describe('generateConfig — header', () => {
  it('includes generated date, hardware summary, apply/persist hints, and source citations', () => {
    const out = generateConfig(baseOpts())
    expect(out).toMatch(/^# sysctl swap tuner \(generated 2026-05-28/m)
    expect(out).toMatch(/^# Hardware: 16 GiB RAM, 8 GiB NVMe swap, general-purpose server/m)
    expect(out).toMatch(/^# Apply: sudo sysctl --system/m)
    expect(out).toMatch(/^# Persist: \/etc\/sysctl\.d\/99-swap-tuning\.conf/m)
    expect(out).toMatch(/docs\.kernel\.org/)
    expect(out).toMatch(/kubernetes\.io\/blog\/2025/)
  })

  it('describes "no swap" when swapGiB is 0', () => {
    const out = generateConfig(baseOpts({
      hardware: { ...DEFAULT_HARDWARE, swapGiB: 0 },
    }))
    expect(out).toMatch(/^# Hardware: 16 GiB RAM, no swap, general-purpose server/m)
  })

  it('marks a preset as customised when applicable', () => {
    const a = generateConfig(baseOpts({ presetLabel: 'Kubernetes node', customised: false }))
    const b = generateConfig(baseOpts({ presetLabel: 'Kubernetes node', customised: true }))
    expect(a).toMatch(/^# Profile: Kubernetes node$/m)
    expect(b).toMatch(/^# Profile: Kubernetes node \(customised\)$/m)
  })

  it('falls back to "custom" when no preset is active', () => {
    const out = generateConfig(baseOpts({ presetLabel: null }))
    expect(out).toMatch(/^# Profile: custom$/m)
  })
})

describe('generateConfig — body', () => {
  it('emits every standard parameter exactly once as a vm.* assignment', () => {
    const out = generateConfig(baseOpts())
    const assignments = out.match(/^vm\.[a-z_]+\s+=\s+\d+$/gm) ?? []
    // 11 total - overcommit_ratio (suppressed when overcommit_memory ≠ 2) = 10
    expect(assignments).toHaveLength(10)
    for (const key of [
      'swappiness', 'min_free_kbytes', 'watermark_scale_factor', 'vfs_cache_pressure',
      'dirty_ratio', 'dirty_background_ratio', 'dirty_expire_centisecs',
      'dirty_writeback_centisecs', 'overcommit_memory', 'panic_on_oom',
    ]) {
      expect(out).toMatch(new RegExp(`^vm\\.${key}\\s+=\\s+`, 'm'))
    }
  })

  it('suppresses vm.overcommit_ratio when overcommit_memory is not 2', () => {
    const out = generateConfig(baseOpts())
    expect(out).not.toMatch(/vm\.overcommit_ratio/)
  })

  it('emits vm.overcommit_ratio when overcommit_memory is 2', () => {
    const out = generateConfig(baseOpts({
      params: { ...deriveDefaults(DEFAULT_HARDWARE), overcommit_memory: 2 },
    }))
    expect(out).toMatch(/^vm\.overcommit_ratio\s+=\s+\d+$/m)
  })

  it('precedes each assignment with an explanatory comment line', () => {
    const out = generateConfig(baseOpts())
    // Each vm.* assignment must be immediately preceded by a "# key: value - …" line.
    const re = /^# (swappiness|min_free_kbytes|dirty_ratio): \d+ - .+\n^vm\./gm
    expect(out).toMatch(re)
  })

  it('flags vfs_cache_pressure=0 as DANGEROUS in the inline comment', () => {
    const out = generateConfig(baseOpts({
      params: { ...deriveDefaults(DEFAULT_HARDWARE), vfs_cache_pressure: 0 },
    }))
    expect(out).toMatch(/# vfs_cache_pressure: 0 - DANGEROUS/m)
  })

  it('flags panic_on_oom=1 as PANIC in the inline comment', () => {
    const out = generateConfig(baseOpts({
      params: { ...deriveDefaults(DEFAULT_HARDWARE), panic_on_oom: 1 },
    }))
    expect(out).toMatch(/# panic_on_oom: 1 - PANIC/m)
  })
})