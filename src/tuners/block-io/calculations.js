import { PARAMETER_DEFS_BY_KEY, READ_AHEAD_DEFAULT } from './defs.js'

/** Schedulers every multi-queue kernel has: none, and mq-deadline (built in wherever it isn't a loaded module). */
const BASIC_SCHEDULERS = ['none', 'mq-deadline']

/**
 * The schedulers the profile's kernel offers: bfq and kyber only where
 * modinfo finds them.
 *
 * @param {import('./profile.js').BlockIoSpec} hw
 * @returns {string[]}
 */
export function availableSchedulers(hw) {
  return hw.schedulers === 'all' ? PARAMETER_DEFS_BY_KEY.scheduler.options.map((o) => o.value) : BASIC_SCHEDULERS
}

/** Whether the profile's disks seek: hard disks only. */
export function seeks(hw) {
  return hw.device === 'hdd'
}

/**
 * Profile-aware starting values. NVMe and virtual disks keep none, since the
 * device or the host orders requests; SATA disks get mq-deadline, or BFQ on a
 * desktop where the kernel has it. Sequential workloads read further ahead,
 * a hard disk most. Opinionated starting points, not kernel constants.
 *
 * @param {import('./profile.js').BlockIoSpec} hw
 * @returns {import('./defs.js').BlockIoValues}
 */
export function deriveDefaults(hw) {
  const sata = hw.device === 'ssd' || hw.device === 'hdd'
  const bfq = hw.workload === 'desktop' && availableSchedulers(hw).includes('bfq')
  return {
    rotational: 1,
    scheduler: !sata ? 'none' : bfq ? 'bfq' : 'mq-deadline',
    nr_requests: 0,
    read_ahead_kb: hw.workload !== 'streaming' ? READ_AHEAD_DEFAULT : seeks(hw) ? 4096 : 1024,
    nomerges: 0,
  }
}

/**
 * The values the cards offer: the scheduler held to what the kernel has, the
 * rest the def's range.
 *
 * @param {string} key
 * @param {import('./profile.js').BlockIoSpec} hw
 * @returns {{ min: number, max: number, options?: string[] }}
 */
export function rangeFor(key, hw) {
  const def = PARAMETER_DEFS_BY_KEY[key]
  if (!def) throw new Error(`Unknown block I/O parameter: ${key}`)
  if (key === 'scheduler') return { min: 0, max: 0, options: availableSchedulers(hw) }
  return { min: def.kernelMin, max: def.kernelMax }
}

/**
 * Whether a key has a card: rotational only for virtual disks (a SATA rule
 * matches on it, and NVMe never rotates), nr_requests only with a scheduler,
 * since without one its ceiling is the device's own queue depth.
 *
 * @param {string} key
 * @param {import('./profile.js').BlockIoSpec} hw
 * @param {import('./defs.js').BlockIoValues} params
 */
export function isApplicable(key, hw, params) {
  if (key === 'rotational') return hw.device === 'virtio'
  if (key === 'nr_requests') return params.scheduler !== 'none'
  return true
}

/**
 * Whether a key is written to the file: the scheduler always, the others
 * only away from the value the kernel already starts at, so its own choices
 * (a device's read-ahead, the request depth) stay.
 *
 * @param {string} key
 * @param {import('./profile.js').BlockIoSpec} hw
 * @param {import('./defs.js').BlockIoValues} params
 */
export function isEmitted(key, hw, params) {
  if (!isApplicable(key, hw, params)) return false
  switch (key) {
    case 'scheduler':
      return true
    case 'rotational':
      return params.rotational === 0
    case 'nr_requests':
      return params.nr_requests > 0
    case 'read_ahead_kb':
      return params.read_ahead_kb !== READ_AHEAD_DEFAULT
    default:
      return params[key] !== PARAMETER_DEFS_BY_KEY[key].kernelDefault
  }
}

/**
 * What the kernel starts nr_requests at once a scheduler is set: twice the
 * queue depth, at most 256. Measured: SATA (32) 64, virtio (256) and NVMe
 * (1023) 256.
 *
 * @param {number} depth  The device's queue depth
 */
export function schedulerRequests(depth) {
  return 2 * Math.min(depth, 128)
}
