import { describe, it, expect } from 'vitest'
import { generateConfig, DEVICES } from './config.js'
import { deriveDefaults, isApplicable, rangeFor, schedulerRequests } from './calculations.js'
import { validate } from './validation.js'
import { DEFAULT_BLOCK_IO_SPEC } from './profile.js'
import { formatValue } from './formatting.js'
import { PARAMETER_DEFS_BY_KEY } from './defs.js'
import { blockIoDomain } from './index.js'
import { presetParams } from '@/core/createTunerStore.js'

const NOW = new Date('2026-01-01T00:00:00Z')
const hw = (overrides) => ({ ...DEFAULT_BLOCK_IO_SPEC, ...overrides })

function file(hardware, overrides = {}) {
  const params = { ...deriveDefaults(hardware), ...overrides }
  return generateConfig({ hardware, params, presetLabel: null, customised: false, now: NOW })[0]
}

const rules = (content) => content.split('\n').filter((l) => l.startsWith('ACTION=='))
const ids = (h, overrides = {}) => validate(h, { ...deriveDefaults(h), ...overrides }).map((i) => i.id)

describe('block I/O defaults', () => {
  it('leaves NVMe and virtio disks without a scheduler, and gives SATA mq-deadline or BFQ on desktops', () => {
    expect(deriveDefaults(hw({ device: 'nvme', workload: 'desktop' })).scheduler).toBe('none')
    expect(deriveDefaults(hw({ device: 'virtio' })).scheduler).toBe('none')
    expect(deriveDefaults(hw({ device: 'hdd' })).scheduler).toBe('mq-deadline')
    expect(deriveDefaults(hw({ device: 'ssd', workload: 'desktop' })).scheduler).toBe('bfq')
    expect(deriveDefaults(hw({ device: 'ssd', workload: 'desktop', schedulers: 'basic' })).scheduler).toBe('mq-deadline')
  })

  it('reads further ahead for sequential workloads, a hard disk most', () => {
    expect(deriveDefaults(hw({ workload: 'server' })).read_ahead_kb).toBe(128)
    expect(deriveDefaults(hw({ device: 'hdd', workload: 'streaming' })).read_ahead_kb).toBe(4096)
    expect(deriveDefaults(hw({ device: 'nvme', workload: 'streaming' })).read_ahead_kb).toBe(1024)
  })

  it('offers bfq and kyber only where the kernel has them', () => {
    expect(rangeFor('scheduler', hw({ schedulers: 'all' })).options).toEqual(['none', 'mq-deadline', 'bfq', 'kyber'])
    expect(rangeFor('scheduler', hw({ schedulers: 'basic' })).options).toEqual(['none', 'mq-deadline'])
    // The BFQ preset falls back to mq-deadline there.
    const preset = blockIoDomain.presetsById.interactive
    expect(presetParams(blockIoDomain, hw({ schedulers: 'basic' }), preset.values).scheduler).toBe('mq-deadline')
  })

  it('shows rotational for virtual disks only, and nr_requests only with a scheduler', () => {
    expect(isApplicable('rotational', hw({ device: 'virtio' }), {})).toBe(true)
    expect(isApplicable('rotational', hw({ device: 'ssd' }), {})).toBe(false)
    expect(isApplicable('nr_requests', hw(), { scheduler: 'none' })).toBe(false)
    expect(isApplicable('nr_requests', hw(), { scheduler: 'mq-deadline' })).toBe(true)
  })

  it('computes the request depth the kernel sets with a scheduler', () => {
    // Measured: SATA 32 -> 64, virtio 256 -> 256, NVMe 1023 -> 256.
    expect([32, 256, 1023].map(schedulerRequests)).toEqual([64, 256, 256])
  })
})

describe('block I/O rules', () => {
  it('writes one file per kind of disk, matching only whole disks of that kind', () => {
    for (const [device, { path }] of Object.entries(DEVICES)) {
      const f = file(hw({ device }))
      expect(f.path).toBe(path)
      for (const line of rules(f.content)) expect(line).toContain('ENV{DEVTYPE}=="disk"')
    }
    expect(rules(file(hw({ device: 'hdd' })).content)[0]).toContain('KERNEL=="sd[a-z]*", ENV{DEVTYPE}=="disk", ATTR{queue/rotational}=="1"')
    expect(rules(file(hw({ device: 'ssd' })).content)[0]).toContain('ATTR{queue/rotational}=="0"')
  })

  it('writes the scheduler always and the rest only away from the kernel value', () => {
    expect(rules(file(hw()).content)).toEqual(['ACTION=="add|change", SUBSYSTEM=="block", KERNEL=="nvme[0-9]*n[0-9]*", ENV{DEVTYPE}=="disk", ATTR{queue/scheduler}="none"'])
    const out = file(hw({ device: 'hdd', workload: 'streaming' }), { nr_requests: 1024, nomerges: 1 }).content
    expect(rules(out).map((l) => l.match(/ATTR\{(queue\/\w+)\}="/)[1])).toEqual(['queue/scheduler', 'queue/nr_requests', 'queue/read_ahead_kb', 'queue/nomerges'])
    expect(out).not.toContain('nr_requests is left out')
  })

  it('writes rotational before the scheduler, and never nr_requests without one', () => {
    const out = file(hw({ device: 'virtio' }), { rotational: 0, nr_requests: 512 }).content
    expect(rules(out)[0]).toMatch(/ATTR\{queue\/rotational\}="0"$/)
    expect(out).not.toContain('ATTR{queue/nr_requests}')
  })
})

describe('block I/O validation', () => {
  it('has nothing to warn about at the defaults', () => {
    for (const device of Object.keys(DEVICES)) {
      for (const workload of blockIoDomain.workloads) {
        const h = hw({ device, workload })
        expect(validate(h, deriveDefaults(h)).filter((i) => i.level === 'warn'), `${device} ${workload}`).toEqual([])
      }
    }
  })

  it('warns about a hard disk without a scheduler and no read-ahead', () => {
    expect(ids(hw({ device: 'hdd' }), { scheduler: 'none' })).toContain('none-hdd')
    expect(ids(hw({ device: 'nvme' }), { scheduler: 'none' })).not.toContain('none-hdd')
    expect(ids(hw(), { read_ahead_kb: 0 })).toContain('read-ahead-off')
  })

  it('notes BFQ on NVMe, Kyber on a hard disk and a large window for a database', () => {
    expect(ids(hw({ device: 'nvme' }), { scheduler: 'bfq' })).toContain('bfq-nvme')
    expect(ids(hw({ device: 'hdd' }), { scheduler: 'kyber' })).toContain('kyber-hdd')
    expect(ids(hw({ workload: 'database' }), { read_ahead_kb: 4096 })).toContain('read-ahead-random')
  })
})

describe('block I/O formatting', () => {
  it('marks the values that are left out', () => {
    expect(formatValue(128, PARAMETER_DEFS_BY_KEY.read_ahead_kb)).toBe('128 KiB (left out)')
    expect(formatValue(4096, PARAMETER_DEFS_BY_KEY.read_ahead_kb)).toBe(`${(4096).toLocaleString()} KiB`)
    expect(formatValue(0, PARAMETER_DEFS_BY_KEY.nr_requests)).toBe('kernel value (left out)')
    expect(formatValue(0, PARAMETER_DEFS_BY_KEY.rotational)).toBe('flash')
  })
})
