/**
 * The body shared by the keyed writers (sysctl.d, tmpfiles.d): one header per
 * section that writes a key, then each def of that section (in def order) as
 * a comment line and the writer's own lines for it.
 */

import { commentLine, sectionHeader } from './comments.js'
import { valueTypeOf } from '../valueTypes.js'

/**
 * @param {Object}   opts
 * @param {Object[]} opts.defs
 * @param {{id:string, title:string}[]} opts.sections  Output order
 * @param {Object}   opts.params
 * @param {(def:Object, value:*)=>string} opts.comment  Text after `# key: value - `
 * @param {(def:Object)=>boolean} opts.include  Leave a def out when it has no effect
 * @param {(def:Object, text:string)=>string[]} opts.lines  The setting lines for one def
 * @returns {string[]}
 */
export function sectionedConfig({ defs, sections, params, comment, include, lines: linesFor }) {
  const lines = []
  for (const section of sections) {
    const written = defs.filter((def) => def.group === section.id && include(def))
    if (!written.length) continue
    lines.push(sectionHeader(section.title))
    for (const def of written) {
      const value = params[def.key]
      const text = valueTypeOf(def).format(value, def)
      lines.push(commentLine(`${def.key}: ${text} - ${comment(def, value)}`))
      lines.push(...linesFor(def, text))
      lines.push('')
    }
  }
  return lines
}
