// @vitest-environment node
import { describe, it, expect } from 'vitest'
import colors from 'tailwindcss/colors.js'
import { THEMED_FAMILIES, SHADES, darkColour } from './theme.js'

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
