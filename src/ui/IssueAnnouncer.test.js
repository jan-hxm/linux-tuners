// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import IssueAnnouncer from './IssueAnnouncer.vue'
import { useTunerStoreFor } from '@/core/createTunerStore.js'
import { swapDomain } from '@/tuners/swap/index.js'
import { TUNER_STORE_KEY, TUNER_DOMAIN_KEY } from '@/ui/useActiveTuner.js'

function mountAnnouncer(store) {
  return mount(IssueAnnouncer, {
    global: { provide: { [TUNER_STORE_KEY]: store, [TUNER_DOMAIN_KEY]: swapDomain } },
  })
}

/** Let the values settle and the region update. */
async function settle() {
  await vi.advanceTimersByTimeAsync(1000)
}

describe('IssueAnnouncer', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reads a new issue once the values settle, and says when it clears', async () => {
    const store = useTunerStoreFor(swapDomain)
    const wrapper = mountAnnouncer(store)
    const region = wrapper.get('[aria-live="polite"]')
    expect(region.text()).toBe('')

    // A drag across the threshold and back says nothing.
    const { dirty_ratio: ratio, dirty_background_ratio: bg } = store.params
    store.setParam('dirty_background_ratio', ratio)
    await vi.advanceTimersByTimeAsync(100)
    store.setParam('dirty_background_ratio', bg)
    await settle()
    expect(region.text()).toBe('')

    store.setParam('dirty_background_ratio', ratio)
    await settle()
    // The fix follows the message.
    const read = `Error: dirty_background_ratio must be less than dirty_ratio. Lower vm.dirty_background_ratio below ${ratio}, or raise vm.dirty_ratio above ${ratio}.`
    expect(region.text()).toBe(read)

    // Another edit that leaves the same issue says nothing new.
    store.setParam('swappiness', store.params.swappiness + 1)
    await settle()
    expect(region.text()).toBe(read)

    store.setParam('dirty_background_ratio', bg)
    await settle()
    expect(region.text()).toBe('No issues left.')
    wrapper.unmount()
  })

  it("doesn't read the issues that were there when it mounted", async () => {
    const store = useTunerStoreFor(swapDomain)
    store.setParam('dirty_background_ratio', store.params.dirty_ratio)
    const wrapper = mountAnnouncer(store)
    store.setParam('swappiness', store.params.swappiness + 1)
    await settle()
    expect(wrapper.text()).toBe('')
    wrapper.unmount()
  })
})
