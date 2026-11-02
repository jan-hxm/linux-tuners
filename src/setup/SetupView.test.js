// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import SetupView from './SetupView.vue'
import { DEFAULT_MACHINE } from '@/core/machine.js'
import { SETUP_STEPS, FACT_PROVIDERS, deriveSteps, skippedForRole } from './steps.js'
import { encodeSetup } from './link.js'
import { useSetupStore, useStepStore } from './useSetupStore.js'
import { defineTunerStore } from '@/core/createTunerStore.js'

async function setupAt(path, hash = '') {
  history.replaceState(null, '', `/setup${hash ? `#${hash}` : ''}`)
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/setup', component: SetupView }, { path: '/:p(.*)*', component: { template: '<div />' } }] })
  router.push(path)
  await router.isReady()
  const wrapper = mount({ template: '<RouterView />' }, { global: { plugins: [router], stubs: { teleport: true } } })
  await flushPromises()
  return wrapper
}

const stepButtons = (wrapper) => wrapper.get('nav[aria-label="Setup steps"]').findAll('button')
const heading = (wrapper) => wrapper.get('h2').text()

describe('SetupView', () => {
  let warn
  let error

  beforeEach(() => {
    setActivePinia(createPinia())
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    error = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('walks from the machine through every step to the files without warnings', async () => {
    const wrapper = await setupAt('/setup')
    expect(heading(wrapper)).toContain('Machine profile')
    for (const step of SETUP_STEPS) {
      await wrapper.findAll('button').find((b) => b.text().endsWith('→')).trigger('click')
      expect(heading(wrapper)).toContain(step.entry.title)
    }
    await wrapper.findAll('button').find((b) => b.text().endsWith('→')).trigger('click')
    expect(heading(wrapper)).toContain('Files')
    const setup = useSetupStore()
    for (const { id } of SETUP_STEPS.filter((s) => !setup.skipped.includes(s.id))) {
      for (const file of useStepStore(id).configFiles) expect(wrapper.text()).toContain(file.path)
    }
    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('starts from the role the landing page picked, and marks the skipped steps', async () => {
    const wrapper = await setupAt('/setup?role=desktop')
    const setup = useSetupStore()
    expect(setup.machine.role).toBe('desktop')
    expect(setup.skipped).toEqual(skippedForRole('desktop'))
    const skippedTitles = SETUP_STEPS.filter((s) => setup.skipped.includes(s.id)).map((s) => s.entry.title)
    for (const title of skippedTitles) expect(stepButtons(wrapper).find((b) => b.text().includes(title)).text()).toContain('Skipped')
    wrapper.unmount()
  })

  it('restores a shared link, and ignores one that fails', async () => {
    const machine = { ...DEFAULT_MACHINE, role: 'database', ramGiB: 64 }
    const skipped = skippedForRole('database')
    const hash = encodeSetup({ machine, skipped, steps: deriveSteps(machine, skipped) })
    let wrapper = await setupAt('/setup', hash)
    expect(useSetupStore().machine).toEqual(machine)
    wrapper.unmount()

    setActivePinia(createPinia())
    wrapper = await setupAt('/setup?role=web', `${hash.slice(0, -4)}AAAA`)
    expect(useSetupStore().machine).toEqual({ ...DEFAULT_MACHINE, role: 'web' })
    wrapper.unmount()
  })

  it('re-derives every step on a machine change, and Undo puts it back', async () => {
    const wrapper = await setupAt('/setup')
    const setup = useSetupStore()
    const [first] = SETUP_STEPS
    useStepStore(first.id).setParam(first.domain.parameterKeys[0], useStepStore(first.id).params[first.domain.parameterKeys[0]])
    const before = JSON.stringify(useStepStore(first.id).$state)
    setup.setHardware({ ...setup.machine, ramGiB: 128 })
    await flushPromises()
    expect(wrapper.text()).toContain('Updated every step for the new machine profile.')
    setup.undo()
    expect(setup.machine.ramGiB).toBe(DEFAULT_MACHINE.ramGiB)
    expect(JSON.stringify(useStepStore(first.id).$state)).toBe(before)
    wrapper.unmount()
  })

  it('feeds a fact change forward and writes the link', async () => {
    vi.useFakeTimers()
    const wrapper = await setupAt('/setup')
    // A fact a later step's profile field copies.
    const reader = SETUP_STEPS.find(({ domain }) => domain.profile.fields.some((f) => Object.hasOwn(FACT_PROVIDERS, f.machine)))
    const fact = reader.domain.profile.fields.find((f) => Object.hasOwn(FACT_PROVIDERS, f.machine)).machine
    const provider = FACT_PROVIDERS[fact]
    const field = reader.domain.profile.fields.find((f) => f.machine === fact)
    const providerStep = SETUP_STEPS.find((s) => s.id === provider)
    // systemd 243 raises kernel.pid_max at boot whatever the kernel step says.
    useSetupStore().setHardware({ ...DEFAULT_MACHINE, systemd: 'older' })
    const store = useStepStore(provider)
    // Move the provider's params until the fact changes.
    const old = providerStep.domain.facts(store.hardware, store.params)[fact]
    const changed = () => providerStep.domain.facts(store.hardware, store.params)[fact] !== old
    for (const key of providerStep.domain.parameterKeys) {
      const range = providerStep.domain.rangeFor(key, store.hardware)
      if (range?.max === undefined) continue
      for (const value of [range.min, range.max]) if (!changed()) store.setParam(key, value)
      if (changed()) break
    }
    const next = providerStep.domain.facts(store.hardware, store.params)[fact]
    expect(next).not.toBe(old)
    await flushPromises()
    expect(useStepStore(reader.id).hardware[field.key]).toBe(next)
    expect(useStepStore(reader.id).facts[fact]).toBe(next)
    vi.advanceTimersByTime(300)
    expect(window.location.hash.length).toBeGreaterThan(1)
    wrapper.unmount()
  })

  it("gives the steps stores that never read the tuner page's hash", () => {
    const [first] = SETUP_STEPS
    const domain = first.domain
    const params = { ...domain.deriveDefaults(domain.defaultHardware) }
    const key = domain.parameterKeys[0]
    const range = domain.rangeFor(key, domain.defaultHardware)
    params[key] = range.min === params[key] ? range.max : range.min
    history.replaceState(null, '', `/x#${domain.encodeState({ hardware: domain.defaultHardware, params })}`)
    expect(defineTunerStore('t-on', domain)().params[key]).toBe(params[key])
    expect(defineTunerStore('t-off', domain, { urlSync: false })().params[key]).not.toBe(params[key])
  })
})
