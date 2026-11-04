import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { render404 } from './generate-static-routes.mjs'
import { LIVE_TUNERS } from '../src/tuners/registry.js'

describe('404 page', () => {
  const html = render404()
  it('has no scripts, is noindex and has no em dash', () => {
    expect(html).not.toMatch(/<script/i)
    expect(html).toContain('<meta name="robots" content="noindex" />')
    expect(html).not.toContain('—')
  })
  it('links every live tuner with escaped text', () => {
    for (const t of LIVE_TUNERS) {
      expect(html).toContain(`href="${t.path}"`)
      expect(html).toContain(t.title.replace(/&/g, '&amp;'))
    }
    expect(html).not.toMatch(/&(?!amp;|quot;|lt;|gt;)/)
  })
})

describe('_redirects', () => {
  it('has no catch-all rule', () => {
    const rules = readFileSync(new URL('../public/_redirects', import.meta.url), 'utf8')
      .split('\n')
      .filter((l) => l.trim() && !l.startsWith('#'))
    expect(rules.some((l) => l.trim().startsWith('/*'))).toBe(false)
  })
})
