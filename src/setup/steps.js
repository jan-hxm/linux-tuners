/**
 * The guided setup's steps and how their profiles are built (Design.md §5
 * "Guided setup"). Plain JS, so the link and the walk are tested under Node.
 *
 * `src/setup/` is a composition root: it reads the registry and each tuner's
 * domain module through TUNER_DOMAINS, never a tuner's internals, and it
 * never branches on a tuner id.
 */

import { LIVE_TUNERS } from '@/tuners/registry.js'
import { TUNER_DOMAINS } from '@/tuners/domains.js'
import { clampToProfile } from '@/core/createTunerStore.js'
import { tunersForRole } from '@/core/machineRoles.js'
import { machineValues, factValues } from '@/core/machine.js'
import { profileSchema } from '@/core/profile.js'
import { restoreFields } from '@/core/serialization.js'

/**
 * @typedef {Object} SetupStep
 * @property {string} id
 * @property {import('@/tuners/registry.js').TunerEntry} entry
 * @property {import('@/core/types.js').TunerDomain} domain
 */

const DOMAINS_BY_ID = Object.fromEntries(TUNER_DOMAINS.map((d) => [d.id, d]))

/** @type {readonly SetupStep[]} One step per live tuner, in the registry's setup order. */
export const SETUP_STEPS = Object.freeze(LIVE_TUNERS.map((entry) => ({ id: entry.id, entry, domain: DOMAINS_BY_ID[entry.id] })))

export const STEP_IDS = Object.freeze(SETUP_STEPS.map((s) => s.id))

/** The step that provides each fact, from what each domain returns at its defaults. */
export const FACT_PROVIDERS = Object.freeze(
  Object.fromEntries(
    SETUP_STEPS.flatMap(({ id, domain }) =>
      Object.keys(domain.facts(domain.defaultHardware, domain.deriveDefaults(domain.defaultHardware))).map((fact) => [fact, id]),
    ),
  ),
)

/** The steps a role starts without: the tuners that rarely matter for it. */
export function skippedForRole(role) {
  return tunersForRole(LIVE_TUNERS, role).optional.map((t) => t.id)
}

/**
 * A step's profile: `base` with `overlay` over it, held to the tuner's link
 * schema, so the setup can't build a profile a shared link couldn't. Should
 * the overlay ever break the schema (the contract suite checks it can't), the
 * step falls back to the tuner's own defaults.
 *
 * @param {import('@/core/types.js').TunerDomain} domain
 * @param {Object} base
 * @param {Object} overlay
 */
export function stepProfile(domain, base, overlay) {
  const fields = domain.profile.fields
  return restoreFields({ ...base, ...overlay }, profileSchema(fields), domain.defaultHardware) ?? { ...domain.defaultHardware }
}

/**
 * The mapped values that differ between two machine profiles. A field the
 * user changed for one step keeps that change until its machine field moves.
 *
 * @param {import('@/core/types.js').TunerDomain} domain
 * @param {Object|null} before  null for a step with no profile yet
 * @param {Object} after
 */
export function mappedChanges(domain, before, after) {
  const next = machineValues(domain.profile.fields, after)
  if (!before) return next
  const old = machineValues(domain.profile.fields, before)
  return Object.fromEntries(Object.entries(next).filter(([key, value]) => old[key] !== value))
}

/**
 * @typedef {Object} StepState
 * @property {Object} hardware
 * @property {Object} params
 * @property {string|null} activePreset
 */

/**
 * Walk the steps in setup order. `stateFor` builds each step's state from the
 * facts the included steps before it provide; a skipped step provides none.
 *
 * @param {string[]} skipped
 * @param {(step: SetupStep, facts: Record<string, number>) => StepState} stateFor
 * @returns {Record<string, StepState & { facts: Record<string, number> }>}
 */
export function walkSteps(skipped, stateFor) {
  const facts = {}
  const out = {}
  for (const step of SETUP_STEPS) {
    const incoming = { ...facts }
    const state = stateFor(step, incoming)
    out[step.id] = { ...state, facts: incoming }
    if (!skipped.includes(step.id)) Object.assign(facts, step.domain.facts(state.hardware, state.params))
  }
  return out
}

/**
 * Every step at its defaults for a machine, or re-derived after a machine
 * change from `previous` (the steps' current states and the machine they were
 * built for), which keeps each step's own fields.
 *
 * @param {Object} machine
 * @param {string[]} skipped
 * @param {{ machine: Object, steps: Record<string, StepState> }} [previous]
 */
export function deriveSteps(machine, skipped, previous) {
  return walkSteps(skipped, ({ id, domain }, facts) => {
    const base = previous?.steps[id]?.hardware ?? domain.defaultHardware
    const overlay = { ...mappedChanges(domain, previous?.machine ?? null, machine), ...factValues(domain.profile.fields, facts) }
    const hardware = stepProfile(domain, base, overlay)
    return { hardware, params: domain.deriveDefaults(hardware), activePreset: null }
  })
}

/**
 * Steps restored from a link. The mapped fields and the facts are never read
 * from it: they are recomputed from the machine and the earlier steps, so a
 * link can't make two steps disagree. The params are held to the result.
 *
 * @param {Object} machine
 * @param {string[]} skipped
 * @param {Record<string, StepState>} steps  Each already through its tuner's restoreState
 */
export function restoredSteps(machine, skipped, steps) {
  return walkSteps(skipped, ({ id, domain }, facts) => {
    const fields = domain.profile.fields
    const hardware = stepProfile(domain, steps[id].hardware, { ...machineValues(fields, machine), ...factValues(fields, facts) })
    return { hardware, params: clampToProfile(domain, hardware, steps[id].params), activePreset: steps[id].activePreset }
  })
}
