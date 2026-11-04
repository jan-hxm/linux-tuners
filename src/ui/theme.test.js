// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import colors from 'tailwindcss/colors.js'
import { THEMED_FAMILIES, SHADES, darkColour, TOKENS, SURFACE_TOKENS, TEXT_TOKENS, MARK_TOKENS, FONT_SANS, FONT_MONO } from './theme.js'
import tailwindConfig from '../../tailwind.config.js'
import { render404 } from '../../scripts/generate-static-routes.mjs'

const hexOf = (c) => (c === 'white' ? '#ffffff' : colors[c[0]][c[1]]) // Tailwind writes white as #fff

/** WCAG relative luminance contrast of two hex colours. */
function contrast(a, b) {
  const lum = (hex) => {
    const [r, g, b] = hex.match(/[0-9a-f]{2}/gi).map((h) => {
      const c = parseInt(h, 16) / 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('dark-mode shade mapping', () => {
  it('maps every themed colour to a real Tailwind colour', () => {
    for (const family of THEMED_FAMILIES) {
      for (const shade of SHADES) expect(hexOf(darkColour(family, shade)), `${family}-${shade}`).toMatch(/^#[0-9a-f]{6}$/i)
    }
    expect(hexOf(darkColour('white'))).toBe(colors.slate[900])
  })

  it('keeps text-slate-500 and darker above AA on the dark card and page', () => {
    const card = hexOf(darkColour('white'))
    const page = hexOf(darkColour('slate', 50))
    for (const shade of [500, 600, 700, 800, 900]) {
      const text = hexOf(darkColour('slate', shade))
      expect(contrast(text, card), `slate-${shade} on card`).toBeGreaterThanOrEqual(4.5)
      expect(contrast(text, page), `slate-${shade} on page`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('keeps text on the sky accent fill above AA in both schemes', () => {
    // Primary buttons and active states: text-white (or the active preset's
    // text-sky-100 description) on bg-sky-700, hover bg-sky-800.
    for (const bg of [700, 800]) {
      for (const text of ['white', ['sky', 100]]) {
        const label = `${text === 'white' ? 'white' : 'sky-100'} on sky-${bg}`
        expect(contrast(hexOf(text), hexOf(['sky', bg])), `${label}, light`).toBeGreaterThanOrEqual(4.5)
        expect(contrast(hexOf(darkColour(...[text].flat())), hexOf(darkColour('sky', bg))), `${label}, dark`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('keeps the tinted badge text readable on its tinted background', () => {
    // The impact bands and callouts: text-<tint>-800 on bg-<tint>-100 or -50.
    for (const family of ['amber', 'red', 'emerald', 'sky']) {
      for (const bg of [50, 100]) {
        expect(contrast(hexOf(darkColour(family, 800)), hexOf(darkColour(family, bg))), `${family}-800 on ${bg}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('keeps the hero text and every focus ring visible on what is behind them', () => {
    // The heroes and step chain are light-palette (no mapping) and run from
    // slate-900 to slate-700; their smallest text is text-xs.
    const hero = [900, 800, 700].map((shade) => colors.slate[shade])
    for (const text of [300, 200]) {
      for (const bg of hero) expect(contrast(colors.slate[text], bg), `slate-${text} on hero`).toBeGreaterThanOrEqual(4.5)
    }
    // The slate-400 eyebrows sit in the slate-900 corner.
    expect(contrast(colors.slate[400], colors.slate[900]), 'slate-400 eyebrow').toBeGreaterThanOrEqual(4.5)
    // Rings (main.css) need 3:1. The default slate-900 ring on the page and
    // cards, in both schemes; the .surface-inverse ring (white) on the hero
    // and on the undo toast, whose slate-900 fill flips with the scheme.
    for (const bg of [['white'], ['slate', 50]]) {
      expect(contrast(colors.slate[900], hexOf(bg[0] === 'white' ? 'white' : bg)), 'ring, light').toBeGreaterThanOrEqual(3)
      expect(contrast(hexOf(darkColour('slate', 900)), hexOf(darkColour(...bg))), 'ring, dark').toBeGreaterThanOrEqual(3)
    }
    for (const bg of hero) expect(contrast('#ffffff', bg), 'inverse ring on hero').toBeGreaterThanOrEqual(3)
    expect(contrast('#ffffff', colors.slate[900]), 'inverse ring on toast, light').toBeGreaterThanOrEqual(3)
    expect(contrast(hexOf(darkColour('white')), hexOf(darkColour('slate', 900))), 'inverse ring on toast, dark').toBeGreaterThanOrEqual(3)
  })
})

describe('semantic tokens (REDESIGN.md §3)', () => {
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
    // `rule` and `rule-strong` are hairlines, minor ticks and secondary button
    // borders beside a text label, not marks, so they have no floor here.
    for (const [scheme, label] of SCHEMES) {
      for (const mark of MARK_TOKENS) {
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
    }
  })

  it('exposes every token as a Tailwind colour and sets the font stacks', () => {
    const { colors: themeColours, fontFamily } = tailwindConfig.theme.extend
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
