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
    expect(out).toMatch(/^# Generated 2026-05-28 by linux-tuners\.dev\/swap/m)
    expect(out).toMatch(/^# Hardware: 16 GiB RAM, 8 GiB NVMe swap, general-purpose server/m)
    expect(out).toMatch(/^# HOW TO APPLY THESE SETTINGS/m)
    expect(out).toMatch(/sudo sysctl --system/)
    expect(out).toMatch(/\/etc\/sysctl\.d\/99-swap-tuning\.conf/)
    expect(out).toMatch(/docs\.kernel\.org/)
  })

  it('cites the Kubernetes swap guide only when the workload is k8s', () => {
    const general = generateConfig(baseOpts())
    expect(general).not.toMatch(/kubernetes\.io\/blog\/2025/)

    const k8s = generateConfig(baseOpts({
      hardware: { ...DEFAULT_HARDWARE, workload: 'k8s' },
    }))
    expect(k8s).toMatch(/kubernetes\.io\/blog\/2025/)
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

describe('generateConfig — swap setup instructions', () => {
  it('gives swap-file steps with fstab persistence for disk-backed swap', () => {
    const out = generateConfig(baseOpts({
      hardware: { ...DEFAULT_HARDWARE, swapDevice: 'nvme-ssd', swapGiB: 8 },
    }))
    expect(out).toMatch(/ACTIVATING SWAP: 8 GiB on NVMe/)
    expect(out).toMatch(/sudo fallocate -l 8G \/swapfile/)
    expect(out).toMatch(/sudo mkswap \/swapfile/)
    expect(out).toMatch(/\/etc\/fstab/)
  })

  it('uses zram-generator steps (size in MiB) for zram swap', () => {
    const out = generateConfig(baseOpts({
      hardware: { ...DEFAULT_HARDWARE, swapDevice: 'zram', swapGiB: 8 },
    }))
    expect(out).toMatch(/ACTIVATING SWAP: 8 GiB zram/)
    expect(out).toMatch(/zram-size = 8192/)
    expect(out).toMatch(/systemd-zram-setup@zram0\.service/)
    expect(out).not.toMatch(/fallocate/)
  })

  it('explains zswap needs backing disk swap plus the kernel cmdline', () => {
    const out = generateConfig(baseOpts({
      hardware: { ...DEFAULT_HARDWARE, swapDevice: 'zswap', swapGiB: 4 },
    }))
    expect(out).toMatch(/ACTIVATING SWAP: zswap/)
    expect(out).toMatch(/sudo fallocate -l 4G \/swapfile/)
    expect(out).toMatch(/zswap\.enabled=1/)
  })

  it('expresses sub-GiB swap in MiB in both the summary and the fallocate command', () => {
    const out = generateConfig(baseOpts({
      hardware: { ...DEFAULT_HARDWARE, swapDevice: 'sata-ssd', swapGiB: 0.5, ramGiB: 1 },
    }))
    expect(out).toMatch(/^# Hardware: 1 GiB RAM, 512 MiB SATA SSD swap/m)
    expect(out).toMatch(/ACTIVATING SWAP: 512 MiB on SATA SSD/)
    expect(out).toMatch(/sudo fallocate -l 512M \/swapfile/)
    expect(out).toMatch(/count=512/)
  })

  it('explains that no swap means swappiness has no effect', () => {
    const out = generateConfig(baseOpts({
      hardware: { ...DEFAULT_HARDWARE, swapGiB: 0 },
    }))
    expect(out).toMatch(/NO SWAP CONFIGURED/)
    expect(out).toMatch(/vm\.swappiness has no effect/)
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