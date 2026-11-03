// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, provide } from 'vue'
import ProfileForm from './ProfileForm.vue'
import ProfileDraftNotice from './ProfileDraftNotice.vue'
import { useProfileDraft } from './useProfileDraft.js'
import { useTunerStoreFor } from '@/core/createTunerStore.js'
import { swapDomain } from '@/tuners/swap/index.js'
import { TUNER_STORE_KEY, TUNER_DOMAIN_KEY, PROFILE_DRAFT_KEY } from '@/ui/useActiveTuner.js'

/** The form and the notice under one shared draft, as TunerPage renders them. */
function mountPage({ collapsed = false } = {}) {
  const store = useTunerStoreFor(swapDomain)
  const Page = defineComponent({
    setup() {
      provide(PROFILE_DRAFT_KEY, useProfileDraft(store, swapDomain.profile, { collapsed }))
      return () => h('div', [h(ProfileForm), h('section', { id: 'tune' }, [h(ProfileDraftNotice)])])
    },
  })
  const wrapper = mount(Page, {
    attachTo: document.body,
    global: { provide: { [TUNER_STORE_KEY]: store, [TUNER_DOMAIN_KEY]: swapDomain } },
  })
  const notice = () => wrapper.find('#tune')
  const noticeApply = () => notice().find('button')
  return { store, wrapper, notice, noticeApply, input: (key) => wrapper.find(`#profile-swap-${key}`) }
}

describe('ProfileDraftNotice', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    history.replaceState(null, '', '/')
  })

  it('shows nothing without a provided draft', () => {
    const store = useTunerStoreFor(swapDomain)
    const wrapper = mount(ProfileDraftNotice, {
      global: { provide: { [TUNER_STORE_KEY]: store, [TUNER_DOMAIN_KEY]: swapDomain } },
    })
    expect(wrapper.text()).toBe('')
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('repeats unapplied edits above the parameters and applies them', async () => {
    const { store, wrapper, notice, noticeApply, input } = mountPage()
    expect(notice().text()).toBe('')
    await input('ramGiB').setValue('64')
    expect(notice().text()).toContain('Unsaved profile changes.')
    expect(noticeApply().text()).toBe(swapDomain.profile.applyLabel)
    await noticeApply().trigger('click')
    expect(store.hardware.ramGiB).toBe(64)
    expect(notice().text()).toBe('')
    // The same draft: the form collapsed as after its own first apply.
    expect(wrapper.find('form').exists()).toBe(false)
    wrapper.unmount()
  })

  it('points to an invalid field instead of applying', async () => {
    const { store, wrapper, notice, noticeApply, input } = mountPage()
    await input('kernelVersion').setValue('6.6 foo')
    await noticeApply().trigger('click')
    expect(store.hardware.kernelVersion).toBeNull()
    expect(notice().find('[role="alert"]').text()).toMatch(/invalid/)
    expect(document.activeElement?.id).toBe('profile-swap-kernelVersion')
    expect(input('kernelVersion').attributes('aria-invalid')).toBe('true')
    wrapper.unmount()
  })

  it('starts on the summary when the profile is already set, and stays open after Edit', async () => {
    const { wrapper } = mountPage({ collapsed: true })
    expect(wrapper.find('form').exists()).toBe(false)
    const edit = wrapper.find('header button')
    expect(edit.attributes('aria-expanded')).toBe('false')
    await edit.trigger('click')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.find('form').exists()).toBe(true)
    wrapper.unmount()
  })

  it('marks a store restored from a shared link', () => {
    const hardware = { ...swapDomain.defaultHardware, ramGiB: 64 }
    history.replaceState(null, '', `/swap#${swapDomain.encodeState({ hardware, params: swapDomain.deriveDefaults(hardware) })}`)
    expect(useTunerStoreFor(swapDomain).restoredFromLink).toBe(true)
    setActivePinia(createPinia())
    history.replaceState(null, '', '/swap')
    expect(useTunerStoreFor(swapDomain).restoredFromLink).toBe(false)
  })
})
