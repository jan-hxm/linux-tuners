/**
 * The probe kinds behind the learning pages' evidence (Design.md "Learning
 * pages > Evidence"). A guide's `src/tuners/<id>/probes.js` names what to
 * measure as plain data; this file is the closed set of ways to measure it.
 * Each kind has:
 *
 *  - `check(probe)`: the probe's fields, held to strict patterns. A probe
 *    that fails it is never run.
 *  - `command(probe)`: a fixed shell template with the probe's one field
 *    passed through quote(). Nothing from evidence, guide text or the guest
 *    reaches a command.
 *  - `parse({ code, stdout, stderr }, probe)`: the value, made of numbers,
 *    strings, booleans, arrays and plain objects only. It throws Absent when
 *    the thing measured isn't there or the command failed, which the
 *    evidence records as `{ status: 'absent', reason }` rather than a guess.
 *  - `compare`: how the freshness check in vm/suite.mjs holds a later run
 *    to the evidence. 'exact' wants the same value. 'present' wants the same
 *    status and the same shape (object keys, array items, value type),
 *    for values the suite's own writes change before the check runs.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { quote } from './vm.mjs'

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)))
export const TUNERS_DIR = join(ROOT, 'src', 'tuners')
export const EVIDENCE_DIR = join(ROOT, 'src', 'learn', 'evidence')

/**
 * The guest every capture and freshness check runs on: the suite's VM, with
 * its memory and extra disks (`vm.start` in vm/suite.mjs; a unit test
 * checks the two agree).
 */
export const GUEST = {
  memory: 3072,
  disks: ['nvme,serial=lt0001', 'ide-hd,bus=ide.1,rotation_rate=1', 'ide-hd,bus=ide.2,rotation_rate=7200'],
}

/** Thrown by a parser: the thing measured is not there. */
export class Absent extends Error {}

const SYSCTL_NAME = /^[a-z0-9_]+(\.[a-z0-9_-]+)+$/
const PROC_SYS_PATH = /^\/(proc|sys)(\/[A-Za-z0-9_.:-]+)+$/
const SYS_PATH = /^\/sys(\/[A-Za-z0-9_.:-]+)+$/
const THREAD_NAME = /^[A-Za-z0-9_.:/-]{1,15}$/
const VMSTAT_PREFIX = /^[a-z][a-z0-9_]*$/
const MEMINFO_KEY = /^[A-Za-z][A-Za-z0-9_()]*$/
const MAX_STRING = 512

const lines = (s) => s.split('\n').map((l) => l.trimEnd())

/** Printable ASCII only, one line, capped: evidence text renders as text. */
export function clean(s, max = MAX_STRING) {
  return String(s).replace(/\s+/g, ' ').replace(/[^\x20-\x7e]/g, '').trim().slice(0, max)
}

/** A whole number that fits a double exactly becomes a number; anything else stays a string. */
function scalar(s) {
  const v = clean(s)
  return /^-?\d+$/.test(v) && Number.isSafeInteger(Number(v)) ? Number(v) : v
}

/** The reason a command failed: the first line of its stderr, or its exit code. */
function failure({ code, stderr }) {
  const first = clean(String(stderr ?? '').split('\n').find((l) => l.trim()) ?? '', 160)
  return first || `exit ${code}`
}

/**
 * The output of a command that succeeded. The exit code decides, not stderr:
 * sudo can warn there on a good read, and procps' sysctl exits non-zero for
 * a key it can't read on every image (vm.sysctls in vm/lib/vm.mjs relies on it too).
 */
function requireOk(r) {
  if (r.code !== 0) throw new Absent(failure(r))
  return r.stdout
}

const fields = (probe, allowed) => {
  const extra = Object.keys(probe).filter((k) => !allowed.includes(k))
  return extra.length ? [`unknown field ${extra.join(', ')}`] : []
}

/** `key value` lines (/proc/vmstat), or `Key: value kB` lines (/proc/meminfo). */
function keyValues(stdout, sep) {
  const out = new Map()
  for (const l of lines(stdout)) {
    const m = sep === ':' ? l.match(/^([A-Za-z][A-Za-z0-9_()]*):\s+(\d+)(\s+kB)?$/) : l.match(/^([a-z][a-z0-9_]*)\s+(-?\d+)$/)
    if (m) out.set(m[1], Number(m[2]))
  }
  return out
}

/**
 * /proc/zoneinfo as `{ <zone>: { min, low, high } }` in pages, the
 * watermarks the zone reports (`min_wmark_pages` and so on, boost included).
 * Node 0's zones are keyed by name ("Normal"), other nodes' as
 * "node1-Normal". Works on the 4.15 layout and on later ones that add
 * `boost` (5.16), `cma` and `promo` (6.12): only `min`, `low` and `high`
 * between a zone's "pages free" line and its "protection:" line count, so
 * the per-cpu `high:` lines of `pagesets` never do. A zone missing one of
 * the three is left out.
 */
export function parseZoneinfo(text) {
  const zones = {}
  let zone = null
  let inMarks = false
  for (const l of lines(text)) {
    const head = l.match(/^Node\s+(\d+),\s+(.*)$/)
    if (head) {
      const z = head[2].match(/^zone\s+(\S+)$/)
      zone = z ? { key: head[1] === '0' ? z[1] : `node${head[1]}-${z[1]}`, marks: {} } : null
      if (zone) zones[zone.key] = zone.marks
      inMarks = false
      continue
    }
    if (!zone) continue
    if (/^\s+pages free\s+\d+$/.test(l)) { inMarks = true; continue }
    if (/^\s+protection:/.test(l) || /^\s+pagesets$/.test(l)) { inMarks = false; continue }
    const m = inMarks && l.match(/^\s+(min|low|high)\s+(\d+)$/)
    if (m) zone.marks[m[1]] = Number(m[2])
  }
  const out = {}
  for (const [k, v] of Object.entries(zones)) {
    if (['min', 'low', 'high'].every((f) => Number.isSafeInteger(v[f]))) out[k] = { min: v.min, low: v.low, high: v.high }
  }
  return out
}

export const KINDS = {
  /** `{ kind: 'sysctl', name: 'vm.min_free_kbytes' }`: the value, a number when it is one whole number. Read as root (fs.protected_* are 0600 on older kernels). */
  sysctl: {
    compare: 'present',
    check: (p) => [...fields(p, ['kind', 'name']), ...(SYSCTL_NAME.test(p.name ?? '') ? [] : ['name must be a dotted sysctl key'])],
    command: (p) => `sudo sysctl -n ${quote(p.name)}`,
    parse: (r) => {
      const out = requireOk(r)
      if (!out.trim()) throw new Absent('empty value')
      return scalar(out)
    },
  },

  /** `{ kind: 'file', path: '/proc/swaps', exists: true }`: true when the file exists; absent when it doesn't. */
  file: {
    compare: 'exact',
    check: (p) => [
      ...fields(p, ['kind', 'path', 'exists']),
      ...(PROC_SYS_PATH.test(p.path ?? '') && !p.path.includes('..') ? [] : ['path must be a /proc or /sys path']),
      ...(p.exists === true ? [] : ['exists must be true']),
    ],
    command: (p) => `if sudo test -e ${quote(p.path)}; then echo present; else echo missing; fi`,
    parse: (r, p) => {
      const out = requireOk(r).trim()
      if (out === 'present') return true
      if (out === 'missing') throw new Absent(`no ${p.path}`)
      throw new Absent('unexpected output')
    },
  },

  /** `{ kind: 'sysfs', path: '/sys/kernel/mm/transparent_hugepage/enabled' }`: the file's value; a choice such as "always [madvise] never" reads as the bracketed one. */
  sysfs: {
    compare: 'present',
    check: (p) => [...fields(p, ['kind', 'path']), ...(SYS_PATH.test(p.path ?? '') && !p.path.includes('..') ? [] : ['path must be a /sys path'])],
    command: (p) => `sudo cat ${quote(p.path)}`,
    parse: (r) => {
      const out = clean(requireOk(r))
      if (!out) throw new Absent('empty file')
      return scalar(out.match(/\[([^\]]+)\]/)?.[1] ?? out)
    },
  },

  /** `{ kind: 'thread', name: 'kswapd0' }`: whether a process or kernel thread of that name runs. */
  thread: {
    compare: 'exact',
    check: (p) => [...fields(p, ['kind', 'name']), ...(THREAD_NAME.test(p.name ?? '') ? [] : ['name must be a process name of up to 15 characters'])],
    command: () => 'ps -e -o comm=',
    parse: (r, p) => lines(requireOk(r)).some((l) => l.trim() === p.name),
  },

  /** `{ kind: 'zoneinfo' }`: `{ <zone>: { min, low, high } }` in pages (parseZoneinfo). */
  zoneinfo: {
    compare: 'present',
    check: (p) => fields(p, ['kind']),
    command: () => 'cat /proc/zoneinfo',
    parse: (r) => {
      const zones = parseZoneinfo(requireOk(r))
      if (!Object.keys(zones).length) throw new Absent('no zone watermarks in /proc/zoneinfo')
      return zones
    },
  },

  /**
   * `{ kind: 'vmstatKeys', prefix: 'allocstall' }`: the /proc/vmstat keys
   * named `<prefix>` or `<prefix>_*`, sorted: `['allocstall']` before 4.8,
   * `['allocstall_dma', 'allocstall_dma32', 'allocstall_movable',
   * 'allocstall_normal']` after. The counts aren't kept; they change by the second.
   */
  vmstatKeys: {
    compare: 'exact',
    check: (p) => [...fields(p, ['kind', 'prefix']), ...(VMSTAT_PREFIX.test(p.prefix ?? '') ? [] : ['prefix must be a vmstat key prefix'])],
    command: () => 'cat /proc/vmstat',
    parse: (r, p) => {
      const keys = [...keyValues(requireOk(r), ' ').keys()].filter((k) => k === p.prefix || k.startsWith(`${p.prefix}_`)).sort()
      if (!keys.length) throw new Absent(`no ${p.prefix} keys in /proc/vmstat`)
      return keys
    },
  },

  /**
   * `{ kind: 'meminfoKeys', keys: ['MemTotal', 'SwapTotal'] }`: `{ <key>:
   * <number> }` for each key /proc/meminfo has, as printed (kB for most,
   * a count for HugePages_*). A key it lacks is left out; none at all is absent.
   */
  meminfoKeys: {
    compare: 'present',
    check: (p) => [
      ...fields(p, ['kind', 'keys']),
      ...(Array.isArray(p.keys) && p.keys.length && p.keys.every((k) => typeof k === 'string' && MEMINFO_KEY.test(k)) ? [] : ['keys must be meminfo field names']),
    ],
    command: () => 'cat /proc/meminfo',
    parse: (r, p) => {
      const all = keyValues(requireOk(r), ':')
      const out = Object.fromEntries(p.keys.filter((k) => all.has(k)).map((k) => [k, all.get(k)]))
      if (!Object.keys(out).length) throw new Absent('none of the keys in /proc/meminfo')
      return out
    },
  },
}

const PROBE_ID = /^([a-z0-9-]+)\.[A-Za-z0-9]+$/

/** Problems with one probe, before anything runs. `tuner` is its folder name. */
export function checkProbe(id, probe, tuner) {
  const m = id.match(PROBE_ID)
  if (!m) return [`${id}: id must be <tuner>.<camelCase>`]
  if (tuner && m[1] !== tuner) return [`${id}: id must start with "${tuner}."`]
  if (!probe || typeof probe !== 'object' || Array.isArray(probe)) return [`${id}: not an object`]
  if (!Object.hasOwn(KINDS, probe.kind)) return [`${id}: unknown kind "${probe.kind}"`]
  return KINDS[probe.kind].check(probe).map((e) => `${id}: ${e}`)
}

/**
 * Every probe from every src/tuners/<id>/probes.js, keyed by probe id.
 * Throws on a malformed probe or a duplicate id, so nothing half-checked runs.
 */
export async function loadProbes(dir = TUNERS_DIR) {
  const out = {}
  const problems = []
  for (const tuner of readdirSync(dir).sort()) {
    const file = join(dir, tuner, 'probes.js')
    if (!existsSync(file)) continue
    const { PROBES } = await import(pathToFileURL(file).href)
    for (const [id, probe] of Object.entries(PROBES ?? {})) {
      if (Object.hasOwn(out, id)) problems.push(`${id}: defined twice`)
      problems.push(...checkProbe(id, probe, tuner))
      out[id] = probe
    }
  }
  if (problems.length) throw new Error(`Bad probes:\n${problems.join('\n')}`)
  return out
}

/** One probe's evidence entry from a command result. */
export function evidenceEntry(probe, result) {
  try {
    return { status: 'ok', value: KINDS[probe.kind].parse(result, probe) }
  } catch (e) {
    if (e instanceof Absent) return { status: 'absent', reason: clean(e.message, 160) }
    throw e
  }
}

/**
 * Run every probe in the guest. `vm` has the VM class's `run`; commands that
 * several probes share run once.
 * @returns {Promise<Record<string, {status:'ok', value:any}|{status:'absent', reason:string}>>}
 */
export async function runProbes(vm, probes) {
  const results = new Map()
  const out = {}
  for (const id of Object.keys(probes).sort()) {
    const probe = probes[id]
    const problems = checkProbe(id, probe)
    if (problems.length) throw new Error(problems.join('\n'))
    const cmd = KINDS[probe.kind].command(probe)
    if (!results.has(cmd)) results.set(cmd, await vm.run(cmd, { check: false }))
    out[id] = evidenceEntry(probe, results.get(cmd))
  }
  return out
}

/** Only numbers, strings, booleans, arrays and plain objects, with object keys sorted. */
export function sortedEvidence(v, path = '$') {
  if (typeof v === 'string') return v
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error(`${path}: not a finite number`)
    return v
  }
  if (Array.isArray(v)) return v.map((x, i) => sortedEvidence(x, `${path}[${i}]`))
  if (v && Object.getPrototypeOf(v) === Object.prototype) {
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortedEvidence(v[k], `${path}.${k}`)]))
  }
  throw new Error(`${path}: not evidence data`)
}

/** The evidence file for one image, as `npm run vm:capture` writes it. */
export function evidenceFile({ image, kernel, capturedAt, probes }) {
  const doc = sortedEvidence({ image, kernel: clean(kernel, 128), capturedAt, guestMemoryMiB: GUEST.memory, probes })
  return `${JSON.stringify(doc, null, 2)}\n`
}

export const evidencePath = (image) => join(EVIDENCE_DIR, `${image}.json`)

/** The committed evidence for an image, or null when there is none. */
export function readEvidence(image, dir = EVIDENCE_DIR) {
  const file = join(dir, `${image}.json`)
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null
}

/** What 'present' holds equal: object keys, array items, or the value's type. */
function shape(v) {
  if (Array.isArray(v)) return v
  if (v && typeof v === 'object') return Object.keys(v).sort()
  return typeof v
}

/** Why a fresh entry doesn't match the recorded one, or null when it does. */
export function staleReason(probe, recorded, fresh) {
  if (!recorded) return 'missing from the evidence'
  if (recorded.status !== fresh.status) {
    return `was ${recorded.status}${recorded.reason ? ` (${recorded.reason})` : ''}, now ${fresh.status}${fresh.reason ? ` (${fresh.reason})` : ''}`
  }
  if (fresh.status !== 'ok') return null
  const [a, b] = KINDS[probe.kind].compare === 'exact' ? [recorded.value, fresh.value] : [shape(recorded.value), shape(fresh.value)]
  const ja = JSON.stringify(sortedEvidence(a))
  const jb = JSON.stringify(sortedEvidence(b))
  return ja === jb ? null : `was ${ja}, now ${jb}`
}

/** `<probe id>: <reason>` for every probe whose evidence is stale. */
export function staleProbes(probes, recorded, fresh) {
  return Object.keys(probes).sort()
    .map((id) => [id, staleReason(probes[id], recorded?.[id], fresh[id])])
    .filter(([, why]) => why)
    .map(([id, why]) => `${id}: ${why}`)
}
