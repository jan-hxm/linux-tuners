import { describe, it, expect } from 'vitest'
import { compressToEncodedURIComponent } from 'lz-string'
import { encodeState, decodeState } from './serialization.js'
import { DEFAULT_HARDWARE } from './parameters.js'
import { deriveDefaults } from './calculations.js'
import { systemdDomain } from '@/domains/systemd/index.js'

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

  // Hardware fields are echoed into the generated config, so a crafted share
  // link must not be able to smuggle extra lines (e.g. kernel.core_pattern) in.
  it('rejects hardware values outside the schema', () => {
    const encode = (hardware) =>
      compressToEncodedURIComponent(JSON.stringify({ ...makeState(), v: 1, hardware }))
    const hw = DEFAULT_HARDWARE
    expect(decodeState(encode({ ...hw, workload: "general\nkernel.core_pattern = |/bin/sh" }))).toBeNull()
    expect(decodeState(encode({ ...hw, swapDevice: 'nvme-ssd\nvm.panic_on_oom = 1' }))).toBeNull()
    expect(decodeState(encode({ ...hw, ramGiB: '16' }))).toBeNull()
    expect(decodeState(encode({ ...hw, swapGiB: -1 }))).toBeNull()
    expect(decodeState(encode({ ...hw, kernelVersion: '6.6\nfoo' }))).toBeNull()
  })

  it('drops unknown hardware and parameter keys, keeps valid ones', () => {
    const state = makeState()
    const payload = compressToEncodedURIComponent(JSON.stringify({
      ...state,
      v: 1,
      hardware: { ...state.hardware, kernelVersion: '6.6', evil: 'x' },
      params: { ...state.params, evil: 1 },
    }))
    const decoded = decodeState(payload)
    expect(decoded.hardware).toEqual({ ...DEFAULT_HARDWARE, kernelVersion: '6.6' })
    expect(decoded.params).toEqual(state.params)
  })

  it('rejects non-finite or non-numeric parameter values', () => {
    const state = makeState()
    const payload = compressToEncodedURIComponent(JSON.stringify({
      ...state, v: 1, params: { ...state.params, swappiness: '60\nkernel.x=1' },
    }))
    expect(decodeState(payload)).toBeNull()
  })

  it('rejects a systemd targetSlice that would inject into the slice path', () => {
    const state = {
      v: 1,
      hardware: { ...systemdDomain.defaultHardware, targetSlice: 'system.slice\n[Service]\nExecStartPre=/bin/sh' },
      params: systemdDomain.deriveDefaults(systemdDomain.defaultHardware),
    }
    expect(systemdDomain.decodeState(compressToEncodedURIComponent(JSON.stringify(state)))).toBeNull()
  })

  it('rejects payloads with a future schema version', () => {
    const original = makeState()
    const payload = compressToEncodedURIComponent(
      JSON.stringify({ ...original, v: 999 }),
    )
    expect(decodeState(payload)).toBeNull()
  })
})