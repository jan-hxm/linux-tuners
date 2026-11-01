/**
 * The filesystem tuner's system profile: one field list that drives the form,
 * the defaults and the shared-link restore schema (src/core/profile.js).
 *
 * @typedef {'server' | 'database' | 'container' | 'desktop'} FilesystemWorkload
 * @typedef {'modern' | 'older'} SystemdGeneration
 *
 * @typedef {Object} FilesystemSpec
 * @property {FilesystemWorkload} workload
 * @property {number}             ramGiB
 * @property {SystemdGeneration}  systemd   240+ raises fs.file-max to the maximum at boot
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
        { value: 'server', label: 'Web, application or file server' },
        { value: 'database', label: 'Database server' },
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
        { value: 'modern', label: '240 or newer', note: 'systemd raises fs.file-max to the maximum at boot, so it is left out.' },
        { value: 'older', label: 'older, or none', note: 'For example Ubuntu 18.04 or CentOS 7: fs.file-max stays at the kernel\'s RAM-based value unless set.' },
      ],
      default: 'modern',
      half: true,
    },
  ],
  /**
   * The collapsed one-line summary, as rich-text parts joined with " · ".
   * @param {FilesystemSpec} hw
   * @param {(key: string, value: string) => string} label  A choice's option label
   */
  summary: (hw, label) => [
    label('workload', hw.workload),
    `\`${formatSizeGiB(hw.ramGiB)}\` RAM`,
    `systemd ${label('systemd', hw.systemd)}`,
  ],
}

/** Default system profile used before the user submits the form. */
export const DEFAULT_FILESYSTEM_SPEC = /** @type {FilesystemSpec} */ (profileDefaults(PROFILE.fields))
