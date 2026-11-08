import { describe, it, expect } from 'vitest'
import { MACHINE_ROLES, isMachineRole, tunersForRole } from './machineRoles.js'
import { LIVE_TUNERS } from '@/tuners/registry.js'

const ids = (list) => list.map((t) => t.id)

describe('machine roles', () => {
  it('gives every role a short plain-text hint without an em dash', () => {
    for (const r of MACHINE_ROLES) {
      expect(typeof r.hint, r.value).toBe('string')
      expect(r.hint.trim(), r.value).toBe(r.hint)
      expect(r.hint.length, r.value).toBeGreaterThan(10)
      expect(r.hint.length, r.value).toBeLessThanOrEqual(60)
      expect(r.hint, r.value).not.toMatch(/[—–<>&]|\.$/)
    }
  })

  it('accepts only known role ids', () => {
    expect(isMachineRole('database')).toBe(true)
    for (const v of ['', 'Database', 'admin', ['database'], undefined, null]) expect(isMachineRole(v)).toBe(false)
  })

  it('splits tuners by role and keeps the setup order in both groups', () => {
    const tuners = [
      { id: 'a', setup: { roles: 'all' } },
      { id: 'b', setup: { roles: ['database'] } },
      { id: 'c', setup: { roles: ['router'] } },
      { id: 'd' },
      { id: 'e', setup: { roles: 'all' } },
    ]
    expect(tunersForRole(tuners, 'database')).toEqual({
      recommended: [tuners[0], tuners[1], tuners[4]],
      optional: [tuners[2], tuners[3]],
    })
  })

  it('recommends huge pages and SysV IPC for a database and puts them under optional on a desktop', () => {
    const db = tunersForRole(LIVE_TUNERS, 'database')
    expect(ids(db.recommended)).toEqual(expect.arrayContaining(['hugepages', 'sysv-ipc', 'network']))
    const desktop = tunersForRole(LIVE_TUNERS, 'desktop')
    expect(ids(desktop.optional)).toEqual(['network', 'hugepages', 'sysv-ipc'])
  })

  it('gives every role every tuner, split between the two groups', () => {
    for (const { value } of MACHINE_ROLES) {
      const { recommended, optional } = tunersForRole(LIVE_TUNERS, value)
      expect([...ids(recommended), ...ids(optional)].sort(), value).toEqual(ids(LIVE_TUNERS).sort())
    }
  })
})
