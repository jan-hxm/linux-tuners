/**
 * Byte-level snapshots of every tuner's generated config for each profile's
 * defaults and each preset. The migration steps in TODO.md §4 are refactors
 * with no behaviour change; these snapshots prove it. Update them (vitest -u)
 * only for an intended output change, and review the diff.
 */
import { describe, it, expect } from 'vitest'
import { TUNER_DOMAINS } from './domains.js'

const NOW = new Date('2026-01-01T00:00:00Z')

describe.each(TUNER_DOMAINS.map((d) => [d.id, d]))('generated config: %s', (_id, domain) => {
  const profiles = [
    domain.defaultHardware,
    ...domain.workloads.map((w) => ({ ...domain.defaultHardware, [domain.workloadField]: w })),
  ]
  for (const hardware of profiles) {
    const workload = hardware[domain.workloadField]
    it(`${workload} / defaults`, () => {
      const params = domain.deriveDefaults(hardware)
      expect(domain.generateConfig({ hardware, params, presetLabel: null, customised: false, now: NOW })).toMatchSnapshot()
    })
    for (const preset of domain.presets) {
      it(`${workload} / ${preset.id}`, () => {
        const params = { ...domain.deriveDefaults(hardware), ...preset.values }
        expect(domain.generateConfig({ hardware, params, presetLabel: preset.label, customised: false, now: NOW })).toMatchSnapshot()
      })
    }
  }
})
