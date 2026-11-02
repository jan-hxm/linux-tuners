// @vitest-environment happy-dom
// No shipped tuner has an enum parameter yet, so a fixture domain checks the
// path one will take: the select control, the store's clamp by type, and a
// shared link carrying an unlisted option.
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import ParameterCard from './ParameterCard.vue'
import { defineTunerStore, restoreState } from '@/core/createTunerStore.js'
import { makeSerialization } from '@/core/serialization.js'
import { TUNER_STORE_KEY, TUNER_DOMAIN_KEY } from '@/ui/useActiveTuner.js'

const CC = {
  key: 'cc',
  sysctlName: 'net.ipv4.tcp_congestion_control',
  type: 'enum',
  control: 'select',
  options: [{ value: 'cubic', label: 'CUBIC' }, { value: 'bbr', label: 'BBR' }],
  kernelDefault: 'cubic',
  shortDesc: 'Congestion control.',
  title: 'Congestion control',
  longDesc: { what: ['x'] },
  kernelDocsUrl: 'https://docs.kernel.org/',
}
const defsByKey = { cc: CC }
const hardware = { workload: 'general' }

const domain = {
  id: 'fixture',
  defaultHardware: hardware,
  defsByKey,
  deriveDefaults: () => ({ cc: 'cubic' }),
  rangeFor: () => ({ min: 0, max: 0 }),
  validate: () => [],
  hasBlockingIssue: () => false,
  formatValue: (v) => v,
  contextApplies: () => false,
  noteKey: 'contextNote',
  context: { badge: 'x', label: 'x', url: 'https://x' },
  docsLabel: 'docs',
  presetsById: {},
  defaultTab: 'a',
  ...makeSerialization({ parameterKeys: ['cc'], defsByKey, defaultHardware: hardware, hardwareSchema: { workload: ['general'] } }),
}

describe('ParameterCard with an enum def', () => {
  let store
  beforeEach(() => {
    setActivePinia(createPinia())
    store = defineTunerStore('fixture', domain)()
  })

  function mountCard() {
    return mount(ParameterCard, {
      props: { paramKey: 'cc' },
      global: { provide: { [TUNER_STORE_KEY]: store, [TUNER_DOMAIN_KEY]: domain } },
    })
  }

  it('renders a select whose change sets the store, with no number range', async () => {
    const wrapper = mountCard()
    const select = wrapper.find('select')
    expect(select.findAll('option').map((o) => o.text())).toEqual(['CUBIC', 'BBR'])
    expect(wrapper.text()).not.toContain('range')
    await select.setValue('bbr')
    expect(store.params.cc).toBe('bbr')
    await nextTick()
    expect(wrapper.find('select').element.value).toBe('bbr')
  })

  it('lists only the options the range allows, and the store holds the value to them', async () => {
    const narrowed = { ...domain, rangeFor: () => ({ min: 0, max: 0, options: ['cubic'] }) }
    store = defineTunerStore('fixture-narrow', narrowed)()
    const wrapper = mount(ParameterCard, {
      props: { paramKey: 'cc' },
      global: { provide: { [TUNER_STORE_KEY]: store, [TUNER_DOMAIN_KEY]: narrowed } },
    })
    expect(wrapper.find('select').findAll('option').map((o) => o.text())).toEqual(['CUBIC'])
    store.setParam('cc', 'bbr')
    expect(store.params.cc).toBe('cubic')
  })

  it('ignores an unlisted value', () => {
    store.setParam('cc', 'bbr')
    store.setParam('cc', 'reno')
    expect(store.params.cc).toBe('bbr')
  })

  it('restores a listed option from a link and rejects anything else', () => {
    const hash = (cc) => domain.encodeState({ hardware, params: { cc } })
    expect(restoreState(domain, hash('bbr')).params.cc).toBe('bbr')
    for (const bad of ['reno', 'bbr\nx=1', 0, null]) expect(restoreState(domain, hash(bad)), String(bad)).toBeNull()
  })
})
