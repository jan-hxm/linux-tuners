/**
 * The swap tuner's hardware profile: one field list that drives the form, the
 * defaults and the shared-link restore schema (src/core/profile.js).
 *
 * @typedef {'hdd' | 'sata-ssd' | 'nvme-ssd' | 'zram' | 'zswap' | 'network'} SwapDevice
 * @typedef {'k8s' | 'database' | 'general' | 'desktop' | 'embedded' | 'custom'} Workload
 * @typedef {'v1' | 'v2'} CgroupVersion
 *
 * @typedef {Object} HardwareSpec
 * @property {number}        ramGiB         Total RAM in GiB (fractional allowed, e.g. 0.5 = 512 MiB)
 * @property {number}        swapGiB        Swap size in GiB (fractional allowed); 0 means no swap
 * @property {SwapDevice}    swapDevice     Backing device class for swap
 * @property {Workload}      workload       Primary workload class
 * @property {CgroupVersion} cgroupVersion  cgroup v1 / v2 — drives per-cgroup swappiness note
 * @property {string|null}   kernelVersion  Optional "major.minor" string (e.g. "6.6")
 */

import { profileDefaults } from '@/core/profile.js'
import { formatSizeGiB } from '@/core/formatting.js'
import {
  RAM_FIELD,
  SWAP_PICKS,
  SWAP_MIN_GIB,
  SWAP_MAX_GIB,
  SIZE_SNAP_GIB,
  SIZE_STEP_GIB,
  cgroupField,
} from '@/ui/profile/fieldOptions.js'

export const PROFILE = {
  title: 'Hardware spec',
  applyLabel: 'Apply hardware specs',
  fields: [
    { ...RAM_FIELD, default: 16, machine: 'ramGiB' },
    {
      key: 'swapGiB',
      type: 'number',
      label: 'Swap size (GiB)',
      min: SWAP_MIN_GIB,
      max: SWAP_MAX_GIB,
      step: SIZE_SNAP_GIB,
      inputStep: SIZE_STEP_GIB,
      picks: SWAP_PICKS,
      help: ['0 means no swap. Fractional values are allowed, e.g. 0.5 = 512 MiB.'],
      default: 8,
    },
    {
      key: 'swapDevice',
      type: 'choice',
      control: 'cards',
      label: 'Swap backing device',
      options: [
        { value: 'hdd', label: 'HDD (rotational)', note: 'caps swappiness at 60' },
        { value: 'sata-ssd', label: 'SATA SSD' },
        { value: 'nvme-ssd', label: 'NVMe SSD' },
        { value: 'zram', label: 'zram (in-memory compressed)', note: 'unlocks swappiness up to 200' },
        { value: 'zswap', label: 'zswap (compressed cache)', note: 'unlocks swappiness up to 200' },
        { value: 'network', label: 'Network swap (NFS, …)', note: 'flagged with a warning' },
      ],
      default: 'nvme-ssd',
      disabledWhen: { field: 'swapGiB', equals: 0 },
      disabledNote: 'Swap is disabled; device selection has no effect.',
    },
    {
      key: 'workload',
      type: 'choice',
      control: 'select',
      label: 'Primary workload',
      options: [
        { value: 'k8s', label: 'Kubernetes node' },
        { value: 'database', label: 'Database server' },
        { value: 'general', label: 'General purpose Linux server' },
        { value: 'desktop', label: 'Desktop workstation' },
        { value: 'embedded', label: 'Embedded / constrained memory' },
        { value: 'custom', label: 'Custom (drive everything manually)' },
      ],
      default: 'general',
      machine: {
        from: 'role',
        map: {
          server: 'general',
          web: 'general',
          database: 'database',
          'container-host': 'k8s',
          'vm-host': 'general',
          router: 'general',
          desktop: 'desktop',
        },
      },
    },
    cgroupField({
      v1: 'cgroup v1: per-cgroup swappiness is supported but deprecated. The system-wide value remains primary.',
      v2: 'cgroup v2: per-cgroup swappiness is not available. System-wide value applies to all cgroups.',
    }),
    {
      key: 'kernelVersion',
      type: 'text',
      label: 'Kernel version (optional)',
      placeholder: 'e.g. 6.6',
      // Echoed into the generated config, so a link must not carry anything else.
      pattern: /^[\w.+-]{0,32}$/,
      // Old kernels the contract tests sample: 4.15 caps swappiness at 100
      // and watermark_scale_factor at 1000, 5.10 only the latter.
      samples: ['4.15', '5.10'],
      invalidMessage: 'Use up to 32 letters, digits, dots, dashes or plus signs, e.g. 6.6.',
      help: [
        'Sets the swappiness slider range: 0–200 on kernel 5.8+, 0–100 before. Left blank, we assume a modern (≥5.8) kernel.',
        'Run `uname -r` to find out your kernel-version.',
      ],
      default: null,
      // The machine's kernel ranges are named by their first version.
      machine: 'kernel',
      half: true,
    },
  ],
  /**
   * The collapsed one-line summary, as rich-text parts joined with " · ".
   * @param {HardwareSpec} hw
   * @param {(key: string, value: string) => string} label  A choice's option label
   */
  summary: (hw, label) => [
    `\`${formatSizeGiB(hw.ramGiB)}\` RAM`,
    hw.swapGiB === 0 ? 'no swap' : `\`${formatSizeGiB(hw.swapGiB)}\` ${hw.swapDevice} swap`,
    label('workload', hw.workload),
  ],
}

/** Default hardware spec used before the user submits the form. */
export const DEFAULT_HARDWARE = /** @type {HardwareSpec} */ (profileDefaults(PROFILE.fields))

/**
 * The landing page's live specimen (Design.md §5 "Guided setup"): one setting,
 * shown for an example machine, a desktop with 16 GiB RAM and 8 GiB NVMe
 * swap, the other fields at their defaults. A desktop puts the value that
 * fits (deriveDefaults) visibly apart from the kernel default, where
 * DEFAULT_HARDWARE's general server lands on it. Plain data: the landing page
 * reads it and never writes it to a store or the URL.
 */
export const LANDING_EXAMPLE = Object.freeze({
  key: 'swappiness',
  hardware: /** @type {HardwareSpec} */ (Object.freeze({
    ...DEFAULT_HARDWARE,
    ramGiB: 16,
    swapGiB: 8,
    swapDevice: 'nvme-ssd',
    workload: 'desktop',
  })),
})
