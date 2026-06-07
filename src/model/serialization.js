import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import { PARAMETER_KEYS, DEFAULT_HARDWARE } from './parameters.js'

/**
 * Versioned envelope so we can evolve the URL format later without breaking
 * existing shared links.
 */
const SCHEMA_VERSION = 1

/**
 * Build a serialization pair bound to a particular tuner's parameter keys and
 * default hardware. Each tuner (swap, systemd, …) has a different set of keys,
 * so the codec is parameterised rather than hardcoded — a swap-encoded hash
 * won't decode as systemd state and vice versa (decodeState requires every key
 * of the *target* domain to be present), which keeps the shared URL hash from
 * cross-contaminating between routes.
 *
 * @param {Object} opts
 * @param {readonly string[]} opts.parameterKeys  Every key that must be present
 * @param {Object} opts.defaultHardware           Fallback hardware shape
 * @param {number} [opts.version]                 Schema version tag
 */
export function makeSerialization({ parameterKeys, defaultHardware, version = SCHEMA_VERSION }) {
  /**
   * @param {Object} state
   * @param {Object} state.hardware
   * @param {Object} state.params
   * @param {string|null} [state.activePreset]
   * @param {string} [state.activeTab]
   * @returns {string} URL-safe compressed string
   */
  function encodeState(state) {
    const envelope = {
      v: version,
      hardware: state.hardware,
      params: state.params,
      activePreset: state.activePreset ?? null,
      activeTab: state.activeTab ?? null,
    }
    return compressToEncodedURIComponent(JSON.stringify(envelope))
  }

  /**
   * @param {string} encoded
   * @returns {{ hardware: Object, params: Object, activePreset: string|null, activeTab: string|null } | null}
   */
  function decodeState(encoded) {
    try {
      const json = decompressFromEncodedURIComponent(encoded)
      if (!json) return null
      const parsed = JSON.parse(json)
      if (!parsed || typeof parsed !== 'object') return null
      if (parsed.v !== version) return null
      if (!isPlainObject(parsed.hardware) || !isPlainObject(parsed.params)) return null
      // Make sure every known parameter is present; missing ones inherit from defaults.
      const params = { ...parsed.params }
      for (const key of parameterKeys) {
        if (typeof params[key] !== 'number') return null
      }
      const hardware = { ...defaultHardware, ...parsed.hardware }
      return {
        hardware,
        params,
        activePreset: parsed.activePreset ?? null,
        activeTab: parsed.activeTab ?? null,
      }
    } catch {
      return null
    }
  }

  return { encodeState, decodeState }
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

/**
 * Swap-tuner serialization instance. Kept as the module's default export pair so
 * existing imports (and the swap serialization tests) keep working unchanged.
 */
export const { encodeState, decodeState } = makeSerialization({
  parameterKeys: PARAMETER_KEYS,
  defaultHardware: DEFAULT_HARDWARE,
})
