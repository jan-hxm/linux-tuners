import { defineStore } from 'pinia'
import { differingKeys, valueTypeOf } from './valueTypes.js'
import { factValues } from './machine.js'

const URL_DEBOUNCE_MS = 200

/**
 * Factory that builds a Pinia store for a tuner from a domain module. The store
 * shape (hardware + params + preset + tab + drawer) and all of its actions are
 * generic; everything domain-specific (how defaults are derived, how a value is
 * clamped, what counts as a validation issue, how state is (de)serialised) is
 * delegated to the `domain` object. Tuners don't call this themselves: the
 * page shell gets each tuner's store through `useTunerStoreFor(domain)`.
 *
 * @param {string} id  Unique Pinia store id (the domain id)
 * @param {import('@/core/types.js').TunerDomain} domain
 * @param {Object} [options]
 * @param {boolean} [options.urlSync]  Read and write location.hash. The guided
 *   setup turns it off, because the setup page owns the link.
 */
export function defineTunerStore(id, domain, { urlSync = true } = {}) {
  return defineStore(id, {
    state: () => {
      const restored = urlSync ? restoreFromUrlHash(domain) : null
      if (restored) {
        return {
          hardware: restored.hardware,
          params: restored.params,
          activePreset: restored.activePreset,
          activeTab: restored.activeTab ?? domain.defaultTab,
          drawerParamKey: null,
          undoState: null,
          facts: {},
          _urlWriteTimer: null,
        }
      }
      return {
        hardware: { ...domain.defaultHardware },
        params: domain.deriveDefaults(domain.defaultHardware),
        activePreset: null,
        activeTab: domain.defaultTab,
        /** key of the parameter currently shown in the InfoDrawer, or null */
        drawerParamKey: null,
        /**
         * What the last reset or preset snap replaced, so UndoToast can put
         * it back: { kind: 'reset' | 'preset', presetId, params, activePreset }.
         * Any other change clears it. Never part of the shared link.
         */
        undoState: null,
        /**
         * The facts earlier guided-setup steps provide (core/machine.js
         * MACHINE_FACTS). None on a tuner's own page.
         */
        facts: {},
        _urlWriteTimer: null,
      }
    },

    getters: {
      issues(state) {
        return domain.validate(state.hardware, state.params, state.facts)
      },
      blocked() {
        return domain.hasBlockingIssue(this.issues)
      },
      /**
       * The generated files, named after the active preset and whether the
       * values moved off it.
       * @returns {import('./output/files.js').ConfigFile[]}
       */
      configFiles(state) {
        const preset = state.activePreset ? domain.presetsById[state.activePreset] : null
        return domain.generateConfig({
          hardware: state.hardware,
          params: state.params,
          presetLabel: preset?.label ?? null,
          customised: preset ? differingKeys(domain.defsByKey, preset.values, state.params).length > 0 : false,
        })
      },
      /** The values the profile derives, which a card's Reset returns to. */
      profileDefaults(state) {
        return domain.deriveDefaults(state.hardware)
      },
      /**
       * Keys whose value differs from the profile's default: what a preset or
       * the user changed. ParameterPanel never hides these.
       * @returns {string[]}
       */
      changedKeys(state) {
        return differingKeys(domain.defsByKey, this.profileDefaults, state.params)
      },
      /** {[paramKey]: ValidationIssue[]} for fast per-card lookup */
      issuesByParam() {
        /** @type {Record<string, any[]>} */
        const map = {}
        for (const issue of this.issues) {
          for (const key of issue.params) {
            if (!map[key]) map[key] = []
            map[key].push(issue)
          }
        }
        return map
      },
    },

    actions: {
      /**
       * Replace the hardware spec and recompute all defaults.
       * @param {Object} hw
       */
      setHardware(hw) {
        this.hardware = { ...hw }
        this.params = domain.deriveDefaults(this.hardware)
        this.activePreset = null
        this.undoState = null
        this.syncUrl()
      },

      /**
       * Set a single parameter value. It is parsed as strictly as a shared
       * link (an int is rounded, e.g. a typed 60.5; NaN or an unlisted enum
       * option is ignored), then clamped to the hardware-aware range.
       * @param {string} key
       * @param {*} value
       */
      setParam(key, value) {
        const def = domain.defsByKey[key]
        const type = valueTypeOf(def)
        const parsed = type.restore(value, def)
        if (parsed === undefined) return
        this.params[key] = type.clamp(parsed, def, domain.rangeFor(key, this.hardware))
        this.activePreset = null
        this.undoState = null
        this.syncUrl()
      },

      /**
       * Snap all parameters to a preset's values. Resets to hardware-derived
       * defaults first, then layers the preset's partial values over that, so
       * parameters the preset doesn't mention return to their hardware default.
       * Values the profile's kernel can't take are held to its range.
       *
       * @param {string} id
       * @param {Object} values
       */
      applyPreset(id, values) {
        this._replaceParams(presetParams(domain, this.hardware, values), id, { kind: 'preset', presetId: id })
      },

      resetToHardwareDefaults() {
        this._replaceParams(domain.deriveDefaults(this.hardware), null, { kind: 'reset', presetId: null })
      },

      /** Put back what the last reset or preset snap replaced. */
      undo() {
        if (!this.undoState) return
        this.params = this.undoState.params
        this.activePreset = this.undoState.activePreset
        this.undoState = null
        this.syncUrl()
      },

      dismissUndo() {
        this.undoState = null
      },

      /**
       * Take new facts from earlier setup steps. Only the profile fields that
       * copy a fact change; the params keep their values, held to the new
       * ranges, so tuning an earlier step doesn't reset this one.
       *
       * @param {Record<string, number>} facts
       */
      setFacts(facts) {
        this.facts = { ...facts }
        const fed = factValues(domain.profile.fields, facts)
        if (Object.keys(fed).every((key) => this.hardware[key] === fed[key])) return
        this.hardware = { ...this.hardware, ...fed }
        this.params = clampToProfile(domain, this.hardware, this.params)
        this.syncUrl()
      },

      /**
       * Swap in a whole new set of params and remember the old one for undo.
       * A snap that changes nothing leaves nothing to undo.
       */
      _replaceParams(params, activePreset, undo) {
        const changed = differingKeys(domain.defsByKey, params, this.params).length > 0
        this.undoState = changed || activePreset !== this.activePreset
          ? { ...undo, params: this.params, activePreset: this.activePreset }
          : null
        this.params = params
        this.activePreset = activePreset
        this.syncUrl()
      },

      /** @param {string} tab */
      setActiveTab(tab) {
        this.activeTab = tab
        this.syncUrl()
      },

      /** @param {string|null} key */
      openDrawer(key) {
        this.drawerParamKey = key
      },

      closeDrawer() {
        this.drawerParamKey = null
      },

      /**
       * Debounced write to location.hash. Browser-only; no-op under Node/Vitest
       * and without `urlSync`.
       */
      syncUrl() {
        if (!urlSync || typeof window === 'undefined') return
        if (this._urlWriteTimer) clearTimeout(this._urlWriteTimer)
        // The timer can outlive the view: if the user navigates to another route
        // within the debounce window, don't stamp this tuner's state onto it.
        const path = window.location.pathname
        this._urlWriteTimer = setTimeout(() => {
          if (window.location.pathname !== path) return
          const encoded = domain.encodeState({
            hardware: this.hardware,
            params: this.params,
            activePreset: this.activePreset,
            activeTab: this.activeTab,
          })
          // Keep history.state: Vue Router stores its back/forward + scroll data there.
          history.replaceState(history.state, '', `#${encoded}`)
        }, URL_DEBOUNCE_MS)
      },
    },
  })
}

/** One store definition per domain object, so every caller shares its state. */
const STORE_DEFINITIONS = new WeakMap()

/**
 * The tuner's store, keyed by its domain id. Used by the page shell and by
 * tests that need a real tuner's store.
 *
 * @param {import('@/core/types.js').TunerDomain} domain
 */
export function useTunerStoreFor(domain) {
  let useStore = STORE_DEFINITIONS.get(domain)
  if (!useStore) {
    useStore = defineTunerStore(domain.id, domain)
    STORE_DEFINITIONS.set(domain, useStore)
  }
  return useStore()
}

function restoreFromUrlHash(domain) {
  if (typeof window === 'undefined') return null
  return restoreState(domain, window.location.hash.slice(1))
}

/**
 * Hold every value to the range the profile allows, as a slider drag would.
 *
 * @param {import('@/core/types.js').TunerDomain} domain
 * @param {Object} hardware
 * @param {Object} params
 */
export function clampToProfile(domain, hardware, params) {
  const out = { ...params }
  for (const key of Object.keys(out)) {
    const def = domain.defsByKey[key]
    out[key] = valueTypeOf(def).clamp(out[key], def, domain.rangeFor(key, hardware))
  }
  return out
}

/**
 * The params a preset gives on a profile: its values over the profile's
 * defaults, held to the profile's ranges. A preset written for current
 * kernels (swappiness 133 for zram) must not reach an older one as a value
 * it rejects.
 *
 * @param {import('@/core/types.js').TunerDomain} domain
 * @param {Object} hardware
 * @param {Object} values  The preset's partial values
 */
export function presetParams(domain, hardware, values) {
  return clampToProfile(domain, hardware, { ...domain.deriveDefaults(hardware), ...values })
}

/**
 * Decode a shared-link hash and hold it to what the UI itself could produce.
 *
 * @param {import('@/core/types.js').TunerDomain} domain
 * @param {string} hash  location.hash without the leading '#'
 */
export function restoreState(domain, hash) {
  if (!hash) return null
  const restored = domain.decodeState(hash)
  if (!restored) return null
  // decodeState already parsed each value strictly by its type (an int is
  // rounded: `vm.swappiness = 60.5` is rejected by sysctl). Hold it to the
  // same range a slider drag would.
  restored.params = clampToProfile(domain, restored.hardware, restored.params)
  // Only a real preset id: presetsById is a plain object, so a name like
  // 'toString' would otherwise resolve to an inherited function.
  if (restored.activePreset !== null && !Object.hasOwn(domain.presetsById, restored.activePreset)) {
    restored.activePreset = null
  }
  return restored
}
