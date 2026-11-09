/**
 * The committed VM captures behind every number in a guide's figures, one
 * JSON file per image in src/learn/evidence/ (written by `npm run vm:capture`).
 * Design.md §5 "Learning pages > Guide data and checks" and "> Evidence".
 *
 * The files are bundled through Vite's import.meta.glob, so this module runs
 * under Vite (the app, the tests, the postbuild's ssrLoadModule), not plain
 * Node. Values are data and the page renders them as text, never as markup.
 *
 * @typedef {number | string | boolean | EvidenceValue[] | { [k: string]: EvidenceValue }} EvidenceValue
 * @typedef {{ status: 'ok', value: EvidenceValue } | { status: 'absent', reason: string }} EvidenceEntry
 * @typedef {{ image: string, kernel: string, capturedAt: string, guestMemoryMiB: number,
 *   probes: Record<string, EvidenceEntry> }} EvidenceFile
 * @typedef {{ status: 'ok', value: EvidenceValue, kernel: string, capturedAt: string }
 *   | { status: 'absent', value: undefined, reason: string, kernel: string, capturedAt: string }
 *   | { status: 'missing' }} Measured
 */

/**
 * The five VM images in vm/lib/images.mjs order, with the label the kernel
 * switcher shows. Plain data, since the VM harness isn't part of the bundle;
 * contract.test.js checks it against images.mjs.
 */
export const IMAGES_ORDER = Object.freeze([
  Object.freeze({ id: 'debian-13', label: 'Debian 13' }),
  Object.freeze({ id: 'ubuntu-24.04', label: 'Ubuntu 24.04' }),
  Object.freeze({ id: 'fedora-43', label: 'Fedora 43' }),
  Object.freeze({ id: 'debian-11', label: 'Debian 11' }),
  Object.freeze({ id: 'ubuntu-18.04', label: 'Ubuntu 18.04' }),
])

/** The memory every capture runs with (the VM suite's usual guest). */
export const GUEST_MEMORY_MIB = 3072

const COMMITTED = import.meta.glob('./evidence/*.json', { eager: true, import: 'default' })

const MISSING = Object.freeze({ status: 'missing' })

/**
 * Evidence files keyed by image id, in IMAGES_ORDER (unknown images last).
 * Without an argument, the committed captures; tests pass their own
 * `import.meta.glob(..., { eager: true, import: 'default' })` result.
 * @param {Record<string, EvidenceFile>} [modules]  glob result, keyed by file path
 * @returns {Readonly<Record<string, EvidenceFile>>}
 */
export function loadEvidence(modules = COMMITTED) {
  const byImage = Object.fromEntries(Object.entries(modules).map(([file, data]) => [file.split('/').pop().replace(/\.json$/, ''), data]))
  const known = IMAGES_ORDER.map((i) => i.id).filter((id) => Object.hasOwn(byImage, id))
  const rest = Object.keys(byImage).filter((id) => !known.includes(id)).sort()
  return Object.freeze(Object.fromEntries([...known, ...rest].map((id) => [id, byImage[id]])))
}

const INDEX = /^\d+$/
const NUMBER = /^-?\d+(\.\d+)?$/

/**
 * The value at a dotted path, through own properties only; undefined when
 * any step is missing. No path returns the value itself. A numeric step on a
 * string picks one of its whitespace-separated words, counted from 0, as a
 * number when it is one: `'2'` on "4096 131072 6291456" gives 6291456.
 * @param {EvidenceValue} value
 * @param {string} [path]
 */
export function resolvePath(value, path) {
  if (path === undefined || path === '') return value
  let at = value
  for (const step of path.split('.')) {
    if (typeof at === 'string' && INDEX.test(step)) {
      const words = at.trim().split(/\s+/).filter(Boolean)
      const i = Number(step)
      if (i >= words.length) return undefined
      at = NUMBER.test(words[i]) ? Number(words[i]) : words[i]
      continue
    }
    if (at === null || typeof at !== 'object' || !Object.hasOwn(at, step)) return undefined
    at = at[step]
  }
  return at
}

/**
 * What one image measured for a figure's reference.
 * @param {{ probe: string, path?: string }} ref  a ValueRef, or `{ probe }` for a node or card
 * @param {string} imageId
 * @param {Record<string, EvidenceFile>} [evidence]  defaults to the committed captures
 * @returns {Measured}
 */
export function valueFor(ref, imageId, evidence = loadEvidence()) {
  if (!ref || typeof ref.probe !== 'string' || !Object.hasOwn(evidence, imageId)) return MISSING
  const file = evidence[imageId]
  const probes = file?.probes
  if (!probes || typeof probes !== 'object' || !Object.hasOwn(probes, ref.probe)) return MISSING
  const entry = probes[ref.probe]
  const { kernel, capturedAt } = file
  if (entry?.status === 'absent') return { status: 'absent', value: undefined, reason: entry.reason, kernel, capturedAt }
  if (entry?.status !== 'ok') return MISSING
  const value = resolvePath(entry.value, ref.path)
  return value === undefined ? MISSING : { status: 'ok', value, kernel, capturedAt }
}

const EM_DASH = '—'
const ch = (...codes) => String.fromCharCode(...codes)
// Control characters (C0 and DEL) and the Unicode line and paragraph separators.
const CONTROL = new RegExp(`[${ch(0)}-${ch(0x1f)}${ch(0x7f, 0x2028, 0x2029)}]`)
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/
const PROBE_ID = /^[a-z0-9-]+\.[A-Za-z0-9]+$/

/**
 * Why an evidence file doesn't have the frozen shape, as `{ path, message }`
 * issues like validateGuide's. Leaves are numbers, strings or booleans.
 * @param {unknown} file
 * @param {string} imageId  the file's name without .json
 */
export function validateEvidence(file, imageId) {
  const issues = []
  const fail = (path, detail) => issues.push({ path, rule: 'evidence', message: `evidence: ${detail}` })
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
  if (!isObj(file)) {
    fail(imageId, 'must be an object')
    return issues
  }
  const allowed = ['image', 'kernel', 'capturedAt', 'guestMemoryMiB', 'probes']
  for (const k of Object.keys(file)) if (!allowed.includes(k)) fail(`${imageId}.${k}`, 'unknown field')
  if (file.image !== imageId) fail(`${imageId}.image`, `"${file.image}" does not match the file name`)
  if (!IMAGES_ORDER.some((i) => i.id === imageId)) fail(imageId, 'is not an image in vm/lib/images.mjs')
  if (typeof file.kernel !== 'string' || !/^[A-Za-z0-9._+~-]+$/.test(file.kernel)) fail(`${imageId}.kernel`, 'must be a kernel release string')
  if (typeof file.capturedAt !== 'string' || !ISO.test(file.capturedAt)) fail(`${imageId}.capturedAt`, 'must be an ISO time in UTC')
  if (file.guestMemoryMiB !== GUEST_MEMORY_MIB) fail(`${imageId}.guestMemoryMiB`, `must be ${GUEST_MEMORY_MIB}`)
  if (!isObj(file.probes)) {
    fail(`${imageId}.probes`, 'must be an object')
    return issues
  }
  const leaf = (v, path, depth) => {
    if (depth > 6) return fail(path, 'nests too deep')
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) fail(path, 'is not a finite number')
    } else if (typeof v === 'string') {
      if (CONTROL.test(v) || v.includes(EM_DASH) || v.length > 200) fail(path, 'string has control characters, an em dash or is over 200 characters')
    } else if (typeof v === 'boolean') {
      // true / false, as a thread probe reports
    } else if (Array.isArray(v)) v.forEach((x, i) => leaf(x, `${path}[${i}]`, depth + 1))
    else if (isObj(v)) Object.entries(v).forEach(([k, x]) => leaf(x, `${path}.${k}`, depth + 1))
    else fail(path, 'must be a number, string, boolean, array or object')
  }
  for (const [id, entry] of Object.entries(file.probes)) {
    const p = `${imageId}.probes.${id}`
    if (!PROBE_ID.test(id)) fail(p, 'probe id is not "<tuner>.<name>"')
    if (!isObj(entry)) {
      fail(p, 'must be an object')
      continue
    }
    if (entry.status === 'ok') {
      if (Object.keys(entry).sort().join() !== 'status,value') fail(p, 'an ok entry has status and value only')
      leaf(entry.value, `${p}.value`, 0)
    } else if (entry.status === 'absent') {
      if (Object.keys(entry).sort().join() !== 'reason,status') fail(p, 'an absent entry has status and reason only')
      if (typeof entry.reason !== 'string' || !entry.reason.trim()) fail(`${p}.reason`, 'must say why')
      else leaf(entry.reason, `${p}.reason`, 0)
    } else fail(`${p}.status`, `"${entry.status}" is not ok or absent`)
  }
  return issues
}
