import { defineStore } from 'pinia'

const URL_DEBOUNCE_MS = 200

/**
 * Factory that builds a Pinia store for a tuner from a domain module. The store
 * shape (hardware + params + preset + tab + drawer) and all of its actions are
 * generic; everything domain-specific (how defaults are derived, how a value is
 * clamped, what counts as a validation issue, how state is (de)serialised) is
 * delegated to the `domain` object. Swap and systemd each instantiate this with
 * their own domain — see src/domains/*.
 *
 * @param {string} id  Unique Pinia store id (e.g. 'tuner', 'systemd')
 * @param {import('@/domains/types.js').TunerDomain} domain
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
       * Set a single parameter value, clamped to the hardware-aware range.
       * @param {string} key
       * @param {number} value
       */
      setParam(key, value) {
        const { min, max } = domain.rangeFor(key, this.hardware)
        const clamped = Math.max(min, Math.min(max, value))
        this.params[key] = clamped
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
        this._urlWriteTimer = setTimeout(() => {
          const encoded = domain.encodeState({
            hardware: this.hardware,
            params: this.params,
            activePreset: this.activePreset,
            activeTab: this.activeTab,
          })
          history.replaceState(null, '', `#${encoded}`)
        }, URL_DEBOUNCE_MS)
      },
    },
  })
}

function restoreFromUrlHash(domain) {
  if (typeof window === 'undefined') return null
  const hash = window.location.hash.slice(1)
  if (!hash) return null
  return domain.decodeState(hash)
}
