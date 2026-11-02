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
})
