/**
 * Cross-parameter validation. Pure function — UI components subscribe to it via
 * the Pinia store. The blocking flag controls whether the config output is
 * suppressed; warnings and info notes only surface inline banners.
 *
 * @typedef {'error' | 'warn' | 'info'} ValidationLevel
 *
 * @typedef {Object} ValidationIssue
 * @property {string}          id        Stable identifier (used as banner key)
 * @property {ValidationLevel} level
 * @property {string[]}        params    Parameter keys this issue relates to
 * @property {string}          message
 * @property {boolean}         blocking  Blocks the config output when true
 */

import { swappinessMaxForDevice } from './calculations.js'

const KIB_PER_GIB = 1024 * 1024

/**
 * @param {import('./parameters.js').HardwareSpec} hw
 * @param {import('./parameters.js').ParameterValues} p
 * @returns {ValidationIssue[]}
 */
export function validate(hw, p) {
  /** @type {ValidationIssue[]} */
  const issues = []

  if (p.dirty_background_ratio >= p.dirty_ratio) {
    issues.push({
      id: 'dirtybg-ge-dirty',
      level: 'error',
      blocking: true,
      params: ['dirty_background_ratio', 'dirty_ratio'],
      message: 'dirty_background_ratio must be less than dirty_ratio.',
    })
  }

  // writeback interval longer than expire → pages may never be flushed.
  // (writeback = 0 disables periodic writeback, which is a separate case.)
  if (p.dirty_writeback_centisecs > 0 && p.dirty_writeback_centisecs > p.dirty_expire_centisecs) {
    issues.push({
      id: 'writeback-gt-expire',
      level: 'error',
      blocking: true,
      params: ['dirty_writeback_centisecs', 'dirty_expire_centisecs'],
      message:
        'dirty_writeback_centisecs is longer than dirty_expire_centisecs: pages can outlive expiry without being flushed.',
    })
  }

  if (p.swappiness > 100 && hw.swapDevice === 'hdd') {
    issues.push({
      id: 'swappiness-on-hdd',
      level: 'warn',
      blocking: false,
      params: ['swappiness'],
      message: 'swappiness > 100 causes severe latency on rotational disks.',
    })
  }

  // Surface the device-specific cap even when value is within kernel range but
  // beyond what the device class realistically tolerates.
  const deviceMax = swappinessMaxForDevice(hw.swapDevice)
  if (p.swappiness > deviceMax) {
    issues.push({
      id: 'swappiness-above-device-cap',
      level: 'warn',
      blocking: false,
      params: ['swappiness'],
      message: `swappiness=${p.swappiness} exceeds the recommended cap (${deviceMax}) for ${describeDevice(hw.swapDevice)}.`,
    })
  }

  if (p.swappiness === 0 && p.watermark_scale_factor < 50) {
    issues.push({
      id: 'swappiness-zero-narrow-watermark',
      level: 'warn',
      blocking: false,
      params: ['swappiness', 'watermark_scale_factor'],
      message:
        'With swappiness=0 and a narrow watermark window, sudden memory-pressure spikes can OOM before kswapd reclaims enough.',
    })
  }

  if (p.min_free_kbytes < 8192) {
    issues.push({
      id: 'min-free-too-low',
      level: 'warn',
      blocking: false,
      params: ['min_free_kbytes'],
      message: 'Values below 8 MiB can cause atomic allocation failures under load.',
    })
  }

  const fivePercentRam = Math.round(hw.ramGiB * KIB_PER_GIB * 0.05)
  if (p.min_free_kbytes > fivePercentRam) {
    issues.push({
      id: 'min-free-too-high',
      level: 'warn',
      blocking: false,
      params: ['min_free_kbytes'],
      message: `Reserving more than 5% of RAM (${fivePercentRam.toLocaleString()} kB on this node) wastes usable memory.`,
    })
  }

  if (p.overcommit_memory === 2 && p.panic_on_oom === 1) {
    issues.push({
      id: 'strict-overcommit-and-panic',
      level: 'warn',
      blocking: false,
      params: ['overcommit_memory', 'panic_on_oom'],
      message:
        'Strict no-overcommit + panic-on-OOM will reboot the node on the first over-allocation attempt.',
    })
  }

  if (p.vfs_cache_pressure === 0) {
    issues.push({
      id: 'vfs-pressure-zero',
      level: 'warn',
      blocking: false,
      params: ['vfs_cache_pressure'],
      message:
        'vfs_cache_pressure=0 is documented as dangerous — the kernel will refuse to reclaim dentry/inode caches even under memory pressure.',
    })
  }

  if (hw.swapGiB === 0 && p.swappiness > 0) {
    issues.push({
      id: 'no-swap-but-swappiness',
      level: 'info',
      blocking: false,
      params: ['swappiness'],
      message: 'Swap is disabled (size = 0); swappiness has no effect.',
    })
  }

  if (hw.swapDevice === 'network') {
    issues.push({
      id: 'network-swap',
      level: 'warn',
      blocking: false,
      params: [],
      message:
        'Swap over a network device (e.g. NFS) is fragile — a network blip can stall every userspace process.',
    })
  }

  return issues
}

/** @param {import('./parameters.js').SwapDevice} device */
function describeDevice(device) {
  switch (device) {
    case 'hdd':
      return 'rotational disks'
    case 'sata-ssd':
      return 'SATA SSD'
    case 'nvme-ssd':
      return 'NVMe SSD'
    case 'zram':
      return 'zram (in-memory compressed swap)'
    case 'zswap':
      return 'zswap'
    case 'network':
      return 'network swap'
    default:
      return device
  }
}

/**
 * @param {ValidationIssue[]} issues
 * @returns {boolean}
 */
export function hasBlockingIssue(issues) {
  return issues.some((i) => i.blocking)
}