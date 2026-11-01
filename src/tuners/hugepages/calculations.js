import { PARAMETER_DEFS_BY_KEY, HUGEPAGE_BYTES, POOL_RAM_SHARE, MAP_COUNT_DEFAULT, MAP_COUNT_DISTRO } from './defs.js'

const GiB = 1024 ** 3

/** RAM in bytes. */
export function ramBytes(hw) {
  return hw.ramGiB * GiB
}

/** Bytes a number of 2 MiB huge pages takes. */
export function poolBytes(pages) {
  return pages * HUGEPAGE_BYTES
}

/**
 * The largest pool the sliders offer: nine tenths of RAM, so the rest of the
 * system still has memory to boot with.
 *
 * @param {import('./profile.js').HugepagesSpec} hw
 */
export function poolCap(hw) {
  return Math.floor((ramBytes(hw) * POOL_RAM_SHARE) / HUGEPAGE_BYTES)
}

/**
 * Profile-aware starting values. No pool by default: it takes RAM whether a
 * program uses it or not, so its size has to come from the program. THP at
 * madvise for every workload, KSM on VM hosts, and the map count current
 * distributions ship. Opinionated starting points, not kernel constants.
 *
 * @param {import('./profile.js').HugepagesSpec} hw
 * @returns {import('./defs.js').HugepagesValues}
 */
export function deriveDefaults(hw) {
  return {
    nr_hugepages: 0,
    nr_overcommit_hugepages: 0,
    thp_enabled: 'madvise',
    thp_defrag: 'madvise',
    ksm_run: hw.workload === 'vm-host' ? 1 : 0,
    ksm_pages_to_scan: PARAMETER_DEFS_BY_KEY.ksm_pages_to_scan.kernelDefault,
    ksm_sleep_millisecs: PARAMETER_DEFS_BY_KEY.ksm_sleep_millisecs.kernelDefault,
    max_map_count: MAP_COUNT_DISTRO,
    zone_reclaim_mode: 0,
  }
}

/**
 * The values the sliders offer: the pools up to nine tenths of RAM, the rest
 * the def's range.
 *
 * @param {string} key
 * @param {import('./profile.js').HugepagesSpec} hw
 * @returns {{ min: number, max: number }}
 */
export function rangeFor(key, hw) {
  const def = PARAMETER_DEFS_BY_KEY[key]
  if (!def) throw new Error(`Unknown hugepages parameter: ${key}`)
  if (def.group === 'pool') return { min: 0, max: poolCap(hw) }
  return { min: def.kernelMin, max: def.kernelMax }
}

/**
 * Whether a key has a card: zone reclaim only with several NUMA nodes, and
 * the KSM scan rate only with KSM on.
 *
 * @param {string} key
 * @param {import('./profile.js').HugepagesSpec} hw
 * @param {import('./defs.js').HugepagesValues} params
 */
export function isApplicable(key, hw, params) {
  if (key === 'zone_reclaim_mode') return hw.numa === 'multi'
  if (key === 'ksm_pages_to_scan' || key === 'ksm_sleep_millisecs') return params.ksm_run === 1
  return true
}

/**
 * Whether a key is written to the file: the applicable ones, except those at
 * the kernel default that a distribution, the boot options or a service may
 * have set already: the pools at 0, KSM off and the map count at 65530.
 *
 * @param {string} key
 * @param {import('./profile.js').HugepagesSpec} hw
 * @param {import('./defs.js').HugepagesValues} params
 */
export function isEmitted(key, hw, params) {
  switch (key) {
    case 'nr_hugepages':
    case 'nr_overcommit_hugepages':
      return params[key] > 0
    case 'ksm_run':
      return params.ksm_run === 1
    case 'max_map_count':
      return params.max_map_count !== MAP_COUNT_DEFAULT
    default:
      return isApplicable(key, hw, params)
  }
}
