/**
 * The kernel tuner's system profile: one field list that drives the form,
 * the defaults and the shared-link restore schema (src/core/profile.js).
 *
 * @typedef {'server' | 'container' | 'desktop'} KernelWorkload
 * @typedef {'modern' | 'older'} SystemdGeneration
 *
 * @typedef {Object} KernelSpec
 * @property {KernelWorkload}    workload
 * @property {number}            ramGiB    The kernel sizes threads-max from RAM
 * @property {SystemdGeneration} systemd   243+ raises kernel.pid_max at boot
 */

import { profileDefaults } from '@/core/profile.js'
import { formatSizeGiB } from '@/core/formatting.js'
import { RAM_FIELD } from '@/ui/profile/fieldOptions.js'

export const PROFILE = {
  title: 'System profile',
  applyLabel: 'Apply system profile',
  fields: [
    {
      key: 'workload',
      type: 'choice',
      control: 'select',
      label: 'What the machine does',
      options: [
        { value: 'server', label: 'Server or cloud VM' },
        { value: 'container', label: 'Container host or Kubernetes node' },
        { value: 'desktop', label: 'Desktop or developer workstation' },
      ],
      default: 'server',
    },
    { ...RAM_FIELD, default: 16, half: true },
    {
      key: 'systemd',
      type: 'choice',
      control: 'segmented',
      label: 'systemd version (systemctl --version)',
      options: [
        { value: 'modern', label: '243 or newer', note: 'systemd raises kernel.pid_max to 4194304 at boot, so it is left out.' },
        { value: 'older', label: 'older, or none', note: 'For example Ubuntu 18.04 or CentOS 7: kernel.pid_max stays at 32768 unless set.' },
      ],
      default: 'modern',
      half: true,
    },
  ],
  /**
   * The collapsed one-line summary, as rich-text parts joined with " · ".
   * @param {KernelSpec} hw
   * @param {(key: string, value: string) => string} label  A choice's option label
   */
  summary: (hw, label) => [
    label('workload', hw.workload),
    `\`${formatSizeGiB(hw.ramGiB)}\` RAM`,
    `systemd ${label('systemd', hw.systemd)}`,
  ],
}

/** Default system profile used before the user submits the form. */
export const DEFAULT_KERNEL_SPEC = /** @type {KernelSpec} */ (profileDefaults(PROFILE.fields))
