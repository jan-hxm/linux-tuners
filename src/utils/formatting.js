/**
 * Display helpers shared by the parameter cards, charts, and config output.
 * Kept dependency-free so they're easy to unit-test.
 */

const KIB_PER_MIB = 1024
const KIB_PER_GIB = 1024 * 1024

/**
 * Render a kB value as the most appropriate higher-order unit.
 * @param {number} kb
 * @returns {string} e.g. "262144 kB (256 MiB)"
 */
export function formatKb(kb) {
  if (kb >= KIB_PER_GIB) {
    return `${kb.toLocaleString()} kB (${(kb / KIB_PER_GIB).toFixed(2)} GiB)`
  }
  if (kb >= KIB_PER_MIB) {
    return `${kb.toLocaleString()} kB (${Math.round(kb / KIB_PER_MIB)} MiB)`
  }
  return `${kb.toLocaleString()} kB`
}

/**
 * Render centisecs as seconds with the raw value in parens.
 * @param {number} cs
 * @returns {string} e.g. "5.00 s (500 cs)"
 */
export function formatCs(cs) {
  return `${(cs / 100).toFixed(2)} s (${cs} cs)`
}

/**
 * Render a percent (0..100) as e.g. "10% (1.6 GiB on this node)".
 * @param {number} pct
 * @param {number} ramGiB
 */
export function formatPercentOfRam(pct, ramGiB) {
  const gib = (ramGiB * pct) / 100
  return `${pct}% (${gib.toFixed(1)} GiB)`
}

/**
 * @param {number} value
 * @param {string} unit  Matches ParameterDef.unit
 * @param {number} ramGiB
 */
export function formatValue(value, unit, ramGiB) {
  switch (unit) {
    case 'kB':
      return formatKb(value)
    case 'cs':
      return formatCs(value)
    case '%':
      return formatPercentOfRam(value, ramGiB)
    case 'mode':
      return `mode ${value}`
    default:
      return value.toLocaleString()
  }
}