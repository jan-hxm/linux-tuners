import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import { valueTypeOf } from './valueTypes.js'
import { matchesRule, snapToStep } from './profile.js'

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
 * @param {Record<string, Object>} opts.defsByKey  Defs, for each value's type
 * @param {Object} opts.defaultHardware           Fallback hardware shape
 * @param {Object} opts.hardwareSchema            Allowed value per hardware field (core/profile.js profileSchema)
 * @param {number} [opts.version]                 Schema version tag
 */
export function makeSerialization({ parameterKeys, defsByKey, defaultHardware, hardwareSchema, version = SCHEMA_VERSION }) {
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
      // Every known parameter must be present and parse as its def's value
      // type; unknown keys are dropped. Range clamping happens in restoreState.
      const params = {}
      for (const key of parameterKeys) {
        const def = defsByKey[key]
        const value = valueTypeOf(def).restore(parsed.params[key], def)
        if (value === undefined) return null
        params[key] = value
      }
      const hardware = restoreFields(parsed.hardware, hardwareSchema, defaultHardware)
      if (!hardware) return null
      return {
        hardware,
        params,
        activePreset: typeof parsed.activePreset === 'string' ? parsed.activePreset : null,
        activeTab: typeof parsed.activeTab === 'string' ? parsed.activeTab : null,
      }
    } catch {
      return null
    }
  }

  return { encodeState, decodeState }
}

/**
 * Profile fields from a link, held to their schema. They end up in the
 * generated config (comments, a file path), so anything outside the schema
 * rejects the whole set. Missing fields inherit from the defaults; unknown
 * fields are dropped; numbers snap to their step.
 *
 * @param {*} raw
 * @param {Object} schema    core/profile.js profileSchema
 * @param {Object} defaults
 * @returns {Object|null}
 */
export function restoreFields(raw, schema, defaults) {
  if (!isPlainObject(raw)) return null
  const out = { ...defaults }
  for (const [key, rule] of Object.entries(schema)) {
    if (!Object.hasOwn(raw, key)) continue
    const value = raw[key]
    if (!matchesRule(value, rule, defaults[key])) return null
    out[key] = snapToStep(value, rule)
  }
  return out
}

export function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

