// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import InfoDrawer from './InfoDrawer.vue'
import { useTunerStoreFor } from '@/core/createTunerStore.js'
import { swapDomain } from '@/tuners/swap/index.js'
import { systemdDomain } from '@/tuners/systemd/index.js'
import { TUNER_STORE_KEY, TUNER_DOMAIN_KEY } from '@/ui/useActiveTuner.js'

async function openDrawer(domain, key) {
  const store = useTunerStoreFor(domain)
  const wrapper = mount(InfoDrawer, {
    attachTo: document.body,
    global: { provide: { [TUNER_STORE_KEY]: store, [TUNER_DOMAIN_KEY]: domain }, stubs: { teleport: true } },
  })
  store.openDrawer(key)
  await nextTick()
  return { store, wrapper }
}

describe('InfoDrawer, the pro reference', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('shows the title, a command with the current value, and the sources, not the card copy', async () => {
    const { store, wrapper } = await openDrawer(swapDomain, 'swappiness')
    store.setParam('swappiness', 10)
    await nextTick()
    expect(wrapper.get('h2').text()).toBe('Swap aggressiveness')
    expect(wrapper.get('code').text()).toBe('sudo sysctl -w vm.swappiness=10')
    expect(wrapper.text()).toContain('Sources')
    expect(wrapper.text()).not.toContain(swapDomain.defsByKey.swappiness.longDesc.what[0])
    wrapper.unmount()
  })

  it('names the workloads by their profile labels and marks the current one', async () => {
    const { wrapper } = await openDrawer(swapDomain, 'swappiness')
    const rows = wrapper.findAll('tbody tr').map((r) => r.find('td').text())
    expect(rows).toContain('Kubernetes node')
    expect(rows).toContain('Embedded / constrained memory')
    expect(rows.filter((r) => r.includes('(current)'))).toHaveLength(1)
    wrapper.unmount()
  })

  it('has no command for a setting that is not a sysctl', async () => {
    const { wrapper } = await openDrawer(systemdDomain, 'cpu_weight')
    expect(wrapper.text()).not.toContain('Try it now')
    wrapper.unmount()
  })
})
