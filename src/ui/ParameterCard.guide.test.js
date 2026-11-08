// @vitest-environment happy-dom
// Zone notes and the live-guide card (Design.md §7 "Three layers per
// parameter"). Test-local defs: no tuner's own defs carry zone notes here.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import ParameterCard from './ParameterCard.vue'
import { useTunerStoreFor } from '@/core/createTunerStore.js'
import { swapDomain } from '@/tuners/swap/index.js'
import { TUNERS } from '@/tuners/registry.js'
import { TUNER_STORE_KEY, TUNER_DOMAIN_KEY } from '@/ui/useActiveTuner.js'
import { HOW_IT_WORKS_KEY } from './descParts.js'

const KEY = 'swappiness'
const domain = {
  ...swapDomain,
  defsByKey: {
    ...swapDomain.defsByKey,
    [KEY]: {
      ...swapDomain.defsByKey[KEY],
      zones: [
        { label: 'low', min: 0, max: 29, note: 'Anonymous pages stay in RAM.' },
        { label: 'middle', min: 30, max: 59 },
        { label: 'high', min: 60, max: 200, note: 'Swapping is cheap here.' },
      ],
    },
  },
}

const entry = TUNERS.find((t) => t.id === swapDomain.id)
const originalGuide = entry.guide

function mountCard(options = {}) {
  const store = useTunerStoreFor(swapDomain)
  const wrapper = mount(ParameterCard, {
    props: { paramKey: KEY, ...options.props },
    global: { provide: { [TUNER_STORE_KEY]: store, [TUNER_DOMAIN_KEY]: domain, ...options.provide } },
  })
  return { store, wrapper }
}
const margin = (w) => w.get('aside')
const learnMore = (w) => w.findAll('button').find((b) => b.text() === 'Learn more')

beforeEach(() => {
  setActivePinia(createPinia())
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  if (originalGuide === undefined) delete entry.guide
  else entry.guide = originalGuide
})

describe('ParameterCard zone note', () => {
  it('shows the current zone note as the margin first note and follows the value', async () => {
    const { store, wrapper } = mountCard()
    store.params[KEY] = 10
    await nextTick()
    expect(margin(wrapper).findAll('li')[0].text()).toContain('Anonymous pages stay in RAM.')
    store.params[KEY] = 45
    await nextTick()
    expect(margin(wrapper).text()).not.toContain('Anonymous pages stay in RAM.')
    expect(margin(wrapper).text()).not.toContain('Swapping is cheap here.')
    store.params[KEY] = 100
    await nextTick()
    expect(margin(wrapper).findAll('li')[0].text()).toContain('Swapping is cheap here.')
  })

  it('announces a changed note once the value has settled, not while dragging', async () => {
    useTunerStoreFor(swapDomain).params[KEY] = 10
    const { store, wrapper } = mountCard()
    await nextTick()
    vi.advanceTimersByTime(700)
    const live = wrapper.get('[aria-live="polite"]')
    expect(live.text()).toBe('')
    store.params[KEY] = 100
    await nextTick()
    vi.advanceTimersByTime(300)
    store.params[KEY] = 120
    await nextTick()
    vi.advanceTimersByTime(300)
    expect(live.text()).toBe('')
    vi.advanceTimersByTime(400)
    await nextTick()
    await nextTick()
    expect(live.text()).toBe('high: Swapping is cheap here.')
  })
})

describe('ParameterCard with a guide', () => {
  const chapters = (key) => (key === KEY ? 'what-reclaim-chooses' : null)

  it('is unchanged without a guide and with a draft guide', async () => {
    entry.guide = undefined
    const none = mountCard({ props: { howItWorks: chapters } })
    expect(none.wrapper.text()).not.toContain('How it works')
    expect(learnMore(none.wrapper)).toBeTruthy()
    const before = margin(none.wrapper).html()
    entry.guide = { slug: 'memory', status: 'draft' }
    const draft = mountCard({ props: { howItWorks: chapters } })
    expect(draft.wrapper.text()).not.toContain('How it works')
    expect(margin(draft.wrapper).html()).toBe(before)
  })

  it('live: no longDesc notes, no Learn more, a How it works link to the chapter', async () => {
    entry.guide = { slug: 'memory', status: 'live' }
    const { wrapper } = mountCard({ props: { howItWorks: chapters } })
    const def = domain.defsByKey[KEY]
    expect(learnMore(wrapper)).toBeUndefined()
    expect(wrapper.text()).not.toContain(def.longDesc.what[0].slice(0, 40))
    const link = wrapper.findAll('a').find((a) => a.text().startsWith('How it works'))
    expect(link.attributes('href')).toBe('/learn/memory#what-reclaim-chooses')
    // The card keeps its short description, origin note and the drawer button.
    expect(wrapper.text()).toContain(def.shortDesc)
    expect(wrapper.text()).toMatch(/Full reference/)
  })

  it('live: takes the lookup from the provider, and shows no link for an unpinned key', () => {
    entry.guide = { slug: 'memory', status: 'live' }
    const provided = mountCard({ provide: { [HOW_IT_WORKS_KEY]: chapters } })
    expect(provided.wrapper.text()).toContain('How it works')
    const unpinned = mountCard({ provide: { [HOW_IT_WORKS_KEY]: () => null } })
    expect(unpinned.wrapper.text()).not.toContain('How it works')
  })

  it('live: keeps the zone note as the first margin note', async () => {
    entry.guide = { slug: 'memory', status: 'live' }
    const { store, wrapper } = mountCard({ props: { howItWorks: chapters } })
    store.params[KEY] = 10
    await nextTick()
    expect(margin(wrapper).findAll('li')[0].text()).toContain('Anonymous pages stay in RAM.')
  })
})
