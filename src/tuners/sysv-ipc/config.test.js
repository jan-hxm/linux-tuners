import { describe, it, expect } from 'vitest'
import { generateConfig } from './config.js'
import { db2Minimums, deriveDefaults, queueMemoryBytes, rangeFor } from './calculations.js'
import { validate } from './validation.js'
import { DEFAULT_IPC_SPEC } from './profile.js'
import { formatValue } from './formatting.js'
import { PARAMETER_DEFS_BY_KEY, SEM_DEFAULT } from './defs.js'
import { VALUE_TYPES } from '@/core/valueTypes.js'

const NOW = new Date('2026-01-01T00:00:00Z')
const WORKLOADS = ['general', 'container', 'oracle', 'db2']

function file(hardware, overrides = {}) {
  const params = { ...deriveDefaults(hardware), ...overrides }
  return generateConfig({ hardware, params, presetLabel: null, customised: false, now: NOW })[0]
}

const ids = (hw, overrides = {}) => validate(hw, { ...deriveDefaults(hw), ...overrides }).map((i) => i.id)

describe('sysv-ipc defaults', () => {
  it('starts every workload but Db2 at the kernel defaults', () => {
    for (const workload of ['general', 'container', 'oracle']) {
      expect(deriveDefaults({ ...DEFAULT_IPC_SPEC, workload })).toEqual({
        shmmni: 4096, shm_rmid_forced: 0, sem: SEM_DEFAULT, msgmni: 32000, msgmax: 8192, msgmnb: 16384,
      })
    }
  })

  it('sizes the Db2 minimums from RAM, between the kernel default and 32768', () => {
    const small = deriveDefaults({ workload: 'db2', ramGiB: 8 })
    expect(small).toMatchObject({ shmmni: 4096, msgmni: 32000, msgmax: 65536, msgmnb: 65536 })
    expect(small.sem).toEqual(SEM_DEFAULT)
    const mid = deriveDefaults({ workload: 'db2', ramGiB: 64 })
    expect(mid).toMatchObject({ shmmni: 16384, msgmni: 32768 })
    expect(mid.sem[3]).toBe(32000)
    const big = deriveDefaults({ workload: 'db2', ramGiB: 256 })
    expect(big).toMatchObject({ shmmni: 32768, msgmni: 32768 })
    expect(big.sem[3]).toBe(32768)
    // Fractional RAM rounds up, so the minimum still holds.
    expect(db2Minimums({ workload: 'db2', ramGiB: 16.5 }).shmmni).toBe(256 * 17)
  })

  it('gives kernel.sem one range per field', () => {
    const range = rangeFor('sem')
    expect(range.elements.map((r) => r.max)).toEqual([65536, 2147483647, 32768, 32768])
    expect(VALUE_TYPES.tuple.clamp([1, 1, 1, 99999], PARAMETER_DEFS_BY_KEY.sem, range)).toEqual([32000, 1024000000, 500, 32768])
    expect(rangeFor('shmmni')).toEqual({ min: 4096, max: 32768 })
  })
})

describe('sysv-ipc config', () => {
  it('writes every key, at the kernel default too, and never shmmax or shmall', () => {
    for (const workload of WORKLOADS) {
      const out = file({ ...DEFAULT_IPC_SPEC, workload })
      expect(out.path).toBe('/etc/sysctl.d/99-sysv-ipc-tuning.conf')
      for (const def of Object.values(PARAMETER_DEFS_BY_KEY)) expect(out.content).toMatch(new RegExp(`^${def.sysctlName.replace('.', '\\.')} = `, 'm'))
      expect(out.content).toMatch(/^kernel\.sem = 32000 1024000000 500 32000$/m)
      expect(out.content).not.toMatch(/^kernel\.shm(max|all)/m)
      expect(out.content).toContain('# kernel.shmmax and kernel.shmall are left out')
      expect(out.content).toContain('own IPC namespace')
    }
  })

  it('explains the vendor minimums for Oracle and Db2', () => {
    expect(file({ ...DEFAULT_IPC_SPEC, workload: 'oracle' }).content).toContain('are all at or below the kernel defaults')
    expect(file({ ...DEFAULT_IPC_SPEC, workload: 'db2' }).content).toContain('Db2 raises these to its minimums when an instance starts')
    expect(file(DEFAULT_IPC_SPEC).content).not.toContain('Db2')
  })

  it('shows the worst-case queue memory on msgmnb', () => {
    const out = file(DEFAULT_IPC_SPEC)
    expect(queueMemoryBytes(deriveDefaults(DEFAULT_IPC_SPEC))).toBe(32000 * 16384)
    expect(out.content).toContain('# msgmnb: 16384 - bytes per queue, up to 500 MiB if every queue fills')
  })
})

describe('sysv-ipc validation', () => {
  it('has nothing to say about the kernel defaults on a general host', () => {
    expect(ids(DEFAULT_IPC_SPEC)).toEqual([])
  })

  it('warns about a message larger than the queue and about large worst-case queue memory', () => {
    expect(ids(DEFAULT_IPC_SPEC, { msgmax: 65536 })).toContain('msgmax-above-queue')
    expect(ids({ ...DEFAULT_IPC_SPEC, ramGiB: 4 }, { msgmnb: 65536 })).toContain('queue-memory')
    expect(ids({ ...DEFAULT_IPC_SPEC, ramGiB: 64 }, { msgmnb: 65536 })).not.toContain('queue-memory')
  })

  it('warns about shm_rmid_forced on databases and notes it elsewhere', () => {
    expect(ids({ ...DEFAULT_IPC_SPEC, workload: 'db2' }, { shm_rmid_forced: 1 })).toContain('rmid-database')
    expect(ids(DEFAULT_IPC_SPEC, { shm_rmid_forced: 1 })).toContain('rmid-tools')
  })

  it('notes values below the Db2 minimums, and the container namespaces', () => {
    const db2 = { workload: 'db2', ramGiB: 64 }
    expect(ids(db2)).not.toContain('db2-minimums')
    expect(validate(db2, { ...deriveDefaults(db2), shmmni: 4096 }).find((i) => i.id === 'db2-minimums').params).toEqual(['shmmni'])
    expect(ids({ ...DEFAULT_IPC_SPEC, workload: 'container' })).toContain('ipc-namespace')
  })

  it('notes when SEMMNS caps the arrays below full size', () => {
    expect(ids(DEFAULT_IPC_SPEC, { sem: [32000, 1024000000, 500, 32768] })).toContain('semmns-total')
  })
})

describe('sysv-ipc formatting', () => {
  it('prints sizes in bytes and the semaphore fields in order', () => {
    expect(formatValue(65536, PARAMETER_DEFS_BY_KEY.msgmnb)).toBe('64 KiB')
    expect(formatValue(SEM_DEFAULT, PARAMETER_DEFS_BY_KEY.sem)).toBe(SEM_DEFAULT.map((n) => n.toLocaleString()).join(' '))
    expect(formatValue(1, PARAMETER_DEFS_BY_KEY.shm_rmid_forced)).toBe('on')
  })
})
