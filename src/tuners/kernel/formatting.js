/**
 * The card's value text for kernel values. Pure, for easy unit testing.
 */

import { formatBytes } from '@/core/formatting.js'
import { VALUE_TYPES } from '@/core/valueTypes.js'

/**
 * The card's value text.
 *
 * @param {number|number[]|string} value
 * @param {Object} def
 */
export function formatValue(value, def) {
  switch (def.key) {
    case 'panic':
      return value === 0 ? 'never reboot' : `${value} s`
    case 'panic_on_oops':
    case 'softlockup_panic':
      return value === 1 ? 'on' : 'off'
    case 'sysrq':
      return VALUE_TYPES.enum.format(value, def)
    case 'printk':
      return value.join(' ')
    case 'maxbytes':
      return formatBytes(value)
    default:
      return value.toLocaleString()
  }
}
