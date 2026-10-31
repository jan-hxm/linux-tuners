// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import ProfileForm from './ProfileForm.vue'
import { useTunerStoreFor } from '@/core/createTunerStore.js'
import { swapDomain } from '@/tuners/swap/index.js'
import { systemdDomain } from '@/tuners/systemd/index.js'
import { TUNER_STORE_KEY, TUNER_DOMAIN_KEY } from '@/ui/useActiveTuner.js'

function mountForm(domain) {
  const store = useTunerStoreFor(domain)
  const wrapper = mount(ProfileForm, {
    global: { provide: { [TUNER_STORE_KEY]: store, [TUNER_DOMAIN_KEY]: domain } },
  })
  const input = (key) => wrapper.find(`#profile-${domain.id}-${key}`)
  return { store, wrapper, input }
}

describe('ProfileForm', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    history.replaceState(null, '', '/')
  })

  it('renders every field from the swap field list with the defaults', () => {
    const { wrapper, input } = mountForm(swapDomain)
    expect(input('ramGiB').element.value).toBe('16')
    expect(input('swapGiB').element.value).toBe('8')
    expect(input('workload').element.value).toBe('general')
    expect(wrapper.find('input[type="radio"][value="nvme-ssd"]').element.checked).toBe(true)
    expect(wrapper.find('[role="radio"][aria-checked="true"]').text()).toBe('v2')
    // Help text renders inline code as an element, not backticks.
    expect(wrapper.find('code').text()).toBe('uname -r')
    expect(wrapper.text()).not.toContain('`')
  })

  it('snaps and clamps numbers on apply, like a restored link', async () => {
    const { store, wrapper, input } = mountForm(swapDomain)
    await input('ramGiB').setValue('0.3')
    await input('swapGiB').setValue('-5')
    expect(wrapper.text()).toContain('Unsaved changes')
    await wrapper.find('form').trigger('submit')
    expect(store.hardware.ramGiB).toBe(307 / 1024)
    expect(store.hardware.swapGiB).toBe(0)
    // The params follow the new profile.
    expect(store.params).toEqual(swapDomain.deriveDefaults(store.hardware))
  })

  it('collapses to a summary after the first apply and stays open after Edit', async () => {
    const { wrapper } = mountForm(swapDomain)
    await wrapper.find('form').trigger('submit')
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).toContain('16 GiB RAM · 8 GiB nvme-ssd swap · General purpose Linux server')
    expect(wrapper.find('header code').exists()).toBe(true)

    await wrapper.find('header button').trigger('click')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.find('form').exists()).toBe(true)
  })

  it('refuses a kernel version the link schema would reject', async () => {
    const { store, wrapper, input } = mountForm(swapDomain)
    await input('kernelVersion').setValue('6.6 foo')
    await wrapper.find('form').trigger('submit')
    expect(store.hardware.kernelVersion).toBeNull()
    expect(input('kernelVersion').attributes('aria-invalid')).toBe('true')
    expect(wrapper.find('#profile-swap-kernelVersion-error').text()).toMatch(/letters, digits/)

    await input('kernelVersion').setValue('6.6')
    expect(wrapper.find('#profile-swap-kernelVersion-error').exists()).toBe(false)
    await wrapper.find('form').trigger('submit')
    expect(store.hardware.kernelVersion).toBe('6.6')
  })

  it('stores a blank optional field as null', async () => {
    const { store, wrapper, input } = mountForm(swapDomain)
    await input('kernelVersion').setValue('   ')
    await wrapper.find('form').trigger('submit')
    expect(store.hardware.kernelVersion).toBeNull()
  })

  it('disables the swap device when swap is 0', async () => {
    const { wrapper, input } = mountForm(swapDomain)
    await input('swapGiB').setValue('0')
    expect(wrapper.find('fieldset').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Swap is disabled; device selection has no effect.')
  })

  it('shows the note of the selected segmented option', async () => {
    const { wrapper } = mountForm(swapDomain)
    expect(wrapper.text()).toContain('cgroup v2: per-cgroup swappiness is not available.')
    await wrapper.findAll('[role="radio"]').find((b) => b.text() === 'v1').trigger('click')
    expect(wrapper.text()).toContain('cgroup v1: per-cgroup swappiness is supported but deprecated.')
  })

  it('rounds systemd integer fields and applies the slice cards', async () => {
    const { store, wrapper, input } = mountForm(systemdDomain)
    await input('cpuCores').setValue('3.7')
    await input('pidMax').setValue('99999999')
    await wrapper.find('input[type="radio"][value="machine.slice"]').setValue(true)
    await wrapper.find('form').trigger('submit')
    expect(store.hardware).toMatchObject({ cpuCores: 4, pidMax: 4194304, targetSlice: 'machine.slice' })
    expect(wrapper.text()).toContain('4 cores')
  })

  it('mirrors an external profile change into an untouched draft', async () => {
    const { store, input } = mountForm(systemdDomain)
    store.setHardware({ ...store.hardware, cpuCores: 32 })
    await nextTick()
    expect(input('cpuCores').element.value).toBe('32')
  })
})
