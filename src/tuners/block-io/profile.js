/**
 * The block I/O tuner's system profile: one field list that drives the form,
 * the defaults and the shared-link restore schema (src/core/profile.js). One
 * profile is one kind of disk; the output is a udev rules file that applies to
 * every disk of that kind.
 *
 * @typedef {'nvme' | 'ssd' | 'hdd' | 'virtio'} DeviceClass
 * @typedef {'desktop' | 'server' | 'database' | 'streaming'} BlockIoWorkload
 * @typedef {'all' | 'basic'} SchedulerSet
 *
 * @typedef {Object} BlockIoSpec
 * @property {DeviceClass}     device
 * @property {BlockIoWorkload} workload
 * @property {SchedulerSet}    schedulers  Whether the kernel has the bfq and kyber modules
 */

import { profileDefaults } from '@/core/profile.js'

export const PROFILE = {
  title: 'Disk profile',
  applyLabel: 'Apply disk profile',
  fields: [
    {
      key: 'device',
      type: 'choice',
      control: 'cards',
      label: 'Which disks (lsblk -d -o NAME,ROTA,TRAN)',
      options: [
        { value: 'nvme', label: 'NVMe SSD', note: 'nvme0n1 and so on: every NVMe namespace.' },
        { value: 'ssd', label: 'SATA or SAS SSD', note: 'sd* disks that lsblk shows with ROTA 0.' },
        { value: 'hdd', label: 'Hard disk', note: 'sd* disks that lsblk shows with ROTA 1.' },
        { value: 'virtio', label: 'Virtual disk (virtio)', note: 'vd* disks in a KVM or QEMU guest.' },
      ],
      default: 'nvme',
    },
    {
      key: 'workload',
      type: 'choice',
      control: 'select',
      label: 'What the disks mostly do',
      options: [
        { value: 'server', label: 'Server or cloud VM: mixed I/O' },
        { value: 'database', label: 'Database: small random reads and writes' },
        { value: 'streaming', label: 'File, media or backup server: large sequential reads' },
        { value: 'desktop', label: 'Desktop or laptop: responsiveness under load' },
      ],
      default: 'server',
      half: true,
    },
    {
      key: 'schedulers',
      type: 'choice',
      control: 'segmented',
      label: 'BFQ and Kyber (modinfo bfq kyber-iosched)',
      options: [
        { value: 'all', label: 'available', note: 'modinfo finds both, as a module or (builtin): Debian, Fedora and most desktop kernels.' },
        { value: 'basic', label: 'not found', note: 'Only none and mq-deadline are offered, for kernels such as Ubuntu 24.04\'s cloud image.' },
      ],
      default: 'all',
      half: true,
    },
  ],
  /**
   * The collapsed one-line summary, as rich-text parts joined with " · ".
   * @param {BlockIoSpec} hw
   * @param {(key: string, value: string) => string} label  A choice's option label
   */
  summary: (hw, label) => [
    label('device', hw.device),
    label('workload', hw.workload).split(':')[0],
    hw.schedulers === 'all' ? 'BFQ and Kyber available' : 'mq-deadline only',
  ],
}

/** Default disk profile used before the user submits the form. */
export const DEFAULT_BLOCK_IO_SPEC = /** @type {BlockIoSpec} */ (profileDefaults(PROFILE.fields))
