/**
 * Writer for systemd ini drop-ins. Directive names come from tuner code and
 * values are plain tokens, so a value can never add a line, a section or a
 * second assignment (Design.md §10).
 */

import { commentLine } from './comments.js'

const SECTION = /^[A-Z][A-Za-z]*$/
const DIRECTIVE = /^[A-Z][A-Za-z]*$/
const VALUE = /^[A-Za-z0-9.:%]+$/

/** `[Name]` */
export function iniSection(name) {
  if (!SECTION.test(name)) throw new Error(`Invalid ini section "${name}"`)
  return `[${name}]`
}

/**
 * A comment line followed by `Key=value`.
 *
 * @param {string} key
 * @param {string} value  Already formatted by the tuner (e.g. "50%", "8M")
 * @param {string} comment
 * @returns {string[]}
 */
export function iniDirective(key, value, comment) {
  if (!DIRECTIVE.test(key)) throw new Error(`Invalid ini directive "${key}"`)
  if (!VALUE.test(value)) throw new Error(`Invalid value for ${key}`)
  return [commentLine(`${key}: ${comment}`), `${key}=${value}`]
}
