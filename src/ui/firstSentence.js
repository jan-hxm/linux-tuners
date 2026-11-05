/**
 * Splits a rich-text note (richText.js markup) after its first sentence, so
 * the card's margin can show one sentence and keep the rest behind "more".
 *
 * Only plain-text runs are scanned: `code`, **bold**, glossary terms and links
 * are never cut, and neither is anything inside parentheses. A sentence ends
 * at `.`, `!` or `?` (plus any closing quote or bracket) followed by
 * whitespace, so "0.5" or "pids.max" don't end one, and abbreviations such as
 * "e.g." and "i.e." don't either. When no safe split exists the whole note is
 * the head and the tail is empty.
 *
 * Both halves are returned as markup again (rebuilt from the parsed
 * segments), so each renders on its own with RichText and together they show
 * exactly what the whole note shows.
 */
import { parseRichText } from './richText.js'

const CLOSERS = new Set([')', ']', '"', "'", '”', '’'])
const ABBREVIATIONS = new Set(['etc', 'vs', 'cf', 'approx', 'incl', 'resp', 'ca', 'viz', 'al', 'no', 'fig', 'eq'])

/** `e.g`, `i.e`, `a.k.a`, a lone initial, or a listed short form. */
function isAbbreviation(word) {
  const w = word.replace(/^[("'“‘[]+/, '')
  return /^([a-z]\.)+[a-z]$/i.test(w) || /^[A-Z]$/.test(w) || ABBREVIATIONS.has(w.toLowerCase())
}

/** Markup for one parsed segment; renders the same as the original source. */
function toSource(seg) {
  if (seg.type === 'code') return `\`${seg.text}\``
  if (seg.type === 'bold') return `**${seg.text}**`
  if (seg.type === 'term') return `[[${seg.text}|${seg.id}]]`
  if (seg.type === 'link') return `[${seg.text}](${seg.href})`
  return seg.text
}

/**
 * Where the first sentence of a plain-text run ends, given the paren depth
 * carried in from earlier runs.
 * @returns {{ cut: number, rest: number, depth: number }} `cut` is the index
 *   after the sentence's last character and `rest` where the next one starts,
 *   or both -1 when the run holds no sentence end.
 */
function scanRun(text, depth) {
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '(') depth++
    else if (c === ')') depth = Math.max(0, depth - 1)
    else if (c === '.' || c === '!' || c === '?') {
      // Closers after the mark belong to the sentence; a `)` among them may
      // close the bracket the mark sat in ("(see below.) Then").
      let j = i + 1
      let after = depth
      while (j < text.length && CLOSERS.has(text[j])) {
        if (text[j] === ')') after = Math.max(0, after - 1)
        j++
      }
      if (after > 0 || j >= text.length || !/\s/.test(text[j])) continue
      if (c === '.') {
        const word = text.slice(0, i).split(/\s/).pop()
        if (isAbbreviation(word)) continue
      }
      let k = j
      while (k < text.length && /\s/.test(text[k])) k++
      return { cut: j, rest: k, depth: after }
    }
  }
  return { cut: -1, rest: -1, depth }
}

/**
 * @param {string} text  A note in richText.js markup.
 * @returns {{ head: string, tail: string }}  `tail` is '' when the note is
 *   one sentence or has no safe place to split.
 */
export function splitFirstSentence(text) {
  const segments = parseRichText(text)
  let depth = 0
  for (let s = 0; s < segments.length; s++) {
    const seg = segments[s]
    if (seg.type !== 'text') continue
    const found = scanRun(seg.text, depth)
    depth = found.depth
    if (found.cut < 0) continue
    const tailSource = seg.text.slice(found.rest) + segments.slice(s + 1).map(toSource).join('')
    if (!tailSource.trim()) break
    const head = segments.slice(0, s).map(toSource).join('') + seg.text.slice(0, found.cut)
    return { head, tail: tailSource }
  }
  return { head: text, tail: '' }
}
