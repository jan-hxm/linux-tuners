/**
 * The machine profile of the guided setup (Design.md §5 "Guided setup"): the
 * one field list for what two or more tuners read about a machine. It uses
 * the field shapes of a tuner profile (./profile.js), so the same form renders
 * it and the same schema restores it from a link.
 *
 * A tuner profile field takes its value from here by declaring `machine`:
 * either the name of a machine field it copies (`'ramGiB'`), or
 * `{ from: '<machine field>', map: { <option>: <value> } }`, with one entry
 * for every option of that machine field.
 */

import { MACHINE_ROLES } from './machineRoles.js'
import { profileDefaults, profileSchema } from './profile.js'

/** Total-RAM quick picks (GiB), shared by every tuner so they never drift. */
export const RAM_PICKS = [
  { value: 0.5, label: '512 MiB' },
  1, 2, 4, 8, 16, 32, 64, 128, 192, 256, 512,
]

// Sanity ceiling: 2304 TiB covers even very high-end server racks while
// keeping derived values and the card layout bounded. Without a cap, pasting
// something like 1e65 produces astronomically long parameter values.
export const RAM_MAX_GIB = 2304 * 1024
// Low enough to model sub-GiB hosts (a 1 GiB box might only have 512 MiB free
// for the workload). RAM can't be 0.
export const RAM_MIN_GIB = 0.25 // 256 MiB

// Sizes snap to MiB, so sub-GiB hosts are expressible without accumulating
// binary-float noise (0.1 + 0.2 etc.); whole-GiB values stay exact.
export const SIZE_SNAP_GIB = 1 / 1024

// Spinner step for the size fields. 0.25 GiB (256 MiB) lets the spinner reach
// the common sub-GiB sizes; any typed value still works, since apply snaps it
// to SIZE_SNAP_GIB.
export const SIZE_STEP_GIB = 0.25

/** The Total RAM field; a tuner spreads it and adds its `default`. */
export const RAM_FIELD = Object.freeze({
  key: 'ramGiB',
  type: 'number',
  label: 'Total RAM (GiB)',
  min: RAM_MIN_GIB,
  max: RAM_MAX_GIB,
  step: SIZE_SNAP_GIB,
  inputStep: SIZE_STEP_GIB,
  picks: RAM_PICKS,
  help: ['Fractional values are allowed for small hosts, e.g. 0.5 = 512 MiB.'],
})

/**
 * The machine fields. The kernel ranges are cut at every version a tuner's
 * profile tells apart (security at 4.19 and 5.13, swap at 5.8 and 5.17), and
 * each value is the range's first version, so a tuner's free-text version
 * field can copy it. A new threshold adds a cut.
 */
export const MACHINE_FIELDS = Object.freeze([
  {
    key: 'role',
    type: 'choice',
    control: 'select',
    label: 'What the machine is for',
    options: MACHINE_ROLES,
    default: 'server',
  },
  { ...RAM_FIELD, default: 16, half: true },
  {
    key: 'cgroupVersion',
    type: 'choice',
    control: 'segmented',
    label: 'cgroup version',
    options: [
      { value: 'v1', label: 'v1', note: 'The legacy hierarchy, for example CentOS 7 or Ubuntu 20.04.' },
      { value: 'v2', label: 'v2', note: 'The unified hierarchy, the default on current distributions.' },
    ],
    default: 'v2',
    half: true,
  },
  {
    key: 'kernel',
    type: 'choice',
    control: 'cards',
    label: 'Kernel version (uname -r)',
    columns: 3,
    options: [
      { value: '5.17', label: '5.17 or newer' },
      { value: '5.13', label: '5.13 to 5.16' },
      { value: '5.8', label: '5.8 to 5.12' },
      { value: '4.19', label: '4.19 to 5.7' },
      { value: '4.9', label: '4.9 to 4.18' },
    ],
    default: '5.17',
  },
  {
    key: 'systemd',
    type: 'choice',
    control: 'segmented',
    label: 'systemd version (systemctl --version)',
    options: [
      { value: '243', label: '243 or newer' },
      { value: '240', label: '240 to 242' },
      { value: 'older', label: 'older, or none' },
    ],
    default: '243',
  },
])

export const MACHINE_FIELDS_BY_KEY = Object.freeze(Object.fromEntries(MACHINE_FIELDS.map((f) => [f.key, f])))

export const DEFAULT_MACHINE = Object.freeze(profileDefaults(MACHINE_FIELDS))

export const MACHINE_SCHEMA = Object.freeze(profileSchema(MACHINE_FIELDS))

/**
 * The facts a setup step passes to the later ones: values another tuner sets,
 * which a tuner's limits depend on. A domain's `facts(hardware, params)`
 * returns some of these, and a later domain reads them through a profile
 * field (`machine: 'pidMax'`) or the third argument of `validate`.
 *
 * - `pidMax`: kernel.pid_max the machine runs with (kernel tuner).
 * - `threadsMax`: kernel.threads-max (kernel tuner).
 * - `nrOpen`: fs.nr_open (filesystem tuner).
 */
export const MACHINE_FACTS = Object.freeze(['pidMax', 'threadsMax', 'nrOpen'])

/** Whether a tuner field copies a fact rather than a machine field. */
function readsFact(field) {
  return typeof field.machine === 'string' && MACHINE_FACTS.includes(field.machine)
}

/** The machine field a tuner field reads, or undefined when it reads none. */
function sourceOf(field) {
  return typeof field.machine === 'string' ? field.machine : field.machine?.from
}

/**
 * The values a machine profile gives a tuner's profile fields, keyed by the
 * tuner's field keys. Fields without a `machine` declaration, and fields that
 * read a fact, are left out, so the caller overlays this on the tuner's own
 * defaults.
 *
 * @param {import('./profile.js').ProfileField[]} fields  A tuner's profile fields
 * @param {Record<string, *>} machine
 */
export function machineValues(fields, machine) {
  const values = {}
  for (const field of fields) {
    const from = sourceOf(field)
    if (from === undefined || readsFact(field)) continue
    if (typeof field.machine === 'string') values[field.key] = machine[from]
    // Own entries only, so a value such as 'constructor' maps to nothing.
    else values[field.key] = Object.hasOwn(field.machine.map, machine[from]) ? field.machine.map[machine[from]] : undefined
  }
  return values
}

/**
 * The values earlier steps' facts give a tuner's profile fields, keyed by the
 * tuner's field keys. A fact no earlier step provided is left out.
 *
 * @param {import('./profile.js').ProfileField[]} fields  A tuner's profile fields
 * @param {Record<string, number>} facts
 */
export function factValues(fields, facts) {
  const values = {}
  for (const field of fields) {
    if (readsFact(field) && Object.hasOwn(facts, field.machine)) values[field.key] = facts[field.machine]
  }
  return values
}

/**
 * The facts a domain reads: those its profile fields copy, and those its
 * `validate` declares in `readsFacts`.
 *
 * @param {import('./types.js').TunerDomain} domain
 * @returns {string[]}
 */
export function factsReadBy(domain) {
  const fromFields = domain.profile.fields.filter(readsFact).map((f) => f.machine)
  return [...new Set([...fromFields, ...domain.readsFacts])]
}

/**
 * Structural checks for a tuner's `machine` declarations: a known machine
 * field or fact, and a map with exactly one entry per option. A fact is only
 * copied, never mapped. Whether each mapped value is one the tuner field
 * accepts is the contract suite's check.
 *
 * @param {import('./profile.js').ProfileField[]} fields
 * @returns {string[]} problems, empty when the declarations are sound
 */
export function machineProblems(fields) {
  const problems = []
  for (const field of fields) {
    if (field.machine === undefined || readsFact(field)) continue
    const source = MACHINE_FIELDS_BY_KEY[sourceOf(field)]
    if (!source) {
      problems.push(`profile field "${field.key}" reads an unknown machine field`)
      continue
    }
    if (typeof field.machine === 'string') continue
    const options = source.options?.map((o) => o.value)
    const mapped = Object.keys(field.machine.map ?? {})
    if (!options) problems.push(`profile field "${field.key}" maps machine field "${source.key}", which has no options`)
    else if (mapped.length !== options.length || !options.every((o) => Object.hasOwn(field.machine.map, o))) {
      problems.push(`profile field "${field.key}" must map every option of machine field "${source.key}"`)
    }
  }
  return problems
}
