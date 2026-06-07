// @vitest-environment happy-dom
// Smoke test that the *shared* ParameterCard renders systemd parameters when the
// systemd store + domain are injected — exercising the dependency-injection
// reuse path for a non-swap domain (toggle control + percent-of-RAM slider).
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import ParameterCard from '@/components/ParameterCard.vue'
import { useSystemdStore } from '@/stores/systemd.js'
import { systemdDomain } from '@/domains/systemd/index.js'
import { TUNER_STORE_KEY, TUNER_DOMAIN_KEY } from '@/composables/useActiveTuner.js'

function mountCard(paramKey) {
  const store = useSystemdStore()
  const wrapper = mount(ParameterCard, {
    props: { paramKey },
    global: { provide: { [TUNER_STORE_KEY]: store, [TUNER_DOMAIN_KEY]: systemdDomain } },
  })
  return { store, wrapper }
}

describe('ParameterCard with the systemd domain', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders a working slider for a percent-of-RAM control', async () => {
    const { store, wrapper } = mountCard('memory_max')
    await nextTick()
    const input = wrapper.find('input[type="range"]')
    expect(input.exists()).toBe(true)
    await input.setValue('75')
    expect(store.params.memory_max).toBe(75)
  })

  it('renders a toggle for a boolean accounting directive', async () => {
    const { store, wrapper } = mountCard('default_cpu_accounting')
    await nextTick()
    // Boolean controls render a switch, not a slider or edit button.
    expect(wrapper.find('input[type="range"]').exists()).toBe(false)
    const sw = wrapper.find('button[role="switch"]')
    expect(sw.exists()).toBe(true)
    await sw.trigger('click')
    expect(store.params.default_cpu_accounting).toBe(1)
  })

  it('shows the systemd docs label, not the swap one', async () => {
    const { wrapper } = mountCard('cpu_weight')
    await nextTick()
    await wrapper.find('button[aria-expanded="false"]').trigger('click')
    expect(wrapper.text()).toContain('systemd docs')
  })
})
