import { PARAMETER_DEFS_BY_KEY, NR_OPEN_DEFAULT } from './defs.js'

const KiB = 1024
const GiB = 1024 * 1024 * KiB

/**
 * Kernel memory one inotify watch pins, with the inode it holds. Measured on
 * the VM images: 5.10 to 6.12 size their default at 1290 to 1350 bytes each.
 */
export const WATCH_COST_BYTES = 1330

/** Worst-case watch memory the defaults stay under: a tenth of RAM. */
const WATCH_RAM_SHARE = 0.1

/** Round up to a multiple of step. */
function roundUp(n, step) {
  return Math.ceil(n / step) * step
}

/** Round down to a multiple of step. */
function roundDown(n, step) {
  return Math.floor(n / step) * step
}

/**
 * fs.file-max as the kernel sizes it at boot: about 10% of RAM in KiB, at
 * least 8192.
 *
 * @param {import('./profile.js').FilesystemSpec} hw
 */
export function kernelFileMax(hw) {
  return Math.max(8192, Math.round((hw.ramGiB * GiB) / KiB / 10))
}

/**
 * fs.inotify.max_user_watches as kernel 5.11 and newer size it: the watches
 * that fit in 1% of RAM, between 8192 and 1048576.
 *
 * @param {import('./profile.js').FilesystemSpec} hw
 */
export function kernelWatches(hw) {
  return Math.min(1048576, Math.max(8192, Math.round((hw.ramGiB * GiB) / 100 / WATCH_COST_BYTES)))
}

/** Kernel memory in bytes if one user filled every watch. */
export function watchMemoryBytes(watches) {
  return watches * WATCH_COST_BYTES
}

/** The most watches whose worst case stays under a tenth of RAM. */
function watchRamCap(hw) {
  return (hw.ramGiB * GiB * WATCH_RAM_SHARE) / WATCH_COST_BYTES
}

/** fs.file-max floor per workload, for systems that don't raise it at boot. Opinionated. */
const FILE_MAX = { server: 1048576, database: 2097152, container: 4194304, desktop: 1048576 }

/**
 * Profile-aware starting values: file watching for desktops and container
 * hosts, AIO for databases, and file-max only where systemd doesn't raise it.
 * Opinionated starting points, not kernel constants.
 *
 * @param {import('./profile.js').FilesystemSpec} hw
 * @returns {import('./defs.js').FilesystemValues}
 */
export function deriveDefaults(hw) {
  const w = hw.workload
  const watchers = w === 'desktop' || w === 'container'
  const watchStep = PARAMETER_DEFS_BY_KEY.max_user_watches.step
  // Watchers get 524288; servers get at least 65536. Either way the worst case
  // stays under a tenth of RAM, and never below what the kernel would pick.
  const wantedWatches = watchers ? 524288 : Math.max(65536, kernelWatches(hw))
  const watches = Math.max(roundUp(kernelWatches(hw), watchStep), roundDown(Math.min(wantedWatches, watchRamCap(hw)), watchStep))
  const fileMax = PARAMETER_DEFS_BY_KEY.file_max
  return {
    file_max: Math.min(fileMax.kernelMax, roundUp(Math.max(FILE_MAX[w], kernelFileMax(hw)), fileMax.step)),
    nr_open: NR_OPEN_DEFAULT,
    max_user_watches: watches,
    max_user_instances: { server: 512, database: 512, container: 8192, desktop: 1024 }[w],
    max_queued_events: w === 'desktop' ? 65536 : 16384,
    aio_max_nr: w === 'database' ? 1048576 : 65536,
  }
}

/**
 * The values the sliders offer: the def's range on every profile.
 *
 * @param {string} key
 * @returns {{ min: number, max: number }}
 */
export function rangeFor(key) {
  const def = PARAMETER_DEFS_BY_KEY[key]
  if (!def) throw new Error(`Unknown filesystem parameter: ${key}`)
  return { min: def.kernelMin, max: def.kernelMax }
}

/** Whether a key has a card: systemd 240 and newer set fs.file-max themselves. */
export function isApplicable(key, hw) {
  return key !== 'file_max' || hw.systemd === 'older'
}

/**
 * Whether a key is written to the file: the applicable ones, except fs.nr_open
 * at the kernel default, so a distribution that raises it at boot keeps that.
 *
 * @param {string} key
 * @param {import('./profile.js').FilesystemSpec} hw
 * @param {import('./defs.js').FilesystemValues} params
 */
export function isEmitted(key, hw, params) {
  if (key === 'nr_open') return params.nr_open !== NR_OPEN_DEFAULT
  return isApplicable(key, hw)
}
