// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import colors from 'tailwindcss/colors.js'
import { PALETTE, LIGHT, DARK, tone } from './palette.js'
import { darkColour } from '../theme.js'

const SRC = fileURLToPath(new URL('../..', import.meta.url))
const COLOUR_LITERAL = /#[0-9a-f]{3,8}\b|rgba?\(/i

// Chart code across all tuners: chart components and the simulations feeding them.
function chartSources() {
  const tuners = join(SRC, 'tuners')
  return readdirSync(tuners, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) => {
      const dir = join(tuners, d.name)
      const components = join(dir, 'components')
      const charts = readdirSync(dir).includes('components')
        ? readdirSync(components).filter((f) => f.endsWith('Chart.vue')).map((f) => join(components, f))
        : []
      return [...charts, ...(readdirSync(dir).includes('simulation.js') ? [join(dir, 'simulation.js')] : [])]
    })
}

describe('palette', () => {
  it('resolves known tones and rejects unknown ones', () => {
    expect(tone('danger')).toBe(PALETTE.danger)
    expect(() => tone('purple')).toThrow(/Unknown chart tone/)
  })

  // The Tailwind colour each tone is, so legends styled with Tailwind classes match.
  const SOURCES = { ink: ['slate', 900], muted: ['slate', 500], faint: ['slate', 300], ok: ['green', 600], info: ['sky', 500], warn: ['amber', 600], danger: ['red', 600] }

  it('uses the Tailwind colours, mapped like the classes in dark mode', () => {
    for (const [name, [family, shade]] of Object.entries(SOURCES)) {
      expect(LIGHT[name], name).toBe(colors[family][shade])
      const dark = darkColour(family, shade)
      expect(DARK[name], name).toBe(dark === 'white' ? colors.white : colors[dark[0]][dark[1]])
    }
    expect(Object.keys(DARK).sort()).toEqual(Object.keys(LIGHT).sort())
  })

  it('is the only place chart colours are written down', () => {
    const files = chartSources()
    expect(files.length).toBeGreaterThan(5)
    const hits = files.filter((f) => COLOUR_LITERAL.test(readFileSync(f, 'utf8'))).map((f) => relative(SRC, f))
    expect(hits).toEqual([])
  })
})
