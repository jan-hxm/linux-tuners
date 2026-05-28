import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import { PARAMETER_KEYS, DEFAULT_HARDWARE } from './parameters.js'

/**
 * Versioned envelope so we can evolve the URL format later without breaking
 * existing shared links.
 */
const SCHEMA_VERSION = 1

/**
 * @param {Object} state
 * @param {import('./parameters.js').HardwareSpec} state.hardware
 * @param {import('./parameters.js').ParameterValues} state.params
 * @param {string|null} [state.activePreset]
 * @param {string} [state.activeTab]
 * @returns {string} URL-safe compressed string
 */
export function encodeState(state) {
  const envelope = {
    v: SCHEMA_VERSION,
    hardware: state.hardware,
    params: state.params,
    activePreset: state.activePreset ?? null,
    activeTab: state.activeTab ?? 'pressure',
  }
  return compressToEncodedURIComponent(JSON.stringify(envelope))
}

/**
 * @param {string} encoded
 * @returns {{ hardware: import('./parameters.js').HardwareSpec, params: import('./parameters.js').ParameterValues, activePreset: string|null, activeTab: string } | null}
 */
export function decodeState(encoded) {
  try {
    const json = decompressFromEncodedURIComponent(encoded)
    if (!json) return null
    const parsed = JSON.parse(json)
    if (!parsed || typeof parsed !== 'object') return null
    if (parsed.v !== SCHEMA_VERSION) return null
    if (!isPlainObject(parsed.hardware) || !isPlainObject(parsed.params)) return null
    // Make sure every known parameter is present; missing ones inherit from defaults.
    const params = { ...parsed.params }
    for (const key of PARAMETER_KEYS) {
      if (typeof params[key] !== 'number') return null
    }
    const hardware = { ...DEFAULT_HARDWARE, ...parsed.hardware }
    return {
      hardware,
      params,
      activePreset: parsed.activePreset ?? null,
      activeTab: parsed.activeTab ?? 'pressure',
    }
  } catch {
    return null
  }
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}