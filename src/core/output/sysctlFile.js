/**
 * Writer for /etc/sysctl.d/ files. Keys come from defs and each value is
 * printed by its def's value type, then held to plain space-separated tokens,
 * so a value can never add structure to the file (Design.md §10).
 */

import { sectionedConfig } from './sections.js'

const SYSCTL_NAME = /^[a-z][a-z0-9_]*(\.[a-z0-9_-]+)+$/
const SYSCTL_VALUE = /^[A-Za-z0-9_.-]+( [A-Za-z0-9_.-]+)*$/

/**
 * One `name = value` line.
 *
 * @param {string} name   Dotted sysctl name from a def
 * @param {string} text   The value as its type formats it
 */
export function sysctlLine(name, text) {
  if (!SYSCTL_NAME.test(name)) throw new Error(`Invalid sysctl name "${name}"`)
  if (!SYSCTL_VALUE.test(text)) throw new Error(`Invalid value for ${name}`)
  return `${name} = ${text}`
}

/**
 * The body of a sysctl file: one header per section that writes a key, then
 * each def of that section (in def order) as a comment line and a
 * `name = value` line, plus one more line per name in the def's `alsoSets`
 * (e.g. the `conf.default` twin of a `conf.all` key), all with the same value.
 *
 * @param {Object}   opts
 * @param {Object[]} opts.defs       Defs with `key`, `group`, `sysctlName` and optional `alsoSets`
 * @param {{id:string, title:string}[]} opts.sections  Output order
 * @param {Object}   opts.params
 * @param {(def:Object, value:*)=>string} opts.comment  Text after `# key: value - `
 * @param {(def:Object)=>boolean} [opts.include]  Leave a def out when it has no effect
 * @returns {string[]}
 */
export function sysctlConfig({ defs, sections, params, comment, include = () => true }) {
  return sectionedConfig({
    defs,
    sections,
    params,
    comment,
    include,
    lines: (def, text) => [def.sysctlName, ...(def.alsoSets ?? [])].map((name) => sysctlLine(name, text)),
  })
}
