/**
 * The card's value text for System V IPC values. Pure, for easy unit testing.
 */

import { formatBytes } from '@/core/formatting.js'

/**
 * The card's value text.
 *
 * @param {number|number[]} value
 * @param {Object} def
 */
export function formatValue(value, def) {
  switch (def.key) {
    case 'shm_rmid_forced':
      return value === 1 ? 'on' : 'off'
    case 'sem':
      return value.map((n) => n.toLocaleString()).join(' ')
    case 'msgmax':
    case 'msgmnb':
      return formatBytes(value)
    default:
      return value.toLocaleString()
  }
}
