import { describe, it, expect } from 'vitest'
import { MACHINE_FIELDS, DEFAULT_MACHINE, machineValues, machineProblems } from './machine.js'
import { profileProblems } from './profile.js'
import { MACHINE_ROLES } from './machineRoles.js'

const WORKLOAD = {
  key: 'workload',
  type: 'choice',
  control: 'select',
  label: 'Workload',
  options: [{ value: 'general', label: 'General' }, { value: 'db', label: 'Database' }],
  default: 'general',
  machine: {
    from: 'role',
    map: Object.fromEntries(MACHINE_ROLES.map((r) => [r.value, r.value === 'database' ? 'db' : 'general'])),
  },
}
const RAM = { key: 'ramGiB', type: 'number', label: 'RAM', min: 1, max: 64, step: 1, default: 16, machine: 'ramGiB' }
const CORES = { key: 'cores', type: 'number', label: 'Cores', min: 1, max: 64, step: 1, default: 8 }

describe('machine profile', () => {
  it('is a sound profile field list whose role options are the machine roles', () => {
    expect(profileProblems(MACHINE_FIELDS)).toEqual([])
    expect(MACHINE_FIELDS.find((f) => f.key === 'role').options).toBe(MACHINE_ROLES)
  })

  it('copies or maps the declared fields and leaves the rest out', () => {
    const machine = { ...DEFAULT_MACHINE, role: 'database', ramGiB: 4 }
    expect(machineValues([WORKLOAD, RAM, CORES], machine)).toEqual({ workload: 'db', ramGiB: 4 })
    expect(machineValues([WORKLOAD], { ...machine, role: 'desktop' })).toEqual({ workload: 'general' })
    expect(machineValues([WORKLOAD], { ...machine, role: 'constructor' })).toEqual({ workload: undefined })
  })

  it('accepts sound declarations', () => {
    expect(machineProblems([WORKLOAD, RAM, CORES])).toEqual([])
  })

  it('reports an unknown machine field, a map on a number field and a map missing or adding an option', () => {
    const { database: _, ...partial } = WORKLOAD.machine.map
    expect(machineProblems([{ ...CORES, machine: 'cpuCores' }])).toHaveLength(1)
    expect(machineProblems([{ ...RAM, machine: { from: 'ramGiB', map: {} } }])).toHaveLength(1)
    expect(machineProblems([{ ...WORKLOAD, machine: { from: 'role', map: partial } }])).toHaveLength(1)
    expect(machineProblems([{ ...WORKLOAD, machine: { from: 'role', map: { ...partial, typo: 'db' } } }])).toHaveLength(1)
  })
})
