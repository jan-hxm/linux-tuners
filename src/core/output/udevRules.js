/**
 * Writer for /etc/udev/rules.d/ files that set per-device sysfs attributes.
 * Each rule is a list of `==` match clauses and one `ATTR{<attr>}="<value>"`
 * assignment, which writes the value to that sysfs file of the matched device
 * and runs nothing. The match clauses and the attribute are constants from a
 * tuner and the value a plain token, so a value can never add a rule, a clause
 * or a `$`/`%` substitution (Design.md §10).
 */

import { sectionedConfig } from './sections.js'

// Keys a rule may match on: the event, the subsystem, the kernel name, a
// device property or a sysfs attribute. Never an assignment key such as RUN.
const MATCH_KEY = /^(ACTION|SUBSYSTEM|KERNEL|ENV\{[A-Z_]+\}|ATTR\{[a-z_]+(\/[a-z_]+)*\})$/
// A glob over plain names: alternatives (|), *, ? and [a-z] classes, no quotes,
// no `$` or `%` (udev substitutions), no backslash.
const MATCH_VALUE = /^[A-Za-z0-9_|*?[\]-]+$/
const ATTR = /^[a-z_]+(\/[a-z_]+)*$/
const ATTR_VALUE = /^[A-Za-z0-9_+.-]+$/

/**
 * The match part of a rule: `KEY=="value"` clauses joined by ", ".
 *
 * @param {[string, string][]} clauses  [key, glob] pairs
 */
export function udevMatch(clauses) {
  if (!Array.isArray(clauses) || !clauses.length) throw new Error('A udev rule needs at least one match clause')
  return clauses
    .map(([key, value]) => {
      if (!MATCH_KEY.test(key)) throw new Error(`Invalid udev match key "${key}"`)
      if (!MATCH_VALUE.test(value)) throw new Error(`Invalid udev match value for ${key}`)
      return `${key}=="${value}"`
    })
    .join(', ')
}

/**
 * One rule: the match clauses, then the attribute write.
 *
 * @param {[string, string][]} clauses
 * @param {string} attr  sysfs attribute relative to the device, e.g. queue/scheduler
 * @param {string} text  The value as its type formats it
 */
export function udevAttrRule(clauses, attr, text) {
  if (!ATTR.test(attr)) throw new Error(`Invalid udev attribute "${attr}"`)
  if (!ATTR_VALUE.test(text)) throw new Error(`Invalid value for ${attr}`)
  return `${udevMatch(clauses)}, ATTR{${attr}}="${text}"`
}

/**
 * The body of a rules file: one header per section that writes a key, then
 * each def of that section as a comment line and its rule. Rules run in file
 * order, so defs come in the order their attributes have to be written.
 *
 * @param {Object}   opts
 * @param {Object[]} opts.defs       Defs with `key`, `group` and `udevAttr`
 * @param {{id:string, title:string}[]} opts.sections  Output order
 * @param {Object}   opts.params
 * @param {[string, string][]} opts.match  The devices every rule applies to
 * @param {(def:Object, value:*)=>string} opts.comment  Text after `# key: value - `
 * @param {(def:Object)=>boolean} [opts.include]  Leave a def out when it has no effect
 * @returns {string[]}
 */
export function udevConfig({ defs, sections, params, match, comment, include = () => true }) {
  return sectionedConfig({ defs, sections, params, comment, include, lines: (def, text) => [udevAttrRule(match, def.udevAttr, text)] })
}
