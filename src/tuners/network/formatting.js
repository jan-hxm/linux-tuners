/**
 * Display formatting for network values: byte sizes, bit rates and the card's
 * value text per def unit. Pure, for easy unit testing.
 */

import { formatBytes } from '@/core/formatting.js'

export { formatBytes }

/** "250 Mbit/s", "9.4 Gbit/s". */
export function formatRate(bps) {
  if (bps >= 1e9) return `${Math.round(bps / 1e8) / 10} Gbit/s`
  if (bps >= 1e6) return `${Math.round(bps / 1e6)} Mbit/s`
  return `${Math.round(bps / 1e3)} kbit/s`
}

/** "86400 s (1 day)", "60 s". */
function formatSeconds(s) {
  if (s >= 86400 && s % 3600 === 0) {
    const days = Math.round((s / 86400) * 10) / 10
    return `${s.toLocaleString()} s (${days} ${days === 1 ? 'day' : 'days'})`
  }
  if (s >= 3600 && s % 60 === 0) return `${s.toLocaleString()} s (${Math.round((s / 3600) * 10) / 10} h)`
  return `${s} s`
}

/**
 * The card's value text.
 *
 * @param {*} value
 * @param {Object} def  Uses def.unit, def.segmentLabels, def.options
 */
export function formatValue(value, def) {
  switch (def.unit) {
    case 'bytes':
      return Array.isArray(value) ? value.map(formatBytes).join(' / ') : formatBytes(value)
    case 'ports':
      return `${value[0]}-${value[1]} (${(value[1] - value[0] + 1).toLocaleString()} ports)`
    case 'seconds':
      return formatSeconds(value)
    case 'bool':
      return value === 1 ? 'on' : 'off'
    case 'segment':
      return def.segmentLabels[value] ?? String(value)
    case 'enum':
      return value
    case 'packets':
    case 'count':
    default:
      return value.toLocaleString()
  }
}
