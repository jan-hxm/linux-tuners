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
 * @property {boolean}         blocking
 */

/**
 * @param {import('./parameters.js').SystemdSpec} hw
 * @param {import('./parameters.js').SystemdValues} p
 * @returns {ValidationIssue[]}
 */
export function validate(hw, p) {
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
    })
  }

  if (highSet && maxSet && p.memory_high === p.memory_max) {
    issues.push({
      id: 'memhigh-eq-memmax',
      level: 'warn',
      blocking: false,
      params: ['memory_high', 'memory_max'],
      message: 'MemoryHigh equals MemoryMax: the slice gets no throttle runway before the hard OOM cap.',
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
    })
  }

  // Memory limits do nothing without memory accounting.
  if (p.default_memory_accounting === 0 && (highSet || maxSet)) {
    issues.push({
      id: 'memlimit-without-accounting',
      level: 'warn',
      blocking: false,
      params: ['default_memory_accounting', 'memory_high', 'memory_max'],
      message: 'MemoryHigh/MemoryMax are only enforced when memory accounting is enabled.',
    })
  }

  // TasksMax does nothing without tasks accounting.
  const tasksCapped = p.tasks_max < hw.pidMax || p.default_tasks_max < hw.pidMax
  if (p.default_tasks_accounting === 0 && tasksCapped) {
    issues.push({
      id: 'tasksmax-without-accounting',
      level: 'warn',
      blocking: false,
      params: ['default_tasks_accounting', 'tasks_max', 'default_tasks_max'],
      message: 'TasksMax/DefaultTasksMax are only enforced when tasks accounting is enabled.',
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
  if (p.cpu_quota > 0 && p.cpu_quota < 100 && hw.targetSlice === 'system.slice') {
    issues.push({
      id: 'cpuquota-starves-system',
      level: 'warn',
      blocking: false,
      params: ['cpu_quota'],
      message: 'Capping system.slice below 100% (one core) can starve core daemons (journald, dbus, sshd).',
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
