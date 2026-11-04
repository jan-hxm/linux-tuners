// @vitest-environment happy-dom
// axe-core over each route's static page text (Design.md §7), as a reader
// without JavaScript gets it: one landmark, headings in order, named links.
// Every violation fails, not only serious ones. Colour contrast needs a
// stylesheet, which happy-dom doesn't apply (see src/a11y.test.js).
import { describe, it, expect, afterEach } from 'vitest'
import axe from 'axe-core'
import { ROUTES_META } from '@/routes-meta.js'
import { pageDoc } from './pages.js'
import { toHtml } from './html.js'

const NOW = new Date('2026-01-02T00:00:00Z')
const routes = ROUTES_META.filter((r) => pageDoc(r.path, { now: NOW })).map((r) => r.path)

afterEach(() => {
  document.body.innerHTML = ''
})

describe('static page text accessibility', () => {
  it.each(routes)('%s has no axe violations', async (path) => {
    document.documentElement.lang = 'en'
    document.title = 'linux-tuners.dev'
    document.body.innerHTML = `<div id="app">${toHtml(pageDoc(path, { now: NOW }))}</div>`
    const { violations } = await axe.run(document, {
      resultTypes: ['violations'],
      rules: { 'color-contrast': { enabled: false } },
    })
    expect(violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(' ')}`))).toEqual([])
  })
})
