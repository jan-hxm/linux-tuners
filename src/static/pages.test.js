/**
 * Contract checks for the static page text (Design.md §5 "Routes, SEO and
 * build"), over every registered tuner like src/tuners/contract.test.js: the
 * doc names every parameter and preset, its copy follows §8, and its HTML
 * carries nothing executable (§10).
 */
import { describe, it, expect } from 'vitest'
import { TUNER_DOMAINS } from '@/tuners/domains.js'
import { LIVE_TUNERS, PLANNED_TUNERS } from '@/tuners/registry.js'
import { MACHINE_ROLES, tunersForRole } from '@/core/machineRoles.js'
import { LANDING_COPY, tunerFacts } from '@/ui/landing.js'
import { ROUTES_META } from '@/routes-meta.js'
import { pageDoc } from './pages.js'
import { docTexts } from './nodes.js'
import { GLOSSARY } from '@/ui/glossary.js'
import { toHtml, escapeHtml } from './html.js'
import { toMarkdown } from './markdown.js'

const NOW = new Date('2026-01-02T00:00:00Z')
const EM_DASH = '—'

/** The text of an HTML string outside <code> and <pre>, with the tags removed. */
function proseText(html) {
  return html
    .replace(/<pre>[\s\S]*?<\/pre>/g, '')
    .replace(/<code>[\s\S]*?<\/code>/g, '')
    .replace(/<[^>]+>/g, '')
}

/** Holds a page's HTML to the static layer's rules. */
function expectSafeHtml(html) {
  expect(html).not.toMatch(/<script/i)
  expect(html).not.toMatch(/\son\w+\s*=/i)
  expect(html).not.toMatch(/javascript:/i)
  expect(html).not.toMatch(/<(iframe|object|embed|style|img|form|input)\b/i)
  for (const [, href] of html.matchAll(/href="([^"]*)"/g)) expect(href).toMatch(/^https:\/\//)
  // The only attributes: the main's class, link targets and rel, and term definitions.
  for (const [, attr] of html.matchAll(/<\w+\s+([a-z-]+)=/g)) expect(['class', 'href']).toContain(attr)
  expect(html.match(/<main\b/g)).toHaveLength(1)
}

/** Headings never skip a level going down, and there is one h1, first. */
function expectHeadingOrder(html) {
  const levels = [...html.matchAll(/<h([1-6])>/g)].map((m) => Number(m[1]))
  expect(levels[0]).toBe(1)
  expect(levels.filter((l) => l === 1)).toHaveLength(1)
  levels.forEach((level, i) => {
    if (i > 0) expect(level, `h${levels[i - 1]} then h${level}`).toBeLessThanOrEqual(levels[i - 1] + 1)
  })
}

describe.each(TUNER_DOMAINS.map((d) => [d.id, d]))('static page: %s', (_id, domain) => {
  const entry = LIVE_TUNERS.find((t) => t.id === domain.id)
  const doc = pageDoc(entry.path, { now: NOW })
  const html = toHtml(doc)
  const markdown = toMarkdown(doc)
  const hardware = domain.defaultHardware
  const defaults = domain.deriveDefaults(hardware)

  it('names every visible parameter in both forms, and every other one', () => {
    for (const section of domain.sections) {
      for (const key of domain.visibleKeys(section, defaults, hardware)) {
        const { sysctlName, title } = domain.defsByKey[key]
        expect(markdown, key).toContain(`\`${sysctlName}\``)
        expect(html, key).toContain(`<code>${escapeHtml(sysctlName)}</code>`)
        expect(html, key).toContain(`<h3>${escapeHtml(title)}</h3>`)
      }
    }
    for (const def of Object.values(domain.defsByKey)) expect(markdown).toContain(def.sysctlName)
  })

  it('lists every preset and the config for the default profile', () => {
    for (const preset of domain.presets) expect(docTexts(doc)).toContain(preset.label)
    const files = domain.generateConfig({ hardware, params: defaults, presetLabel: null, customised: false, now: NOW })
    for (const file of files) {
      expect(docTexts(doc)).toContain(file.content)
      expect(markdown).toContain(file.content)
    }
  })

  it('has the page and About copy', () => {
    expect(doc.title).toBe(domain.page.title)
    expect(doc.url).toBe(`https://linux-tuners.dev${entry.path}`)
    for (const section of domain.about.sections) expect(docTexts(doc)).toContain(section.title)
    for (const tab of domain.graphTabs) expect(markdown).toContain(tab.blurb)
  })

  it('defines every glossary term it uses in a Glossary section, not a tooltip', () => {
    const ids = new Set()
    for (const block of doc.blocks) {
      const segs = block.kind === 'paragraph' ? block.segments : block.kind === 'list' ? block.items.flat() : []
      for (const s of segs) if (s.type === 'term' && Object.hasOwn(GLOSSARY, s.id)) ids.add(s.id)
    }
    if (!ids.size) return
    const texts = docTexts(doc)
    expect(texts).toContain('Glossary')
    for (const id of ids) expect(texts, id).toContain(GLOSSARY[id].definition)
  })

  it('has no em dash in any displayed text (Design.md §8)', () => {
    expect(docTexts(doc).filter((s) => s.includes(EM_DASH))).toEqual([])
    expect(markdown).not.toContain(EM_DASH)
  })

  it('leaves no rich-text markup in the HTML prose', () => {
    const prose = proseText(html)
    expect(prose).not.toMatch(/\*\*|`|\[\[|\]\]|\]\(/)
  })

  it('carries nothing executable, and keeps its headings in order', () => {
    expectSafeHtml(html)
    expectHeadingOrder(html)
  })
})

describe('static pages of every route', () => {
  it.each(ROUTES_META.map((r) => r.path))('%s', (path) => {
    const doc = pageDoc(path, { now: NOW })
    if (ROUTES_META.find((r) => r.path === path).noindex) {
      // The legal pages have no static text.
      expect(doc).toBeNull()
      return
    }
    expect(doc.blocks.length).toBeGreaterThan(2)
    const html = toHtml(doc)
    expectSafeHtml(html)
    expectHeadingOrder(html)
    expect(docTexts(doc).filter((s) => s.includes(EM_DASH))).toEqual([])
  })

  it('links the landing page to every live tuner', () => {
    const html = toHtml(pageDoc('/', { now: NOW }))
    for (const t of LIVE_TUNERS) expect(html).toContain(`href="https://linux-tuners.dev${t.path}"`)
  })

  // The same story as the live page (views/LandingView.vue), from the same copy.
  it('tells the landing page story: hero, key, why, the roles and every tuner with its question', () => {
    const doc = pageDoc('/', { now: NOW })
    const all = docTexts(doc).join('\n')
    const md = toMarkdown(doc)
    expect(doc.blocks[0]).toEqual({ kind: 'heading', level: 1, text: LANDING_COPY.hero.title })
    for (const s of [LANDING_COPY.hero.lead, LANDING_COPY.why.heading, LANDING_COPY.start.heading, ...LANDING_COPY.key.marks.map((m) => m.label)]) {
      expect(all).toContain(s)
    }
    for (const r of MACHINE_ROLES) {
      const { recommended } = tunersForRole(LIVE_TUNERS, r.value)
      expect(all, r.value).toContain(`${r.label}: ${recommended.length} tuners, in this order.`)
    }
    for (const t of LIVE_TUNERS) {
      const domain = TUNER_DOMAINS.find((d) => d.id === t.id)
      expect(md, t.id).toContain(t.question)
      for (const path of tunerFacts(domain).writes) expect(md, t.id).toContain(path)
    }
    for (const t of PLANNED_TUNERS) expect(all).toContain(t.title)
  })

  it('builds each page from definitions only: the same input, the same text', () => {
    for (const { path } of ROUTES_META) {
      expect(JSON.stringify(pageDoc(path, { now: NOW }))).toBe(JSON.stringify(pageDoc(path, { now: NOW })))
    }
  })
})
