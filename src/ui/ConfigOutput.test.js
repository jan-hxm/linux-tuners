// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import ConfigOutput from './ConfigOutput.vue'
import { useTunerStoreFor } from '@/core/createTunerStore.js'
import { combineFiles } from '@/core/output/files.js'
import { swapDomain } from '@/tuners/swap/index.js'
import { systemdDomain } from '@/tuners/systemd/index.js'
import { TUNER_STORE_KEY, TUNER_DOMAIN_KEY } from '@/ui/useActiveTuner.js'

function mountOutput(domain) {
  const store = useTunerStoreFor(domain)
  const wrapper = mount(ConfigOutput, {
    global: { provide: { [TUNER_STORE_KEY]: store, [TUNER_DOMAIN_KEY]: domain } },
  })
  return { store, wrapper }
}

const copyButton = (wrapper) => wrapper.findAll('button').find((b) => /Copy to clipboard|Copied/.test(b.text()))

// A state that trips each domain's blocking validation.
const BLOCKING = [
  [swapDomain, 'swap', { dirty_background_ratio: 50, dirty_ratio: 20 }],
  [systemdDomain, 'systemd', { default_limit_nofile_soft: 1048576, default_limit_nofile_hard: 1024 }],
]

describe('ConfigOutput', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useRealTimers()
  })

  describe.each([
    [swapDomain, 'swap', { swappiness: 10 }],
    [systemdDomain, 'systemd', { cpu_weight: 200 }],
  ])('%#: %s output', (domain, _name, change) => {
    it('shows what the generator produces for the current state and follows changes', async () => {
      const { store, wrapper } = mountOutput(domain)
      const expected = () => combineFiles(store.configFiles)
      expect(wrapper.get('textarea').element.value).toBe(expected())

      const before = expected()
      for (const [k, v] of Object.entries(change)) store.setParam(k, v)
      await nextTick()
      expect(expected()).not.toBe(before)
      expect(wrapper.get('textarea').element.value).toBe(expected())
      expect(wrapper.get('textarea').attributes('readonly')).toBeDefined()
    })

    it('copies the textarea text, then confirms and returns to idle', async () => {
      vi.useFakeTimers()
      const writeText = vi.fn().mockResolvedValue()
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
      const { store, wrapper } = mountOutput(domain)

      expect(copyButton(wrapper).text()).toBe('Copy to clipboard')
      await copyButton(wrapper).trigger('click')
      await flushPromises()
      expect(writeText).toHaveBeenCalledTimes(1)
      expect(writeText).toHaveBeenCalledWith(combineFiles(store.configFiles))
      expect(copyButton(wrapper).text()).toBe('Copied ✓')
      expect(wrapper.text()).toContain('Copied to clipboard.')

      vi.advanceTimersByTime(2000)
      await nextTick()
      expect(copyButton(wrapper).text()).toBe('Copy to clipboard')
      vi.useRealTimers()
    })

    it('says so when the clipboard refuses', async () => {
      const writeText = vi.fn().mockRejectedValue(new Error('denied'))
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
      const { wrapper } = mountOutput(domain)
      await copyButton(wrapper).trigger('click')
      await flushPromises()
      expect(wrapper.text()).toContain('Clipboard write failed. Select the textarea and copy manually.')
      expect(copyButton(wrapper).text()).toBe('Copy to clipboard')
    })
  })

  describe.each(BLOCKING)('%#: %s blocked state', (domain, _name, bad) => {
    it('withholds the output and offers no copy while a blocking issue stands, then restores it', async () => {
      const writeText = vi.fn().mockResolvedValue()
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
      const { store, wrapper } = mountOutput(domain)
      const good = { ...store.params }

      for (const [k, v] of Object.entries(bad)) store.setParam(k, v)
      await nextTick()

      const blocking = store.issues.filter((i) => i.blocking)
      expect(blocking.length).toBeGreaterThan(0)
      expect(wrapper.text()).toContain('Config output is suppressed.')
      for (const issue of blocking) expect(wrapper.text()).toContain(issue.message)
      expect(wrapper.find('textarea').exists()).toBe(false)
      expect(copyButton(wrapper)).toBeUndefined()
      expect(wrapper.findAll('button').some((b) => /Download/.test(b.text()))).toBe(false)
      expect(writeText).not.toHaveBeenCalled()

      for (const k of Object.keys(bad)) store.setParam(k, good[k])
      await nextTick()
      expect(wrapper.text()).not.toContain('Config output is suppressed.')
      expect(wrapper.get('textarea').element.value).toBe(combineFiles(store.configFiles))
      expect(copyButton(wrapper)).toBeDefined()
    })
  })
})
