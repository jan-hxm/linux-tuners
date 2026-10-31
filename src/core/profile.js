/**
 * A tuner's profile (hardware and workload) is one declarative field list in
 * src/tuners/<id>/profile.js. This module turns that list into the defaults,
 * the restore schema for shared links, and the form's apply-time
 * normalisation, so the form and the URL validation can't drift apart
 * (Design.md §9 "Profile").
 *
 * Field shapes (all have `key`, `label` and `default`):
 * - `number`: `min`, `max`, `step` (the granularity a value snaps to, also on
 *   restore), optional `inputStep` (the spinner step), `picks` and `help`.
 * - `choice`: `options: { value, label, note? }[]` and `control`: `select`,
 *   `cards` (radio cards, each showing its note) or `segmented` (shows the
 *   selected option's note).
 * - `text`: `pattern` (a RegExp), optional `placeholder`, `help` and
 *   `invalidMessage`. A `null` default makes the field optional: blank is null.
 *
 * Any field may set `half: true` (consecutive halves share a row) and
 * `disabledWhen: { field, equals }` with a `disabledNote`.
 *
 * @typedef {Object} ProfileField
 * @property {string} key
 * @property {'number'|'choice'|'text'} type
 * @property {string} label
 * @property {*} default
 */

export const FIELD_TYPES = ['number', 'choice', 'text']
export const CHOICE_CONTROLS = ['select', 'cards', 'segmented']

/**
 * @param {ProfileField[]} fields
 * @returns {Record<string, *>}
 */
export function profileDefaults(fields) {
  return Object.fromEntries(fields.map((f) => [f.key, f.default]))
}

/**
 * The rule decodeState holds each field to: an enum list, a numeric
 * `{ min, max, step }`, or a RegExp.
 *
 * @param {ProfileField[]} fields
 */
export function profileSchema(fields) {
  return Object.fromEntries(fields.map((f) => [f.key, fieldRule(f)]))
}

function fieldRule(field) {
  if (field.type === 'choice') return field.options.map((o) => o.value)
  if (field.type === 'text') return field.pattern
  return { min: field.min, max: field.max, step: field.step }
}

/**
 * @param {*} value
 * @param {string[] | { min: number, max: number, step?: number } | RegExp} rule
 * @param {*} fallback  The field's default; a null default means null is allowed
 */
export function matchesRule(value, rule, fallback) {
  if (value === null) return fallback === null
  if (Array.isArray(rule)) return rule.includes(value)
  if (rule instanceof RegExp) return typeof value === 'string' && rule.test(value)
  return Number.isFinite(value) && value >= rule.min && value <= rule.max
}

/**
 * Round a numeric field to its schema step and clamp it, so neither a link nor
 * the form can carry values the other wouldn't (e.g. 0.3 GiB of RAM, which
 * yields fractional byte counts downstream). Non-numeric and step-less rules
 * pass through.
 */
export function snapToStep(value, rule) {
  if (typeof value !== 'number' || !rule.step) return value
  return Math.max(rule.min, Math.min(rule.max, Math.round(value / rule.step) * rule.step))
}

/**
 * The value a form draft applies as. Numbers snap like a restored link (an
 * unparseable entry falls back to the minimum); blank optional text is null.
 * Returns `undefined` for text that fails the field's pattern or a choice
 * that isn't listed.
 *
 * @param {ProfileField} field
 * @param {*} raw  The draft value
 */
export function normalizeField(field, raw) {
  if (field.type === 'number') {
    const n = raw === '' ? NaN : Number(raw)
    return Number.isFinite(n) ? snapToStep(n, fieldRule(field)) : field.min
  }
  if (field.type === 'text') {
    const text = String(raw ?? '').trim()
    if (text === '' && field.default === null) return null
    return field.pattern.test(text) ? text : undefined
  }
  return field.options.some((o) => o.value === raw) ? raw : undefined
}

/** Whether a field is disabled for the given draft (`disabledWhen`). */
export function isFieldDisabled(field, draft) {
  const rule = field.disabledWhen
  if (!rule) return false
  const value = draft[rule.field]
  return typeof rule.equals === 'number' ? Number(value) === rule.equals : value === rule.equals
}

/**
 * Structural checks for defineTuner: unique keys, known shapes, and a default
 * the field's own restore rule accepts.
 *
 * @param {ProfileField[]} fields
 * @returns {string[]} problems, empty when the list is sound
 */
export function profileProblems(fields) {
  const problems = []
  const keys = fields.map((f) => f.key)
  if (new Set(keys).size !== keys.length) problems.push('profile has a duplicate field key')
  for (const f of fields) {
    if (!FIELD_TYPES.includes(f.type)) {
      problems.push(`profile field "${f.key}" has unknown type "${f.type}"`)
      continue
    }
    if (!f.label) problems.push(`profile field "${f.key}" has no label`)
    if (f.type === 'choice' && !CHOICE_CONTROLS.includes(f.control)) problems.push(`profile field "${f.key}" has unknown control "${f.control}"`)
    if (f.type === 'text' && !(f.pattern instanceof RegExp)) problems.push(`profile field "${f.key}" needs a RegExp pattern`)
    if (f.type === 'number' && !(f.step > 0)) problems.push(`profile field "${f.key}" needs a positive step`)
    if (!matchesRule(f.default, fieldRule(f), f.default)) problems.push(`profile field "${f.key}" has a default its rule rejects`)
    if (f.disabledWhen && !keys.includes(f.disabledWhen.field)) problems.push(`profile field "${f.key}" is disabled by an unknown field`)
  }
  return problems
}
