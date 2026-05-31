/**
 * Shape definitions for the tuner's two core state objects. Plain JSDoc so editors
 * (and Vitest's tsc-in-VSCode hover) can still surface fields, without a TS toolchain.
 *
 * @typedef {'hdd' | 'sata-ssd' | 'nvme-ssd' | 'zram' | 'zswap' | 'network'} SwapDevice
 * @typedef {'k8s' | 'database' | 'general' | 'desktop' | 'embedded' | 'custom'} Workload
 * @typedef {'v1' | 'v2'} CgroupVersion
 *
 * @typedef {Object} HardwareSpec
 * @property {number}        ramGiB         Total RAM in GiB (positive integer)
 * @property {number}        swapGiB        Swap size in GiB; 0 means no swap
 * @property {SwapDevice}    swapDevice     Backing device class for swap
 * @property {Workload}      workload       Primary workload class
 * @property {CgroupVersion} cgroupVersion  cgroup v1 / v2 — drives per-cgroup swappiness note
 * @property {string|null}   kernelVersion  Optional "major.minor" string (e.g. "6.6")
 *
 * @typedef {Object} ParameterValues
 * @property {number} swappiness                 0–200 on kernel ≥5.8, else 0–100
 * @property {number} min_free_kbytes            In kB
 * @property {number} watermark_scale_factor     Tenths of a per-cent (kernel raw units)
 * @property {number} vfs_cache_pressure         0–500
 * @property {number} dirty_ratio                Percent of available memory
 * @property {number} dirty_background_ratio     Percent of available memory
 * @property {number} dirty_expire_centisecs     1/100 s
 * @property {number} dirty_writeback_centisecs  1/100 s
 * @property {0|1|2}  overcommit_memory          Kernel mode
 * @property {number} overcommit_ratio           Only meaningful when overcommit_memory = 2
 * @property {0|1}    panic_on_oom               Reboot-on-OOM toggle
 */

/** All parameter keys, in display order. */
export const PARAMETER_KEYS = /** @type {(keyof ParameterValues)[]} */ ([
  'swappiness',
  'min_free_kbytes',
  'watermark_scale_factor',
  'vfs_cache_pressure',
  'dirty_ratio',
  'dirty_background_ratio',
  'dirty_expire_centisecs',
  'dirty_writeback_centisecs',
  'overcommit_memory',
  'overcommit_ratio',
  'panic_on_oom',
])

/**
 * Fast (in-memory / compressed) swap devices for which swappiness > 100 is
 * *advisable*. Note this is about what makes sense, not what the kernel allows:
 * kernel 5.8+ accepts 0–200 on any device — the 200 cap is a kernel-version
 * limit, not a device limit (see swappinessKernelMax). These devices just make
 * high values pay off, so deriveDefaults biases them upward.
 */
export const FAST_SWAP_DEVICES = /** @type {SwapDevice[]} */ (['zram', 'zswap'])

/** Default hardware spec used before the user submits the form. */
export const DEFAULT_HARDWARE = /** @type {HardwareSpec} */ ({
  ramGiB: 16,
  swapGiB: 8,
  swapDevice: 'nvme-ssd',
  workload: 'general',
  cgroupVersion: 'v2',
  kernelVersion: null,
})