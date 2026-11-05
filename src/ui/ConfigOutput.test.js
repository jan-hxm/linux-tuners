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

const copyButton = (wrapper) => wrapper.findAll('button').find((b) => /^(Copy the file|Copy all files|Copied)$/.test(b.text()))
/** The copy button's resting label: one file, or all of them. */
const copyLabel = (store) => (store.configFiles.length > 1 ? 'Copy all files' : 'Copy the file')
/** The output as the preview shows it. */
const preview = (wrapper) => wrapper.get('pre').element.textContent

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
      expect(preview(wrapper)).toBe(expected())

      const before = expected()
      for (const [k, v] of Object.entries(change)) store.setParam(k, v)
      await nextTick()
      expect(expected()).not.toBe(before)
      expect(preview(wrapper)).toBe(expected())
      expect(wrapper.get('pre').attributes('contenteditable')).toBeUndefined()
    })

    it('copies the output text, then confirms and returns to idle', async () => {
      vi.useFakeTimers()
      const writeText = vi.fn().mockResolvedValue()
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
      const { store, wrapper } = mountOutput(domain)

      expect(copyButton(wrapper).text()).toBe(copyLabel(store))
      await copyButton(wrapper).trigger('click')
      await flushPromises()
      expect(writeText).toHaveBeenCalledTimes(1)
      expect(writeText).toHaveBeenCalledWith(combineFiles(store.configFiles))
      expect(copyButton(wrapper).text()).toBe('Copied')
      expect(wrapper.text()).toContain('Copied to clipboard.')

      vi.advanceTimersByTime(2000)
      await nextTick()
      expect(copyButton(wrapper).text()).toBe(copyLabel(store))
      vi.useRealTimers()
    })

    it('says so when the clipboard refuses', async () => {
      const writeText = vi.fn().mockRejectedValue(new Error('denied'))
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
      const { store, wrapper } = mountOutput(domain)
      await copyButton(wrapper).trigger('click')
      await flushPromises()
      expect(wrapper.text()).toContain('Clipboard write failed. Select the text below and copy it by hand.')
      expect(copyButton(wrapper).text()).toBe(copyLabel(store))
    })
  })

  it('opens with a summary from state and marks the first step as next after a copy', async () => {
    // The "Copied" confirmation resets after 1.8 s; fake timers keep a slow
    // run from passing that before the assertions.
    vi.useFakeTimers()
    const writeText = vi.fn().mockResolvedValue()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const { store, wrapper } = mountOutput(swapDomain)
    const shown = [...new Set(swapDomain.sections.flatMap((s) => swapDomain.visibleKeys(s, store.params, store.hardware)))]
    expect(wrapper.text()).toContain(`${shown.length} settings. All fit your machine.`)

    store.setParam('swappiness', store.params.swappiness === 10 ? 20 : 10)
    await nextTick()
    expect(wrapper.text()).toContain(`${shown.length} settings. ${shown.length - 1} fit your machine, 1 changed by you.`)
    // The changed setting's line carries the "changed by you" colour; the text is the output.
    expect(wrapper.findAll('pre .text-mine-text').map((l) => l.text())).toEqual([expect.stringMatching(/^vm\.swappiness = /)])

    const firstStep = () => wrapper.find('aside ol > li')
    expect(firstStep().attributes('aria-current')).toBeUndefined()
    await copyButton(wrapper).trigger('click')
    await flushPromises()
    expect(firstStep().attributes('aria-current')).toBe('step')
    expect(firstStep().text()).toContain('Next.')
    expect(wrapper.text()).toContain('Copied to clipboard. Next: save the file.')

    // Once the output changes, what was copied is stale: no step is next.
    store.setParam('swappiness', 30)
    await nextTick()
    expect(firstStep().attributes('aria-current')).toBeUndefined()
    vi.useRealTimers()
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
      expect(wrapper.find('pre').exists()).toBe(false)
      expect(copyButton(wrapper)).toBeUndefined()
      expect(wrapper.findAll('button').some((b) => /Download/.test(b.text()))).toBe(false)
      expect(writeText).not.toHaveBeenCalled()

      for (const k of Object.keys(bad)) store.setParam(k, good[k])
      await nextTick()
      expect(wrapper.text()).not.toContain('Config output is suppressed.')
      expect(preview(wrapper)).toBe(combineFiles(store.configFiles))
      expect(copyButton(wrapper)).toBeDefined()
    })
  })
})
