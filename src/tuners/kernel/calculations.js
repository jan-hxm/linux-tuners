import { PARAMETER_DEFS_BY_KEY, PID_MAX_LIMIT, THREAD_STACK_BYTES } from './defs.js'

const GiB = 1024 ** 3

/** systemd's DefaultTasksMax: this share of min(pid_max, threads-max). */
export const TASKS_MAX_SHARE = 0.15

/** Thread stacks past this share of RAM are worth a warning. */
export const THREAD_RAM_WARN = 0.5

/**
 * kernel.threads-max as the kernel sizes it at boot, rounded up to the
 * slider's step: thread stacks in an eighth of RAM. Measured on the VM
 * images at about 1% below this, since the kernel counts RAM before freeing
 * its boot memory.
 *
 * @param {import('./profile.js').KernelSpec} hw
 */
export function kernelThreads(hw) {
  const step = PARAMETER_DEFS_BY_KEY.threads_max.step
  return Math.min(PID_MAX_LIMIT, Math.ceil((hw.ramGiB * GiB) / (8 * THREAD_STACK_BYTES) / step) * step)
}

/** The pid_max the machine runs with: systemd 243+ sets the limit at boot. */
export function effectivePidMax(hw, p) {
  return hw.systemd === 'modern' ? PID_MAX_LIMIT : p.pid_max
}

/** systemd's default TasksMax per service with these values. */
export function defaultTasksMax(hw, p) {
  return Math.floor(TASKS_MAX_SHARE * Math.min(effectivePidMax(hw, p), p.threads_max))
}

/** Kernel stack memory if every thread allowed existed, as a share of RAM. */
export function threadStackRamShare(hw, p) {
  return (p.threads_max * THREAD_STACK_BYTES) / (hw.ramGiB * GiB)
}

/**
 * Profile-aware starting values. Opinionated: servers reboot after a crash,
 * container hosts get LXD's key quotas, and every workload gets the SysRq
 * keys that restart a hung machine and a console that shows only errors.
 *
 * @param {import('./profile.js').KernelSpec} hw
 * @returns {import('./defs.js').KernelValues}
 */
export function deriveDefaults(hw) {
  const unattended = hw.workload !== 'desktop'
  const container = hw.workload === 'container'
  return {
    pid_max: PID_MAX_LIMIT,
    threads_max: kernelThreads(hw),
    maxkeys: container ? 2000 : 200,
    maxbytes: container ? 2000000 : 20000,
    panic: unattended ? 10 : 0,
    panic_on_oops: unattended ? 1 : 0,
    softlockup_panic: 0,
    sysrq: 'reboot',
    printk: [4, 4, 1, 7],
  }
}

/**
 * The values the controls offer. threads-max starts at the kernel's
 * RAM-based value: below the threads already running nothing can fork.
 *
 * @param {string} key
 * @param {import('./profile.js').KernelSpec} hw
 * @returns {import('@/core/valueTypes.js').Range}
 */
export function rangeFor(key, hw) {
  const def = PARAMETER_DEFS_BY_KEY[key]
  if (!def) throw new Error(`Unknown kernel parameter: ${key}`)
  if (key === 'threads_max') return { min: kernelThreads(hw), max: def.kernelMax }
  return def.elementLimits
    ? { min: def.kernelMin, max: def.kernelMax, elements: def.elementLimits }
    : { min: def.kernelMin, max: def.kernelMax }
}

/** Whether a key has a card: systemd 243 and newer set kernel.pid_max themselves. */
export function isApplicable(key, hw) {
  return key !== 'pid_max' || hw.systemd === 'older'
}

/**
 * Whether a key is written to the file: the applicable ones, except
 * threads-max at the kernel's own RAM-based value, which the file would
 * only approximate.
 *
 * @param {string} key
 * @param {import('./profile.js').KernelSpec} hw
 * @param {import('./defs.js').KernelValues} params
 */
export function isEmitted(key, hw, params) {
  if (key === 'threads_max') return params.threads_max > kernelThreads(hw)
  return isApplicable(key, hw)
}
