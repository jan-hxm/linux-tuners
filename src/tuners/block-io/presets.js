/**
 * Built-in presets. Each is a partial BlockIoValues: keys it doesn't name
 * keep the profile's starting value (store.applyPreset). There is no kernel
 * defaults preset: the kernel's scheduler depends on the device's hardware
 * queues and on how the kernel was built, so no one set is right everywhere.
 * A scheduler the profile's kernel lacks is held to what it has
 * (presetParams); the contract suite checks every profile.
 *
 * @typedef {Object} Preset
 * @property {string} id
 * @property {string} label
 * @property {string} description
 * @property {string} source
 * @property {Partial<import('./defs.js').BlockIoValues>} values
 */

/** @type {Preset[]} */
export const PRESETS = [
  {
    id: 'interactive',
    label: 'Interactive (BFQ)',
    description: 'BFQ, so programs the user is waiting for get the disk first and a desktop stays responsive during a large copy or an update. Where the kernel has no BFQ, mq-deadline.',
    source: 'docs.kernel.org block/bfq-iosched',
    values: {
      scheduler: 'bfq',
      read_ahead_kb: 128,
    },
  },
  {
    id: 'sequential',
    label: 'Large sequential reads',
    description: 'A 4 MiB read-ahead window, for disks that mostly stream large files: backups, media, log and data scans. Random I/O loses page cache to it.',
    source: 'docs.kernel.org admin-guide/abi-stable (read_ahead_kb)',
    values: {
      read_ahead_kb: 4096,
    },
  },
]

export const PRESETS_BY_ID = Object.fromEntries(PRESETS.map((p) => [p.id, p]))
