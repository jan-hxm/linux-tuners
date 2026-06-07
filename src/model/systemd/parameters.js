/**
 * Shape definitions for the systemd tuner's two core state objects. Mirrors the
 * swap tuner's src/model/parameters.js but for systemd resource control.
 *
 * @typedef {'container-host' | 'kubernetes' | 'database' | 'general' | 'desktop'} SystemdWorkload
 * @typedef {'system.slice' | 'user.slice' | 'machine.slice'} TargetSlice
 * @typedef {'v1' | 'v2'} CgroupVersion
 *
 * @typedef {Object} SystemdSpec
 * @property {number}          ramGiB         Total RAM in GiB (positive integer)
 * @property {number}          cpuCores       Logical CPUs (drives CPUQuota + share math)
 * @property {SystemdWorkload} workload       Primary workload class
 * @property {TargetSlice}     targetSlice    Slice the slice-level controls apply to
 * @property {number}          pidMax         kernel.pid_max (drives TasksMax %)
 * @property {CgroupVersion}   cgroupVersion  Unified (v2) controllers vs legacy (v1)
 *
 * @typedef {Object} SystemdValues
 * @property {0|1}    default_cpu_accounting       DefaultCPUAccounting
 * @property {0|1}    default_memory_accounting    DefaultMemoryAccounting
 * @property {0|1}    default_io_accounting        DefaultIOAccounting
 * @property {0|1}    default_tasks_accounting     DefaultTasksAccounting
 * @property {0|1}    default_ip_accounting        DefaultIPAccounting
 * @property {number} default_tasks_max            DefaultTasksMax (absolute count)
 * @property {number} default_limit_nofile_soft    DefaultLimitNOFILE soft
 * @property {number} default_limit_nofile_hard    DefaultLimitNOFILE hard
 * @property {number} default_limit_memlock        DefaultLimitMEMLOCK (bytes)
 * @property {number} cpu_weight                   CPUWeight (1–10000)
 * @property {number} cpu_quota                    CPUQuota (% across cores; max = no limit)
 * @property {number} memory_high                  MemoryHigh (% of RAM; 100 = infinity)
 * @property {number} memory_max                   MemoryMax (% of RAM; 100 = infinity)
 * @property {number} memory_swap_max              MemorySwapMax (% of RAM; 100 = infinity, 0 = no swap)
 * @property {number} io_weight                    IOWeight (1–10000)
 * @property {number} tasks_max                    TasksMax (absolute count)
 */

/** All parameter keys, in display order. */
export const SYSTEMD_KEYS = /** @type {(keyof SystemdValues)[]} */ ([
  'default_cpu_accounting',
  'default_memory_accounting',
  'default_io_accounting',
  'default_tasks_accounting',
  'default_ip_accounting',
  'default_tasks_max',
  'default_limit_nofile_soft',
  'default_limit_nofile_hard',
  'default_limit_memlock',
  'cpu_weight',
  'cpu_quota',
  'memory_high',
  'memory_max',
  'memory_swap_max',
  'io_weight',
  'tasks_max',
])

/**
 * Modern 64-bit default for kernel.pid_max. systemd raises pid_max to 2^22 on
 * 64-bit systems (since v243); DefaultTasksMax is derived as a percentage of it.
 * See systemd-system.conf(5) DefaultTasksMax=.
 */
export const DEFAULT_PID_MAX = 4194304

/** Default system profile used before the user submits the form. */
export const DEFAULT_SYSTEMD_SPEC = /** @type {SystemdSpec} */ ({
  ramGiB: 16,
  cpuCores: 8,
  workload: 'general',
  targetSlice: 'system.slice',
  pidMax: DEFAULT_PID_MAX,
  cgroupVersion: 'v2',
})
