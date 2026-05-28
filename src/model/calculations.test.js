import { describe, it, expect } from 'vitest'
import {
  deriveDefaults,
  clampSwappinessForDevice,
  swappinessMaxForDevice,
  watermarkWindowMiB,
  watermarkLevelsMiB,
  rangeFor,
} from './calculations.js'

describe('deriveDefaults', () => {
  it('returns kernel defaults for a general-purpose 16 GiB / NVMe / 8 GiB swap node', () => {
    const p = deriveDefaults({
      ramGiB: 16,
      swapGiB: 8,
      swapDevice: 'nvme-ssd',
      workload: 'general',
      cgroupVersion: 'v2',
      kernelVersion: null,
    })
    expect(p.swappiness).toBe(60)
    expect(p.dirty_ratio).toBe(20)
    expect(p.dirty_background_ratio).toBe(10)
    expect(p.vfs_cache_pressure).toBe(100)
    // 0.4% of 16 GiB in kB = ~67_109; floored against 8 MiB (8192 kB) so the
    // percentage wins on RAM ≥ 2 GiB.
    expect(p.min_free_kbytes).toBeGreaterThan(8192)
  })

  it('applies the K8s recipe from the K8s blog: swappiness=10, wsf=2000', () => {
    const p = deriveDefaults({
      ramGiB: 32,
      swapGiB: 16,
      swapDevice: 'nvme-ssd',
      workload: 'k8s',
      cgroupVersion: 'v2',
      kernelVersion: null,
    })
    expect(p.swappiness).toBe(10)
    expect(p.watermark_scale_factor).toBe(2000)
  })

  it('uses the K8s + zram fast-swap formula', () => {
    const p = deriveDefaults({
      ramGiB: 16,
      swapGiB: 4,
      swapDevice: 'zram',
      workload: 'k8s',
      cgroupVersion: 'v2',
      kernelVersion: null,
    })
    expect(p.swappiness).toBe(133)
    expect(p.watermark_scale_factor).toBe(1000)
  })

  it('caps swappiness at 60 on rotational disks even when the workload asks for 100', () => {
    const p = deriveDefaults({
      ramGiB: 4,
      swapGiB: 4,
      swapDevice: 'hdd',
      workload: 'desktop',
      cgroupVersion: 'v2',
      kernelVersion: null,
    })
    expect(p.swappiness).toBe(60)
  })

  it('tightens dirty ratios for database workloads', () => {
    const p = deriveDefaults({
      ramGiB: 64,
      swapGiB: 0,
      swapDevice: 'nvme-ssd',
      workload: 'database',
      cgroupVersion: 'v2',
      kernelVersion: null,
    })
    expect(p.dirty_ratio).toBe(5)
    expect(p.dirty_background_ratio).toBe(2)
  })

  it('forces swappiness to 0 when no swap is configured', () => {
    const p = deriveDefaults({
      ramGiB: 8,
      swapGiB: 0,
      swapDevice: 'nvme-ssd',
      workload: 'general',
      cgroupVersion: 'v2',
      kernelVersion: null,
    })
    expect(p.swappiness).toBe(0)
  })
})

describe('clampSwappinessForDevice', () => {
  it('respects device caps', () => {
    expect(clampSwappinessForDevice(150, 'hdd')).toBe(60)
    expect(clampSwappinessForDevice(150, 'nvme-ssd')).toBe(100)
    expect(clampSwappinessForDevice(150, 'zram')).toBe(150)
    expect(clampSwappinessForDevice(250, 'zram')).toBe(200)
    expect(clampSwappinessForDevice(-1, 'nvme-ssd')).toBe(0)
  })
})

describe('swappinessMaxForDevice', () => {
  it.each([
    ['hdd', 60],
    ['sata-ssd', 100],
    ['nvme-ssd', 100],
    ['zram', 200],
    ['zswap', 200],
    ['network', 30],
  ])('caps %s at %i', (device, expected) => {
    expect(swappinessMaxForDevice(device)).toBe(expected)
  })
})

describe('watermark math', () => {
  it('matches the K8s blog illustration roughly: wsf=2000 on 16 GiB → ~3.2 GiB window', () => {
    // The blog uses a NUMA-zone-local example; whole-system: 16 GiB × 2000/10000 = 3276 MiB.
    expect(watermarkWindowMiB(16, 2000)).toBe(3277)
  })

  it('stacks min < low < high in MiB', () => {
    const lv = watermarkLevelsMiB(16, 262144, 2000)
    expect(lv.minMiB).toBe(256)
    expect(lv.lowMiB).toBeGreaterThan(lv.minMiB)
    expect(lv.highMiB).toBeGreaterThan(lv.lowMiB)
    expect(lv.usableMiB).toBeGreaterThan(0)
  })
})

describe('rangeFor', () => {
  it('returns device-specific swappiness range', () => {
    const hw = {
      ramGiB: 16,
      swapGiB: 8,
      swapDevice: 'hdd',
      workload: 'general',
      cgroupVersion: 'v2',
      kernelVersion: null,
    }
    expect(rangeFor('swappiness', hw)).toEqual({ min: 0, max: 60 })
  })

  it('caps min_free_kbytes upper bound at 10% of RAM', () => {
    const hw = {
      ramGiB: 4,
      swapGiB: 0,
      swapDevice: 'nvme-ssd',
      workload: 'general',
      cgroupVersion: 'v2',
      kernelVersion: null,
    }
    const r = rangeFor('min_free_kbytes', hw)
    expect(r.max).toBe(Math.round(4 * 1024 * 1024 * 0.1))
  })
})