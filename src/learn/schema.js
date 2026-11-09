/**
 * The shape of a study guide (`src/tuners/<id>/learn.js`) and the checks the
 * guide contract suite runs on it (src/learn/contract.test.js). Design.md §5
 * "Learning pages > Guide data and checks" is the prose version of this file.
 *
 * validateGuide() never throws on bad data: it walks the guide and returns one
 * issue per broken rule, each naming the path into the guide and the rule, so
 * a failing contract test says what to fix and where.
 *
 * Plain JS with no Vue and no tuner imports, so the build, the tests and the
 * figure components can all read it.
 *
 * @typedef {{ probe: string, path?: string, unit: string, label?: string }} ValueRef  unit '' for a unitless value
 *   A number in a figure: the probe id in the tuner's probes.js, a dotted path
 *   into the probe's captured value, and the unit it is shown in. A numeric
 *   step of the path on a string value picks one of its words, counted from
 *   0, so `path: '2'` on "4096 131072 6291456" is 6291456 (resolvePath).
 *   `label` (at most BUDGETS.label words) is what the figure, the panel and the
 *   static page call it; without one a ref is named by the part that shows it
 *   (a mark, a bar, a node), else by its path. A stack layer's `values` are
 *   shown by name alone, so one without a path needs a label.
 *   'bytes' and 'kB' (the kernel's KiB) read as KiB, MiB or GiB, with the
 *   number as measured in the tooltip, the panel and the static page.
 *
 * Figure words. A `label` (a card's title, a node's text, an edge, a mark or
 * a zone) names a part in at most BUDGETS.label words; what the part does is
 * its `does`, a tip: one sentence of RichText (code and bold only, no links or
 * glossary terms, since a tooltip never holds a control) that the page shows
 * in a tooltip and the static page inline.
 *
 * @typedef {{ id: string, title: string, does: string, col: number, row: number, tone?: 'fit', probe?: string, path?: string, unit?: string }} PartsCard  path and unit as on a ValueRef
 * @typedef {{ id: string, label: string, value?: ValueRef, does?: string }} ScaleSegment
 *   A stretch of a scale bar: measured (`value`) or, at most once and last, the rest of the total.
 * @typedef {{ label: string, total: ValueRef, segments: ScaleSegment[] }} ScaleBar
 *   A bar drawn to scale from the evidence: each measured segment is its share of `total`.
 * @typedef {{ picture: string, cards: PartsCard[], bands?: { label: string, rows: [number, number] }[],
 *   edges: { from: string, to: string, label: string }[], scale?: ScaleBar }} PartsMap
 *   The "Start here" diagram. Edges join cards that share a row or a column.
 *
 * @typedef {{ id: string, label: string, kind: 'bands'|'nodes',
 *   bands?: { id: string, text: string, does?: string }[],
 *   nodes?: { id: string, text: string, sub?: string, does?: string, probe?: string, path?: string, unit?: string }[],
 *   values?: ValueRef[] }} StackLayer
 * @typedef {{ id: string, label: string, value: ValueRef, does?: string, tone?: 'fit'|'error' }} GaugeMark
 * @typedef {{ id: string, label: string, does?: string, from?: string, to?: string, tone?: 'fit'|'error' }} GaugeZone
 *   The stretch between two marks (`from` below, `to` above); no `from` is the
 *   foot of the scale, no `to` its top.
 * @typedef {{ key: string, mark?: string, from?: string, to?: string, value?: ValueRef }} GaugePin
 *   A setting drawn on the scale: on one mark, or on the gap from one mark to another.
 *   `value` is the setting's own measured value, shown in the pin's panel.
 * @typedef {{ kind: 'gauge', title: string, axis: string, marks: GaugeMark[], zones: GaugeZone[],
 *     range?: { from: number, to: number },
 *     zoom?: { label: string, full: ValueRef, fullPerUnit?: number },
 *     curve?: { points: [number, number][], events?: { at: number, label: string, does?: string, tone?: 'fit'|'error' }[] },
 *     pins?: GaugePin[] }} GaugeFigure
 *   A vertical scale drawn to scale from the evidence on the chosen image.
 *   `marks` are listed bottom to top in one unit. The scale runs over `range`,
 *   or from 0 to a round number above the top mark. `zoom` adds a thin bar of
 *   the whole `full` range (in the marks' unit, or `fullPerUnit` of its unit
 *   per mark unit) with a bracket on the part the scale shows. `curve` is
 *   schematic: `[t, level]` with t 0..1 and level 0..marks+1, where 0 is the
 *   foot, k the k-th mark and marks+1 the top, so it follows the marks as measured.
 * @typedef {{ kind: 'stack', title: string, layers: StackLayer[] }
 *   | { kind: 'timeline', title: string, schematic: true, lines: { id: string, label: string, value: ValueRef, does?: string }[],
 *       curve: [number, number][], events: { at: number, label: string, does?: string, tone?: 'fit'|'error' }[] }
 *   | { kind: 'sideBySide', title: string,
 *       states: { label: string, cells: number, lit: number, start?: number, asked?: number, setting: { key: string, value: number|string } }[],
 *       legend?: { asked?: string, lit: string, off: string },
 *       backedBy: { vmTest: string } | { probe: string } }
 *   | GaugeFigure | CompareFigure | TreeFigure | ModesFigure} Figure
 *   A side-by-side state lights `lit` cells from `start` (0 when unset); `asked`
 *   is the cell the request was for, drawn in ink, the other lit ones in fit.
 *
 * @typedef {{ id: string, label: string, does?: string }} FigureGroup  a heading over bars or rows
 * @typedef {{ kind: 'compare', title: string, axis: string, scale: 'linear'|'log',
 *     groups?: FigureGroup[],
 *     bars: { id: string, label: string, value: ValueRef, does?: string, group?: string, tone?: 'fit'|'error' }[],
 *     marks?: { id: string, label: string, value: ValueRef, does?: string, tone?: 'fit'|'error' }[],
 *     pins?: ({ key: string, bar: string } | { key: string, mark: string })[] }} CompareFigure
 *   Horizontal bars, one per item, on one shared scale in one unit (1 to 12
 *   bars, at most 3 marks, which are vertical lines such as a limit). With
 *   `groups`, every bar names one. `log` suits values orders of magnitude apart.
 * @typedef {{ id: string, label: string, value?: ValueRef, does?: string, children?: TreeNode[] }} TreeNode
 * @typedef {{ kind: 'tree', title: string, root: TreeNode, pins?: { key: string, node: string }[] }} TreeFigure
 *   A small hierarchy: at most 3 levels and 12 nodes, such as systemd's slices.
 * @typedef {{ id: string, label: string, value: ValueRef, does?: string, group?: string, pin?: string,
 *     bits?: true, allValues?: true, options: { value: number|string, label: string, does?: string }[] }} ModesRow
 *   One setting's choices as segments, the measured one lit. `bits`: options are
 *   bit values (0 or powers of two) and every set bit lights. Where `pin` names
 *   a def with options, each option value is one the def writes (its
 *   sysctlValue, else its value), unless `allValues`.
 * @typedef {{ kind: 'modes', title: string, groups?: FigureGroup[], rows: ModesRow[] }} ModesFigure
 *
 * @typedef {{ key: string, dir: 'raise'|'lower' } | { key: string, to: string|number } | { leave: true, why: string }} Answer
 *   `to` names a value: an option's value for a def with options, else a number
 *   in the def's kernel range on its step (answerValueIssue). Prefer it to
 *   raise and lower for a setting whose values have no order.
 * @typedef {{ q: string, check: string, hint: string, yes: Answer, no?: Answer }} Question
 *   A missing `no` means "go to the next question", so the last one needs it.
 *
 * @typedef {Object} Chapter  The nine-part template, in this order.
 * @property {string} id       kebab case, unique in the guide, the URL anchor
 * @property {string} title
 * @property {string} oneLine  RichText, at most 30 words
 * @property {{ text: string, limit: string }} picture  RichText; text at most 70 words,
 *                             limit says where the comparison stops being true
 * @property {Figure} figure
 * @property {string[]} body   RichText, 1 to 3 paragraphs of at most 70 words; the
 *                             only part that may cite `[^sourceId]`
 * @property {{ key: string, here: string, layer?: string }[]} pins  def keys of this
 *                             tuner; `here` at most 40 words; `layer` an id in the figure
 * @property {Question[]} choose  1 to 3 questions
 * @property {{ low: string, high: string }} symptoms  one line each
 * @property {{ cmd: string, for: string }} look  one read-only command and what to look for
 * @property {Record<string, { url: string, label: string }>} sources
 *
 * @typedef {Object} Guide
 * @property {string} slug
 * @property {string} title
 * @property {string} lead      RichText, one or two sentences
 * @property {number} minutes
 * @property {PartsMap} parts
 * @property {Chapter[]} chapters
 *
 * @typedef {{ path: string, rule: string, message: string }} Issue
 *   `message` starts with the rule name, so it reads on its own.
 *
 * @typedef {Object} GuideContext
 * @property {Record<string, unknown>} defsByKey  the tuner's defs; every key must be pinned once
 * @property {Record<string, { kind: string }>} probes  the tuner's PROBES
 * @property {Record<string, import('./evidence.js').EvidenceFile>} evidence  loadEvidence()
 * @property {Record<string, unknown>} glossary  ui/glossary.js GLOSSARY
 * @property {'draft'|'live'} status  live guides need evidence for every probe on every image
 */

import { parseRichText } from '../ui/richText.js'
import { IMAGES_ORDER, resolvePath } from './evidence.js'

/** The nine chapter parts, in the order a chapter lists and renders them. */
export const TEMPLATE_PARTS = Object.freeze(['oneLine', 'picture', 'figure', 'body', 'pins', 'choose', 'symptoms', 'look', 'sources'])

/** Word budgets (Design.md §5 "Guide data and checks"). */
export const BUDGETS = Object.freeze({
  oneLine: 30,
  pictureText: 70,
  paragraphs: 3,
  paragraph: 70,
  pinHere: 40,
  sentence: 30,
  questions: 3,
  leadSentences: 2,
  /** Words in a figure label: a card title, node, edge, mark, zone or legend entry. */
  label: 4,
  /** A tip (`does`): one sentence of at most this many words. */
  tip: 25,
  tipSentences: 1,
})

/** Words a beginner's text leaves out: each one tells the reader they should already know. */
export const BANNED_WORDS = Object.freeze(['simply', 'just', 'obviously', 'easy', 'of course'])

/** The only hosts a source or an inline link may point at. */
export const SOURCE_HOSTS = Object.freeze(['docs.kernel.org', 'man7.org', 'systemd.io'])

/**
 * The read-only commands a `look.cmd` or `choose[].check` may start with, as
 * leading words. A pipe may only feed `grep` or `awk`.
 */
export const READ_ONLY_COMMANDS = Object.freeze([
  ['cat'], ['grep'], ['awk'], ['free'], ['swapon', '--show'], ['sysctl'], ['dmesg'], ['sudo', 'dmesg'],
  ['systemctl', 'show'], ['ls'], ['findmnt'], ['udevadm', 'info'],
])

export const FIGURE_KINDS = Object.freeze(['stack', 'timeline', 'sideBySide', 'gauge', 'compare', 'tree', 'modes'])

/** Most bars, marks and groups a compare figure, rows and options a modes figure, and nodes and levels a tree draws. */
export const FIGURE_LIMITS = Object.freeze({ bars: 12, marks: 3, groups: 6, rows: 12, options: 8, treeNodes: 12, treeLevels: 3 })

const EM_DASH = '—'
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/
const FOOTNOTE = /\[\^([a-z0-9-]+)\]/g
const BANNED = new RegExp(`\\b(${BANNED_WORDS.map((w) => w.replace(/ /g, '\\s+')).join('|')})\\b`, 'i')
// Markup left in plain text after parsing would show literally.
const LEFTOVER = /`|\*\*|(^|\s)\*\S|\]\(|\[\[|\]\]|\[\^/
const PATH = /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*$/

// ── Text helpers ────────────────────────────────────────────────────────────

/**
 * The `[^id]` footnote marks in a RichText string, in order. ui/richText.js
 * doesn't know them yet, so they are taken out before it parses the rest.
 * @param {string} text
 * @returns {string[]}
 */
export function footnotes(text) {
  return [...text.matchAll(FOOTNOTE)].map((m) => m[1])
}

/** RichText without its footnote marks. */
export function stripFootnotes(text) {
  return text.replace(FOOTNOTE, '')
}

/**
 * What a reader sees of a RichText string, for counting: markup gone, code
 * spans kept as one word each (with `codeAs` in place of their text, so a dot
 * in `vm.swappiness` doesn't end a sentence).
 * @param {string} text
 * @param {{ rich?: boolean, codeAs?: string }} [opts]
 */
export function visibleText(text, { rich = true, codeAs } = {}) {
  if (!rich) return text
  return parseRichText(stripFootnotes(text))
    .map((s) => (s.type === 'code' && codeAs !== undefined ? codeAs : s.text))
    .join('')
}

/** @param {string} text */
export function wordCount(text) {
  const t = text.trim()
  return t ? t.split(/\s+/).length : 0
}

/**
 * The sentences of plain text: split after `.`, `!` or `?` followed by a space
 * or the end. An abbreviation splits early, which only makes a sentence shorter.
 * @param {string} text
 */
export function sentences(text) {
  return text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)
}

/** A URL's problem as a source or inline link, or null. */
export function sourceUrlIssue(url) {
  if (typeof url !== 'string') return 'not a string'
  let u
  try {
    u = new URL(url)
  } catch {
    return `"${url}" is not a URL`
  }
  if (u.protocol !== 'https:') return `"${url}" is not https`
  if (!SOURCE_HOSTS.includes(u.hostname)) return `"${url}" is not on ${SOURCE_HOSTS.join(', ')}`
  if (u.username || u.password || u.port) return `"${url}" has credentials or a port`
  return null
}

// ── Commands ────────────────────────────────────────────────────────────────

/** Splits on whitespace and on `|` outside quotes; quotes stay in the words. */
function shellSegments(cmd) {
  const segments = [[]]
  let word = ''
  let quote = null
  const flush = () => {
    if (word) segments.at(-1).push(word)
    word = ''
  }
  for (const ch of cmd) {
    if (quote) {
      if (ch === quote) quote = null
      word += ch
    } else if (ch === "'" || ch === '"') {
      quote = ch
      word += ch
    } else if (ch === '|') {
      flush()
      segments.push([])
    } else if (/\s/.test(ch)) flush()
    else word += ch
  }
  flush()
  return { segments, unclosed: quote !== null }
}

const startsWith = (words, prefix) =>
  prefix.every((p, i) => words[i] === p || (p.startsWith('--') && words[i]?.startsWith(`${p}=`)))

// Per-command arguments that would write, clear or run something.
const SYSCTL_ARG = /^(-[aneNqbAX]+|--all|--values|--names|[A-Za-z0-9_*][A-Za-z0-9_.*/-]*)$/
const DMESG_WRITES = /^(-[A-Za-z]*[cCnDE][A-Za-z]*|--clear|--read-clear|--console-(off|on|level).*)$/
const SWAPON_ARG = /^(--show(=[A-Z,]+)?|--noheadings|--bytes|--raw)$/
const AWK_WRITES = /\b(system|getline|inplace)\b|\|/
const AWK_FLAGS = /^(-i|--include|-E|--exec|-l|--load)$/

/**
 * Why a guide command isn't read-only, or [] when it is.
 * @param {string} cmd
 * @returns {string[]}
 */
export function commandIssues(cmd) {
  if (typeof cmd !== 'string' || !cmd.trim()) return ['empty command']
  const out = []
  for (const [bad, label] of [['>', '">"'], [';', '";"'], ['`', 'a backtick'], ['$(', '"$("'], ['&', '"&"'], ['<', '"<"'], ['\n', 'a line break']]) {
    if (cmd.includes(bad)) out.push(`contains ${label}`)
  }
  if (/\btee\b/.test(cmd)) out.push('contains tee')
  if (/(^|\s)(-[A-Za-z]*w[A-Za-z]*|--write)(\s|=|$)/.test(cmd)) out.push('contains -w')
  const { segments, unclosed } = shellSegments(cmd)
  if (unclosed) out.push('has an unclosed quote')
  const [first, ...rest] = segments
  const prefix = READ_ONLY_COMMANDS.find((p) => startsWith(first, p))
  if (!prefix) out.push(`starts with "${first.slice(0, 2).join(' ')}", not one of: ${READ_ONLY_COMMANDS.map((p) => p.join(' ')).join(', ')}`)
  else {
    const args = first.slice(prefix.length)
    const name = prefix.join(' ')
    if (name === 'sysctl') {
      const bad = args.filter((a) => !SYSCTL_ARG.test(a))
      if (bad.length) out.push(`sysctl argument ${bad.map((a) => `"${a}"`).join(', ')} could write or load a file`)
    }
    if (name.endsWith('dmesg') && args.some((a) => DMESG_WRITES.test(a))) out.push('dmesg would clear the log or change the console')
    if (name === 'swapon --show' && args.some((a) => !SWAPON_ARG.test(a))) out.push('swapon takes only --show and display flags')
    if (name === 'udevadm info' && args.some((a) => a === '-c' || a.startsWith('--cleanup'))) out.push('udevadm info would clean the database')
  }
  for (const seg of rest) {
    if (!seg.length) out.push('has an empty pipe stage')
    else if (seg[0] !== 'grep' && seg[0] !== 'awk') out.push(`pipes into "${seg[0]}"; a pipe may only feed grep or awk`)
  }
  for (const seg of segments) {
    if (seg[0] !== 'awk') continue
    if (seg.slice(1).some((a) => AWK_FLAGS.test(a))) out.push('awk loads an extension or edits in place')
    if (AWK_WRITES.test(seg.slice(1).join(' '))) out.push('awk program runs a command or pipes')
  }
  return out
}

/**
 * Why `to` is not a value the def accepts, or null when it is. A def with
 * `options` takes one of their values (the option's id, not its
 * sysctlValue); any other def takes a number inside its kernelMin..kernelMax
 * on its step (1 when it sets none), so a bool takes 0 or 1 and a segmented
 * control one of its segments. A def with neither gets no `to`.
 * @param {Record<string, unknown>} def
 * @param {unknown} to
 * @returns {string | null}
 */
export function answerValueIssue(def, to) {
  if (Array.isArray(def?.options)) {
    const values = def.options.map((o) => o?.value)
    return values.some((v) => v === to) ? null : `${JSON.stringify(to)} is not one of the setting's options (${values.join(', ')})`
  }
  const { kernelMin: min, kernelMax: max } = def ?? {}
  if (typeof min !== 'number' || typeof max !== 'number' || !Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
    return 'only a setting with options or a numeric range takes "to"; use dir for this one'
  }
  if (typeof to !== 'number' || !Number.isFinite(to)) return `${JSON.stringify(to)} is not a number`
  if (to < min || to > max) return `${to} is outside the setting's range ${min} to ${max}`
  const step = typeof def.step === 'number' && def.step > 0 ? def.step : 1
  const n = (to - min) / step
  if (Math.abs(n - Math.round(n)) > 1e-9) return `${to} is not on the setting's step of ${step} from ${min}`
  return null
}

// ── The validator ───────────────────────────────────────────────────────────

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const isStr = (v) => typeof v === 'string' && v.trim() !== ''
const isInt = (v, min = -Infinity) => Number.isInteger(v) && v >= min
const inUnit = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1

/**
 * Checks a guide against the frozen schema and the beginner-writing rules.
 * @param {Guide} guide
 * @param {GuideContext} ctx
 * @returns {Issue[]}
 */
export function validateGuide(guide, ctx) {
  const { defsByKey = {}, probes = {}, evidence = {}, glossary = {}, status = 'draft' } = ctx ?? {}
  /** @type {Issue[]} */
  const issues = []
  const fail = (path, rule, detail) => issues.push({ path, rule, message: `${rule}: ${detail}` })
  const isDef = (key) => typeof key === 'string' && Object.hasOwn(defsByKey, key)
  const isProbe = (id) => typeof id === 'string' && Object.hasOwn(probes, id)

  /** Required and optional keys of one object; anything else is a typo. */
  function shape(path, obj, required, optional = []) {
    if (!isObj(obj)) {
      fail(path, 'shape', 'must be an object')
      return false
    }
    for (const k of required) if (!Object.hasOwn(obj, k)) fail(path, 'shape', `missing "${k}"`)
    for (const k of Object.keys(obj)) if (!required.includes(k) && !optional.includes(k)) fail(`${path}.${k}`, 'shape', 'unknown field')
    return true
  }

  function list(path, value, { min = 0, max = Infinity } = {}) {
    if (!Array.isArray(value)) {
      fail(path, 'shape', 'must be an array')
      return []
    }
    if (value.length < min) fail(path, 'shape', `needs at least ${min} entr${min === 1 ? 'y' : 'ies'}`)
    if (value.length > max) fail(path, 'word budget', `${value.length} entries, at most ${max}`)
    return value
  }

  function uniqueIds(path, items, seen = new Set()) {
    items.forEach((item, i) => {
      if (!isObj(item)) return
      if (typeof item.id !== 'string' || !KEBAB.test(item.id)) fail(`${path}[${i}].id`, 'unique id', `"${item.id}" is not kebab case`)
      else if (seen.has(item.id)) fail(`${path}[${i}].id`, 'unique id', `"${item.id}" is used twice`)
      else seen.add(item.id)
    })
    return seen
  }

  const usedFootnotes = new Set()
  /** Footnote ids cited in the current chapter, by path; checked against its sources. */
  let citations = []

  /**
   * One displayed string. Plain text may hold no markup; RichText must parse
   * cleanly, name known glossary ids and link only to source hosts. Every
   * string gets the sentence-length and banned-word checks.
   */
  function text(path, value, { rich = false, cite = false, budget, sentenceMax } = {}) {
    if (!isStr(value)) {
      fail(path, 'shape', 'must be a non-empty string')
      return
    }
    if (rich) {
      const marks = footnotes(value)
      if (marks.length && !cite) fail(path, 'footnote', '[^id] marks belong in the body only')
      for (const id of marks) citations.push({ path, id })
      // The page splits a paragraph at its marks before RichText parses each
      // piece (ChapterView), so a mark inside markup (**bold[^x]**) would
      // leave each half unparsed. Every piece must parse on its own.
      if (marks.length) {
        const pieces = value.split(/\[\^[a-z0-9-]+\]/)
        const broken = pieces.some((piece) => parseRichText(piece).some((seg) => seg.type === 'text' && LEFTOVER.test(seg.text)))
        const whole = parseRichText(stripFootnotes(value)).some((seg) => seg.type === 'text' && LEFTOVER.test(seg.text))
        if (broken && !whole) fail(path, 'footnote', 'a [^id] mark sits inside markup; put it after the closing mark')
      }
      for (const seg of parseRichText(stripFootnotes(value))) {
        if (seg.type === 'term' && !Object.hasOwn(glossary, seg.id)) fail(path, 'glossary', `unknown glossary id "${seg.id}"`)
        if (seg.type === 'link') {
          const why = sourceUrlIssue(seg.href)
          if (why) fail(path, 'source', `inline link ${why}`)
        }
        if (seg.type === 'text' && LEFTOVER.test(seg.text)) fail(path, 'rich text', `markup that does not parse in "${seg.text.trim()}"`)
      }
    } else if (parseRichText(value).some((s) => s.type !== 'text') || LEFTOVER.test(value)) {
      fail(path, 'rich text', 'markup in a plain-text field')
    }
    if (/[\r\n]/.test(value)) fail(path, 'shape', 'must be one line')
    const seen = visibleText(value, { rich, codeAs: 'code' })
    if (budget !== undefined && wordCount(seen) > budget) fail(path, 'word budget', `${wordCount(seen)} words, at most ${budget}`)
    const parts = sentences(seen)
    if (sentenceMax !== undefined && parts.length > sentenceMax) fail(path, 'word budget', `${parts.length} sentences, at most ${sentenceMax}`)
    for (const s of parts) {
      if (wordCount(s) > BUDGETS.sentence) fail(path, 'sentence length', `${wordCount(s)} words in "${s.slice(0, 40)}...", at most ${BUDGETS.sentence}`)
    }
    const banned = seen.match(BANNED)
    if (banned) fail(path, 'banned word', `"${banned[0]}"`)
  }

  /** A figure label: plain text that names a part in a few words. */
  function label(path, value) {
    text(path, value)
    if (isStr(value) && wordCount(value) > BUDGETS.label) {
      fail(path, 'figure words', `${wordCount(value)} words in a label, at most ${BUDGETS.label}; move the rest into the part's does`)
    }
  }

  /**
   * A tip (`does`): one sentence the page shows in a tooltip. RichText with
   * code and bold only, since a tooltip never holds a link or a control.
   */
  function tip(path, value) {
    text(path, value, { rich: true })
    if (!isStr(value)) return
    for (const seg of parseRichText(stripFootnotes(value))) {
      if (seg.type === 'link' || seg.type === 'term') fail(path, 'tooltip', `a ${seg.type === 'link' ? 'link' : 'glossary term'} in a tip; a tooltip holds no control`)
    }
    const seen = visibleText(value, { codeAs: 'code' })
    if (sentences(seen).length > BUDGETS.tipSentences) fail(path, 'figure words', `${sentences(seen).length} sentences in a tip, at most ${BUDGETS.tipSentences}`)
    if (wordCount(seen) > BUDGETS.tip) fail(path, 'figure words', `${wordCount(seen)} words in a tip, at most ${BUDGETS.tip}`)
  }

  const isNum = (v) => typeof v === 'number' && Number.isFinite(v)

  function command(path, value) {
    for (const why of commandIssues(value)) fail(path, 'command', why)
  }

  /** A probe id named by a figure; live guides need it measured on every image. */
  const probeRefs = []
  function probe(path, id, refPath, { scalar = false } = {}) {
    if (!isProbe(id)) fail(path, 'probe', `"${id}" is not in the tuner's probes.js`)
    else probeRefs.push({ path, id, refPath, scalar })
  }

  /**
   * A card's or node's own measured value: `probe`, with `path` and `unit`
   * as on a ValueRef when the probe's value is an object (a meminfoKeys
   * probe). Without a path it must measure one plain value.
   */
  function itemProbe(path, item) {
    if (item.probe === undefined) {
      if (item.path !== undefined || item.unit !== undefined) fail(path, 'shape', 'path and unit need a probe')
      return
    }
    if (item.path !== undefined && (typeof item.path !== 'string' || !PATH.test(item.path))) fail(`${path}.path`, 'shape', `"${item.path}" is not a dotted path`)
    if (item.unit !== undefined && typeof item.unit !== 'string') fail(`${path}.unit`, 'shape', 'must be a string')
    else if (item.unit) text(`${path}.unit`, item.unit)
    probe(`${path}.probe`, item.probe, item.path, { scalar: item.path === undefined })
  }

  function valueRef(path, ref, { needsLabel = false } = {}) {
    if (!shape(path, ref, ['probe', 'unit'], ['path', 'label'])) return
    if (ref.label !== undefined) label(`${path}.label`, ref.label)
    else if (needsLabel && !ref.path) fail(path, 'figure words', 'a value shown by name alone needs a label (at most four words) when it has no path')
    if (ref.path !== undefined && (typeof ref.path !== 'string' || !PATH.test(ref.path))) fail(`${path}.path`, 'shape', `"${ref.path}" is not a dotted path`)
    // A unitless value (vm.swappiness) has unit ''; otherwise plain text.
    if (typeof ref.unit !== 'string') fail(`${path}.unit`, 'shape', 'must be a string')
    else if (ref.unit !== '') text(`${path}.unit`, ref.unit)
    probe(`${path}.probe`, ref.probe, ref.path)
  }

  function answer(path, a) {
    if (!isObj(a)) return fail(path, 'shape', 'must be an object')
    if (Object.hasOwn(a, 'leave')) {
      shape(path, a, ['leave', 'why'])
      if (a.leave !== true) fail(`${path}.leave`, 'shape', 'must be true')
      text(`${path}.why`, a.why, { rich: true })
    } else if (Object.hasOwn(a, 'to')) {
      shape(path, a, ['key', 'to'])
      if (!isDef(a.key)) return fail(`${path}.key`, 'def key', `"${a.key}" is not a def key of this tuner`)
      const why = answerValueIssue(defsByKey[a.key], a.to)
      if (why) fail(`${path}.to`, 'answer value', why)
    } else {
      shape(path, a, ['key', 'dir'])
      if (!isDef(a.key)) fail(`${path}.key`, 'def key', `"${a.key}" is not a def key of this tuner`)
      if (a.dir !== 'raise' && a.dir !== 'lower') fail(`${path}.dir`, 'shape', `"${a.dir}" is not raise or lower`)
    }
  }

  // ── Parts map ──
  function partsMap(path, parts) {
    if (!shape(path, parts, ['picture', 'cards', 'edges'], ['bands', 'scale'])) return
    text(`${path}.picture`, parts.picture, { rich: true })
    const cards = list(`${path}.cards`, parts.cards, { min: 1 })
    uniqueIds(`${path}.cards`, cards)
    const byId = new Map()
    const cells = new Set()
    cards.forEach((c, i) => {
      const p = `${path}.cards[${i}]`
      if (!shape(p, c, ['id', 'title', 'does', 'col', 'row'], ['tone', 'probe', 'path', 'unit'])) return
      label(`${p}.title`, c.title)
      tip(`${p}.does`, c.does)
      if (!isInt(c.col, 1)) fail(`${p}.col`, 'figure range', 'must be a whole number from 1')
      if (!isInt(c.row, 1)) fail(`${p}.row`, 'figure range', 'must be a whole number from 1')
      const cell = `${c.col},${c.row}`
      if (cells.has(cell)) fail(p, 'figure range', `shares column ${c.col}, row ${c.row} with another card`)
      cells.add(cell)
      if (c.tone !== undefined && c.tone !== 'fit') fail(`${p}.tone`, 'shape', `"${c.tone}" is not fit`)
      itemProbe(p, c)
      byId.set(c.id, c)
    })
    const rows = cards.map((c) => c?.row).filter((r) => isInt(r, 1))
    if (parts.bands !== undefined) {
      list(`${path}.bands`, parts.bands).forEach((b, i) => {
        const p = `${path}.bands[${i}]`
        if (!shape(p, b, ['label', 'rows'])) return
        label(`${p}.label`, b.label)
        const [from, to] = Array.isArray(b.rows) ? b.rows : []
        if (!Array.isArray(b.rows) || b.rows.length !== 2 || !isInt(from, 1) || !isInt(to, from)) fail(`${p}.rows`, 'figure range', 'must be [from, to] rows with from <= to')
        else if (to > Math.max(...rows)) fail(`${p}.rows`, 'figure range', `row ${to} has no card`)
      })
    }
    list(`${path}.edges`, parts.edges).forEach((e, i) => {
      const p = `${path}.edges[${i}]`
      if (!shape(p, e, ['from', 'to', 'label'])) return
      label(`${p}.label`, e.label)
      const a = byId.get(e.from)
      const b = byId.get(e.to)
      if (!a) fail(`${p}.from`, 'figure range', `"${e.from}" is not a card`)
      if (!b) fail(`${p}.to`, 'figure range', `"${e.to}" is not a card`)
      if (a && b) {
        if (a === b) fail(p, 'figure range', 'joins a card to itself')
        else if (a.row !== b.row && a.col !== b.col) fail(p, 'figure range', `"${e.from}" and "${e.to}" share neither a row nor a column`)
      }
    })
    if (parts.scale !== undefined) scaleBar(`${path}.scale`, parts.scale)
  }

  /** A bar drawn to scale: measured segments in the total's unit, then at most one rest. */
  function scaleBar(path, scale) {
    if (!shape(path, scale, ['label', 'total', 'segments'])) return
    label(`${path}.label`, scale.label)
    valueRef(`${path}.total`, scale.total)
    const segments = list(`${path}.segments`, scale.segments, { min: 1, max: 4 })
    uniqueIds(`${path}.segments`, segments)
    segments.forEach((seg, i) => {
      const p = `${path}.segments[${i}]`
      if (!shape(p, seg, ['id', 'label'], ['value', 'does'])) return
      label(`${p}.label`, seg.label)
      if (seg.does !== undefined) tip(`${p}.does`, seg.does)
      if (seg.value === undefined) {
        if (i !== segments.length - 1) fail(p, 'figure range', 'a segment without a value is the rest of the total, so it comes last')
      } else {
        valueRef(`${p}.value`, seg.value)
        if (isObj(seg.value) && isObj(scale.total) && seg.value.unit !== scale.total.unit) fail(`${p}.value.unit`, 'figure range', `"${seg.value.unit}" is not the total's unit "${scale.total.unit}"; a bar has one scale`)
      }
    })
  }

  // ── Figures ──
  /** Ids a pin's `layer` may name. */
  function figure(path, fig) {
    const ids = new Set()
    if (!isObj(fig)) {
      fail(path, 'shape', 'must be an object')
      return ids
    }
    if (!FIGURE_KINDS.includes(fig.kind)) {
      fail(`${path}.kind`, 'shape', `"${fig.kind}" is not one of ${FIGURE_KINDS.join(', ')}`)
      return ids
    }
    if (fig.kind === 'stack') {
      shape(path, fig, ['kind', 'title', 'layers'])
      text(`${path}.title`, fig.title)
      const layers = list(`${path}.layers`, fig.layers, { min: 1 })
      uniqueIds(`${path}.layers`, layers, ids)
      layers.forEach((l, i) => {
        const p = `${path}.layers[${i}]`
        if (!shape(p, l, ['id', 'label', 'kind'], ['bands', 'nodes', 'values'])) return
        label(`${p}.label`, l.label)
        if (l.kind === 'bands') {
          if (l.nodes !== undefined) fail(`${p}.nodes`, 'shape', 'a bands layer has no nodes')
          const bands = list(`${p}.bands`, l.bands, { min: 1 })
          uniqueIds(`${p}.bands`, bands, ids)
          bands.forEach((b, j) => {
            if (!shape(`${p}.bands[${j}]`, b, ['id', 'text'], ['does'])) return
            label(`${p}.bands[${j}].text`, b.text)
            if (b.does !== undefined) tip(`${p}.bands[${j}].does`, b.does)
          })
        } else if (l.kind === 'nodes') {
          if (l.bands !== undefined) fail(`${p}.bands`, 'shape', 'a nodes layer has no bands')
          const nodes = list(`${p}.nodes`, l.nodes, { min: 1 })
          uniqueIds(`${p}.nodes`, nodes, ids)
          nodes.forEach((n, j) => {
            const q = `${p}.nodes[${j}]`
            if (!shape(q, n, ['id', 'text'], ['sub', 'does', 'probe', 'path', 'unit'])) return
            label(`${q}.text`, n.text)
            if (n.sub !== undefined) label(`${q}.sub`, n.sub)
            if (n.does !== undefined) tip(`${q}.does`, n.does)
            itemProbe(q, n)
          })
        } else fail(`${p}.kind`, 'shape', `"${l.kind}" is not bands or nodes`)
        if (l.values !== undefined) list(`${p}.values`, l.values).forEach((v, j) => valueRef(`${p}.values[${j}]`, v, { needsLabel: true }))
      })
    } else if (fig.kind === 'timeline') {
      shape(path, fig, ['kind', 'title', 'schematic', 'lines', 'curve', 'events'])
      text(`${path}.title`, fig.title)
      if (fig.schematic !== true) fail(`${path}.schematic`, 'shape', 'must be true: the curve is a shape, not a measurement')
      const lines = list(`${path}.lines`, fig.lines, { min: 1 })
      uniqueIds(`${path}.lines`, lines, ids)
      lines.forEach((l, i) => {
        const p = `${path}.lines[${i}]`
        if (!shape(p, l, ['id', 'label', 'value'], ['does'])) return
        label(`${p}.label`, l.label)
        if (l.does !== undefined) tip(`${p}.does`, l.does)
        valueRef(`${p}.value`, l.value)
      })
      let lastT = -Infinity
      list(`${path}.curve`, fig.curve, { min: 2 }).forEach((pt, i) => {
        const p = `${path}.curve[${i}]`
        if (!Array.isArray(pt) || pt.length !== 2 || !inUnit(pt[0]) || !inUnit(pt[1])) return fail(p, 'figure range', 'must be [t, level], each 0..1')
        if (pt[0] < lastT) fail(p, 'figure range', 'goes back in time')
        lastT = pt[0]
      })
      list(`${path}.events`, fig.events).forEach((e, i) => {
        const p = `${path}.events[${i}]`
        if (!shape(p, e, ['at', 'label'], ['does', 'tone'])) return
        label(`${p}.label`, e.label)
        if (e.does !== undefined) tip(`${p}.does`, e.does)
        if (!inUnit(e.at)) fail(`${p}.at`, 'figure range', 'must be 0..1')
        if (e.tone !== undefined && e.tone !== 'fit' && e.tone !== 'error') fail(`${p}.tone`, 'shape', `"${e.tone}" is not fit or error`)
      })
    } else if (fig.kind === 'gauge') {
      gauge(path, fig, ids)
    } else if (fig.kind === 'compare') {
      compare(path, fig, ids)
    } else if (fig.kind === 'tree') {
      tree(path, fig, ids)
    } else if (fig.kind === 'modes') {
      modes(path, fig, ids)
    } else {
      shape(path, fig, ['kind', 'title', 'states', 'backedBy'], ['legend'])
      text(`${path}.title`, fig.title)
      const states = list(`${path}.states`, fig.states, { min: 2 })
      states.forEach((s, i) => {
        const p = `${path}.states[${i}]`
        if (!shape(p, s, ['label', 'cells', 'lit', 'setting'], ['start', 'asked'])) return
        label(`${p}.label`, s.label)
        if (!isInt(s.cells, 1)) fail(`${p}.cells`, 'figure range', 'must be a whole number from 1')
        const start = s.start ?? 0
        if (s.start !== undefined && !isInt(s.start, 0)) fail(`${p}.start`, 'figure range', 'must be a whole number from 0')
        if (!isInt(s.lit, 0) || (isInt(s.cells, 1) && isInt(start, 0) && start + s.lit > s.cells)) fail(`${p}.lit`, 'figure range', 'must be a whole number, with start + lit at most cells')
        if (s.asked !== undefined && (!isInt(s.asked, 0) || !isInt(s.lit, 1) || s.asked < start || s.asked >= start + s.lit)) {
          fail(`${p}.asked`, 'figure range', 'must be one of the lit cells, counted from 0')
        }
        if (shape(`${p}.setting`, s.setting, ['key', 'value'])) {
          if (!isDef(s.setting.key)) fail(`${p}.setting.key`, 'def key', `"${s.setting.key}" is not a def key of this tuner`)
          const v = s.setting.value
          if (!(typeof v === 'number' && Number.isFinite(v)) && !isStr(v)) fail(`${p}.setting.value`, 'shape', 'must be a number or a string')
          else if (typeof v === 'string') text(`${p}.setting.value`, v)
        }
      })
      if (fig.legend !== undefined && shape(`${path}.legend`, fig.legend, ['lit', 'off'], ['asked'])) {
        for (const k of ['asked', 'lit', 'off']) if (fig.legend[k] !== undefined) label(`${path}.legend.${k}`, fig.legend[k])
        if (fig.legend.asked === undefined && states.some((s) => s?.asked !== undefined)) fail(`${path}.legend`, 'shape', 'a state names an asked cell, so the legend needs "asked"')
      }
      const b = fig.backedBy
      if (isObj(b) && Object.hasOwn(b, 'vmTest')) {
        shape(`${path}.backedBy`, b, ['vmTest'])
        if (!isStr(b.vmTest)) fail(`${path}.backedBy.vmTest`, 'shape', 'must name a test in vm/suite.mjs')
      } else if (isObj(b) && Object.hasOwn(b, 'probe')) {
        shape(`${path}.backedBy`, b, ['probe'])
        probe(`${path}.backedBy.probe`, b.probe)
      } else fail(`${path}.backedBy`, 'shape', 'must be { vmTest } or { probe }')
    }
    return ids
  }

  /** Gauges, for the live mark-order check. */
  const gauges = []
  /** Settings a figure draws itself, by figure path, for the chapter's pin check. */
  const drawnPins = []

  const tone = (p, t) => {
    if (t !== undefined && t !== 'fit' && t !== 'error') fail(p, 'shape', `"${t}" is not fit or error`)
  }

  /** A setting drawn on a figure: a def key, at most once per figure. */
  function drawnKey(p, key, pinKeys) {
    if (!isDef(key)) fail(p, 'def key', `"${key}" is not a def key of this tuner`)
    else if (pinKeys.some((k) => k.key === key)) fail(p, 'pins', `"${key}" is drawn twice on this figure`)
    else pinKeys.push({ key, path: p })
  }

  /** Optional group headings; their ids, or null without groups. Every item then names one. */
  function groupsOf(path, groups, ids) {
    if (groups === undefined) return null
    const all = list(path, groups, { min: 1, max: FIGURE_LIMITS.groups })
    uniqueIds(path, all, ids)
    all.forEach((g, i) => {
      const p = `${path}[${i}]`
      if (!shape(p, g, ['id', 'label'], ['does'])) return
      label(`${p}.label`, g.label)
      if (g.does !== undefined) tip(`${p}.does`, g.does)
    })
    return new Set(all.filter(isObj).map((g) => g.id))
  }

  function inGroup(p, item, groupIds) {
    if (groupIds === null) {
      if (item.group !== undefined) fail(`${p}.group`, 'figure range', 'the figure has no groups')
    } else if (item.group === undefined) fail(p, 'figure range', 'the figure has groups, so every item names one')
    else if (!groupIds.has(item.group)) fail(`${p}.group`, 'figure range', `"${item.group}" is not a group`)
  }

  function compare(path, fig, ids) {
    shape(path, fig, ['kind', 'title', 'axis', 'scale', 'bars'], ['groups', 'marks', 'pins'])
    text(`${path}.title`, fig.title)
    label(`${path}.axis`, fig.axis)
    if (fig.scale !== 'linear' && fig.scale !== 'log') fail(`${path}.scale`, 'shape', `"${fig.scale}" is not linear or log`)
    const groupIds = groupsOf(`${path}.groups`, fig.groups, ids)
    let unit
    const sameUnit = (p, ref) => {
      if (!isObj(ref)) return
      if (unit === undefined) unit = ref.unit
      else if (ref.unit !== unit) fail(`${p}.value.unit`, 'figure range', `"${ref.unit}" is not the first bar's unit "${unit}"; a compare figure has one scale`)
    }
    const bars = list(`${path}.bars`, fig.bars, { min: 1, max: FIGURE_LIMITS.bars })
    uniqueIds(`${path}.bars`, bars, ids)
    bars.forEach((b, i) => {
      const p = `${path}.bars[${i}]`
      if (!shape(p, b, ['id', 'label', 'value'], ['does', 'group', 'tone'])) return
      label(`${p}.label`, b.label)
      if (b.does !== undefined) tip(`${p}.does`, b.does)
      valueRef(`${p}.value`, b.value)
      sameUnit(p, b.value)
      inGroup(p, b, groupIds)
      tone(`${p}.tone`, b.tone)
    })
    const marks = fig.marks === undefined ? [] : list(`${path}.marks`, fig.marks, { min: 1, max: FIGURE_LIMITS.marks })
    uniqueIds(`${path}.marks`, marks, ids)
    marks.forEach((m, i) => {
      const p = `${path}.marks[${i}]`
      if (!shape(p, m, ['id', 'label', 'value'], ['does', 'tone'])) return
      label(`${p}.label`, m.label)
      if (m.does !== undefined) tip(`${p}.does`, m.does)
      valueRef(`${p}.value`, m.value)
      sameUnit(p, m.value)
      tone(`${p}.tone`, m.tone)
    })
    const barIds = new Set(bars.filter(isObj).map((b) => b.id))
    const markIds = new Set(marks.filter(isObj).map((m) => m.id))
    const pinKeys = []
    if (fig.pins !== undefined) {
      list(`${path}.pins`, fig.pins).forEach((pin, i) => {
        const p = `${path}.pins[${i}]`
        if (!isObj(pin)) return fail(p, 'shape', 'must be an object')
        const onBar = Object.hasOwn(pin, 'bar')
        if (!shape(p, pin, onBar ? ['key', 'bar'] : ['key', 'mark'])) return
        drawnKey(`${p}.key`, pin.key, pinKeys)
        const at = onBar ? pin.bar : pin.mark
        if (!(onBar ? barIds : markIds).has(at)) fail(`${p}.${onBar ? 'bar' : 'mark'}`, 'figure range', `"${at}" is not a ${onBar ? 'bar' : 'mark'}`)
      })
    }
    drawnPins.push({ path, pinKeys })
  }

  function tree(path, fig, ids) {
    shape(path, fig, ['kind', 'title', 'root'], ['pins'])
    text(`${path}.title`, fig.title)
    const nodeIds = new Set()
    let count = 0
    const node = (p, n, depth) => {
      if (!shape(p, n, ['id', 'label'], ['value', 'does', 'children'])) return
      count++
      if (typeof n.id !== 'string' || !KEBAB.test(n.id)) fail(`${p}.id`, 'unique id', `"${n.id}" is not kebab case`)
      else if (ids.has(n.id) || nodeIds.has(n.id)) fail(`${p}.id`, 'unique id', `"${n.id}" is used twice`)
      else nodeIds.add(n.id)
      label(`${p}.label`, n.label)
      if (n.does !== undefined) tip(`${p}.does`, n.does)
      if (n.value !== undefined) valueRef(`${p}.value`, n.value)
      if (n.children === undefined) return
      const kids = list(`${p}.children`, n.children, { min: 1 })
      if (depth + 1 >= FIGURE_LIMITS.treeLevels && kids.length) return fail(`${p}.children`, 'figure range', `a tree has at most ${FIGURE_LIMITS.treeLevels} levels`)
      kids.forEach((k, i) => node(`${p}.children[${i}]`, k, depth + 1))
    }
    node(`${path}.root`, fig.root, 0)
    if (count > FIGURE_LIMITS.treeNodes) fail(path, 'figure range', `${count} nodes, at most ${FIGURE_LIMITS.treeNodes}`)
    for (const id of nodeIds) ids.add(id)
    const pinKeys = []
    if (fig.pins !== undefined) {
      list(`${path}.pins`, fig.pins).forEach((pin, i) => {
        const p = `${path}.pins[${i}]`
        if (!shape(p, pin, ['key', 'node'])) return
        drawnKey(`${p}.key`, pin.key, pinKeys)
        if (!nodeIds.has(pin.node)) fail(`${p}.node`, 'figure range', `"${pin.node}" is not a node`)
      })
    }
    drawnPins.push({ path, pinKeys })
  }

  const isPow2 = (v) => Number.isSafeInteger(v) && v > 0 && 2 ** Math.round(Math.log2(v)) === v

  function modes(path, fig, ids) {
    shape(path, fig, ['kind', 'title', 'rows'], ['groups'])
    text(`${path}.title`, fig.title)
    const groupIds = groupsOf(`${path}.groups`, fig.groups, ids)
    const rows = list(`${path}.rows`, fig.rows, { min: 1, max: FIGURE_LIMITS.rows })
    uniqueIds(`${path}.rows`, rows, ids)
    const pinKeys = []
    rows.forEach((row, i) => {
      const p = `${path}.rows[${i}]`
      if (!shape(p, row, ['id', 'label', 'value', 'options'], ['does', 'group', 'pin', 'bits', 'allValues'])) return
      label(`${p}.label`, row.label)
      if (row.does !== undefined) tip(`${p}.does`, row.does)
      valueRef(`${p}.value`, row.value)
      inGroup(p, row, groupIds)
      for (const flag of ['bits', 'allValues']) if (row[flag] !== undefined && row[flag] !== true) fail(`${p}.${flag}`, 'shape', 'must be true when set')
      const seen = new Set()
      const options = list(`${p}.options`, row.options, { min: 2, max: FIGURE_LIMITS.options })
      options.forEach((o, j) => {
        const q = `${p}.options[${j}]`
        if (!shape(q, o, ['value', 'label'], ['does'])) return
        label(`${q}.label`, o.label)
        if (o.does !== undefined) tip(`${q}.does`, o.does)
        if (!isNum(o.value) && !isStr(o.value)) return fail(`${q}.value`, 'shape', 'must be a number or a string')
        if (typeof o.value === 'string') text(`${q}.value`, o.value)
        if (seen.has(String(o.value))) fail(`${q}.value`, 'figure range', `${JSON.stringify(o.value)} is listed twice in this row`)
        seen.add(String(o.value))
        if (row.bits === true && o.value !== 0 && !isPow2(o.value)) fail(`${q}.value`, 'figure range', `${JSON.stringify(o.value)} is not 0 or a power of two; a bits row lists one bit per option`)
      })
      if (row.pin === undefined) return
      drawnKey(`${p}.pin`, row.pin, pinKeys)
      const def = isDef(row.pin) ? defsByKey[row.pin] : null
      if (row.allValues !== true && Array.isArray(def?.options)) {
        const written = def.options.map((o) => String(o?.sysctlValue ?? o?.value))
        options.forEach((o, j) => {
          if (isObj(o) && (isNum(o.value) || isStr(o.value)) && !written.includes(String(o.value))) {
            fail(`${p}.options[${j}].value`, 'mode value', `${JSON.stringify(o.value)} is not a value ${row.pin} writes (${written.join(', ')}); set allValues for one the tuner does not offer`)
          }
        })
      }
    })
    drawnPins.push({ path, pinKeys })
  }

  function gauge(path, fig, ids) {
    shape(path, fig, ['kind', 'title', 'axis', 'marks', 'zones'], ['range', 'zoom', 'curve', 'pins'])
    text(`${path}.title`, fig.title)
    label(`${path}.axis`, fig.axis)
    const marks = list(`${path}.marks`, fig.marks, { min: 1, max: 5 })
    uniqueIds(`${path}.marks`, marks, ids)
    const markIds = marks.map((m) => m?.id)
    const order = (id) => markIds.indexOf(id)
    let unit
    marks.forEach((m, i) => {
      const p = `${path}.marks[${i}]`
      if (!shape(p, m, ['id', 'label', 'value'], ['does', 'tone'])) return
      label(`${p}.label`, m.label)
      if (m.does !== undefined) tip(`${p}.does`, m.does)
      valueRef(`${p}.value`, m.value)
      if (isObj(m.value)) {
        if (unit === undefined) unit = m.value.unit
        else if (m.value.unit !== unit) fail(`${p}.value.unit`, 'figure range', `"${m.value.unit}" is not the first mark's unit "${unit}"; a gauge has one scale`)
      }
      if (m.tone !== undefined && m.tone !== 'fit' && m.tone !== 'error') fail(`${p}.tone`, 'shape', `"${m.tone}" is not fit or error`)
    })
    const zones = list(`${path}.zones`, fig.zones, { min: 1 })
    uniqueIds(`${path}.zones`, zones, ids)
    zones.forEach((z, i) => {
      const p = `${path}.zones[${i}]`
      if (!shape(p, z, ['id', 'label'], ['does', 'from', 'to', 'tone'])) return
      label(`${p}.label`, z.label)
      if (z.does !== undefined) tip(`${p}.does`, z.does)
      for (const end of ['from', 'to']) if (z[end] !== undefined && order(z[end]) < 0) fail(`${p}.${end}`, 'figure range', `"${z[end]}" is not a mark`)
      if (z.from !== undefined && z.to !== undefined && order(z.from) >= 0 && order(z.to) >= 0 && order(z.from) >= order(z.to)) {
        fail(p, 'figure range', `"${z.from}" is not below "${z.to}"; marks are listed bottom to top`)
      }
      if (z.tone !== undefined && z.tone !== 'fit' && z.tone !== 'error') fail(`${p}.tone`, 'shape', `"${z.tone}" is not fit or error`)
    })
    if (fig.range !== undefined && shape(`${path}.range`, fig.range, ['from', 'to'])) {
      if (!isNum(fig.range.from) || !isNum(fig.range.to) || fig.range.from >= fig.range.to) fail(`${path}.range`, 'figure range', 'must be { from, to } numbers with from below to')
    }
    if (fig.zoom !== undefined && shape(`${path}.zoom`, fig.zoom, ['label', 'full'], ['fullPerUnit'])) {
      label(`${path}.zoom.label`, fig.zoom.label)
      valueRef(`${path}.zoom.full`, fig.zoom.full)
      const per = fig.zoom.fullPerUnit
      if (per !== undefined && !(isNum(per) && per > 0)) fail(`${path}.zoom.fullPerUnit`, 'figure range', 'must be a number above 0')
      if (per === undefined && isObj(fig.zoom.full) && unit !== undefined && fig.zoom.full.unit !== unit) {
        fail(`${path}.zoom.full.unit`, 'figure range', `"${fig.zoom.full.unit}" is not the marks' unit "${unit}"; give fullPerUnit to convert`)
      }
    }
    if (fig.curve !== undefined && shape(`${path}.curve`, fig.curve, ['points'], ['events'])) {
      let lastT = -Infinity
      const top = marks.length + 1
      list(`${path}.curve.points`, fig.curve.points, { min: 2 }).forEach((pt, i) => {
        const p = `${path}.curve.points[${i}]`
        if (!Array.isArray(pt) || pt.length !== 2 || !inUnit(pt[0]) || !isNum(pt[1]) || pt[1] < 0 || pt[1] > top) {
          return fail(p, 'figure range', `must be [t, level], t 0..1 and level 0..${top} (0 the foot, k the k-th mark, ${top} the top)`)
        }
        if (pt[0] < lastT) fail(p, 'figure range', 'goes back in time')
        lastT = pt[0]
      })
      if (fig.curve.events !== undefined) {
        list(`${path}.curve.events`, fig.curve.events).forEach((e, i) => {
          const p = `${path}.curve.events[${i}]`
          if (!shape(p, e, ['at', 'label'], ['does', 'tone'])) return
          label(`${p}.label`, e.label)
          if (e.does !== undefined) tip(`${p}.does`, e.does)
          if (!inUnit(e.at)) fail(`${p}.at`, 'figure range', 'must be 0..1')
          if (e.tone !== undefined && e.tone !== 'fit' && e.tone !== 'error') fail(`${p}.tone`, 'shape', `"${e.tone}" is not fit or error`)
        })
      }
    }
    const pinKeys = []
    if (fig.pins !== undefined) {
      list(`${path}.pins`, fig.pins).forEach((pin, i) => {
        const p = `${path}.pins[${i}]`
        if (!isObj(pin)) return fail(p, 'shape', 'must be an object')
        const onMark = Object.hasOwn(pin, 'mark')
        if (!shape(p, pin, onMark ? ['key', 'mark'] : ['key', 'from', 'to'], ['value'])) return
        drawnKey(`${p}.key`, pin.key, pinKeys)
        for (const end of onMark ? ['mark'] : ['from', 'to']) if (order(pin[end]) < 0) fail(`${p}.${end}`, 'figure range', `"${pin[end]}" is not a mark`)
        if (!onMark && order(pin.from) >= 0 && order(pin.to) >= 0 && order(pin.from) >= order(pin.to)) fail(p, 'figure range', `"${pin.from}" is not below "${pin.to}"`)
        if (pin.value !== undefined) valueRef(`${p}.value`, pin.value)
      })
    }
    gauges.push({ path, marks: marks.filter(isObj) })
    drawnPins.push({ path, pinKeys })
  }

  // ── Chapters ──
  const pinned = new Map()
  function chapter(path, ch) {
    if (!isObj(ch)) return fail(path, 'shape', 'must be an object')
    citations = []
    shape(path, ch, ['id', 'title', ...TEMPLATE_PARTS])
    const order = Object.keys(ch).filter((k) => TEMPLATE_PARTS.includes(k))
    const expected = TEMPLATE_PARTS.filter((k) => order.includes(k))
    if (order.join() !== expected.join()) fail(path, 'template order', `parts are ${order.join(', ')}; the order is ${TEMPLATE_PARTS.join(', ')}`)
    text(`${path}.title`, ch.title)
    text(`${path}.oneLine`, ch.oneLine, { rich: true, budget: BUDGETS.oneLine })

    if (shape(`${path}.picture`, ch.picture, ['text', 'limit'])) {
      text(`${path}.picture.text`, ch.picture.text, { rich: true, budget: BUDGETS.pictureText })
      text(`${path}.picture.limit`, ch.picture.limit, { rich: true })
    }

    const ids = figure(`${path}.figure`, ch.figure)

    list(`${path}.body`, ch.body, { min: 1, max: BUDGETS.paragraphs }).forEach((para, i) =>
      text(`${path}.body[${i}]`, para, { rich: true, cite: true, budget: BUDGETS.paragraph }),
    )

    const here = new Set()
    list(`${path}.pins`, ch.pins, { min: 1 }).forEach((pin, i) => {
      const p = `${path}.pins[${i}]`
      if (!shape(p, pin, ['key', 'here'], ['layer'])) return
      if (!isDef(pin.key)) fail(`${p}.key`, 'def key', `"${pin.key}" is not a def key of this tuner`)
      else if (here.has(pin.key)) fail(`${p}.key`, 'pins', `"${pin.key}" is pinned twice in this chapter`)
      else {
        here.add(pin.key)
        pinned.set(pin.key, [...(pinned.get(pin.key) ?? []), p])
      }
      text(`${p}.here`, pin.here, { rich: true, budget: BUDGETS.pinHere })
      if (pin.layer !== undefined && !ids.has(pin.layer)) fail(`${p}.layer`, 'pins', `"${pin.layer}" is not an id in this chapter's figure`)
    })
    const drawn = drawnPins.find((g) => g.path === `${path}.figure`)
    for (const { key, path: at } of drawn?.pinKeys ?? []) {
      if (isDef(key) && !here.has(key)) fail(at, 'pins', `"${key}" is drawn on the figure but not pinned in this chapter`)
    }

    const questions = list(`${path}.choose`, ch.choose, { min: 1, max: BUDGETS.questions })
    questions.forEach((q, i) => {
      const p = `${path}.choose[${i}]`
      if (!shape(p, q, ['q', 'check', 'hint', 'yes'], ['no'])) return
      text(`${p}.q`, q.q)
      command(`${p}.check`, q.check)
      text(`${p}.hint`, q.hint, { rich: true })
      answer(`${p}.yes`, q.yes)
      if (q.no !== undefined) answer(`${p}.no`, q.no)
      else if (i === questions.length - 1) fail(`${p}.no`, 'shape', 'the last question needs a "no" answer: there is no next question')
    })

    if (shape(`${path}.symptoms`, ch.symptoms, ['low', 'high'])) {
      text(`${path}.symptoms.low`, ch.symptoms.low, { rich: true })
      text(`${path}.symptoms.high`, ch.symptoms.high, { rich: true })
    }

    if (shape(`${path}.look`, ch.look, ['cmd', 'for'])) {
      command(`${path}.look.cmd`, ch.look.cmd)
      text(`${path}.look.for`, ch.look.for, { rich: true })
    }

    const sources = isObj(ch.sources) ? ch.sources : {}
    if (!isObj(ch.sources)) fail(`${path}.sources`, 'shape', 'must be an object')
    else if (!Object.keys(sources).length) fail(`${path}.sources`, 'source', 'a chapter cites at least one source')
    for (const [id, src] of Object.entries(sources)) {
      const p = `${path}.sources.${id}`
      if (!KEBAB.test(id)) fail(p, 'unique id', `"${id}" is not kebab case`)
      if (!shape(p, src, ['url', 'label'])) continue
      const why = sourceUrlIssue(src.url)
      if (why) fail(`${p}.url`, 'source', why)
      text(`${p}.label`, src.label)
    }
    for (const { path: at, id } of citations) {
      usedFootnotes.add(id)
      if (!Object.hasOwn(sources, id)) fail(at, 'footnote', `[^${id}] has no entry in this chapter's sources`)
    }
    const cited = new Set(citations.map((c) => c.id))
    for (const id of Object.keys(sources)) if (!cited.has(id)) fail(`${path}.sources.${id}`, 'source', `"${id}" is never cited`)
  }

  // ── Guide ──
  if (!shape('guide', guide, ['slug', 'title', 'lead', 'minutes', 'parts', 'chapters'])) return issues
  if (typeof guide.slug !== 'string' || !KEBAB.test(guide.slug)) fail('slug', 'shape', `"${guide.slug}" is not kebab case`)
  text('title', guide.title)
  text('lead', guide.lead, { rich: true, sentenceMax: BUDGETS.leadSentences })
  if (!isInt(guide.minutes, 1)) fail('minutes', 'shape', 'must be a whole number from 1')
  partsMap('parts', guide.parts)
  const chapters = list('chapters', guide.chapters, { min: 1 })
  uniqueIds('chapters', chapters)
  chapters.forEach((ch, i) => chapter(`chapters[${i}]`, ch))

  for (const key of Object.keys(defsByKey)) {
    const at = pinned.get(key) ?? []
    if (at.length === 0) fail('chapters', 'pins', `"${key}" is pinned in no chapter; every def key is pinned in exactly one`)
    if (at.length > 1) fail(at[1], 'pins', `"${key}" is already pinned at ${at[0]}; every def key is pinned in exactly one chapter`)
  }

  // Evidence: a live page shows a number for every reference, on every image.
  if (status === 'live') {
    for (const { id: image } of IMAGES_ORDER) {
      const file = Object.hasOwn(evidence, image) ? evidence[image] : undefined
      if (!file) {
        fail('guide', 'evidence', `no evidence file for ${image}; a live guide needs every image captured`)
        continue
      }
      for (const { path, id, refPath, scalar } of probeRefs) {
        const entry = isObj(file.probes) && Object.hasOwn(file.probes, id) ? file.probes[id] : undefined
        if (!entry || (entry.status !== 'ok' && entry.status !== 'absent')) fail(path, 'evidence', `"${id}" has no ok or absent entry for ${image}`)
        else if (entry.status === 'ok' && refPath !== undefined && resolvePath(entry.value, refPath) === undefined) fail(path, 'evidence', `"${id}" on ${image} has nothing at "${refPath}"`)
        else if (entry.status === 'ok' && scalar && isObj(entry.value)) fail(path, 'evidence', `"${id}" on ${image} is an object; name the field with path (and its unit)`)
      }
      // A gauge lists its marks bottom to top; the captures must agree.
      for (const { path, marks } of gauges) {
        const values = marks.map((m) => {
          const entry = isObj(file.probes) && isObj(m.value) && Object.hasOwn(file.probes, m.value.probe) ? file.probes[m.value.probe] : undefined
          return entry?.status === 'ok' ? (m.value.path ? resolvePath(entry.value, m.value.path) : entry.value) : undefined
        })
        if (values.every(isNum) && values.some((v, i) => i > 0 && v < values[i - 1])) {
          fail(`${path}.marks`, 'figure range', `on ${image} the marks are not in order bottom to top (${values.join(', ')})`)
        }
      }
    }
  } else if (status !== 'draft') fail('guide', 'shape', `status "${status}" is not draft or live`)

  // No em dash anywhere, ids and commands included.
  ;(function sweep(value, path) {
    if (typeof value === 'string') {
      if (value.includes(EM_DASH)) fail(path, 'em dash', 'use a comma, colon or parentheses instead')
    } else if (Array.isArray(value)) value.forEach((v, i) => sweep(v, `${path}[${i}]`))
    else if (isObj(value)) {
      for (const [k, v] of Object.entries(value)) {
        if (k.includes(EM_DASH)) fail(`${path}.${k}`, 'em dash', 'in a field name')
        sweep(v, path ? `${path}.${k}` : k)
      }
    }
  })(guide, '')

  return issues
}
