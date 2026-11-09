// The prerendered study guide pages (Design.md §5 "Learning pages > Routes
// and pages"), with the fixture guide as the one live guide: every chapter in
// the template order, the figures as lists with each value and the kernel it
// was measured on, the chooser as the static flow, the Markdown copy, the
// llms.txt entries. The axe sweep of the static HTML is in a11y.test.js.
import { describe, it, expect } from 'vitest'
import { ROUTES_META, learnRoutesMeta } from '@/routes-meta.js'
import { pageDoc, loadStaticGuides } from './pages.js'
import { staticSite } from './site.js'
import { toHtml } from './html.js'
import { toMarkdown } from './markdown.js'
import { docTexts } from './nodes.js'
import { DEMO_LEARN, liveDemoGuides } from '@/learn/__fixtures__/demoKit.js'

const NOW = new Date('2026-01-02T00:00:00Z')
const EM_DASH = String.fromCharCode(0x2014)
const guides = await loadStaticGuides(liveDemoGuides())
// The real routes without the learn ones, so the fixture is the one live guide.
const baseRoutes = ROUTES_META.filter((r) => !r.path.startsWith('/learn'))
const routes = [...baseRoutes, ...learnRoutesMeta(liveDemoGuides())]
const doc = pageDoc('/learn/demo', { now: NOW, guides })
const html = toHtml(doc)
const md = toMarkdown(doc)

describe('a guide page as static text', () => {
  it('has the header block, Start here, the chapter map and every chapter in order', () => {
    const h2 = doc.blocks.filter((b) => b.kind === 'heading' && b.level === 2).map((b) => b.text)
    expect(h2.slice(0, 2 + DEMO_LEARN.chapters.length)).toEqual(['Start here', 'The chapters', ...DEMO_LEARN.chapters.map((c) => c.title)])
    expect(md).toContain('8 chapters · 13 settings · 5 min read · Figures measured on 5 kernels')
    expect(md).toContain('[Tune these settings in the Swap & memory tuner](https://linux-tuners.dev/swap)')
    const parts = doc.blocks.filter((b) => b.kind === 'heading' && b.level === 3).map((b) => b.text)
    for (const part of ['Picture it', 'Settings here', 'Should you change it?', "What you notice if it's wrong", 'Look on your machine', 'Sources']) {
      expect(parts.filter((p) => p === part), part).toHaveLength(DEMO_LEARN.chapters.length)
    }
  })

  it('lists each figure value on every kernel, with the kernel it was measured on', () => {
    expect(md).toContain('`Normal.min`**: Debian 13, kernel 0.0.0-fixture: 2,000 pages; Ubuntu 24.04, kernel 0.0.1-fixture: 2,000 pages;')
    expect(md).toContain('Ubuntu 18.04, kernel 0.0.4-fixture: 1,800 pages.')
    // A value every image measured the same is said once.
    expect(md).toContain('**Background, Worker:** Frees memory in the background. Measured: yes on all 5 test kernels.')
    // A card on an object-valued probe shows the field its path names, with its unit.
    expect(md).toMatch(/\*\*Memory, Page cache:\*\* Keeps file data in spare memory\. Measured: [\d.,]+ MiB \([\d,]+ kB\) on all 5 test kernels\./)
    expect(md).toContain('Layers from the top:')
    expect(md).toContain('A schematic timeline: the order is real, the distances are not.')
    expect(md).toContain('**Batch off:** demo.batch_order = 0: 1 asked for, 0 read along, 11 stays on disk, of 12.')
    // Tips inline, the scale bar and the gauge as lists with every value per kernel.
    expect(md).toContain('Above high (Nothing to do)')
    expect(md).toContain('Memory, drawn to scale from each kernel\'s capture:')
    expect(md).toContain('**Free or kernel**, the rest: Everything else, **free** or kept by the kernel.')
    expect(md).toContain('A scale of free pages, drawn to scale from each kernel\'s capture. Marks from the bottom:')
    expect(md).toContain('**programs wait** (below min): A program asking for memory frees some itself.')
    expect(md).toContain('Settings on the scale: `demo.floor_kbytes` on min; `demo.gap_factor` from low to high.')
    expect(md).toContain('a program waits (Free memory fell below min)')
    expect(md).toContain('Checked on real kernels by the VM test')
  })

  it('lists compare, tree and modes figures with every kernel\'s value, sizes readable and exact', () => {
    expect(md).toContain("Bars on a log scale of buffer size, drawn from each kernel's capture, by group:")
    expect(md).toContain('**Each socket, Largest** (Automatic tuning grows a busy socket up to this)')
    expect(md).toContain('Lines across the bars: **Asked-for ceiling** (A program that sets its own buffer size gets at most this).')
    expect(md).toContain('Settings drawn: `demo.buf_sizes` on Largest; `demo.buf_max` on the asked-for ceiling line.')
    // A bar read by index from a string of three numbers, on every kernel, named by its label.
    expect(md).toContain('`Start`**: Debian 13, kernel 0.0.0-fixture: 128 KiB (131,072 bytes);')
    expect(md).toContain('Ubuntu 18.04, kernel 0.0.4-fixture: 85.3 KiB (87,380 bytes).')
    expect(md).toContain('`Largest buffer`**: 6 MiB (6,291,456 bytes) on all 5 test kernels.')
    expect(md).toContain('`Extra per socket`**: Debian 13, kernel 0.0.0-fixture: 16 MiB (16,777,216 bytes);')
    expect(md).toMatch(/Ubuntu 18\.04, kernel 0\.0\.4-fixture: not present on this kernel\./)
    // The tree, top down.
    expect(md).toContain('**Root slice**, at the top (Holds every process on the machine)')
    expect(md).toContain('**web.service**, in System services')
    expect(md).toContain('Settings drawn: `CPUWeight` on System services.')
    expect(md).toContain('`System CPU weight`**: 100 on all 5 test kernels.')
    // Modes: the choices, then the value each kernel measured.
    expect(md).toContain('**Kernel, Huge pages** (When the kernel backs memory with huge pages): one of always, when asked (madvise) (Only memory a program marks for it), never. Set by `demo.page_mode`.')
    expect(md).toContain('**Kernel, Magic keys**: any of console level (2), keyboard (4)')
    expect(md).toContain('`Magic keys`**: Debian 13, kernel 0.0.0-fixture: 438;')
  })

  it('writes the chooser as the static flow and the marks as [n]', () => {
    expect(md).toContain('Yes: Raise demo.reserve_kbytes. No: Go to question 2.')
    expect(md).toContain('No: Leave it as it is: The reserve is doing its job, so the default fits.')
    // A to answer names its value as code.
    expect(md).toContain('Yes: Set demo.mode to `0` (relaxed, promise more than there is). No: Leave it as it is')
    expect(html).toMatch(/Set demo\.mode to <code[^>]*>0<\/code> \(relaxed/)
    expect(md).toMatch(/high\.\\\[1\\\]/)
    expect(md).not.toContain('[^')
  })

  it('links each setting to the tuner with the focus query, never a hash', () => {
    expect(html).toContain('href="https://linux-tuners.dev/swap?focus=reserve_kbytes"')
    expect(html).not.toMatch(/href="https:\/\/linux-tuners\.dev\/swap#/)
  })

  it('carries nothing executable and no em dash', () => {
    expect(html).not.toMatch(/<script|\son\w+\s*=|javascript:/i)
    for (const [, href] of html.matchAll(/href="([^"]*)"/g)) expect(href).toMatch(/^https:\/\//)
    expect(docTexts(doc).join(' ')).not.toContain(EM_DASH)
  })
})

describe('the static site with a live guide', () => {
  const site = staticSite({ now: NOW, guides, routes })
  const page = (path) => site.pages.find((p) => p.path === path)

  it('writes the index and the guide, each with its Markdown copy', () => {
    expect(page('/learn').markdownPath).toBe('learn.md')
    expect(page('/learn/demo').markdownPath).toBe('learn/demo.md')
    expect(page('/learn').markdown).toContain('[Read How a demo tuner works](https://linux-tuners.dev/learn/demo)')
    expect(site.headers).toContain('/learn/demo.md\n  Content-Type: text/markdown; charset=utf-8\n  X-Robots-Tag: noindex\n  Link: <https://linux-tuners.dev/learn/demo>; rel="canonical"')
  })

  it('lists the guides in llms.txt and puts the guide in llms-full.txt', () => {
    expect(site.llmsTxt).toContain('## Guides')
    expect(site.llmsTxt).toContain(`- [${DEMO_LEARN.title}](https://linux-tuners.dev/learn/demo.md): `)
    expect(site.llmsTxt).toContain('(https://linux-tuners.dev/learn.md): every study guide')
    expect(site.llmsFullTxt).toContain(`# ${DEMO_LEARN.title}`)
  })

  it('refuses a learn route without its guide data', () => {
    expect(() => staticSite({ now: NOW, routes })).toThrow(/no guide data/)
  })

  it('writes no learn page while no guide is live', () => {
    // The real routes without the learn ones: the site as it is while no guide is live.
    const plain = staticSite({ now: NOW, routes: baseRoutes })
    expect(plain.pages.some((p) => p.path.startsWith('/learn'))).toBe(false)
    expect(plain.llmsTxt).not.toContain('## Guides')
  })
})
