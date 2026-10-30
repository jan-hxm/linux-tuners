/**
 * Parser for the inline markup RichText.vue renders: `code`, **bold** and
 * [label](https://url). Anything else is plain text.
 *
 * @typedef {{ type: 'text'|'code'|'bold', text: string } | { type: 'link', text: string, href: string }} RichSegment
 */

const TOKEN = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g

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
    else out.push({ type: 'link', text: m[3], href: m[4] })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ type: 'text', text: text.slice(last) })
  return out
}
