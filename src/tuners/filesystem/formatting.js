/**
 * The card's value text for filesystem values. Pure, for easy unit testing.
 */

import { NR_OPEN_DEFAULT } from './defs.js'

/**
 * The card's value text.
 *
 * @param {number} value
 * @param {Object} def
 */
export function formatValue(value, def) {
  if (def.key === 'nr_open' && value === NR_OPEN_DEFAULT) return `${value.toLocaleString()} (left out)`
  return value.toLocaleString()
}
