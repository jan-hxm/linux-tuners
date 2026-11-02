/**
 * The guided setup's shared link (Design.md §5 "Guided setup", "Link state"):
 * its own envelope in the hash, with a version, the machine profile, the
 * skipped steps, and each step's state encoded by that tuner's own
 * encodeState. A shared link is untrusted input, so restoring it is as strict
 * as a tuner link, and any part that fails rejects the whole link.
 */

import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import { restoreState } from '@/core/createTunerStore.js'
import { DEFAULT_MACHINE, MACHINE_SCHEMA } from '@/core/machine.js'
import { isPlainObject, restoreFields } from '@/core/serialization.js'
import { SETUP_STEPS, STEP_IDS, restoredSteps } from './steps.js'

/** Bump when a step is added, so a link from before is refused outright. */
export const SETUP_LINK_VERSION = 1

/**
 * @param {Object} state
 * @param {Object} state.machine
 * @param {string[]} state.skipped
 * @param {Record<string, import('./steps.js').StepState>} state.steps
 * @returns {string}
 */
export function encodeSetup({ machine, skipped, steps }) {
  const envelope = {
    v: SETUP_LINK_VERSION,
    machine,
    skipped,
    steps: Object.fromEntries(SETUP_STEPS.map(({ id, domain }) => [id, domain.encodeState(steps[id])])),
  }
  return compressToEncodedURIComponent(JSON.stringify(envelope))
}

/**
 * @param {string} hash  location.hash without the leading '#'
 * @returns {{ machine: Object, skipped: string[], steps: ReturnType<typeof restoredSteps> } | null}
 */
export function decodeSetup(hash) {
  if (!hash) return null
  try {
    const json = decompressFromEncodedURIComponent(hash)
    if (!json) return null
    const parsed = JSON.parse(json)
    if (!isPlainObject(parsed) || parsed.v !== SETUP_LINK_VERSION) return null

    const machine = restoreFields(parsed.machine, MACHINE_SCHEMA, DEFAULT_MACHINE)
    if (!machine) return null

    const { skipped } = parsed
    if (!Array.isArray(skipped) || !skipped.every((id) => STEP_IDS.includes(id)) || new Set(skipped).size !== skipped.length) return null

    // Every step, and nothing else: an unknown step id rejects the link.
    if (!isPlainObject(parsed.steps)) return null
    const keys = Object.keys(parsed.steps)
    if (keys.length !== STEP_IDS.length || !STEP_IDS.every((id) => Object.hasOwn(parsed.steps, id))) return null
    const steps = {}
    for (const { id, domain } of SETUP_STEPS) {
      const encoded = parsed.steps[id]
      const restored = typeof encoded === 'string' ? restoreState(domain, encoded) : null
      if (!restored) return null
      steps[id] = restored
    }
    return { machine, skipped: STEP_IDS.filter((id) => skipped.includes(id)), steps: restoredSteps(machine, skipped, steps) }
  } catch {
    return null
  }
}
