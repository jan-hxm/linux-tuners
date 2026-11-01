/**
 * The card's value text for block I/O values. Pure, for easy unit testing.
 */

import { READ_AHEAD_DEFAULT } from './defs.js'

/**
 * The card's value text.
 *
 * @param {number|string} value
 * @param {Object} def
 */
export function formatValue(value, def) {
  switch (def.key) {
    case 'rotational':
      return value === 1 ? 'rotating (left out)' : 'flash'
    case 'scheduler':
      return value
    case 'nr_requests':
      return value === 0 ? 'kernel value (left out)' : value.toLocaleString()
    case 'read_ahead_kb':
      return value === READ_AHEAD_DEFAULT ? `${value} KiB (left out)` : `${value.toLocaleString()} KiB`
    default:
      return String(value)
  }
}
