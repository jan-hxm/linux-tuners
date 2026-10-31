// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTunerStoreFor } from '@/core/createTunerStore.js'
import { swapDomain } from '@/tuners/swap/index.js'

describe('tuner store — syncUrl', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    history.replaceState({ routerState: 1 }, '', '/swap')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('writes the hash without discarding the router history state', () => {
    const store = useTunerStoreFor(swapDomain)
    store.setParam('swappiness', 42)
    vi.advanceTimersByTime(500)
    expect(window.location.hash.length).toBeGreaterThan(1)
    expect(history.state).toEqual({ routerState: 1 })
  })

  it('does not write onto another route if the user navigated away within the debounce', () => {
    const store = useTunerStoreFor(swapDomain)
    store.setParam('swappiness', 42)
    history.pushState(null, '', '/systemd')
    vi.advanceTimersByTime(500)
    expect(window.location.pathname).toBe('/systemd')
    expect(window.location.hash).toBe('')
  })
})
