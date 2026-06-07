/**
 * Display formatting for systemd parameter values. Mirrors the swap tuner's
 * utils/formatting.formatValue but understands systemd's units: booleans, byte
 * sizes, weights, percent-of-RAM and percent-of-cores (where the top of the
 * range reads as "no limit"). Pure + dependency-free for easy unit testing.
 */

const BYTES_PER_KIB = 1024
const BYTES_PER_MIB = 1024 * 1024
const BYTES_PER_GIB = 1024 * 1024 * 1024

/** Humanise a byte count: "8 MiB (8,388,608 B)". */
export function formatBytes(bytes) {
  if (bytes <= 0) return '0 B'
  if (bytes >= BYTES_PER_GIB) {
    return `${(bytes / BYTES_PER_GIB).toFixed(2)} GiB (${bytes.toLocaleString()} B)`
  }
  if (bytes >= BYTES_PER_MIB) {
    return `${Math.round(bytes / BYTES_PER_MIB)} MiB (${bytes.toLocaleString()} B)`
  }
  if (bytes >= BYTES_PER_KIB) {
    return `${Math.round(bytes / BYTES_PER_KIB)} KiB (${bytes.toLocaleString()} B)`
  }
  return `${bytes.toLocaleString()} B`
}

/**
 * @param {number} value
 * @param {Object} def   The parameter def (uses def.unit)
 * @param {import('./parameters.js').SystemdSpec} hw
 */
export function formatValue(value, def, hw) {
  switch (def.unit) {
    case 'bool':
      return value === 1 ? 'yes' : 'no'
    case 'tasks':
    case 'count':
    case 'weight':
      return value.toLocaleString()
    case 'bytes':
      return formatBytes(value)
    case 'pct': {
      // Percentage of total RAM. Top of range = infinity (no limit); 0 has a
      // meaning of its own for MemorySwapMax (no swap).
      if (value >= 100) return '100% (no limit)'
      const gib = (hw.ramGiB * value) / 100
      if (value === 0) return '0%'
      return `${value}% (${gib.toFixed(1)} GiB of ${hw.ramGiB})`
    }
    case 'pct-cores': {
      const cores = Math.max(1, hw.cpuCores)
      if (value >= cores * 100) return 'no limit'
      return `${value}% (${(value / 100).toFixed(1)} of ${cores} cores)`
    }
    default:
      return value.toLocaleString()
  }
}
