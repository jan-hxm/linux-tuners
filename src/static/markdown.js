/**
 * Serializes a static page doc (nodes.js) to Markdown for dist/<route>.md and
 * llms-full.txt. Glossary terms become plain text, code blocks are fenced,
 * links are [label](url) (https only, as in html.js), and characters that
 * would start markup in plain text are escaped.
 */

import { SAFE_HREF } from './html.js'

/** Escapes the characters that would start emphasis, code, a link or HTML. */
export function escapeMarkdown(value) {
  return String(value).replace(/[\\`*[\]<]/g, '\\$&')
}

/** Inline code, with a longer fence when the text holds a backtick. */
function inlineCode(value) {
  const runs = String(value).match(/`+/g) ?? []
  const fence = '`'.repeat(Math.max(0, ...runs.map((r) => r.length)) + 1)
  const pad = runs.length ? ' ' : ''
  return `${fence}${pad}${value}${pad}${fence}`
}

/** @param {import('./nodes.js').Segment} seg */
function segmentMarkdown(seg) {
  switch (seg.type) {
    case 'code':
      return inlineCode(seg.text)
    case 'bold':
      return `**${escapeMarkdown(seg.text)}**`
    case 'link':
      return SAFE_HREF.test(seg.href) ? `[${escapeMarkdown(seg.text)}](${seg.href})` : escapeMarkdown(seg.text)
    default:
      // Text, and glossary terms as plain text.
      return escapeMarkdown(seg.text)
  }
}

const inline = (segments) => segments.map(segmentMarkdown).join('')

/** A fenced block, with a fence longer than any backtick run inside. */
function fenced(value) {
  const runs = String(value).match(/`{3,}/g) ?? []
  const fence = '`'.repeat(Math.max(2, ...runs.map((r) => r.length)) + 1)
  return `${fence}\n${value}\n${fence}`
}

/** @param {import('./nodes.js').Block} block */
function blockMarkdown(block) {
  switch (block.kind) {
    case 'heading':
      return `${'#'.repeat(Math.min(6, Math.max(1, Math.trunc(block.level))))} ${escapeMarkdown(block.text)}`
    case 'paragraph':
      return inline(block.segments)
    case 'list':
      return block.items.map((item, i) => `${block.ordered ? `${i + 1}.` : '-'} ${inline(item)}`).join('\n')
    case 'defs':
      return block.rows.map((r) => `- **${inline(r.term)}**: ${inline(r.desc)}`).join('\n')
    case 'code':
      return fenced(block.text)
    default:
      throw new Error(`Unknown block kind "${block.kind}"`)
  }
}

/**
 * @param {import('./nodes.js').Doc} doc
 * @returns {string}  Ends with one newline
 */
export function toMarkdown(doc) {
  const [first, ...rest] = doc.blocks
  const blocks = first?.kind === 'heading' && first.level === 1
    // The canonical page goes under the title, so a copy still says where it came from.
    ? [blockMarkdown(first), `Interactive page: ${doc.url}`, ...rest.map(blockMarkdown)]
    : doc.blocks.map(blockMarkdown)
  return `${blocks.join('\n\n')}\n`
}
