/**
 * The huge pages tuner's system profile: one field list that drives the form,
 * the defaults and the shared-link restore schema (src/core/profile.js).
 *
 * @typedef {'server' | 'database' | 'vm-host' | 'desktop'} HugepagesWorkload
 * @typedef {'single' | 'multi'} NumaLayout
 *
 * @typedef {Object} HugepagesSpec
 * @property {HugepagesWorkload} workload
 * @property {number}            ramGiB
 * @property {NumaLayout}        numa      zone_reclaim_mode only matters with several nodes
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
        { value: 'vm-host', label: 'Virtual machine host (KVM, QEMU)' },
        { value: 'desktop', label: 'Desktop or gaming machine' },
      ],
      default: 'server',
      machine: {
        from: 'role',
        map: {
          server: 'server',
          web: 'server',
          database: 'database',
          'container-host': 'server',
          'vm-host': 'vm-host',
          router: 'server',
          desktop: 'desktop',
        },
      },
    },
    { ...RAM_FIELD, default: 16, half: true, machine: 'ramGiB' },
    {
      key: 'numa',
      type: 'choice',
      control: 'segmented',
      label: 'NUMA nodes (lscpu | grep "NUMA node(s)")',
      options: [
        { value: 'single', label: 'one', note: 'Most desktops, laptops and single-socket servers. zone_reclaim_mode has no effect and is left out.' },
        { value: 'multi', label: 'two or more', note: 'Multi-socket servers and some large single-socket ones: zone_reclaim_mode is written.' },
      ],
      default: 'single',
      half: true,
    },
  ],
  /**
   * The collapsed one-line summary, as rich-text parts joined with " · ".
   * @param {HugepagesSpec} hw
   * @param {(key: string, value: string) => string} label  A choice's option label
   */
  summary: (hw, label) => [
    label('workload', hw.workload),
    `\`${formatSizeGiB(hw.ramGiB)}\` RAM`,
    `${label('numa', hw.numa)} NUMA ${hw.numa === 'single' ? 'node' : 'nodes'}`,
  ],
}

/** Default system profile used before the user submits the form. */
export const DEFAULT_HUGEPAGES_SPEC = /** @type {HugepagesSpec} */ (profileDefaults(PROFILE.fields))
