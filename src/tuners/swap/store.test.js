import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { compressToEncodedURIComponent } from 'lz-string'
import { useTunerStoreFor, restoreState } from '@/core/createTunerStore.js'
import { swapDomain } from './index.js'
import { deriveDefaults } from './calculations.js'

describe('tuner store — applyPreset', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('resets parameters the preset does not mention to hardware defaults', () => {
    const store = useTunerStoreFor(swapDomain)
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
    const store = useTunerStoreFor(swapDomain)

    const values = { swappiness: 10, min_free_kbytes: 262144, watermark_scale_factor: 2000 }
    store.applyPreset('k8s', values)
    const first = { ...store.params }

    // Customise something in between, then re-apply.
    store.setParam('dirty_ratio', 99)
    store.applyPreset('k8s', values)
    const second = { ...store.params }

    expect(second).toEqual(first)
  })

  it('ignores a non-finite value and rounds a fractional one', () => {
    const store = useTunerStoreFor(swapDomain)
    const before = store.params.swappiness
    for (const bad of [NaN, Infinity, '60', null]) store.setParam('swappiness', bad)
    expect(store.params.swappiness).toBe(before)
    store.setParam('swappiness', 42.6)
    expect(store.params.swappiness).toBe(43)
  })

  it('records the active preset id', () => {
    const store = useTunerStoreFor(swapDomain)
    store.applyPreset('database', { swappiness: 1 })
    expect(store.activePreset).toBe('database')
  })

  it('holds preset values to what the profile kernel accepts', () => {
    const store = useTunerStoreFor(swapDomain)
    store.setHardware({ ...store.hardware, kernelVersion: '4.15' })
    store.applyPreset('k8s-zram', { swappiness: 133, watermark_scale_factor: 2000 })
    expect(store.params.swappiness).toBe(100)
    expect(store.params.watermark_scale_factor).toBe(1000)
  })
})

describe('shared links', () => {
  const v1Link = (params) => compressToEncodedURIComponent(JSON.stringify({ v: 1, hardware: swapDomain.defaultHardware, params, activePreset: null, activeTab: null }))

  it('refuses a link from before vm.page-cluster, and round-trips a current one', () => {
    const { page_cluster, ...before } = deriveDefaults(swapDomain.defaultHardware)
    expect(restoreState(swapDomain, v1Link(before))).toBeNull()
    // A version 1 link is refused even with every current key in it.
    expect(restoreState(swapDomain, v1Link({ ...before, page_cluster }))).toBeNull()
    const params = { ...before, page_cluster: 0 }
    const hash = swapDomain.encodeState({ hardware: swapDomain.defaultHardware, params })
    expect(restoreState(swapDomain, hash).params).toEqual(params)
  })

  it('holds a hostile vm.page-cluster to what the slider offers', () => {
    const base = deriveDefaults(swapDomain.defaultHardware)
    const restore = (v) => restoreState(swapDomain, swapDomain.encodeState({ hardware: swapDomain.defaultHardware, params: { ...base, page_cluster: v } }))
    expect(restore(99).params.page_cluster).toBe(31)
    expect(restore(-5).params.page_cluster).toBe(0)
    expect(restore(3.4).params.page_cluster).toBe(3)
    for (const bad of ['3', '"><script>', null, [3], {}]) expect(restore(bad)).toBeNull()
  })
})
