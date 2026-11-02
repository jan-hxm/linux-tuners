// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import InstallSteps from './InstallSteps.vue'
import ConfigOutput from './ConfigOutput.vue'
import { useTunerStoreFor } from '@/core/createTunerStore.js'
import { swapDomain } from '@/tuners/swap/index.js'
import { TUNER_STORE_KEY, TUNER_DOMAIN_KEY } from '@/ui/useActiveTuner.js'

const FILE = { path: '/etc/sysctl.d/99-a.conf', content: 'vm.swappiness = 10' }

describe('InstallSteps', () => {
  it('numbers the steps, copies each command on its own, and says how to undo', async () => {
    const writeText = vi.fn().mockResolvedValue()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const wrapper = mount(InstallSteps, { props: { files: [FILE] } })

    expect(wrapper.findAll('ol > li').map((li) => li.find('p .font-semibold').text())).toEqual([
      'Save the file.', 'Apply it now.', 'Check a value.',
    ])
    expect(wrapper.text()).toContain('If something goes wrong: delete the file and reboot.')

    await wrapper.find('button[aria-label="Copy command: sysctl vm.swappiness"]').trigger('click')
    await nextTick()
    expect(writeText).toHaveBeenCalledWith('sysctl vm.swappiness')
    expect(wrapper.find('button[aria-label="Copy command: sysctl vm.swappiness"]').text()).toBe('Copied ✓')
    expect(wrapper.find('button[aria-label="Copy command: sudo sysctl --system"]').text()).toBe('Copy')
  })
})

describe('ConfigOutput differing values', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('lists the values that differ from the kernel defaults behind a toggle', async () => {
    const store = useTunerStoreFor(swapDomain)
    const wrapper = mount(ConfigOutput, {
      global: { provide: { [TUNER_STORE_KEY]: store, [TUNER_DOMAIN_KEY]: swapDomain } },
    })
    const stock = Object.fromEntries(swapDomain.parameterKeys.map((k) => [k, swapDomain.defsByKey[k].kernelDefault]))
    store.applyPreset('custom', stock)
    store.setParam('swappiness', 10)
    await nextTick()

    const toggle = wrapper.find('button[aria-controls="output-differing"]')
    expect(toggle.text()).toContain('1 value differs from the kernel defaults')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    await toggle.trigger('click')
    expect(wrapper.find('#output-differing').text()).toContain('vm.swappiness')
    expect(wrapper.find('#output-differing').text()).toContain('60 → 10')
  })
})
