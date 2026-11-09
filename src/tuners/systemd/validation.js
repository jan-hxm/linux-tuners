/**
 * Cross-parameter validation for the systemd tuner. Same contract as the swap
 * tuner's validation (ValidationIssue[] with a blocking flag that suppresses the
 * config output). Pure function consumed via the store.
 *
 * @typedef {'error' | 'warn' | 'info'} ValidationLevel
 * @typedef {Object} ValidationIssue
 * @property {string}          id
 * @property {ValidationLevel} level
 * @property {string[]}        params
 * @property {string}          message
 * @property {string}          [fix]     What to change to resolve it, in one plain sentence
 * @property {boolean}         blocking
 */

import { SYSTEMD_DEFS_BY_KEY } from './defs.js'

/**
 * @param {import('./profile.js').SystemdSpec} hw
 * @param {import('./defs.js').SystemdValues} p
 * @param {{ nrOpen?: number, pidMax?: number, threadsMax?: number }} [facts]
 *   From the filesystem and kernel steps of the guided setup; none on this
 *   tuner's own page.
 * @returns {ValidationIssue[]}
 */
export function validate(hw, p, facts = {}) {
  /** @type {ValidationIssue[]} */
  const issues = []

  // RLIMIT rule: a soft limit may never exceed its hard limit.
  if (p.default_limit_nofile_soft > p.default_limit_nofile_hard) {
    issues.push({
      id: 'nofile-soft-gt-hard',
      level: 'error',
      blocking: true,
      params: ['default_limit_nofile_soft', 'default_limit_nofile_hard'],
      message: 'DefaultLimitNOFILE soft limit must not exceed the hard limit.',
      fix: `Lower the DefaultLimitNOFILE soft limit to ${p.default_limit_nofile_hard} or less, or raise the hard limit to ${p.default_limit_nofile_soft} or more.`,
    })
  }

  // MemoryHigh should sit below MemoryMax so the slice is throttled before the
  // OOM-killing hard cap. (Both are "set" only when below 100% = not infinity.)
  const highSet = p.memory_high < 100
  const maxSet = p.memory_max < 100
  if (highSet && maxSet && p.memory_high > p.memory_max) {
    issues.push({
      id: 'memhigh-gt-memmax',
      level: 'error',
      blocking: true,
      params: ['memory_high', 'memory_max'],
      message: 'MemoryHigh is above MemoryMax: the slice would be OOM-killed before the soft throttle ever engages.',
      fix: `Lower MemoryHigh below ${p.memory_max}%, or raise MemoryMax above ${p.memory_high}%.`,
    })
  }

  if (highSet && maxSet && p.memory_high === p.memory_max) {
    issues.push({
      id: 'memhigh-eq-memmax',
      level: 'warn',
      blocking: false,
      params: ['memory_high', 'memory_max'],
      message: 'MemoryHigh equals MemoryMax: the slice gets no throttle runway before the hard OOM cap.',
      fix: 'Lower MemoryHigh a few percent below MemoryMax.',
    })
  }

  // Unified resource control (CPUWeight/MemoryMax/IOWeight/MemorySwapMax) needs
  // the cgroup v2 unified hierarchy.
  if (hw.cgroupVersion === 'v1') {
    issues.push({
      id: 'cgroup-v1',
      level: 'warn',
      blocking: false,
      params: [],
      message: 'These controls assume the cgroup v2 unified hierarchy. On cgroup v1, CPUWeight/MemoryMax/IOWeight/MemorySwapMax map to legacy controllers with different semantics or no effect.',
      fix: 'Boot the machine with the cgroup v2 unified hierarchy (systemd.unified_cgroup_hierarchy=1 on the kernel command line).',
    })
  }

  // No warning for a memory or task limit with its accounting off: systemd
  // turns the controller on for any unit with a limit set (MemoryMax=,
  // TasksMax=, or a DefaultTasksMax= copied into the unit), see
  // systemd.resource-control(5) and unit_get_own_mask() in cgroup.c.

  // No limit can pass fs.nr_open: units asking for more get fs.nr_open.
  if (facts.nrOpen !== undefined && p.default_limit_nofile_hard > facts.nrOpen) {
    issues.push({
      id: 'nofile-above-nr-open',
      level: 'warn',
      blocking: false,
      params: ['default_limit_nofile_hard'],
      message: `The DefaultLimitNOFILE hard limit is above fs.nr_open from the filesystem step (${facts.nrOpen}), so units get ${facts.nrOpen} instead.`,
      fix: `Lower the DefaultLimitNOFILE hard limit to ${facts.nrOpen} or less, or raise fs.nr_open in the filesystem step.`,
    })
  }

  // The kernel runs out of PIDs or threads before a task cap above both binds.
  const kernelTasks = Math.min(facts.pidMax ?? Infinity, facts.threadsMax ?? Infinity)
  const tasksAbove = ['default_tasks_max', 'tasks_max'].filter((k) => p[k] > kernelTasks)
  if (tasksAbove.length > 0) {
    issues.push({
      id: 'tasks-above-kernel-limit',
      level: 'warn',
      blocking: false,
      params: tasksAbove,
      message: `${tasksAbove.map((k) => SYSTEMD_DEFS_BY_KEY[k].sysctlName).join(' and ')} ${tasksAbove.length > 1 ? 'are' : 'is'} above the smaller of kernel.pid_max and kernel.threads-max from the kernel step (${kernelTasks}), so the kernel stops new tasks first.`,
      fix: `Lower ${tasksAbove.map((k) => SYSTEMD_DEFS_BY_KEY[k].sysctlName).join(' and ')} to ${kernelTasks} or less, or raise the smaller kernel limit in the kernel step.`,
    })
  }

  // IOWeight shaping is invisible (and harder to verify) without I/O accounting.
  if (p.default_io_accounting === 0 && p.io_weight !== 100) {
    issues.push({
      id: 'ioweight-without-accounting',
      level: 'info',
      blocking: false,
      params: ['default_io_accounting', 'io_weight'],
      message: 'IOWeight still applies, but enable I/O accounting to actually observe the bandwidth split.',
    })
  }

  // Hard CPU cap below one full core on the system slice can starve daemons.
  if (p.cpu_quota < 100 && hw.targetSlice === 'system.slice') {
    issues.push({
      id: 'cpuquota-starves-system',
      level: 'warn',
      blocking: false,
      params: ['cpu_quota'],
      message: 'Capping system.slice below 100% (one core) can starve core daemons (journald, dbus, sshd).',
      fix: 'Raise CPUQuota to 100% or more, or apply the cap to a different slice.',
    })
  }

  // A memory hard cap sized very tight will OOM-kill under any real load.
  if (maxSet && p.memory_max < 10) {
    issues.push({
      id: 'memmax-too-tight',
      level: 'warn',
      blocking: false,
      params: ['memory_max'],
      message: `MemoryMax at ${p.memory_max}% of RAM is very tight; the slice will be OOM-killed under normal load.`,
      fix: 'Raise MemoryMax to 10% of RAM or more.',
    })
  }

  // Pinning a slice out of swap is intentional but worth surfacing.
  if (p.memory_swap_max === 0) {
    issues.push({
      id: 'swap-disabled-for-slice',
      level: 'info',
      blocking: false,
      params: ['memory_swap_max'],
      message: 'MemorySwapMax=0 forbids this slice from swapping; intentional for latency-sensitive workloads like databases.',
    })
  }

  return issues
}

/**
 * @param {ValidationIssue[]} issues
 * @returns {boolean}
 */
export function hasBlockingIssue(issues) {
  return issues.some((i) => i.blocking)
}
