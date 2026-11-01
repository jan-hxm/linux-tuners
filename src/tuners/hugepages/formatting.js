/**
 * The card's value text for huge pages values. Pure, for easy unit testing.
 */

import { MAP_COUNT_DEFAULT } from './defs.js'
import { poolBytes } from './calculations.js'
import { formatBytes } from '@/core/formatting.js'

/**
 * The card's value text.
 *
 * @param {number|string} value
 * @param {Object} def
 */
export function formatValue(value, def) {
  switch (def.key) {
    case 'nr_hugepages':
    case 'nr_overcommit_hugepages':
      return value === 0 ? '0 (left out)' : `${value.toLocaleString()} (${formatBytes(poolBytes(value))})`
    case 'thp_enabled':
    case 'thp_defrag':
      return value
    case 'ksm_run':
      return value === 1 ? 'on' : 'off (left out)'
    case 'zone_reclaim_mode':
      return value === 1 ? 'on' : 'off'
    case 'max_map_count':
      return value === MAP_COUNT_DEFAULT ? `${value.toLocaleString()} (left out)` : value.toLocaleString()
    case 'ksm_sleep_millisecs':
      return `${value} ms`
    default:
      return value.toLocaleString()
  }
}
