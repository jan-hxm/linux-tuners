import { describe, it, expect } from 'vitest'
import { generateConfig } from './config.js'
import { defaultTasksMax, deriveDefaults, kernelThreads, rangeFor } from './calculations.js'
import { validate } from './validation.js'
import { DEFAULT_KERNEL_SPEC } from './profile.js'
import { formatValue } from './formatting.js'
import { PARAMETER_DEFS_BY_KEY } from './defs.js'
import { kernelDomain } from './index.js'

const NOW = new Date('2026-01-01T00:00:00Z')
const OLDER = { ...DEFAULT_KERNEL_SPEC, systemd: 'older' }

function file(hardware, overrides = {}) {
  const params = { ...deriveDefaults(hardware), ...overrides }
  return generateConfig({ hardware, params, presetLabel: null, customised: false, now: NOW })[0].content
}

const ids = (hw, overrides = {}) => validate(hw, { ...deriveDefaults(hw), ...overrides }).map((i) => i.id)

describe('kernel defaults', () => {
  it('sizes threads-max like the kernel, an eighth of RAM in 16 KiB stacks', () => {
    expect(kernelThreads({ ramGiB: 16 })).toBe(131072)
    expect(kernelThreads({ ramGiB: 2 })).toBe(16384)
    expect(kernelThreads({ ramGiB: 4096 })).toBe(4194304)
    expect(rangeFor('threads_max', { ramGiB: 2 })).toEqual({ min: 16384, max: 4194304 })
  })

  it('reboots unattended machines after a crash and gives container hosts the LXD key quotas', () => {
    expect(deriveDefaults(DEFAULT_KERNEL_SPEC)).toMatchObject({ panic: 10, panic_on_oops: 1, maxkeys: 200, maxbytes: 20000, sysrq: 'reboot' })
    expect(deriveDefaults({ ...DEFAULT_KERNEL_SPEC, workload: 'container' })).toMatchObject({ maxkeys: 2000, maxbytes: 2000000 })
    expect(deriveDefaults({ ...DEFAULT_KERNEL_SPEC, workload: 'desktop' })).toMatchObject({ panic: 0, panic_on_oops: 0 })
  })

  it('derives systemd\'s DefaultTasksMax from the smaller of pid_max and threads-max', () => {
    // Measured: 15593 threads gave 2338; 200000 on Ubuntu 18.04 (pid_max 32768) gave 4915.
    expect(defaultTasksMax(DEFAULT_KERNEL_SPEC, { threads_max: 15593, pid_max: 32768 })).toBe(2338)
    expect(defaultTasksMax(OLDER, { threads_max: 200000, pid_max: 32768 })).toBe(4915)
  })
})

describe('kernel config', () => {
  it('leaves pid_max to systemd 243+ and threads-max at the kernel value', () => {
    const out = file(DEFAULT_KERNEL_SPEC)
    expect(out).not.toMatch(/^kernel\.(pid_max|threads-max) /m)
    expect(out).toContain('# kernel.pid_max is left out')
    expect(out).toContain('# kernel.threads-max is left out')
    expect(file(OLDER)).toMatch(/^kernel\.pid_max = 4194304$/m)
  })

  it('writes threads-max once raised, with the TasksMax it gives', () => {
    const out = file(DEFAULT_KERNEL_SPEC, { threads_max: 200704 })
    expect(out).toMatch(/^kernel\.threads-max = 200704$/m)
    expect(out).toContain('of kernel.pid_max and kernel.threads-max, 30105 here')
  })

  it('prints the SysRq bitmask, all four printk fields and the panic keys', () => {
    const out = file(DEFAULT_KERNEL_SPEC)
    expect(out).toMatch(/^kernel\.sysrq = 176$/m)
    expect(out).toMatch(/^kernel\.printk = 4 4 1 7$/m)
    expect(out).toMatch(/^kernel\.panic = 10$/m)
    expect(out).toMatch(/^kernel\.panic_on_oops = 1$/m)
    expect(out).toMatch(/^kernel\.keys\.maxkeys = 200$/m)
  })
})

describe('kernel validation', () => {
  it('has nothing to warn about at the defaults', () => {
    for (const workload of kernelDomain.workloads) {
      expect(validate({ ...DEFAULT_KERNEL_SPEC, workload }, deriveDefaults({ ...DEFAULT_KERNEL_SPEC, workload })).filter((i) => i.level === 'warn')).toEqual([])
    }
  })

  it('warns when a panic switch is on but kernel.panic never reboots', () => {
    expect(ids(DEFAULT_KERNEL_SPEC, { panic: 0 })).toContain('panic-no-reboot')
    expect(ids(DEFAULT_KERNEL_SPEC, { panic: 0, panic_on_oops: 0 })).not.toContain('panic-no-reboot')
  })

  it('notes the thread limits once threads-max is raised', () => {
    expect(ids(DEFAULT_KERNEL_SPEC)).not.toContain('tasks-max')
    expect(ids(DEFAULT_KERNEL_SPEC, { threads_max: 200704 })).toContain('tasks-max')
    expect(ids(OLDER, { threads_max: 200704, pid_max: 32768 })).toContain('threads-above-pids')
    expect(ids(DEFAULT_KERNEL_SPEC, { threads_max: 200704, pid_max: 32768 })).not.toContain('threads-above-pids')
    expect(ids({ ...DEFAULT_KERNEL_SPEC, ramGiB: 2 }, { threads_max: 4194304 })).toContain('thread-memory')
  })

  it('notes a byte quota too small for the key count, and SysRq open to everything', () => {
    expect(ids(DEFAULT_KERNEL_SPEC, { maxkeys: 2000 })).toContain('keys-bytes')
    expect(ids(DEFAULT_KERNEL_SPEC, { sysrq: 'all' })).toContain('sysrq-all')
  })
})

describe('kernel formatting', () => {
  it('prints seconds, switches, the bitmask and the printk fields', () => {
    expect(formatValue(0, PARAMETER_DEFS_BY_KEY.panic)).toBe('never reboot')
    expect(formatValue(10, PARAMETER_DEFS_BY_KEY.panic)).toBe('10 s')
    expect(formatValue('debian', PARAMETER_DEFS_BY_KEY.sysrq)).toBe('438')
    expect(formatValue([4, 4, 1, 7], PARAMETER_DEFS_BY_KEY.printk)).toBe('4 4 1 7')
  })
})
