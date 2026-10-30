import { describe, it, expect } from 'vitest'
import { reactive } from 'vue'
import { useTunerSimulation } from './useTunerSimulation.js'

describe('useTunerSimulation', () => {
  it('exposes one computed per simulation function, tracking hardware and params', () => {
    const store = reactive({ hardware: { ramGiB: 8 }, params: { swappiness: 60 } })
    let runs = 0
    const simulation = {
      sum: (hw, p) => (runs++, hw.ramGiB + p.swappiness),
      LIMIT: 100, // non-function exports are skipped
    }
    const sim = useTunerSimulation(store, simulation)
    expect(Object.keys(sim)).toEqual(['sum'])
    expect(sim.sum.value).toBe(68)
    expect(sim.sum.value).toBe(68)
    expect(runs).toBe(1)
    store.params.swappiness = 10
    expect(sim.sum.value).toBe(18)
    store.hardware = { ramGiB: 16 }
    expect(sim.sum.value).toBe(26)
  })
})
