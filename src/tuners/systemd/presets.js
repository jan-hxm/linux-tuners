/**
 * Built-in systemd profiles. Each is a partial SystemdValues — keys not
 * mentioned fall back to the hardware-derived default (the store resets to
 * defaults, then layers the preset on top). The numbers are opinionated starting
 * points drawn from common systemd / container-host practice, not mandated
 * constants; the user fine-tunes from here.
 *
 * @typedef {Object} Preset
 * @property {string} id
 * @property {string} label
 * @property {string} description
 * @property {string} source
 * @property {Object} values
 */

/** @type {Preset[]} */
export const SYSTEMD_PRESETS = [
  {
    id: 'systemd-defaults',
    label: 'systemd defaults',
    description: 'Stock manager defaults, no slice-level resource limits. A known baseline.',
    source: 'systemd-system.conf(5) / systemd.resource-control(5)',
    values: {
      default_cpu_accounting: 0,
      default_memory_accounting: 1,
      default_io_accounting: 0,
      default_tasks_accounting: 1,
      default_ip_accounting: 0,
      default_tasks_max: 629146,
      default_limit_nofile_soft: 1024,
      default_limit_nofile_hard: 524288,
      default_limit_memlock: 8388608,
      cpu_weight: 100,
      memory_high: 100,
      memory_max: 100,
      memory_swap_max: 100,
      io_weight: 100,
      tasks_max: 629146,
    },
  },
  {
    id: 'container-host',
    label: 'Container host',
    description: 'Full accounting, high FD ceiling, host RAM protected by a throttle + hard cap.',
    source: 'systemd.resource-control(5) + common container-host practice',
    values: {
      default_cpu_accounting: 1,
      default_memory_accounting: 1,
      default_io_accounting: 1,
      default_tasks_accounting: 1,
      default_tasks_max: 1048576,
      default_limit_nofile_hard: 1048576,
      memory_high: 80,
      memory_max: 90,
      io_weight: 100,
    },
  },
  {
    id: 'kubernetes-node',
    label: 'Kubernetes node',
    description: 'Like a container host, with PID and FD headroom for kubelet and the runtime.',
    source: 'systemd.resource-control(5) + Kubernetes node sizing practice',
    values: {
      default_cpu_accounting: 1,
      default_memory_accounting: 1,
      default_io_accounting: 1,
      default_tasks_accounting: 1,
      default_tasks_max: 1048576,
      default_limit_nofile_hard: 1048576,
      memory_high: 80,
      memory_max: 90,
      cpu_weight: 200,
      io_weight: 200,
    },
  },
  {
    id: 'database-server',
    label: 'Database server',
    description: 'Big mlock + FD limits, slice pinned out of swap, generous memory before OOM.',
    source: 'systemd.exec(5) limits + database tuning practice',
    values: {
      default_memory_accounting: 1,
      default_io_accounting: 1,
      default_tasks_accounting: 1,
      default_limit_memlock: 268435456,
      default_limit_nofile_hard: 1048576,
      memory_high: 85,
      memory_max: 95,
      memory_swap_max: 0,
      io_weight: 200,
    },
  },
  {
    id: 'desktop',
    label: 'Desktop workstation',
    description: 'Light touch: keep sessions responsive, modest task cap, no hard memory limit.',
    source: 'General interactive-desktop guidance',
    values: {
      default_memory_accounting: 1,
      default_tasks_accounting: 1,
      memory_high: 95,
      memory_max: 100,
      tasks_max: 262144,
      io_weight: 100,
    },
  },
  {
    id: 'hardened-multitenant',
    label: 'Hardened multi-tenant',
    description: 'Tight throttle, hard memory cap and task cap to fence off a shared slice.',
    source: 'Multi-tenant isolation practice (systemd.resource-control)',
    values: {
      default_cpu_accounting: 1,
      default_memory_accounting: 1,
      default_io_accounting: 1,
      default_tasks_accounting: 1,
      memory_high: 70,
      memory_max: 80,
      tasks_max: 262144,
      io_weight: 100,
    },
  },
]

export const SYSTEMD_PRESETS_BY_ID = Object.fromEntries(SYSTEMD_PRESETS.map((p) => [p.id, p]))
