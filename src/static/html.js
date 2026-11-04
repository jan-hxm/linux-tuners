/**
 * Serializes a static page doc (nodes.js) to semantic HTML: one <main>,
 * headings, paragraphs, lists, <dl> and <pre><code>. Every text node and
 * attribute is escaped; the only attribute is a link's https href (from a
 * `link` segment, which the rich-text parser limits to https too) and the
 * <main> class. No scripts, no handlers,
 * no styles (Design.md §10).
 */

import { GLOSSARY } from '@/ui/glossary.js'
import { SITE_ORIGIN } from '@/routes-meta.js'

/** A URL the page may link to: absolute https with nothing that could end the attribute or a Markdown link. */
export const SAFE_HREF = /^https:\/\/[^\s"'<>`\\()]+$/

/** Escapes text for an HTML text node or a double- or single-quoted attribute. */
export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** @param {import('./nodes.js').Segment} seg */
function segmentHtml(seg) {
  const body = escapeHtml(seg.text)
  switch (seg.type) {
    case 'code':
      return `<code>${body}</code>`
    case 'bold':
      return `<strong>${body}</strong>`
    case 'link': {
      if (!SAFE_HREF.test(seg.href)) return body
      // Like RichText, an outside link gets rel="noopener"; a link within the site doesn't need it.
      const rel = seg.href.startsWith(`${SITE_ORIGIN}/`) ? '' : ' rel="noopener"'
      return `<a href="${escapeHtml(seg.href)}"${rel}>${body}</a>`
    }
    case 'term': {
      // An unknown id shows as plain text, as RichText does.
      const entry = Object.hasOwn(GLOSSARY, seg.id) ? GLOSSARY[seg.id] : null
      // The definition itself is in the page's Glossary section (pages.js).
      return entry ? `<dfn>${body}</dfn>` : body
    }
    default:
      return body
  }
}

const inline = (segments) => segments.map(segmentHtml).join('')

/** @param {import('./nodes.js').Block} block */
function blockHtml(block) {
  switch (block.kind) {
    case 'heading': {
      const level = Math.min(6, Math.max(1, Math.trunc(block.level)))
      return `<h${level}>${escapeHtml(block.text)}</h${level}>`
    }
    case 'paragraph':
      return `<p>${inline(block.segments)}</p>`
    case 'list': {
      const tag = block.ordered ? 'ol' : 'ul'
      return `<${tag}>${block.items.map((item) => `<li>${inline(item)}</li>`).join('')}</${tag}>`
    }
    case 'defs':
      return `<dl>${block.rows.map((r) => `<div><dt>${inline(r.term)}</dt><dd>${inline(r.desc)}</dd></div>`).join('')}</dl>`
    case 'code':
      return `<pre><code>${escapeHtml(block.text)}</code></pre>`
    default:
      throw new Error(`Unknown block kind "${block.kind}"`)
  }
}

/**
 * @param {import('./nodes.js').Doc} doc
 * @returns {string}  One <main class="static-doc">, one block per line
 */
export function toHtml(doc) {
  return `<main class="static-doc">\n${doc.blocks.map(blockHtml).join('\n')}\n</main>`
}
