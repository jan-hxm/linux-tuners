/**
 * The guided setup's state: the machine profile, the skipped steps, and one
 * tuner store per step. The step stores come from the shared factory with
 * `urlSync: false`, because this page owns the link; the shared tuner UI
 * renders them unchanged.
 */

import { defineStore } from 'pinia'
import { defineTunerStore } from '@/core/createTunerStore.js'
import { DEFAULT_MACHINE } from '@/core/machine.js'
import { isMachineRole } from '@/core/machineRoles.js'
import { SETUP_STEPS, deriveSteps, skippedForRole } from './steps.js'
import { decodeSetup, encodeSetup } from './link.js'

const URL_DEBOUNCE_MS = 200

const STEP_STORES = Object.fromEntries(
  SETUP_STEPS.map(({ id, domain }) => [id, defineTunerStore(`setup/${id}`, domain, { urlSync: false })]),
)

/** The store of one setup step. */
export function useStepStore(id) {
  return STEP_STORES[id]()
}

function stepStates() {
  return Object.fromEntries(
    SETUP_STEPS.map(({ id }) => {
      const s = useStepStore(id)
      return [id, { hardware: s.hardware, params: s.params, activePreset: s.activePreset }]
    }),
  )
}

/** Write each step's state into its store. */
function loadSteps(steps) {
  for (const { id } of SETUP_STEPS) {
    const { hardware, params, activePreset, facts } = steps[id]
    useStepStore(id).$patch((s) => {
      s.hardware = { ...hardware }
      s.params = { ...params }
      s.activePreset = activePreset
      s.facts = { ...facts }
      s.undoState = null
      s.drawerParamKey = null
    })
  }
}

export const useSetupStore = defineStore('setup', {
  state: () => ({
    machine: { ...DEFAULT_MACHINE },
    /** @type {string[]} ids of the steps left out, in setup order */
    skipped: skippedForRole(DEFAULT_MACHINE.role),
    /**
     * What the last machine-profile change replaced, for UndoToast:
     * { kind: 'machine', machine, skipped, steps }. Never part of the link.
     */
    undoState: null,
    _urlWriteTimer: null,
  }),

  getters: {
    /** ProfileForm reads the profile it edits as `hardware`. */
    hardware: (state) => state.machine,

    /** The facts each step gets from the included steps before it. */
    incomingFacts(state) {
      const facts = {}
      const out = {}
      for (const { id, domain } of SETUP_STEPS) {
        out[id] = { ...facts }
        if (state.skipped.includes(id)) continue
        const s = useStepStore(id)
        Object.assign(facts, domain.facts(s.hardware, s.params))
      }
      return out
    },
  },

  actions: {
    /**
     * Start from a shared link, or else from the role the landing page
     * picked, or else from the defaults. A link that fails any check is
     * ignored as a whole, as on a tuner page.
     *
     * @param {string} hash  location.hash without the '#'
     * @param {*} role       the `role` query value, untrusted
     */
    init(hash, role) {
      const restored = decodeSetup(hash)
      if (restored) {
        this.machine = restored.machine
        this.skipped = restored.skipped
        loadSteps(restored.steps)
      } else {
        this.machine = { ...DEFAULT_MACHINE, ...(isMachineRole(role) ? { role } : {}) }
        this.skipped = skippedForRole(this.machine.role)
        loadSteps(deriveSteps(this.machine, this.skipped))
      }
      this.undoState = null
    },

    /**
     * Apply a new machine profile: every step re-derives its defaults, as a
     * tuner's own profile change does, and Undo puts the old setup back. A new
     * role also resets which steps are skipped.
     *
     * @param {Object} machine
     */
    setHardware(machine) {
      const previous = { machine: this.machine, steps: stepStates() }
      const undo = { kind: 'machine', machine: this.machine, skipped: this.skipped, steps: deriveStepsSnapshot(previous.steps) }
      const skipped = machine.role === this.machine.role ? this.skipped : skippedForRole(machine.role)
      this.machine = { ...machine }
      this.skipped = skipped
      loadSteps(deriveSteps(this.machine, skipped, previous))
      this.undoState = undo
      this.syncUrl()
    },

    undo() {
      const undo = this.undoState
      if (!undo) return
      this.machine = undo.machine
      this.skipped = undo.skipped
      loadSteps(undo.steps)
      this.undoState = null
      this.syncUrl()
    },

    dismissUndo() {
      this.undoState = null
    },

    /** @param {string} id */
    toggleSkipped(id) {
      this.skipped = this.skipped.includes(id)
        ? this.skipped.filter((s) => s !== id)
        : SETUP_STEPS.map((s) => s.id).filter((s) => s === id || this.skipped.includes(s))
      this.undoState = null
      this.syncUrl()
    },

    /** Hand each step the facts from the steps before it. */
    applyFacts() {
      const incoming = this.incomingFacts
      for (const { id } of SETUP_STEPS) useStepStore(id).setFacts(incoming[id])
    },

    /** The link to this setup, for the Share button and the hash. */
    linkHash() {
      return encodeSetup({ machine: this.machine, skipped: this.skipped, steps: stepStates() })
    },

    /** Debounced write to location.hash, kept on this page only. */
    syncUrl() {
      if (typeof window === 'undefined') return
      if (this._urlWriteTimer) clearTimeout(this._urlWriteTimer)
      const path = window.location.pathname
      this._urlWriteTimer = setTimeout(() => {
        if (window.location.pathname !== path) return
        // Keep history.state: Vue Router stores its back/forward + scroll data
        // there. The link carries the role, so the landing page's ?role= goes.
        history.replaceState(history.state, '', `${path}#${this.linkHash()}`)
      }, URL_DEBOUNCE_MS)
    },
  },
})

/** A copy of the step states with their current facts, for Undo. */
function deriveStepsSnapshot(steps) {
  return Object.fromEntries(Object.entries(steps).map(([id, s]) => [id, { ...s, facts: { ...useStepStore(id).facts } }]))
}
