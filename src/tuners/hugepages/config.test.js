import { describe, it, expect } from 'vitest'
import { generateConfig } from './config.js'
import { deriveDefaults, isApplicable, poolCap, rangeFor } from './calculations.js'
import { validate } from './validation.js'
import { DEFAULT_HUGEPAGES_SPEC } from './profile.js'
import { formatValue } from './formatting.js'
import { PARAMETER_DEFS_BY_KEY } from './defs.js'

const NOW = new Date('2026-01-01T00:00:00Z')
const WORKLOADS = ['server', 'database', 'vm-host', 'desktop']

function files(hardware, overrides = {}) {
  const params = { ...deriveDefaults(hardware), ...overrides }
  const [sysctl, tmpfiles] = generateConfig({ hardware, params, presetLabel: null, customised: false, now: NOW })
  return { sysctl: sysctl.content, tmpfiles: tmpfiles.content, paths: [sysctl.path, tmpfiles.path] }
}

const ids = (hw, overrides = {}) => validate(hw, { ...deriveDefaults(hw), ...overrides }).map((i) => i.id)

describe('hugepages defaults', () => {
  it('reserves no pool, keeps THP at madvise, and turns KSM on only for VM hosts', () => {
    for (const workload of WORKLOADS) {
      const p = deriveDefaults({ ...DEFAULT_HUGEPAGES_SPEC, workload })
      expect(p.nr_hugepages).toBe(0)
      expect(p.thp_enabled).toBe('madvise')
      expect(p.ksm_run).toBe(workload === 'vm-host' ? 1 : 0)
      expect(p.max_map_count).toBe(1048576)
    }
  })

  it('offers a pool of up to nine tenths of RAM', () => {
    const hw = { ...DEFAULT_HUGEPAGES_SPEC, ramGiB: 16 }
    expect(poolCap(hw)).toBe(7372)
    expect(rangeFor('nr_hugepages', hw)).toEqual({ min: 0, max: 7372 })
    expect(rangeFor('max_map_count', hw)).toEqual({ min: 65530, max: 2147483647 })
  })
})

describe('hugepages config', () => {
  it('writes the vm.* keys to sysctl.d and THP and KSM as tmpfiles.d w lines', () => {
    const out = files({ ...DEFAULT_HUGEPAGES_SPEC, workload: 'vm-host' })
    expect(out.paths).toEqual(['/etc/sysctl.d/99-hugepages-tuning.conf', '/etc/tmpfiles.d/99-hugepages-tuning.conf'])
    expect(out.sysctl).toMatch(/^vm\.max_map_count = 1048576$/m)
    expect(out.sysctl).not.toMatch(/^w /m)
    expect(out.tmpfiles).toMatch(/^w \/sys\/kernel\/mm\/transparent_hugepage\/enabled - - - - madvise$/m)
    expect(out.tmpfiles).toMatch(/^w \/sys\/kernel\/mm\/ksm\/run - - - - 1$/m)
    expect(out.tmpfiles).not.toMatch(/^vm\./m)
  })

  it('leaves the pools out at 0, KSM out while off, and the map count out at 65530', () => {
    const out = files(DEFAULT_HUGEPAGES_SPEC, { max_map_count: 65530 })
    expect(out.sysctl).not.toMatch(/^vm\.nr_(overcommit_)?hugepages/m)
    expect(out.sysctl).not.toMatch(/^vm\.max_map_count/m)
    expect(out.sysctl).toContain('# vm.nr_hugepages is left out at 0')
    expect(out.sysctl).toContain('# vm.max_map_count is left out at the kernel default')
    expect(out.sysctl).toContain('so this file sets nothing')
    expect(out.tmpfiles).not.toContain('/ksm/')
    expect(out.sysctl).toContain('# ksm/run is left out while KSM is off')

    const raised = files(DEFAULT_HUGEPAGES_SPEC, { nr_hugepages: 1024, nr_overcommit_hugepages: 64 })
    expect(raised.sysctl).toMatch(/^vm\.nr_hugepages = 1024$/m)
    expect(raised.sysctl).toMatch(/^vm\.nr_overcommit_hugepages = 64$/m)
    expect(raised.sysctl).toContain('# nr_hugepages: 1024 - 2 MiB pages reserved, 2 GiB of RAM')
  })

  it('writes zone_reclaim_mode only with several NUMA nodes', () => {
    expect(files(DEFAULT_HUGEPAGES_SPEC).sysctl).not.toContain('vm.zone_reclaim_mode')
    expect(files({ ...DEFAULT_HUGEPAGES_SPEC, numa: 'multi' }).sysctl).toMatch(/^vm\.zone_reclaim_mode = 0$/m)
  })

  it('shows the KSM scan rate only with KSM on, and zone reclaim only on NUMA', () => {
    const p = deriveDefaults(DEFAULT_HUGEPAGES_SPEC)
    expect(isApplicable('ksm_pages_to_scan', DEFAULT_HUGEPAGES_SPEC, p)).toBe(false)
    expect(isApplicable('ksm_pages_to_scan', DEFAULT_HUGEPAGES_SPEC, { ...p, ksm_run: 1 })).toBe(true)
    expect(isApplicable('zone_reclaim_mode', DEFAULT_HUGEPAGES_SPEC, p)).toBe(false)
    expect(isApplicable('zone_reclaim_mode', { ...DEFAULT_HUGEPAGES_SPEC, numa: 'multi' }, p)).toBe(true)
  })

  it('marks left-out values on the card', () => {
    expect(formatValue(0, PARAMETER_DEFS_BY_KEY.nr_hugepages)).toBe('0 (left out)')
    expect(formatValue(512, PARAMETER_DEFS_BY_KEY.nr_hugepages)).toBe(`${(512).toLocaleString()} (1 GiB)`)
    expect(formatValue(0, PARAMETER_DEFS_BY_KEY.ksm_run)).toBe('off (left out)')
    expect(formatValue(65530, PARAMETER_DEFS_BY_KEY.max_map_count)).toBe(`${(65530).toLocaleString()} (left out)`)
  })
})

describe('hugepages validation', () => {
  it('warns when the pool takes more than three quarters of RAM', () => {
    const hw = { ...DEFAULT_HUGEPAGES_SPEC, ramGiB: 16 }
    expect(ids(hw, { nr_hugepages: 6144 })).not.toContain('pool-ram')
    expect(ids(hw, { nr_hugepages: 6200 })).toContain('pool-ram')
    expect(ids(hw, { nr_hugepages: 1 })).toContain('pool-check')
  })

  it('warns about THP always on databases and defrag always anywhere', () => {
    expect(ids({ ...DEFAULT_HUGEPAGES_SPEC, workload: 'database' }, { thp_enabled: 'always' })).toContain('thp-always-database')
    expect(ids(DEFAULT_HUGEPAGES_SPEC, { thp_enabled: 'always' })).not.toContain('thp-always-database')
    expect(ids(DEFAULT_HUGEPAGES_SPEC, { thp_defrag: 'always' })).toContain('thp-defrag-always')
  })

  it('notes a map count that lowers what current distributions ship', () => {
    expect(ids(DEFAULT_HUGEPAGES_SPEC, { max_map_count: 262144 })).toContain('map-count-lowers')
    expect(ids(DEFAULT_HUGEPAGES_SPEC, { max_map_count: 65530 })).not.toContain('map-count-lowers')
    expect(ids(DEFAULT_HUGEPAGES_SPEC)).not.toContain('map-count-lowers')
  })

  it('warns about zone reclaim only where it is written', () => {
    expect(ids({ ...DEFAULT_HUGEPAGES_SPEC, numa: 'multi' }, { zone_reclaim_mode: 1 })).toContain('zone-reclaim-on')
    expect(ids(DEFAULT_HUGEPAGES_SPEC, { zone_reclaim_mode: 1 })).not.toContain('zone-reclaim-on')
  })

  it('warns about nothing on the defaults', () => {
    for (const workload of WORKLOADS) {
      for (const numa of ['single', 'multi']) {
        const hw = { ...DEFAULT_HUGEPAGES_SPEC, workload, numa }
        expect(validate(hw, deriveDefaults(hw)).filter((i) => i.level === 'warn')).toEqual([])
      }
    }
  })
})
