import { describe, it, expect } from 'vitest'
import { restoreState } from './createTunerStore.js'
import { swapDomain } from '@/domains/swap/index.js'
import { systemdDomain } from '@/domains/systemd/index.js'

function hashFor(domain, overrides = {}, hardware = domain.defaultHardware) {
  return domain.encodeState({
    hardware,
    params: { ...domain.deriveDefaults(hardware), ...overrides.params },
    activePreset: overrides.activePreset ?? null,
    activeTab: null,
  })
}

describe('restoreState (shared-link hash → store state)', () => {
  it('returns null for an empty hash', () => {
    expect(restoreState(swapDomain, '')).toBeNull()
  })

  it('rounds fractional parameter values, which sysctl would reject', () => {
    const restored = restoreState(swapDomain, hashFor(swapDomain, { params: { swappiness: 60.5, overcommit_memory: 1.4 } }))
    expect(restored.params.swappiness).toBe(61)
    expect(restored.params.overcommit_memory).toBe(1)
  })

  it('clamps out-of-range values into the slider range', () => {
    const restored = restoreState(swapDomain, hashFor(swapDomain, { params: { swappiness: 9999 } }))
    expect(restored.params.swappiness).toBe(200)
  })

  it('drops a preset id that is not a real preset, including inherited names', () => {
    for (const bogus of ['toString', 'constructor', '__proto__', 'no-such-preset']) {
      const restored = restoreState(swapDomain, hashFor(swapDomain, { activePreset: bogus }))
      expect(restored.activePreset).toBeNull()
    }
  })

  it('keeps a real preset id', () => {
    const id = swapDomain.presets[0].id
    expect(restoreState(swapDomain, hashFor(swapDomain, { activePreset: id })).activePreset).toBe(id)
  })

  it('yields whole-byte systemd values for odd RAM sizes', () => {
    const hw = { ...systemdDomain.defaultHardware, ramGiB: 0.3 }
    const restored = restoreState(systemdDomain, hashFor(systemdDomain, { params: { default_limit_memlock: 1e12 } }, hw))
    expect(Number.isInteger(restored.params.default_limit_memlock)).toBe(true)
  })
})
