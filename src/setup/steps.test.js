import { describe, it, expect } from 'vitest'
import { DEFAULT_MACHINE, MACHINE_FIELDS, factValues, machineValues } from '@/core/machine.js'
import { LIVE_TUNERS } from '@/tuners/registry.js'
import { SETUP_STEPS, STEP_IDS, FACT_PROVIDERS, deriveSteps, skippedForRole } from './steps.js'

const stepById = Object.fromEntries(SETUP_STEPS.map((s) => [s.id, s]))

describe('setup steps', () => {
  it('has one step per live tuner, in the registry order', () => {
    expect(STEP_IDS).toEqual(LIVE_TUNERS.map((t) => t.id))
    for (const step of SETUP_STEPS) expect(step.domain?.id, step.id).toBe(step.id)
  })

  it('skips, for each role, exactly the tuners the role does not recommend', () => {
    for (const { value: role } of MACHINE_FIELDS.find((f) => f.key === 'role').options) {
      const skipped = skippedForRole(role)
      for (const t of LIVE_TUNERS) expect(skipped.includes(t.id), `${role}: ${t.id}`).toBe(!(t.setup.roles === 'all' || t.setup.roles.includes(role)))
    }
  })

  it('keeps a change made for one step until its machine field changes', () => {
    const machine = { ...DEFAULT_MACHINE, role: 'database' }
    const skipped = skippedForRole(machine.role)
    const steps = deriveSteps(machine, skipped)
    // A step whose workload maps the role, changed for that step only.
    const { id, domain } = SETUP_STEPS.find((s) => s.domain.profile.fields.find((f) => f.key === s.domain.workloadField)?.machine)
    const other = domain.workloads.find((w) => w !== steps[id].hardware[domain.workloadField])
    steps[id] = { ...steps[id], hardware: { ...steps[id].hardware, [domain.workloadField]: other } }

    const moreRam = deriveSteps({ ...machine, ramGiB: 64 }, skipped, { machine, steps })
    expect(moreRam[id].hardware[domain.workloadField]).toBe(other)
    if ('ramGiB' in moreRam[id].hardware) expect(moreRam[id].hardware.ramGiB).toBe(64)

    const newRole = deriveSteps({ ...machine, role: 'web' }, skipped, { machine, steps })
    expect(newRole[id].hardware[domain.workloadField]).toBe(machineValues(domain.profile.fields, { ...machine, role: 'web' })[domain.workloadField])
  })

  it('feeds each fact forward from its provider, and none from a skipped provider', () => {
    for (const [fact, provider] of Object.entries(FACT_PROVIDERS)) {
      const readers = SETUP_STEPS.filter(({ domain }) => domain.profile.fields.some((f) => f.machine === fact))
      const with_ = deriveSteps(DEFAULT_MACHINE, [])
      const without = deriveSteps(DEFAULT_MACHINE, [provider])
      for (const { id, domain } of readers) {
        expect(with_[id].facts[fact], `${id} gets ${fact}`).toBe(stepById[provider].domain.facts(with_[provider].hardware, with_[provider].params)[fact])
        expect(factValues(domain.profile.fields, with_[id].facts)).not.toEqual({})
        expect(Object.hasOwn(without[id].facts, fact), `${id} without ${provider}`).toBe(false)
      }
    }
  })
})
