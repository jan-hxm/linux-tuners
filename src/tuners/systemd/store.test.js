import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTunerStoreFor } from '@/core/createTunerStore.js'
import { systemdDomain } from './index.js'
import { deriveDefaults } from './calculations.js'

describe('systemd store — applyPreset', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('resets parameters the preset does not mention to profile defaults', () => {
    const store = useTunerStoreFor(systemdDomain)
    const defaults = deriveDefaults(store.hardware)

    for (const key of Object.keys(store.params)) {
      store.setParam(key, defaults[key] + 1)
    }

    store.applyPreset('memhigh-only', { memory_high: 42 })

    expect(store.params.memory_high).toBe(42)
    for (const key of Object.keys(store.params)) {
      if (key === 'memory_high') continue
      expect(store.params[key]).toBe(defaults[key])
    }
  })

  it('records the active preset id', () => {
    const store = useTunerStoreFor(systemdDomain)
    store.applyPreset('database-server', { memory_swap_max: 0 })
    expect(store.activePreset).toBe('database-server')
  })

  it('clamps a single parameter to its profile-aware range', () => {
    const store = useTunerStoreFor(systemdDomain)
    // cpu_quota max is cores × 100; default cpuCores = 8 → 800.
    store.setParam('cpu_quota', 999999)
    expect(store.params.cpu_quota).toBe(800)
  })

  it('recomputes defaults when the system profile changes', () => {
    const store = useTunerStoreFor(systemdDomain)
    store.setHardware({ ...store.hardware, workload: 'database' })
    expect(store.params.memory_swap_max).toBe(0)
    expect(store.activePreset).toBeNull()
  })
})
