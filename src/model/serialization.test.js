import { describe, it, expect } from 'vitest'
import { compressToEncodedURIComponent } from 'lz-string'
import { encodeState, decodeState } from './serialization.js'
import { DEFAULT_HARDWARE } from './parameters.js'
import { deriveDefaults } from './calculations.js'

function makeState(overrides = {}) {
  return {
    hardware: { ...DEFAULT_HARDWARE },
    params: deriveDefaults(DEFAULT_HARDWARE),
    activePreset: null,
    activeTab: 'pressure',
    ...overrides,
  }
}

describe('encodeState / decodeState', () => {
  it('round-trips a complete state', () => {
    const original = makeState({ activePreset: 'k8s-node', activeTab: 'watermarks' })
    const encoded = encodeState(original)
    const decoded = decodeState(encoded)
    expect(decoded).toEqual(original)
  })

  it('returns null on garbage input', () => {
    expect(decodeState('this-is-not-valid-lz-string')).toBeNull()
    expect(decodeState('')).toBeNull()
  })

  it('rejects payloads missing a known parameter', () => {
    const original = makeState()
    // Synthesise a payload that round-trips through lz-string cleanly but is
    // missing one of the required ParameterValues keys.
    const { swappiness, ...partial } = original.params
    const tampered = compressToEncodedURIComponent(
      JSON.stringify({ v: 1, hardware: original.hardware, params: partial, activePreset: null, activeTab: 'pressure' }),
    )
    expect(decodeState(tampered)).toBeNull()
  })

  it('rejects payloads with a future schema version', () => {
    const original = makeState()
    const payload = compressToEncodedURIComponent(
      JSON.stringify({ ...original, v: 999 }),
    )
    expect(decodeState(payload)).toBeNull()
  })
})