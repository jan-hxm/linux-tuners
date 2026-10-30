import { defineStore } from 'pinia'
import { valueTypeOf } from './valueTypes.js'

const URL_DEBOUNCE_MS = 200

/**
 * Factory that builds a Pinia store for a tuner from a domain module. The store
 * shape (hardware + params + preset + tab + drawer) and all of its actions are
 * generic; everything domain-specific (how defaults are derived, how a value is
 * clamped, what counts as a validation issue, how state is (de)serialised) is
 * delegated to the `domain` object. Swap and systemd each instantiate this with
 * their own domain — see src/tuners/<id>/index.js.
 *
 * @param {string} id  Unique Pinia store id (e.g. 'tuner', 'systemd')
 * @param {import('@/core/types.js').TunerDomain} domain
 */
export function defineTunerStore(id, domain) {
  return defineStore(id, {
    state: () => {
      const restored = restoreFromUrlHash(domain)
      if (restored) {
        return {
          hardware: restored.hardware,
          params: restored.params,
          activePreset: restored.activePreset,
          activeTab: restored.activeTab ?? domain.defaultTab,
          drawerParamKey: null,
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
        _urlWriteTimer: null,
      }
    },

    getters: {
      issues(state) {
        return domain.validate(state.hardware, state.params)
      },
      blocked() {
        return domain.hasBlockingIssue(this.issues)
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
        this.syncUrl()
      },

      /**
       * Snap all parameters to a preset's values. Resets to hardware-derived
       * defaults first, then layers the preset's partial values over that, so
       * parameters the preset doesn't mention return to their hardware default.
       *
       * @param {string} id
       * @param {Object} values
       */
      applyPreset(id, values) {
        this.params = { ...domain.deriveDefaults(this.hardware), ...values }
        this.activePreset = id
        this.syncUrl()
      },

      resetToHardwareDefaults() {
        this.params = domain.deriveDefaults(this.hardware)
        this.activePreset = null
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
       * Debounced write to location.hash. Browser-only; no-op under Node/Vitest.
       */
      syncUrl() {
        if (typeof window === 'undefined') return
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

function restoreFromUrlHash(domain) {
  if (typeof window === 'undefined') return null
  return restoreState(domain, window.location.hash.slice(1))
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
  for (const key of Object.keys(restored.params)) {
    const def = domain.defsByKey[key]
    restored.params[key] = valueTypeOf(def).clamp(restored.params[key], def, domain.rangeFor(key, restored.hardware))
  }
  // Only a real preset id: presetsById is a plain object, so a name like
  // 'toString' would otherwise resolve to an inherited function.
  if (restored.activePreset !== null && !Object.hasOwn(domain.presetsById, restored.activePreset)) {
    restored.activePreset = null
  }
  return restored
}
