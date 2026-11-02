// The guided setup's link is untrusted input, like a tuner link (Design.md
// §5 "Guided setup", "Link state"; §10).
import { describe, it, expect } from 'vitest'
import { compressToEncodedURIComponent } from 'lz-string'
import { DEFAULT_MACHINE, factValues, machineValues } from '@/core/machine.js'
import { SETUP_STEPS, STEP_IDS, FACT_PROVIDERS, deriveSteps, skippedForRole } from './steps.js'
import { SETUP_LINK_VERSION, decodeSetup, encodeSetup } from './link.js'

const raw = (envelope) => compressToEncodedURIComponent(typeof envelope === 'string' ? envelope : JSON.stringify(envelope))

function defaultSetup(machine = DEFAULT_MACHINE) {
  const skipped = skippedForRole(machine.role)
  return { machine, skipped, steps: deriveSteps(machine, skipped) }
}

/** A valid envelope as plain JSON, to tamper with. */
function envelope(setup = defaultSetup()) {
  return {
    v: SETUP_LINK_VERSION,
    machine: setup.machine,
    skipped: setup.skipped,
    steps: Object.fromEntries(SETUP_STEPS.map(({ id, domain }) => [id, domain.encodeState(setup.steps[id])])),
  }
}

const strip = (steps) => Object.fromEntries(Object.entries(steps).map(([id, s]) => [id, { hardware: s.hardware, params: s.params, activePreset: s.activePreset }]))

describe('setup link', () => {
  it('restores a default setup unchanged, for every role', () => {
    for (const role of ['server', 'database', 'desktop', 'router']) {
      const setup = defaultSetup({ ...DEFAULT_MACHINE, role })
      const restored = decodeSetup(encodeSetup(setup))
      expect(restored.machine).toEqual(setup.machine)
      expect(restored.skipped).toEqual(setup.skipped)
      expect(strip(restored.steps)).toEqual(strip(setup.steps))
    }
  })

  it('restores tuned values, presets and included optional steps', () => {
    const setup = defaultSetup({ ...DEFAULT_MACHINE, role: 'desktop' })
    const [first, second] = SETUP_STEPS
    const preset = second.domain.presets[0]
    setup.steps[second.id] = { ...setup.steps[second.id], params: { ...setup.steps[second.id].params, ...preset.values }, activePreset: preset.id }
    setup.skipped = setup.skipped.slice(1)
    const restored = decodeSetup(encodeSetup(setup))
    expect(restored.skipped).toEqual(setup.skipped)
    expect(restored.steps[second.id].activePreset).toBe(preset.id)
    expect(restored.steps[second.id].params).toEqual(setup.steps[second.id].params)
    expect(restored.steps[first.id].params).toEqual(setup.steps[first.id].params)
  })

  it('rejects the whole link when any part fails', () => {
    const good = envelope()
    const [firstId, secondId] = STEP_IDS
    const cases = {
      'not lz-string': 'not a link',
      'not JSON': raw('{oops'),
      'an array': raw([]),
      'another version': raw({ ...good, v: SETUP_LINK_VERSION + 1 }),
      'no version': raw({ ...good, v: undefined }),
      'an unknown role': raw({ ...good, machine: { ...good.machine, role: 'admin' } }),
      'RAM outside the field': raw({ ...good, machine: { ...good.machine, ramGiB: 1e65 } }),
      'a newline in a machine field': raw({ ...good, machine: { ...good.machine, kernel: '5.17\nkernel.panic = 0' } }),
      'no machine': raw({ ...good, machine: null }),
      'skipped as a string': raw({ ...good, skipped: firstId }),
      'an unknown skipped step': raw({ ...good, skipped: ['toString'] }),
      'a step skipped twice': raw({ ...good, skipped: [firstId, firstId] }),
      'a missing step': raw({ ...good, steps: Object.fromEntries(Object.entries(good.steps).filter(([id]) => id !== firstId)) }),
      'an unknown step': raw({ ...good, steps: { ...good.steps, __proto__: null, evil: good.steps[firstId] } }),
      'an inherited step name': raw({ ...good, steps: { ...Object.fromEntries(Object.entries(good.steps).slice(1)), constructor: good.steps[firstId] } }),
      'a step that is not a string': raw({ ...good, steps: { ...good.steps, [firstId]: { v: 1 } } }),
      "another tuner's state": raw({ ...good, steps: { ...good.steps, [firstId]: good.steps[secondId] } }),
      'a broken step': raw({ ...good, steps: { ...good.steps, [firstId]: 'garbage' } }),
    }
    for (const [label, hash] of Object.entries(cases)) expect(decodeSetup(hash), label).toBeNull()
    expect(decodeSetup(raw(good))).not.toBeNull()
  })

  it('recomputes the mapped fields and the facts instead of reading them from the link', () => {
    const setup = defaultSetup()
    const tampered = { ...setup, steps: { ...setup.steps } }
    for (const { id, domain } of SETUP_STEPS) {
      const fields = domain.profile.fields
      const hardware = { ...setup.steps[id].hardware }
      // Another valid value for every machine-fed field: the field's own default
      // differs from the mapped value for some, the floor for numbers.
      for (const field of fields.filter((f) => f.machine !== undefined)) {
        hardware[field.key] = field.type === 'number' ? field.min : field.options?.find((o) => o.value !== hardware[field.key])?.value ?? hardware[field.key]
      }
      tampered.steps[id] = { ...setup.steps[id], hardware }
    }
    const restored = decodeSetup(encodeSetup(tampered))
    expect(restored).not.toBeNull()
    for (const { id, domain } of SETUP_STEPS) {
      const fields = domain.profile.fields
      const expected = { ...machineValues(fields, setup.machine), ...factValues(fields, restored.steps[id].facts) }
      for (const [key, value] of Object.entries(expected)) expect(restored.steps[id].hardware[key], `${id}.${key}`).toBe(value)
    }
    // A fact reaches its readers: the steps after its provider see it.
    for (const [fact, provider] of Object.entries(FACT_PROVIDERS)) {
      const after = STEP_IDS.slice(STEP_IDS.indexOf(provider) + 1)
      for (const id of after) expect(Object.hasOwn(restored.steps[id].facts, fact), `${id} gets ${fact}`).toBe(true)
    }
  })
})
