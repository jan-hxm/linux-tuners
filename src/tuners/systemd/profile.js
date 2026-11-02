/**
 * The systemd tuner's system profile: one field list that drives the form, the
 * defaults and the shared-link restore schema (src/core/profile.js).
 *
 * @typedef {'container-host' | 'kubernetes' | 'database' | 'general' | 'desktop'} SystemdWorkload
 * @typedef {'system.slice' | 'user.slice' | 'machine.slice'} TargetSlice
 * @typedef {'v1' | 'v2'} CgroupVersion
 *
 * @typedef {Object} SystemdSpec
 * @property {number}          ramGiB         Total RAM in GiB (fractional allowed, e.g. 0.5 = 512 MiB)
 * @property {number}          cpuCores       Logical CPUs (drives CPUQuota + share math)
 * @property {SystemdWorkload} workload       Primary workload class
 * @property {TargetSlice}     targetSlice    Slice the slice-level controls apply to
 * @property {number}          pidMax         kernel.pid_max (drives TasksMax %)
 * @property {CgroupVersion}   cgroupVersion  Unified (v2) controllers vs legacy (v1)
 */

import { profileDefaults } from '@/core/profile.js'
import { formatSizeGiB } from '@/core/formatting.js'
import {
  RAM_FIELD,
  CORE_PICKS,
  CORE_MAX,
  PID_PICKS,
  PID_MAX_CEIL,
  cgroupField,
} from '@/ui/profile/fieldOptions.js'

/**
 * Modern 64-bit default for kernel.pid_max. systemd raises pid_max to 2^22 on
 * 64-bit systems (since v243); DefaultTasksMax is derived as a percentage of it.
 * See systemd-system.conf(5) DefaultTasksMax=.
 */
export const DEFAULT_PID_MAX = 4194304

// workload and targetSlice are echoed into the generated config, including a
// file path, so a shared link is held to these option lists.
export const PROFILE = {
  title: 'System profile',
  applyLabel: 'Apply system profile',
  fields: [
    { ...RAM_FIELD, default: 16, machine: 'ramGiB' },
    {
      key: 'cpuCores',
      type: 'number',
      label: 'Logical CPUs (cores)',
      min: 1,
      max: CORE_MAX,
      step: 1,
      picks: CORE_PICKS,
      help: ['Sets the CPUQuota range (100% = one core) and the CPU-share simulation.'],
      default: 8,
    },
    {
      key: 'workload',
      type: 'choice',
      control: 'select',
      label: 'Primary workload',
      options: [
        { value: 'container-host', label: 'Container host (Docker / Podman)' },
        { value: 'kubernetes', label: 'Kubernetes node' },
        { value: 'database', label: 'Database server' },
        { value: 'general', label: 'General purpose Linux server' },
        { value: 'desktop', label: 'Desktop workstation' },
      ],
      default: 'general',
      machine: {
        from: 'role',
        map: {
          server: 'general',
          web: 'general',
          database: 'database',
          'container-host': 'container-host',
          'vm-host': 'general',
          router: 'general',
          desktop: 'desktop',
        },
      },
    },
    {
      key: 'targetSlice',
      type: 'choice',
      control: 'cards',
      label: 'Target slice (for the slice-level controls)',
      columns: 3,
      mono: true,
      options: [
        { value: 'system.slice', label: 'system.slice', note: 'system services (the usual target)' },
        { value: 'user.slice', label: 'user.slice', note: 'logged-in user sessions' },
        { value: 'machine.slice', label: 'machine.slice', note: 'VMs & containers (machined)' },
      ],
      default: 'system.slice',
    },
    {
      key: 'pidMax',
      type: 'number',
      label: 'kernel.pid_max',
      min: 1024,
      max: PID_MAX_CEIL,
      step: 1,
      inputStep: 1024,
      picks: PID_PICKS,
      help: [
        'Drives DefaultTasksMax (15% of pid_max) and the TasksMax range.',
        'Run `sysctl kernel.pid_max` to find yours.',
      ],
      default: DEFAULT_PID_MAX,
      machine: 'pidMax',
      half: true,
    },
    cgroupField({
      v1: 'cgroup v1: the unified CPU/memory/I/O controls here map to legacy controllers with different semantics. Prefer v2.',
      v2: 'cgroup v2 (unified hierarchy): full support for CPUWeight, MemoryMax, IOWeight and MemorySwapMax.',
    }),
  ],
  /**
   * The collapsed one-line summary, as rich-text parts joined with " · ".
   * @param {SystemdSpec} hw
   * @param {(key: string, value: string) => string} label  A choice's option label
   */
  summary: (hw, label) => [
    `\`${formatSizeGiB(hw.ramGiB)}\` RAM`,
    `\`${hw.cpuCores}\` cores`,
    label('workload', hw.workload),
    `\`${hw.targetSlice}\``,
  ],
}

/** Default system profile used before the user submits the form. */
export const DEFAULT_SYSTEMD_SPEC = /** @type {SystemdSpec} */ (profileDefaults(PROFILE.fields))
