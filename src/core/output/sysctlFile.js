/**
 * Writer for /etc/sysctl.d/ files. Keys come from defs and values must be
 * integers, so a value can never add structure to the file (Design.md §10).
 */

import { commentLine, sectionHeader } from './comments.js'

const SYSCTL_NAME = /^[a-z][a-z0-9_]*(\.[a-z0-9_-]+)+$/

/**
 * One `name = value` line.
 *
 * @param {string} name   Dotted sysctl name from a def
 * @param {number} value
 */
export function sysctlLine(name, value) {
  if (!SYSCTL_NAME.test(name)) throw new Error(`Invalid sysctl name "${name}"`)
  if (!Number.isSafeInteger(value)) throw new Error(`Non-integer value for ${name}`)
  return `${name} = ${value}`
}

/**
 * The body of a sysctl file: one header per section, then each def of that
 * section (in def order) as a comment line and a `name = value` line.
 *
 * @param {Object}   opts
 * @param {Object[]} opts.defs       Defs with `key`, `group` and `sysctlName`
 * @param {{id:string, title:string}[]} opts.sections  Output order
 * @param {Object}   opts.params
 * @param {(def:Object, value:number)=>string} opts.comment  Text after `# key: value - `
 * @param {(def:Object)=>boolean} [opts.include]  Leave a def out when it has no effect
 * @returns {string[]}
 */
export function sysctlConfig({ defs, sections, params, comment, include = () => true }) {
  const lines = []
  for (const section of sections) {
    lines.push(sectionHeader(section.title))
    for (const def of defs) {
      if (def.group !== section.id || !include(def)) continue
      const value = params[def.key]
      lines.push(commentLine(`${def.key}: ${value} - ${comment(def, value)}`))
      lines.push(sysctlLine(def.sysctlName, value))
      lines.push('')
    }
  }
  return lines
}
