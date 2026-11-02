/**
 * The System V IPC tuner's system profile: one field list that drives the
 * form, the defaults and the shared-link restore schema (src/core/profile.js).
 *
 * @typedef {'general' | 'container' | 'oracle' | 'db2'} IpcWorkload
 *
 * @typedef {Object} IpcSpec
 * @property {IpcWorkload} workload
 * @property {number}      ramGiB    Db2 sizes its minimums from RAM
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
      label: 'What the machine runs',
      options: [
        { value: 'general', label: 'General server or desktop' },
        { value: 'container', label: 'Container host or Kubernetes node' },
        { value: 'oracle', label: 'Oracle Database' },
        { value: 'db2', label: 'IBM Db2' },
      ],
      default: 'general',
      machine: {
        from: 'role',
        map: {
          server: 'general',
          web: 'general',
          database: 'general',
          'container-host': 'container',
          'vm-host': 'general',
          router: 'general',
          desktop: 'general',
        },
      },
    },
    { ...RAM_FIELD, default: 16, machine: 'ramGiB' },
  ],
  /**
   * The collapsed one-line summary, as rich-text parts joined with " · ".
   * @param {IpcSpec} hw
   * @param {(key: string, value: string) => string} label  A choice's option label
   */
  summary: (hw, label) => [label('workload', hw.workload), `\`${formatSizeGiB(hw.ramGiB)}\` RAM`],
}

/** Default system profile used before the user submits the form. */
export const DEFAULT_IPC_SPEC = /** @type {IpcSpec} */ (profileDefaults(PROFILE.fields))
