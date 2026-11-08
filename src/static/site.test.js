import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { staticSite, injectStatic } from './site.js'
import { loadStaticGuides } from './pages.js'
import { LIVE_TUNERS } from '@/tuners/registry.js'
import { LIVE_GUIDES } from '@/learn/guides.js'

const NOW = new Date('2026-01-02T00:00:00Z')
const SHELL = readFileSync(fileURLToPath(new URL('../../index.html', import.meta.url)), 'utf8')
const site = staticSite({ now: NOW, guides: await loadStaticGuides() })
const page = (path) => site.pages.find((p) => p.path === path)

const headOf = (html) => html.slice(0, html.indexOf('</head>'))

describe('injectStatic (the postbuild step)', () => {
  const swap = page('/swap')
  const out = injectStatic(SHELL, swap)

  it('fills the one #app with the page, and changes nothing else in the body', () => {
    expect(out.match(/id="app"/g)).toHaveLength(1)
    const inner = out.slice(out.indexOf('<div id="app">') + '<div id="app">'.length, out.lastIndexOf('</div>'))
    expect(inner.trim()).toBe(swap.html)
    expect(out.replace(`\n${swap.html}\n`, '')).toBe(SHELL.replace('</head>', '  <link rel="alternate" type="text/markdown" href="/swap.md" />\n  </head>'))
  })

  it('keeps the head tags and adds the Markdown alternate', () => {
    const head = headOf(out)
    expect(head).toContain('<link rel="alternate" type="text/markdown" href="/swap.md" />')
    expect(head.startsWith(headOf(SHELL))).toBe(true)
    expect(head.match(/<link rel="alternate"/g)).toHaveLength(1)
  })

  it('adds no alternate for a page without Markdown', () => {
    const setup = page('/setup')
    expect(setup.markdownPath).toBeNull()
    expect(headOf(injectStatic(SHELL, setup))).toBe(headOf(SHELL))
  })

  it('refuses a shell whose #app is missing or already filled', () => {
    expect(() => injectStatic(SHELL.replace('<div id="app"></div>', ''), swap)).toThrow()
    expect(() => injectStatic(out, swap)).toThrow()
  })

  it('treats $ patterns in the page as text', () => {
    const odd = { ...swap, html: '<main>$& $1 $`</main>' }
    expect(injectStatic(SHELL, odd)).toContain('<main>$& $1 $`</main>')
  })
})

describe('staticSite', () => {
  it('writes Markdown for the landing page and every tuner', () => {
    expect(site.pages.filter((p) => p.markdownPath).map((p) => p.markdownPath).sort()).toEqual(
      [
        'index.md',
        ...LIVE_TUNERS.map((t) => `${t.id}.md`),
        // The study guides: the index and one page per live guide.
        ...(LIVE_GUIDES.length ? ['learn.md', ...LIVE_GUIDES.map((g) => `learn/${g.slug}.md`)] : []),
      ].sort(),
    )
  })

  it('lists every tuner in llms.txt, linking its Markdown', () => {
    expect(site.llmsTxt.startsWith('# linux-tuners.dev\n\n> ')).toBe(true)
    for (const t of LIVE_TUNERS) expect(site.llmsTxt).toContain(`- [${t.title}](https://linux-tuners.dev${t.path}.md): ${t.blurb}`)
  })

  it('puts every tuner page in llms-full.txt', () => {
    for (const t of LIVE_TUNERS) expect(site.llmsFullTxt).toContain(page(t.path).markdown)
  })

  it('gives every Markdown and llms file its headers, noindex and canonical', () => {
    for (const p of site.pages.filter((x) => x.markdownPath)) {
      const canonical = `https://linux-tuners.dev${p.path}`
      expect(site.headers).toContain(
        `/${p.markdownPath}\n  Content-Type: text/markdown; charset=utf-8\n  X-Robots-Tag: noindex\n  Link: <${canonical}>; rel="canonical"\n`,
      )
    }
    expect(site.headers).toContain('/llms.txt\n  Content-Type: text/plain; charset=utf-8')
    expect(site.headers).toContain('/llms-full.txt\n  Content-Type: text/plain; charset=utf-8')
  })

  it('writes no CR and no em dash', () => {
    for (const text of [site.llmsTxt, site.llmsFullTxt, site.headers, ...site.pages.flatMap((p) => [p.html, p.markdown ?? ''])]) {
      expect(text).not.toContain('\r')
      expect(text).not.toContain('—')
    }
  })
})
