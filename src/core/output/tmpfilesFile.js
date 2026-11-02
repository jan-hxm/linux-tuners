/**
 * Writer for /etc/tmpfiles.d/ files that set sysfs values at boot. It writes
 * only `w` lines, which write their argument to an existing file and run
 * nothing; the path is a constant `/sys` path from a def and the value a plain
 * token, so a value can never add a line, a field or a specifier
 * (Design.md §10).
 */

import { sectionedConfig } from './sections.js'

const SYSFS_PATH = /^\/sys(\/[a-z0-9_]+)+$/
// No `%` (tmpfiles specifiers), no backslash (C escapes), no whitespace.
const SYSFS_VALUE = /^[A-Za-z0-9_+.-]+$/

/**
 * One `w <path> - - - - <value>` line: write the value to the sysfs file, and
 * leave mode, owner, group and age alone.
 *
 * @param {string} path  Absolute sysfs path from a def
 * @param {string} text  The value as its type formats it
 */
export function tmpfilesWrite(path, text) {
  if (!SYSFS_PATH.test(path)) throw new Error(`Invalid sysfs path "${path}"`)
  if (!SYSFS_VALUE.test(text)) throw new Error(`Invalid value for ${path}`)
  return `w ${path} - - - - ${text}`
}

/**
 * A command that writes the def's value to its sysfs file at once, until the
 * next reboot, so it can be tried before the file is saved. The same path and
 * value checks as the `w` line.
 *
 * @param {Object} def   Def with `sysfsPath`
 * @param {string} text  The value as its type formats it
 */
export function sysfsTryCommand(def, text) {
  tmpfilesWrite(def.sysfsPath, text)
  return `echo ${text} | sudo tee ${def.sysfsPath}`
}

/**
 * The body of a tmpfiles.d file: one header per section that writes a key,
 * then each def of that section as a comment line and its `w` line.
 *
 * @param {Object}   opts
 * @param {Object[]} opts.defs       Defs with `key`, `group` and `sysfsPath`
 * @param {{id:string, title:string}[]} opts.sections  Output order
 * @param {Object}   opts.params
 * @param {(def:Object, value:*)=>string} opts.comment  Text after `# key: value - `
 * @param {(def:Object)=>boolean} [opts.include]  Leave a def out when it has no effect
 * @returns {string[]}
 */
export function tmpfilesConfig({ defs, sections, params, comment, include = () => true }) {
  return sectionedConfig({ defs, sections, params, comment, include, lines: (def, text) => [tmpfilesWrite(def.sysfsPath, text)] })
}
