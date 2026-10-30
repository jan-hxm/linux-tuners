// @vitest-environment happy-dom
// The registry is the one list of tuners: check its shape and that every
// consumer (domains, router, routes-meta) agrees with it.
import { describe, it, expect } from 'vitest'
import { TUNERS, LIVE_TUNERS, PLANNED_TUNERS } from './registry.js'
import { TUNER_DOMAINS } from '@/tuners/domains.js'
import { TUNER_VIEWS, router } from '@/router.js'
import { ROUTES_META } from '@/routes-meta.js'

const EM_DASH = String.fromCharCode(0x2014)
const ROUTE_FIELDS = ['title', 'description', 'ogTitle', 'priority', 'changefreq', 'jsonLdType']

describe('tuner registry', () => {
  it('has unique kebab-case ids and a known status', () => {
    const ids = TUNERS.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const t of TUNERS) {
      expect(t.id).toMatch(/^[a-z][a-z0-9-]*$/)
      expect(['live', 'planned']).toContain(t.status)
    }
    expect(LIVE_TUNERS.length + PLANNED_TUNERS.length).toBe(TUNERS.length)
  })

  it('gives every entry landing-card text without em dashes', () => {
    for (const t of TUNERS) {
      expect(t.title, t.id).toBeTruthy()
      expect(t.blurb, t.id).toBeTruthy()
      expect(t.keys.length, t.id).toBeGreaterThan(0)
      const shown = [t.title, t.blurb, t.navLabel, ...t.keys, ...Object.values(t.route ?? {})]
      expect(shown.join(' '), t.id).not.toContain(EM_DASH)
    }
  })

  it('gives live tuners a safe path, a nav label and full route metadata', () => {
    for (const t of LIVE_TUNERS) {
      // The postbuild script turns the path into a directory under dist/.
      expect(t.path, t.id).toBe(`/${t.id}`)
      expect(t.navLabel, t.id).toBeTruthy()
      for (const field of ROUTE_FIELDS) expect(t.route?.[field], `${t.id}.route.${field}`).toBeDefined()
    }
  })

  it('gives planned tuners no path, nav entry or route', () => {
    for (const t of PLANNED_TUNERS) {
      expect(t.path, t.id).toBeUndefined()
      expect(t.navLabel, t.id).toBeUndefined()
      expect(t.route, t.id).toBeUndefined()
    }
  })

  it('has exactly one domain module per live tuner', () => {
    expect(TUNER_DOMAINS.map((d) => d.id).sort()).toEqual(LIVE_TUNERS.map((t) => t.id).sort())
  })

  it('has exactly one lazy view per live tuner', () => {
    expect(Object.keys(TUNER_VIEWS).sort()).toEqual(LIVE_TUNERS.map((t) => t.id).sort())
  })

  it('routes every live tuner and no planned one', () => {
    const paths = ROUTES_META.map((r) => r.path)
    for (const t of LIVE_TUNERS) {
      expect(paths, t.id).toContain(t.path)
      const record = router.getRoutes().find((r) => r.path === t.path)
      expect(record?.components?.default, t.id).toBe(TUNER_VIEWS[t.id])
    }
    for (const t of PLANNED_TUNERS) {
      expect(paths, t.id).not.toContain(`/${t.id}`)
      expect(router.hasRoute(t.id), t.id).toBe(false)
    }
  })
})
