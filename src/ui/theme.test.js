// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TOKENS, SURFACE_TOKENS, TEXT_TOKENS, MARK_TOKENS, FONT_SANS, FONT_MONO, contrast } from './theme.js'
import tailwindConfig from '../../tailwind.config.js'
import { render404 } from '../../scripts/generate-static-routes.mjs'

// The colour families the redesign replaced (Design.md §7). Tailwind's
// palette isn't offered any more, so such a class would silently do nothing;
// the old dark-mode helpers and their CSS hooks are gone with it.
describe('old colour families', () => {
  const ROOT = fileURLToPath(new URL('../../', import.meta.url))
  const FAMILIES = 'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'
  const OLD = [
    ['a Tailwind colour family class', new RegExp(`\\b[a-z-]+-(${FAMILIES})-(50|[1-9]00|950)\\b`)],
    ['white as a colour class', /\b(bg|text|border|ring|outline|fill|stroke|decoration)-white\b/],
    ['a legacy CSS hook', /\b(surface-inverse|focus-inset|light-palette)\b|--c-[a-z]/],
    ['a legacy chart tone', /PALETTE\.(muted|faint|ok|info|warn|danger)\b|tone: '(muted|faint|ok|info|warn|danger)'/],
  ]
  const files = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const path = join(dir, e.name)
      if (e.isDirectory()) return files(path)
      return /\.(vue|js|mjs|css|html)$/.test(e.name) && !e.name.endsWith('.test.js') ? [path] : []
    })
  const sources = [...files(join(ROOT, 'src')), ...files(join(ROOT, 'scripts')), join(ROOT, 'index.html'), join(ROOT, 'tailwind.config.js')]

  it.each(OLD)('no source uses %s', (_name, pattern) => {
    const hits = sources.flatMap((f) =>
      readFileSync(f, 'utf8')
        .split('\n')
        .flatMap((line, i) => (pattern.test(line) ? [`${relative(ROOT, f)}:${i + 1}`] : [])),
    )
    expect(hits).toEqual([])
  })

  it('offers only the tokens as Tailwind colours', () => {
    const { colors } = tailwindConfig.theme
    expect(Object.keys(colors).sort()).toEqual(['black', 'current', 'inherit', 'transparent', ...Object.keys(TOKENS)].sort())
    expect(tailwindConfig.theme.extend.colors).toBeUndefined()
  })
})

describe('semantic tokens (Design.md §7)', () => {
  const SCHEMES = [
    [0, 'light'],
    [1, 'dark'],
  ]

  it('holds a light and a dark hex for every token', () => {
    for (const [name, pair] of Object.entries(TOKENS)) {
      expect(pair, name).toHaveLength(2)
      for (const hex of pair) expect(hex, name).toMatch(/^#[0-9A-F]{6}$/)
    }
    for (const name of [...SURFACE_TOKENS, ...TEXT_TOKENS, ...MARK_TOKENS]) expect(TOKENS[name], name).toBeDefined()
  })

  it('keeps every text token at 4.5:1 on every surface, in both schemes', () => {
    for (const [scheme, label] of SCHEMES) {
      for (const text of TEXT_TOKENS) {
        for (const bg of SURFACE_TOKENS) {
          expect(contrast(TOKENS[text][scheme], TOKENS[bg][scheme]), `${text} on ${bg}, ${label}`).toBeGreaterThanOrEqual(4.5)
        }
      }
    }
  })

  it('keeps every mark (tick, bar, dot, focus ring) at 3:1 on every surface, in both schemes', () => {
    // `rule` is a hairline beside a text label, so it has no floor here;
    // `rule-strong` (secondary button borders, minor ticks) is held to 3:1 too.
    for (const [scheme, label] of SCHEMES) {
      for (const mark of [...MARK_TOKENS, 'rule-strong']) {
        for (const bg of SURFACE_TOKENS) {
          expect(contrast(TOKENS[mark][scheme], TOKENS[bg][scheme]), `${mark} on ${bg}, ${label}`).toBeGreaterThanOrEqual(3)
        }
      }
    }
  })

  it('keeps the primary button (paper on an ink fill) and the slider thumb ring readable', () => {
    for (const [scheme, label] of SCHEMES) {
      expect(contrast(TOKENS.paper[scheme], TOKENS.ink[scheme]), `paper on ink, ${label}`).toBeGreaterThanOrEqual(4.5)
      expect(contrast(TOKENS['paper-hover'][scheme], TOKENS.ink[scheme]), `paper-hover on ink, ${label}`).toBeGreaterThanOrEqual(4.5)
      // A primary button's hover fill is ink-2.
      expect(contrast(TOKENS.paper[scheme], TOKENS['ink-2'][scheme]), `paper on ink-2, ${label}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('exposes every token as a Tailwind colour and sets the font stacks', () => {
    const { fontFamily } = tailwindConfig.theme.extend
    const themeColours = tailwindConfig.theme.colors
    for (const name of Object.keys(TOKENS)) expect(themeColours[name], name).toBe(`rgb(var(--t-${name}) / <alpha-value>)`)
    expect(fontFamily.sans).toBe(FONT_SANS)
    expect(fontFamily.mono).toBe(FONT_MONO)
    expect(FONT_SANS[0]).toBe('"Host Grotesk"')
    expect(FONT_MONO[0]).toBe('"Fragment Mono"')
  })

  it('self-hosts the fonts with swap and never names a third-party font origin', () => {
    const css = readFileSync(new URL('../assets/main.css', import.meta.url), 'utf8')
    const faces = css.match(/@font-face\s*\{[^}]*\}/g)
    const web = faces.filter((face) => /url\(/.test(face))
    expect(web).toHaveLength(4)
    for (const face of web) {
      expect(face).toMatch(/font-display:\s*swap/)
      expect(face).toMatch(/url\('\.\/fonts\/[a-z0-9-]+\.woff2'\)/)
    }
    expect(css).not.toMatch(/fonts\.(googleapis|gstatic)\.com|https?:\/\//)
    const fonts = new URL('../assets/fonts/', import.meta.url)
    expect(readFileSync(new URL('OFL.txt', fonts), 'utf8')).toMatch(/SIL Open Font License, Version 1\.1/)
  })

  it('colours the browser chrome and the 404 page with paper and ink', () => {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
    expect(html).toContain(`<meta name="theme-color" content="${TOKENS.paper[0]}" media="(prefers-color-scheme: light)" />`)
    expect(html).toContain(`<meta name="theme-color" content="${TOKENS.paper[1]}" media="(prefers-color-scheme: dark)" />`)
    const page = render404()
    for (const hex of [TOKENS.paper[0], TOKENS.ink[0], TOKENS.paper[1], TOKENS.ink[1]]) expect(page).toContain(hex)
    expect(page).not.toMatch(/Host Grotesk|Fragment Mono|@font-face/)
  })
})
