/**
 * The neutral document tree the static page text is built as (Design.md §5
 * "Routes, SEO and build"). pages.js builds one per route from definitions;
 * html.js and markdown.js serialize it. Inline text is a list of the same
 * segments ui/richText.js parses (`text`, `code`, `bold`, `link`, `term`), so
 * the data files' markup means the same here as on the page.
 *
 * @typedef {import('@/ui/richText.js').RichSegment} Segment
 *
 * @typedef {{ kind: 'heading', level: 1|2|3|4, text: string }
 *   | { kind: 'paragraph', segments: Segment[] }
 *   | { kind: 'list', ordered: boolean, items: Segment[][] }
 *   | { kind: 'defs', rows: { term: Segment[], desc: Segment[] }[] }
 *   | { kind: 'code', text: string }} Block
 *
 * @typedef {Object} Doc
 * @property {string}  title   The page's own title (its h1)
 * @property {string}  url     The page's canonical URL
 * @property {Block[]} blocks
 */

import { parseRichText } from '@/ui/richText.js'

/** Plain text, shown as written (no markup). */
export const text = (value) => ({ type: 'text', text: String(value) })
/** Inline code. */
export const code = (value) => ({ type: 'code', text: String(value) })
/** Bold text. */
export const bold = (value) => ({ type: 'bold', text: String(value) })
/** A link; serializers drop the link (keep the text) unless it's https. */
export const link = (label, href) => ({ type: 'link', text: String(label), href: String(href) })
/** A string in the data files' inline markup (`code`, **bold**, links, [[terms]]). */
export const rich = (value) => parseRichText(String(value))

/** @returns {Block} */
export const heading = (level, value) => ({ kind: 'heading', level, text: String(value) })
/** @param {...(Segment|Segment[])} segments @returns {Block} */
export const paragraph = (...segments) => ({ kind: 'paragraph', segments: segments.flat() })
/** @param {Segment[][]} items @returns {Block} */
export const list = (items, { ordered = false } = {}) => ({ kind: 'list', ordered, items })
/** @param {{ term: Segment[], desc: Segment[] }[]} rows @returns {Block} */
export const defs = (rows) => ({ kind: 'defs', rows })
/** A block of preformatted text: a config file or commands. @returns {Block} */
export const codeBlock = (value) => ({ kind: 'code', text: String(value) })

/** Joins segment lists with a separator between them. */
export function joinSegments(parts, separator) {
  return parts.flatMap((segments, i) => (i === 0 ? segments : [text(separator), ...segments]))
}

/** Every piece of displayed text in a doc, for the copy checks. */
export function docTexts(doc) {
  const out = [doc.title]
  const segs = (list) => list.forEach((s) => out.push(s.text))
  for (const block of doc.blocks) {
    if (block.kind === 'heading' || block.kind === 'code') out.push(block.text)
    else if (block.kind === 'paragraph') segs(block.segments)
    else if (block.kind === 'list') block.items.forEach(segs)
    else if (block.kind === 'defs') block.rows.forEach((r) => (segs(r.term), segs(r.desc)))
  }
  return out
}
