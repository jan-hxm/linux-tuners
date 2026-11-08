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
 * @typedef {{ probe: string, path?: string, unit: string }} ValueRef
 *   A number in a figure: the probe id in the tuner's probes.js, a dotted path
 *   into the probe's captured value, and the unit it is shown in.
 *
 * @typedef {{ id: string, title: string, does: string, col: number, row: number, tone?: 'fit', probe?: string }} PartsCard
 * @typedef {{ picture: string, cards: PartsCard[], bands?: { label: string, rows: [number, number] }[],
 *   edges: { from: string, to: string, label: string }[] }} PartsMap
 *   The "Start here" diagram. Edges join cards that share a row or a column.
 *
 * @typedef {{ id: string, label: string, kind: 'bands'|'nodes',
 *   bands?: { id: string, text: string }[], nodes?: { id: string, text: string, sub?: string, probe?: string }[],
 *   values?: ValueRef[] }} StackLayer
 * @typedef {{ kind: 'stack', title: string, layers: StackLayer[] }
 *   | { kind: 'timeline', title: string, schematic: true, lines: { id: string, label: string, value: ValueRef }[],
 *       curve: [number, number][], events: { at: number, label: string, tone?: 'fit'|'error' }[] }
 *   | { kind: 'sideBySide', title: string,
 *       states: { label: string, cells: number, lit: number, setting: { key: string, value: number|string } }[],
 *       backedBy: { vmTest: string } | { probe: string } }} Figure
 *
 * @typedef {{ key: string, dir: 'raise'|'lower' } | { leave: true, why: string }} Answer
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

export const FIGURE_KINDS = Object.freeze(['stack', 'timeline', 'sideBySide'])

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

  function command(path, value) {
    for (const why of commandIssues(value)) fail(path, 'command', why)
  }

  /** A probe id named by a figure; live guides need it measured on every image. */
  const probeRefs = []
  function probe(path, id, refPath) {
    if (!isProbe(id)) fail(path, 'probe', `"${id}" is not in the tuner's probes.js`)
    else probeRefs.push({ path, id, refPath })
  }

  function valueRef(path, ref) {
    if (!shape(path, ref, ['probe', 'unit'], ['path'])) return
    if (ref.path !== undefined && (typeof ref.path !== 'string' || !PATH.test(ref.path))) fail(`${path}.path`, 'shape', `"${ref.path}" is not a dotted path`)
    text(`${path}.unit`, ref.unit)
    probe(`${path}.probe`, ref.probe, ref.path)
  }

  function answer(path, a) {
    if (!isObj(a)) return fail(path, 'shape', 'must be an object')
    if (Object.hasOwn(a, 'leave')) {
      shape(path, a, ['leave', 'why'])
      if (a.leave !== true) fail(`${path}.leave`, 'shape', 'must be true')
      text(`${path}.why`, a.why, { rich: true })
    } else {
      shape(path, a, ['key', 'dir'])
      if (!isDef(a.key)) fail(`${path}.key`, 'def key', `"${a.key}" is not a def key of this tuner`)
      if (a.dir !== 'raise' && a.dir !== 'lower') fail(`${path}.dir`, 'shape', `"${a.dir}" is not raise or lower`)
    }
  }

  // ── Parts map ──
  function partsMap(path, parts) {
    if (!shape(path, parts, ['picture', 'cards', 'edges'], ['bands'])) return
    text(`${path}.picture`, parts.picture, { rich: true })
    const cards = list(`${path}.cards`, parts.cards, { min: 1 })
    uniqueIds(`${path}.cards`, cards)
    const byId = new Map()
    const cells = new Set()
    cards.forEach((c, i) => {
      const p = `${path}.cards[${i}]`
      if (!shape(p, c, ['id', 'title', 'does', 'col', 'row'], ['tone', 'probe'])) return
      text(`${p}.title`, c.title)
      text(`${p}.does`, c.does)
      if (!isInt(c.col, 1)) fail(`${p}.col`, 'figure range', 'must be a whole number from 1')
      if (!isInt(c.row, 1)) fail(`${p}.row`, 'figure range', 'must be a whole number from 1')
      const cell = `${c.col},${c.row}`
      if (cells.has(cell)) fail(p, 'figure range', `shares column ${c.col}, row ${c.row} with another card`)
      cells.add(cell)
      if (c.tone !== undefined && c.tone !== 'fit') fail(`${p}.tone`, 'shape', `"${c.tone}" is not fit`)
      if (c.probe !== undefined) probe(`${p}.probe`, c.probe)
      byId.set(c.id, c)
    })
    const rows = cards.map((c) => c?.row).filter((r) => isInt(r, 1))
    if (parts.bands !== undefined) {
      list(`${path}.bands`, parts.bands).forEach((b, i) => {
        const p = `${path}.bands[${i}]`
        if (!shape(p, b, ['label', 'rows'])) return
        text(`${p}.label`, b.label)
        const [from, to] = Array.isArray(b.rows) ? b.rows : []
        if (!Array.isArray(b.rows) || b.rows.length !== 2 || !isInt(from, 1) || !isInt(to, from)) fail(`${p}.rows`, 'figure range', 'must be [from, to] rows with from <= to')
        else if (to > Math.max(...rows)) fail(`${p}.rows`, 'figure range', `row ${to} has no card`)
      })
    }
    list(`${path}.edges`, parts.edges).forEach((e, i) => {
      const p = `${path}.edges[${i}]`
      if (!shape(p, e, ['from', 'to', 'label'])) return
      text(`${p}.label`, e.label)
      const a = byId.get(e.from)
      const b = byId.get(e.to)
      if (!a) fail(`${p}.from`, 'figure range', `"${e.from}" is not a card`)
      if (!b) fail(`${p}.to`, 'figure range', `"${e.to}" is not a card`)
      if (a && b) {
        if (a === b) fail(p, 'figure range', 'joins a card to itself')
        else if (a.row !== b.row && a.col !== b.col) fail(p, 'figure range', `"${e.from}" and "${e.to}" share neither a row nor a column`)
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
        text(`${p}.label`, l.label)
        if (l.kind === 'bands') {
          if (l.nodes !== undefined) fail(`${p}.nodes`, 'shape', 'a bands layer has no nodes')
          const bands = list(`${p}.bands`, l.bands, { min: 1 })
          uniqueIds(`${p}.bands`, bands, ids)
          bands.forEach((b, j) => shape(`${p}.bands[${j}]`, b, ['id', 'text']) && text(`${p}.bands[${j}].text`, b.text))
        } else if (l.kind === 'nodes') {
          if (l.bands !== undefined) fail(`${p}.bands`, 'shape', 'a nodes layer has no bands')
          const nodes = list(`${p}.nodes`, l.nodes, { min: 1 })
          uniqueIds(`${p}.nodes`, nodes, ids)
          nodes.forEach((n, j) => {
            const q = `${p}.nodes[${j}]`
            if (!shape(q, n, ['id', 'text'], ['sub', 'probe'])) return
            text(`${q}.text`, n.text)
            if (n.sub !== undefined) text(`${q}.sub`, n.sub)
            if (n.probe !== undefined) probe(`${q}.probe`, n.probe)
          })
        } else fail(`${p}.kind`, 'shape', `"${l.kind}" is not bands or nodes`)
        if (l.values !== undefined) list(`${p}.values`, l.values).forEach((v, j) => valueRef(`${p}.values[${j}]`, v))
      })
    } else if (fig.kind === 'timeline') {
      shape(path, fig, ['kind', 'title', 'schematic', 'lines', 'curve', 'events'])
      text(`${path}.title`, fig.title)
      if (fig.schematic !== true) fail(`${path}.schematic`, 'shape', 'must be true: the curve is a shape, not a measurement')
      const lines = list(`${path}.lines`, fig.lines, { min: 1 })
      uniqueIds(`${path}.lines`, lines, ids)
      lines.forEach((l, i) => {
        const p = `${path}.lines[${i}]`
        if (!shape(p, l, ['id', 'label', 'value'])) return
        text(`${p}.label`, l.label)
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
        if (!shape(p, e, ['at', 'label'], ['tone'])) return
        text(`${p}.label`, e.label)
        if (!inUnit(e.at)) fail(`${p}.at`, 'figure range', 'must be 0..1')
        if (e.tone !== undefined && e.tone !== 'fit' && e.tone !== 'error') fail(`${p}.tone`, 'shape', `"${e.tone}" is not fit or error`)
      })
    } else {
      shape(path, fig, ['kind', 'title', 'states', 'backedBy'])
      text(`${path}.title`, fig.title)
      list(`${path}.states`, fig.states, { min: 2 }).forEach((s, i) => {
        const p = `${path}.states[${i}]`
        if (!shape(p, s, ['label', 'cells', 'lit', 'setting'])) return
        text(`${p}.label`, s.label)
        if (!isInt(s.cells, 1)) fail(`${p}.cells`, 'figure range', 'must be a whole number from 1')
        if (!isInt(s.lit, 0) || (isInt(s.cells, 1) && s.lit > s.cells)) fail(`${p}.lit`, 'figure range', 'must be a whole number from 0 to cells')
        if (shape(`${p}.setting`, s.setting, ['key', 'value'])) {
          if (!isDef(s.setting.key)) fail(`${p}.setting.key`, 'def key', `"${s.setting.key}" is not a def key of this tuner`)
          const v = s.setting.value
          if (!(typeof v === 'number' && Number.isFinite(v)) && !isStr(v)) fail(`${p}.setting.value`, 'shape', 'must be a number or a string')
          else if (typeof v === 'string') text(`${p}.setting.value`, v)
        }
      })
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
      for (const { path, id, refPath } of probeRefs) {
        const entry = isObj(file.probes) && Object.hasOwn(file.probes, id) ? file.probes[id] : undefined
        if (!entry || (entry.status !== 'ok' && entry.status !== 'absent')) fail(path, 'evidence', `"${id}" has no ok or absent entry for ${image}`)
        else if (entry.status === 'ok' && refPath !== undefined && resolvePath(entry.value, refPath) === undefined) fail(path, 'evidence', `"${id}" on ${image} has nothing at "${refPath}"`)
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
