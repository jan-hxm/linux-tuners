// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import UndoToast from './UndoToast.vue'
import { useTunerStoreFor } from '@/core/createTunerStore.js'
import { swapDomain } from '@/tuners/swap/index.js'
import { TUNER_STORE_KEY, TUNER_DOMAIN_KEY } from '@/ui/useActiveTuner.js'

function mountToast(store) {
  return mount(UndoToast, {
    attachTo: document.body,
    global: { provide: { [TUNER_STORE_KEY]: store, [TUNER_DOMAIN_KEY]: swapDomain } },
  })
}

const undoButton = (wrapper) => wrapper.findAll('button').find((b) => b.text() === 'Undo')

describe('undo after a reset or a preset snap', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('puts back the params and preset a snap replaced', async () => {
    const store = useTunerStoreFor(swapDomain)
    store.setParam('swappiness', 42)
    const before = { ...store.params }
    const preset = swapDomain.presets[0]
    store.applyPreset(preset.id, preset.values)

    const wrapper = mountToast(store)
    await nextTick()
    expect(wrapper.text()).toContain(`Applied the ${preset.label} preset.`)
    await undoButton(wrapper).trigger('click')
    expect(store.params).toEqual(before)
    expect(store.activePreset).toBe(null)
    expect(store.undoState).toBe(null)
    expect(wrapper.text()).toBe('')
    wrapper.unmount()
  })

  it('undoes a reset too, and any later edit drops the undo', async () => {
    const store = useTunerStoreFor(swapDomain)
    store.setParam('swappiness', 42)
    store.resetToHardwareDefaults()
    expect(store.undoState.kind).toBe('reset')
    store.undo()
    expect(store.params.swappiness).toBe(42)

    store.resetToHardwareDefaults()
    store.setParam('swappiness', 43)
    expect(store.undoState).toBe(null)
    store.resetToHardwareDefaults()
    store.setHardware({ ...store.hardware })
    expect(store.undoState).toBe(null)
  })

  it('offers nothing to undo when the snap changed nothing', () => {
    const store = useTunerStoreFor(swapDomain)
    store.resetToHardwareDefaults()
    expect(store.undoState).toBe(null)
  })

  it('hides after a few seconds, but not while it holds focus', async () => {
    const store = useTunerStoreFor(swapDomain)
    const wrapper = mountToast(store)
    store.setParam('swappiness', 42)
    store.resetToHardwareDefaults()
    await nextTick()
    await undoButton(wrapper).trigger('focusin')
    vi.advanceTimersByTime(20000)
    expect(store.undoState).not.toBe(null)

    await undoButton(wrapper).trigger('focusout')
    vi.advanceTimersByTime(20000)
    expect(store.undoState).toBe(null)
    wrapper.unmount()
  })

  it('dismisses on Escape', async () => {
    const store = useTunerStoreFor(swapDomain)
    const wrapper = mountToast(store)
    store.setParam('swappiness', 42)
    store.resetToHardwareDefaults()
    await nextTick()
    await undoButton(wrapper).trigger('keydown', { key: 'Escape' })
    expect(store.undoState).toBe(null)
    wrapper.unmount()
  })
})
