import { describe, it, expect } from 'vitest'
import { generateConfig } from './config.js'
import { deriveDefaults, kernelFileMax, kernelWatches, watchMemoryBytes } from './calculations.js'
import { validate } from './validation.js'
import { DEFAULT_FILESYSTEM_SPEC } from './profile.js'
import { formatValue } from './formatting.js'
import { PARAMETER_DEFS_BY_KEY } from './defs.js'
import { combineFiles } from '@/core/output/files.js'

const NOW = new Date('2026-01-01T00:00:00Z')
const GiB = 1024 ** 3
const WORKLOADS = ['server', 'database', 'container', 'desktop']

function config(hardware, overrides = {}) {
  const params = { ...deriveDefaults(hardware), ...overrides }
  return combineFiles(generateConfig({ hardware, params, presetLabel: null, customised: false, now: NOW }))
}

const issues = (hw, overrides = {}) => validate(hw, { ...deriveDefaults(hw), ...overrides })
const ids = (hw, overrides) => issues(hw, overrides).map((i) => i.id)

describe('filesystem kernel defaults', () => {
  // MemTotal and max_user_watches as booted on the VM images (vm/README.md).
  it.each([
    ['Debian 11, 5.10', 2032836, 16096],
    ['Debian 13, 6.12', 2021556, 15393],
    ['Debian 13, 6.12', 6074788, 46647],
    ['Ubuntu 24.04, 6.8', 6068084, 45933],
  ])('sizes the watch default as %s does at %i kB, within 5%', (_k, memKiB, measured) => {
    const got = kernelWatches({ ...DEFAULT_FILESYSTEM_SPEC, ramGiB: memKiB / 1024 / 1024 })
    expect(Math.abs(got - measured) / measured).toBeLessThan(0.05)
  })

  it('keeps the watch default between 8192 and 1048576', () => {
    expect(kernelWatches({ ...DEFAULT_FILESYSTEM_SPEC, ramGiB: 0.25 })).toBe(8192)
    expect(kernelWatches({ ...DEFAULT_FILESYSTEM_SPEC, ramGiB: 512 })).toBe(1048576)
  })

  it('sizes file-max like Ubuntu 18.04 did at 2 GiB, within 5%', () => {
    // 200843 on 2041136 kB.
    const got = kernelFileMax({ ...DEFAULT_FILESYSTEM_SPEC, ramGiB: 2041136 / 1024 / 1024 })
    expect(Math.abs(got - 200843) / 200843).toBeLessThan(0.05)
  })
})

describe('filesystem defaults', () => {
  it.each(WORKLOADS.flatMap((w) => [0.25, 2, 16, 512].map((ram) => [w, ram])))(
    'raises nothing below the kernel and warns about nothing for %s at %s GiB',
    (workload, ramGiB) => {
      const hw = { ...DEFAULT_FILESYSTEM_SPEC, workload, ramGiB, systemd: 'older' }
      const p = deriveDefaults(hw)
      expect(p.max_user_watches).toBeGreaterThanOrEqual(kernelWatches(hw))
      expect(p.file_max).toBeGreaterThanOrEqual(Math.min(kernelFileMax(hw), PARAMETER_DEFS_BY_KEY.file_max.kernelMax))
      expect(issues(hw).filter((i) => i.level === 'warn').map((i) => i.id)).toEqual([])
    },
  )

  it('gives watchers 524288 watches where RAM allows, under a tenth of RAM otherwise', () => {
    expect(deriveDefaults({ ...DEFAULT_FILESYSTEM_SPEC, workload: 'desktop' }).max_user_watches).toBe(524288)
    const small = { ...DEFAULT_FILESYSTEM_SPEC, workload: 'container', ramGiB: 2 }
    expect(watchMemoryBytes(deriveDefaults(small).max_user_watches)).toBeLessThanOrEqual(0.1 * 2 * GiB)
  })

  it('raises AIO only for databases and leaves fs.nr_open at the kernel default', () => {
    for (const workload of WORKLOADS) {
      const p = deriveDefaults({ ...DEFAULT_FILESYSTEM_SPEC, workload })
      expect(p.aio_max_nr).toBe(workload === 'database' ? 1048576 : 65536)
      expect(p.nr_open).toBe(1048576)
    }
  })
})

describe('filesystem config', () => {
  it('leaves fs.file-max out on systemd 240 and newer, and writes it on older systems', () => {
    expect(config(DEFAULT_FILESYSTEM_SPEC)).not.toMatch(/^fs\.file-max/m)
    expect(config(DEFAULT_FILESYSTEM_SPEC)).toContain('# fs.file-max is left out')
    // The server floor is 1048576; at 16 GiB the kernel's own value is higher.
    const older = config({ ...DEFAULT_FILESYSTEM_SPEC, systemd: 'older' })
    expect(older).toMatch(/^fs\.file-max = 1703936$/m)
    expect(older).not.toContain('# fs.file-max is left out')
  })

  it('leaves fs.nr_open out at 1048576, and writes it with the unit check when raised', () => {
    const out = config(DEFAULT_FILESYSTEM_SPEC)
    expect(out).not.toMatch(/^fs\.nr_open/m)
    expect(out).toContain('# fs.nr_open is left out')
    expect(out).not.toContain('# ── File descriptors')
    const raised = config(DEFAULT_FILESYSTEM_SPEC, { nr_open: 2097152 })
    expect(raised).toMatch(/^fs\.nr_open = 2097152$/m)
    expect(raised).toContain('grep -rs LimitNOFILE=')
    expect(raised).toContain('# ── File descriptors')
  })

  it('writes the inotify and AIO keys for every workload', () => {
    for (const workload of WORKLOADS) {
      const out = config({ ...DEFAULT_FILESYSTEM_SPEC, workload })
      for (const name of ['fs.inotify.max_user_watches', 'fs.inotify.max_user_instances', 'fs.inotify.max_queued_events', 'fs.aio-max-nr']) {
        expect(out).toMatch(new RegExp(`^${name.replace(/\./g, '\\.')} = \\d+$`, 'm'))
      }
    }
  })

  it('marks fs.nr_open as left out on the card at the kernel default only', () => {
    expect(formatValue(1048576, PARAMETER_DEFS_BY_KEY.nr_open)).toBe(`${(1048576).toLocaleString()} (left out)`)
    expect(formatValue(2097152, PARAMETER_DEFS_BY_KEY.nr_open)).toBe((2097152).toLocaleString())
  })
})

describe('filesystem validation', () => {
  it('notes the unit start failure once fs.nr_open is set', () => {
    expect(ids(DEFAULT_FILESYSTEM_SPEC)).not.toContain('nr-open-units')
    expect(ids(DEFAULT_FILESYSTEM_SPEC, { nr_open: 2097152 })).toContain('nr-open-units')
  })

  it('warns when the watch limit could pin more than a tenth of RAM', () => {
    const hw = { ...DEFAULT_FILESYSTEM_SPEC, ramGiB: 2 }
    expect(ids(hw, { max_user_watches: 1048576 })).toContain('watches-memory')
    expect(ids(hw)).not.toContain('watches-memory')
  })

  it('warns about a file-max below the kernel value only where it is written', () => {
    expect(ids({ ...DEFAULT_FILESYSTEM_SPEC, systemd: 'older' }, { file_max: 65536 })).toContain('file-max-below-kernel')
    expect(ids(DEFAULT_FILESYSTEM_SPEC, { file_max: 65536 })).not.toContain('file-max-below-kernel')
  })

  it('suggests more inotify instances on container hosts', () => {
    const hw = { ...DEFAULT_FILESYSTEM_SPEC, workload: 'container' }
    expect(ids(hw)).not.toContain('instances-container')
    expect(ids(hw, { max_user_instances: 512 })).toContain('instances-container')
  })
})
