/**
 * The "Do I need this?" box's text, from a registry entry's `setup` block.
 * Plain JS, shared by NeedThisBox.vue and the static page text (src/static/).
 */

import { rolesText } from '@/core/machineRoles.js'

export const NEED_THIS_HEADING = 'Do I need this?'

/**
 * The box's rows, in order.
 *
 * @param {{ roles: 'all' | string[], why: string, defaultsFine: string }} setup
 * @returns {{ id: string, label: string, text: string }[]}
 */
export function needThisRows(setup) {
  return [
    { id: 'why', label: 'What it does', text: setup.why },
    { id: 'roles', label: 'Matters for', text: rolesText(setup.roles) },
    { id: 'fine', label: 'The defaults are fine for', text: setup.defaultsFine },
  ]
}
