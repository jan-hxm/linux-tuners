/**
 * Parser for the inline markup RichText.vue renders: `code`, **bold**,
 * [label](https://url) and glossary terms. Anything else is plain text.
 *
 * A glossary term is `[[label|id]]`, or `[[label]]` when the id is the label
 * in lower case with spaces as hyphens (`[[OOM killer]]` is `oom-killer`).
 * The id names an entry in ui/glossary.js; the parser doesn't check it, the
 * contract suite does, and RichText shows an unknown one as plain text.
 *
 * @typedef {{ type: 'text'|'code'|'bold', text: string }
 *   | { type: 'link', text: string, href: string }
 *   | { type: 'term', text: string, id: string }} RichSegment
 */

const TOKEN = /`([^`]+)`|\*\*([^*]+)\*\*|\[\[([^\]|]+)(?:\|([a-z0-9-]+))?\]\]|\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g

/**
 * The glossary id `[[label]]` stands for.
 * @param {string} label
 */
export function termId(label) {
  return label.trim().toLowerCase().replace(/\s+/g, '-')
}

/**
 * @param {string} text
 * @returns {RichSegment[]}
 */
export function parseRichText(text) {
  const out = []
  let last = 0
  for (const m of text.matchAll(TOKEN)) {
    if (m.index > last) out.push({ type: 'text', text: text.slice(last, m.index) })
    if (m[1] !== undefined) out.push({ type: 'code', text: m[1] })
    else if (m[2] !== undefined) out.push({ type: 'bold', text: m[2] })
    else if (m[3] !== undefined) out.push({ type: 'term', text: m[3], id: m[4] ?? termId(m[3]) })
    else out.push({ type: 'link', text: m[5], href: m[6] })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ type: 'text', text: text.slice(last) })
  return out
}
