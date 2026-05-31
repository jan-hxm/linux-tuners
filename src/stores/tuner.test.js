import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTunerStore } from './tuner.js'
import { deriveDefaults } from '@/model/calculations.js'

describe('tuner store — applyPreset', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('resets parameters the preset does not mention to hardware defaults', () => {
    const store = useTunerStore()
    const defaults = deriveDefaults(store.hardware)

    // Customise every parameter to something distinct from its default.
    for (const key of Object.keys(store.params)) {
      store.setParam(key, defaults[key] + 1)
    }

    // A preset that only specifies swappiness.
    store.applyPreset('swappiness-only', { swappiness: 42 })

    expect(store.params.swappiness).toBe(42)
    // Every other parameter must be back at the hardware-derived default,
    // not the customised (default + 1) value.
    for (const key of Object.keys(store.params)) {
      if (key === 'swappiness') continue
      expect(store.params[key]).toBe(defaults[key])
    }
  })

  it('is idempotent — applying the same preset twice yields identical state', () => {
    const store = useTunerStore()

    const values = { swappiness: 10, min_free_kbytes: 262144, watermark_scale_factor: 2000 }
    store.applyPreset('k8s', values)
    const first = { ...store.params }

    // Customise something in between, then re-apply.
    store.setParam('dirty_ratio', 99)
    store.applyPreset('k8s', values)
    const second = { ...store.params }

    expect(second).toEqual(first)
  })

  it('records the active preset id', () => {
    const store = useTunerStore()
    store.applyPreset('database', { swappiness: 1 })
    expect(store.activePreset).toBe('database')
  })
})
