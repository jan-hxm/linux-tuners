// @vitest-environment happy-dom
// The registry is the one list of tuners: check its shape and that every
// consumer (domains, router, routes-meta) agrees with it.
import { describe, it, expect } from 'vitest'
import { TUNERS, LIVE_TUNERS, PLANNED_TUNERS } from './registry.js'
import { TUNER_DOMAINS } from '@/tuners/domains.js'
import { TUNER_VIEWS, router } from '@/router.js'
import { ROUTES_META } from '@/routes-meta.js'
import { MACHINE_ROLES } from '@/core/machineRoles.js'
import { GUIDES } from '@/learn/guides.js'

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
      const shown = [t.title, t.blurb, t.navLabel, t.question, ...t.keys, ...Object.values(t.route ?? {}), t.setup?.why]
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

  // The landing table's first column (Design.md §9 "Registry").
  it('asks one question per live tuner, without em dashes', () => {
    for (const t of LIVE_TUNERS) {
      expect(typeof t.question, t.id).toBe('string')
      expect(t.question.trim(), t.id).toBe(t.question)
      expect(t.question, t.id).toMatch(/\S\?$/)
      expect(t.question, t.id).not.toContain(EM_DASH)
    }
    const questions = LIVE_TUNERS.map((t) => t.question)
    expect(new Set(questions).size).toBe(questions.length)
  })

  it('gives planned tuners no path, nav entry, route, question or table facts', () => {
    for (const t of PLANNED_TUNERS) {
      expect(t.question, t.id).toBeUndefined()
      expect(t.settingCount, t.id).toBeUndefined()
      expect(t.writes, t.id).toBeUndefined()
      expect(t.path, t.id).toBeUndefined()
      expect(t.navLabel, t.id).toBeUndefined()
      expect(t.route, t.id).toBeUndefined()
      expect(t.setup, t.id).toBeUndefined()
    }
  })

  it('recommends every live tuner for a list of known machine roles, or all of them', () => {
    const roles = MACHINE_ROLES.map((r) => r.value)
    for (const t of LIVE_TUNERS) {
      expect(t.setup?.why, t.id).toBeTruthy()
      if (t.setup.roles === 'all') continue
      expect(t.setup.roles.length, t.id).toBeGreaterThan(0)
      expect(new Set(t.setup.roles).size, t.id).toBe(t.setup.roles.length)
      // A list naming every role should say 'all', so a new role reaches it.
      expect(t.setup.roles.length, t.id).toBeLessThan(roles.length)
      for (const role of t.setup.roles) expect(roles, t.id).toContain(role)
    }
  })

  it('says when the defaults are fine for every live tuner', () => {
    for (const t of LIVE_TUNERS) {
      expect(t.setup.defaultsFine, t.id).toBeTruthy()
      expect(t.setup.defaultsFine, t.id).not.toContain(EM_DASH)
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

  // Study guides (Design.md §5 "Learning pages"); src/learn/guides.test.js
  // checks the slugs against the guides the contract suite finds.
  it('gives a guide only to live tuners, as { slug, status } with a loader in guides.js', () => {
    for (const t of TUNERS.filter((x) => x.guide)) {
      expect(t.status, t.id).toBe('live')
      expect(Object.keys(t.guide).sort(), t.id).toEqual(['slug', 'status'])
      expect(t.guide.slug, t.id).toMatch(/^[a-z][a-z0-9-]*$/)
      expect(['draft', 'live'], t.id).toContain(t.guide.status)
      expect(GUIDES[t.guide.slug]?.tunerId, t.id).toBe(t.id)
    }
    expect(TUNERS.find((t) => t.id === 'swap').guide).toEqual({ slug: 'memory', status: 'draft' })
  })

  // Search results cut descriptions at about 155 characters, and link
  // checkers warn above that.
  it('keeps every page description short enough for search results', () => {
    for (const r of ROUTES_META) expect(r.description.length, r.path).toBeLessThanOrEqual(155)
  })
})
