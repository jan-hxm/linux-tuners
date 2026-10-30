/**
 * Value types for parameter defs (Design.md §9 "Value types"). A def names its
 * type in `def.type`; `int` is the default. Shared code reads, clamps, prints
 * and compares values only through these, so the untrusted-input rule
 * (Design.md §5) and the "only values the kernel accepts" rule (§3) each live
 * in one place as types are added.
 *
 * Each type has:
 *   restore(raw, def)       strict parse of untrusted input; undefined rejects it
 *   clamp(value, def, range) the nearest value the UI could produce
 *   format(value, def)      the emitted text; throws on a value of the wrong shape
 *   equals(a, b)
 */

/** @typedef {{ min: number, max: number }} Range */

/** @param {number} v @param {Range} range */
function clampInt(v, { min, max }) {
  return Math.max(min, Math.min(max, Math.round(v)))
}

function formatInt(v) {
  if (!Number.isSafeInteger(v)) throw new Error(`Not an integer: ${v}`)
  return String(v)
}

const int = {
  restore: (raw) => (Number.isFinite(raw) ? Math.round(raw) : undefined),
  clamp: (v, _def, range) => clampInt(v, range),
  format: formatInt,
  equals: (a, b) => a === b,
}

/** Stored as 0/1, the way sysctl and the toggle control both use it. */
const bool = {
  restore: int.restore,
  clamp: (v) => clampInt(v, { min: 0, max: 1 }),
  format: (v) => {
    if (v !== 0 && v !== 1) throw new Error(`Not 0 or 1: ${v}`)
    return String(v)
  },
  equals: (a, b) => a === b,
}

/** One of `def.options[].value`, all plain tokens. */
const enumType = {
  restore: (raw, def) => (enumValues(def).includes(raw) ? raw : undefined),
  clamp: (v, def) => (enumValues(def).includes(v) ? v : def.kernelDefault),
  format: (v, def) => {
    if (!enumValues(def).includes(v)) throw new Error(`Not an option of ${def.key}: ${v}`)
    return v
  },
  equals: (a, b) => a === b,
}

/** `def.length` integers, each held to the def's range; printed space-separated. */
const tuple = {
  restore: (raw, def) => {
    if (!Array.isArray(raw) || raw.length !== def.length || !raw.every(Number.isFinite)) return undefined
    return raw.map(Math.round)
  },
  clamp: (v, _def, range) => v.map((n) => clampInt(n, range)),
  format: (v, def) => {
    if (!Array.isArray(v) || v.length !== def.length) throw new Error(`Not a ${def.length}-tuple`)
    return v.map(formatInt).join(' ')
  },
  equals: (a, b) => a.length === b.length && a.every((n, i) => n === b[i]),
}

function enumValues(def) {
  return (def.options ?? []).map((o) => o.value)
}

export const VALUE_TYPES = Object.freeze({ int, bool, enum: enumType, tuple })

/** The value type a def declares, `int` when it declares none. */
export function valueTypeOf(def) {
  const name = def.type ?? 'int'
  if (!Object.hasOwn(VALUE_TYPES, name)) throw new Error(`Unknown value type "${name}" on ${def.key}`)
  return VALUE_TYPES[name]
}

/**
 * Every param as its type prints it, for writers that add their own syntax
 * around the value (e.g. `50%` in an ini drop-in). Throws on a malformed value.
 *
 * @param {Record<string, Object>} defsByKey
 * @param {Object} params
 * @returns {Record<string, string>}
 */
export function formatParams(defsByKey, params) {
  return Object.fromEntries(
    Object.entries(defsByKey).map(([key, def]) => [key, valueTypeOf(def).format(params[key], def)]),
  )
}

/**
 * Keys of `values` whose value differs from `params`: the preset diff and the
 * "customised" flag.
 *
 * @param {Record<string, Object>} defsByKey
 * @param {Object} values  A preset's partial values
 * @param {Object} params
 */
export function differingKeys(defsByKey, values, params) {
  return Object.keys(values).filter((key) => !valueTypeOf(defsByKey[key]).equals(params[key], values[key]))
}
