import { FAST_SWAP_DEVICES } from './parameters.js'
import { PARAMETER_DEFS_BY_KEY } from '../data/parameterDefs.js'

const KIB_PER_GIB = 1024 * 1024
const KIB_PER_MIB = 1024

/**
 * Compute hardware-aware defaults for every vm.* parameter.
 *
 * Pulls in:
 *  - the kernel defaults from parameterDefs.js
 *  - per-workload overrides (k8s, database, …)
 *  - per-device caps (e.g. swappiness capped at 100 on rotational disks)
 *
 * @param {import('./parameters.js').HardwareSpec} hw
 * @returns {import('./parameters.js').ParameterValues}
 */
export function deriveDefaults(hw) {
  const ramKib = hw.ramGiB * KIB_PER_GIB

  // min_free_kbytes: ~0.4% of RAM, floored at 8 MiB and capped at the kernel
  // max. The kernel itself uses a sqrt-based heuristic, but the K8s blog's
  // reference is "raise this to widen the kswapd window" — a simple percentage
  // is closer to what an operator wants to reason about than the kernel internal
  // formula. The kernelMax cap keeps the default inside the slider's own range
  // (which also tops out at kernelMax) on very large-RAM hosts, instead of
  // producing a multi-GiB value the slider can't represent and the card can't
  // lay out.
  const minFreeFromRatio = Math.round(ramKib * 0.004)
  const min_free_kbytes = Math.min(
    Math.max(minFreeFromRatio, 8 * KIB_PER_MIB),
    PARAMETER_DEFS_BY_KEY.min_free_kbytes.kernelMax,
  )

  // watermark_scale_factor default 10 (kernel). Raise it on workloads where
  // proactive reclaim matters.
  let watermark_scale_factor = PARAMETER_DEFS_BY_KEY.watermark_scale_factor.kernelDefault

  // swappiness baseline — workload first, then device caps.
  let swappiness = PARAMETER_DEFS_BY_KEY.swappiness.kernelDefault
  switch (hw.workload) {
    case 'k8s':
      swappiness = 10
      watermark_scale_factor = 2000
      break
    case 'database':
      swappiness = 1
      break
    case 'desktop':
      swappiness = 100
      break
    case 'embedded':
      swappiness = 30
      break
    case 'general':
    case 'custom':
      // leave at kernel default
      break
  }
  // fast swap devices: bias toward swap when the workload is k8s with zram/zswap
  if (FAST_SWAP_DEVICES.includes(hw.swapDevice) && hw.workload === 'k8s') {
    swappiness = 133
    watermark_scale_factor = 1000
  }
  // device caps
  swappiness = clampSwappinessForDevice(swappiness, hw.swapDevice)

  // No swap configured? swappiness is irrelevant; surface it as 0 to be honest.
  if (hw.swapGiB === 0) swappiness = 0

  // dirty page defaults — databases want tight limits
  let dirty_ratio = PARAMETER_DEFS_BY_KEY.dirty_ratio.kernelDefault
  let dirty_background_ratio = PARAMETER_DEFS_BY_KEY.dirty_background_ratio.kernelDefault
  if (hw.workload === 'database') {
    dirty_ratio = 5
    dirty_background_ratio = 2
  } else if (hw.workload === 'embedded') {
    dirty_ratio = 30
    dirty_background_ratio = 15
  }

  return {
    swappiness,
    min_free_kbytes,
    watermark_scale_factor,
    vfs_cache_pressure: PARAMETER_DEFS_BY_KEY.vfs_cache_pressure.kernelDefault,
    dirty_ratio,
    dirty_background_ratio,
    dirty_expire_centisecs: PARAMETER_DEFS_BY_KEY.dirty_expire_centisecs.kernelDefault,
    dirty_writeback_centisecs: PARAMETER_DEFS_BY_KEY.dirty_writeback_centisecs.kernelDefault,
    overcommit_memory: 0,
    overcommit_ratio: PARAMETER_DEFS_BY_KEY.overcommit_ratio.kernelDefault,
    panic_on_oom: 0,
  }
}

/**
 * Per-device caps on swappiness:
 *  - HDD: hard-cap at 60. Anything above is footgun territory.
 *  - SATA/NVMe SSD: respect kernel cap of 100.
 *  - zram/zswap: full 0–200 range allowed.
 *  - Network swap: cap at 30 — swapping over the network is already slow.
 *
 * @param {number} value
 * @param {import('./parameters.js').SwapDevice} device
 * @returns {number}
 */
export function clampSwappinessForDevice(value, device) {
  const max = swappinessMaxForDevice(device)
  if (value > max) return max
  if (value < 0) return 0
  return value
}

const SWAPPINESS_MAX_MODERN = 200
const SWAPPINESS_MAX_LEGACY = 100

/**
 * Hard kernel limit for vm.swappiness, which is purely a *kernel-version* matter,
 * NOT a device matter. Kernel 5.8 raised MAX_SWAPPINESS from 100 to 200 for all
 * swap, regardless of backing device. Whether values > 100 are *advisable* is a
 * separate (device-dependent) question handled by swappinessMaxForDevice + the
 * validation warnings — the slider should still let you reach any kernel-legal
 * value.
 *
 * Unknown/blank version is treated as modern (200): kernel 5.8 shipped in 2020,
 * so an unspecified kernel is far likelier to be ≥ 5.8 than not.
 *
 * @param {string|null|undefined} kernelVersion  "major.minor" string, e.g. "6.6"
 * @returns {number}
 */
export function swappinessKernelMax(kernelVersion) {
  if (!kernelVersion) return SWAPPINESS_MAX_MODERN
  const m = /^\s*(\d+)\.(\d+)/.exec(kernelVersion)
  if (!m) return SWAPPINESS_MAX_MODERN
  const major = Number(m[1])
  const minor = Number(m[2])
  if (major < 5 || (major === 5 && minor < 8)) return SWAPPINESS_MAX_LEGACY
  return SWAPPINESS_MAX_MODERN
}

/**
 * Device-appropriate *recommended* swappiness ceiling. This is advisory only —
 * it drives the deriveDefaults clamp (so starting values stay device-safe) and
 * the "exceeds recommended cap" validation warning. It is deliberately NOT the
 * slider's hard max; see swappinessKernelMax for that.
 *
 * @param {import('./parameters.js').SwapDevice} device
 */
export function swappinessMaxForDevice(device) {
  switch (device) {
    case 'hdd':
      return 60
    case 'network':
      return 30
    case 'zram':
    case 'zswap':
      return 200
    case 'sata-ssd':
    case 'nvme-ssd':
    default:
      return 100
  }
}

/**
 * Derive the watermark window size in MiB for the current parameter values and RAM.
 * Uses the kernel formula:
 *   window_pages = total_managed_pages * watermark_scale_factor / 10000
 * Returns the distance from low → high in MiB. The min watermark is `min_free_kbytes / 4`
 * per zone in the actual kernel — here we model the whole-system view for UI display.
 *
 * @param {number} ramGiB
 * @param {number} watermarkScaleFactor
 * @returns {number} MiB
 */
export function watermarkWindowMiB(ramGiB, watermarkScaleFactor) {
  const ramMiB = ramGiB * 1024
  return Math.round((ramMiB * watermarkScaleFactor) / 10000)
}

/**
 * @param {number} ramGiB
 * @param {number} minFreeKb
 * @param {number} watermarkScaleFactor
 * @returns {{ minMiB: number, lowMiB: number, highMiB: number, usableMiB: number }}
 */
export function watermarkLevelsMiB(ramGiB, minFreeKb, watermarkScaleFactor) {
  const totalMiB = ramGiB * 1024
  const minMiB = Math.round(minFreeKb / 1024)
  const window = watermarkWindowMiB(ramGiB, watermarkScaleFactor)
  const lowMiB = minMiB + window
  const highMiB = lowMiB + window
  const usableMiB = Math.max(totalMiB - highMiB, 0)
  return { minMiB, lowMiB, highMiB, usableMiB }
}

/**
 * Suggested min/max for each slider, taking hardware into account. Falls back
 * to the kernel range from parameterDefs when there's no hardware-derived bound.
 *
 * @param {string} key
 * @param {import('./parameters.js').HardwareSpec} hw
 * @returns {{ min: number, max: number }}
 */
export function rangeFor(key, hw) {
  const def = PARAMETER_DEFS_BY_KEY[key]
  if (!def) throw new Error(`Unknown parameter: ${key}`)
  if (key === 'swappiness') {
    // Slider reaches the kernel-legal max (200 on ≥5.8, 100 before). Whether a
    // high value suits the device is a soft warning, not a hard cap.
    return { min: def.kernelMin, max: swappinessKernelMax(hw.kernelVersion) }
  }
  if (key === 'min_free_kbytes') {
    // Cap upper bound at 10% of RAM — beyond that the slider becomes useless.
    const maxFromRam = Math.round(hw.ramGiB * KIB_PER_GIB * 0.1)
    return { min: def.kernelMin, max: Math.min(def.kernelMax, maxFromRam) }
  }
  return { min: def.kernelMin, max: def.kernelMax }
}