import { SYSTEMD_DEFS_BY_KEY } from '@/data/systemd/parameterDefs.js'

/**
 * Hardware/workload-aware defaults for every systemd resource-control parameter.
 *
 * Like the swap tuner's deriveDefaults, the per-workload numbers here are
 * opinionated *starting points* (not kernel constants): they encode common
 * practice for container hosts, databases, etc., and the user adjusts from
 * there. Kernel/systemd-mandated values (accounting defaults, the 15%-of-pid_max
 * DefaultTasksMax rule, the 1024:524288 / 8M limit defaults) come straight from
 * the man pages — see parameterDefs.js sources.
 *
 * @param {import('./parameters.js').SystemdSpec} hw
 * @returns {import('./parameters.js').SystemdValues}
 */
export function deriveDefaults(hw) {
  // DefaultTasksMax = 15% of kernel.pid_max (systemd-system.conf(5)).
  const tasksFromPid = Math.round(hw.pidMax * 0.15)

  // Accounting: systemd stock defaults (memory + tasks on, cpu/io/ip off).
  let cpuAcct = 0
  let ioAcct = 0
  const memAcct = 1
  const tasksAcct = 1
  const ipAcct = 0

  // Slice-level controls start "unset": weights at the neutral 100, quotas and
  // memory limits at the top of their range (= infinity / no limit).
  const cores = Math.max(1, hw.cpuCores)
  let cpu_quota = cores * 100 // no limit
  let memory_high = 100 // infinity
  let memory_max = 100 // infinity
  let memory_swap_max = 100 // infinity
  let default_limit_nofile_hard = SYSTEMD_DEFS_BY_KEY.default_limit_nofile_hard.kernelDefault
  let default_limit_memlock = SYSTEMD_DEFS_BY_KEY.default_limit_memlock.kernelDefault
  let default_tasks_max = clamp(tasksFromPid, 64, hw.pidMax)
  let tasks_max = clamp(tasksFromPid, 64, hw.pidMax)

  switch (hw.workload) {
    case 'container-host':
    case 'kubernetes':
      // Observability for co-located workloads + headroom for the runtime.
      cpuAcct = 1
      ioAcct = 1
      default_limit_nofile_hard = 1048576
      // Protect the host: throttle the tuned slice before it eats all RAM.
      memory_high = 80
      memory_max = 90
      break
    case 'database':
      // Pin buffers in RAM, keep the slice out of swap, raise mlock + fds.
      default_limit_memlock = 268435456 // 256 MiB
      default_limit_nofile_hard = 1048576
      memory_high = 85
      memory_max = 95
      memory_swap_max = 0 // never swap the DB slice
      break
    case 'desktop':
      // Keep interactive sessions responsive; cap runaway user tasks modestly.
      tasks_max = clamp(Math.round(hw.pidMax * 0.1), 64, hw.pidMax)
      break
    case 'general':
    default:
      break
  }

  return {
    default_cpu_accounting: cpuAcct,
    default_memory_accounting: memAcct,
    default_io_accounting: ioAcct,
    default_tasks_accounting: tasksAcct,
    default_ip_accounting: ipAcct,
    default_tasks_max,
    default_limit_nofile_soft: SYSTEMD_DEFS_BY_KEY.default_limit_nofile_soft.kernelDefault,
    default_limit_nofile_hard,
    default_limit_memlock,
    cpu_weight: 100,
    cpu_quota,
    memory_high,
    memory_max,
    memory_swap_max,
    io_weight: 100,
    tasks_max,
  }
}

/**
 * Suggested min/max for each slider, taking the system profile into account.
 *
 * @param {string} key
 * @param {import('./parameters.js').SystemdSpec} hw
 * @returns {{ min: number, max: number }}
 */
export function rangeFor(key, hw) {
  const def = SYSTEMD_DEFS_BY_KEY[key]
  if (!def) throw new Error(`Unknown systemd parameter: ${key}`)

  if (key === 'cpu_quota') {
    // 0 .. one full machine (cores × 100%). The top of the range = "no limit".
    return { min: 0, max: Math.max(100, Math.max(1, hw.cpuCores) * 100) }
  }
  if (key === 'default_tasks_max' || key === 'tasks_max') {
    // Can't exceed the kernel PID space.
    return { min: def.kernelMin, max: Math.min(def.kernelMax, hw.pidMax) }
  }
  if (key === 'default_limit_memlock') {
    // Don't offer locking more than total RAM.
    const ramBytes = hw.ramGiB * 1024 * 1024 * 1024
    return { min: def.kernelMin, max: Math.min(def.kernelMax, ramBytes) }
  }
  return { min: def.kernelMin, max: def.kernelMax }
}

/** The CPUQuota value that means "no limit" for the given core count. */
export function cpuQuotaNoLimit(hw) {
  return Math.max(1, hw.cpuCores) * 100
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}
