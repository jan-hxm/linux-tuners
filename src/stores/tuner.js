import { defineStore } from 'pinia'
import { DEFAULT_HARDWARE } from '@/model/parameters.js'
import { deriveDefaults, rangeFor } from '@/model/calculations.js'
import { validate, hasBlockingIssue } from '@/model/validation.js'
import { encodeState, decodeState } from '@/model/serialization.js'

const URL_DEBOUNCE_MS = 200

export const useTunerStore = defineStore('tuner', {
  state: () => {
    const restored = restoreFromUrlHash()
    if (restored) {
      return {
        hardware: restored.hardware,
        params: restored.params,
        activePreset: restored.activePreset,
        activeTab: restored.activeTab,
        _urlWriteTimer: null,
      }
    }
    return {
      hardware: { ...DEFAULT_HARDWARE },
      params: deriveDefaults(DEFAULT_HARDWARE),
      activePreset: null,
      /** 'pressure' | 'watermarks' | 'dirty' */
      activeTab: 'pressure',
      /** key of the parameter currently shown in the InfoDrawer, or null */
      drawerParamKey: null,
      _urlWriteTimer: null,
    }
  },

  getters: {
    issues(state) {
      return validate(state.hardware, state.params)
    },
    blocked() {
      return hasBlockingIssue(this.issues)
    },
    /** {[paramKey]: ValidationIssue[]} for fast per-card lookup */
    issuesByParam() {
      /** @type {Record<string, import('@/model/validation.js').ValidationIssue[]>} */
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
     * Use this when the user submits the HardwareForm.
     * @param {import('@/model/parameters.js').HardwareSpec} hw
     */
    setHardware(hw) {
      this.hardware = { ...hw }
      this.params = deriveDefaults(this.hardware)
      this.activePreset = null
      this.syncUrl()
    },

    /**
     * Set a single parameter value, clamped to the hardware-aware range.
     * @param {string} key
     * @param {number} value
     */
    setParam(key, value) {
      const { min, max } = rangeFor(key, this.hardware)
      const clamped = Math.max(min, Math.min(max, value))
      this.params[key] = clamped
      this.activePreset = null
      this.syncUrl()
    },

    /**
     * Snap all parameters to a preset's values.
     * @param {string} id
     * @param {Partial<import('@/model/parameters.js').ParameterValues>} values
     */
    applyPreset(id, values) {
      this.params = { ...this.params, ...values }
      this.activePreset = id
      this.syncUrl()
    },

    resetToHardwareDefaults() {
      this.params = deriveDefaults(this.hardware)
      this.activePreset = null
      this.syncUrl()
    },

    /**
     * @param {'pressure'|'watermarks'|'dirty'} tab
     */
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
        const encoded = encodeState({
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

function restoreFromUrlHash() {
  if (typeof window === 'undefined') return null
  const hash = window.location.hash.slice(1)
  if (!hash) return null
  return decodeState(hash)
}