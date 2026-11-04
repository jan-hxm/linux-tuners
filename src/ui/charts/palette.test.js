// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PALETTE, LIGHT, DARK, tone } from './palette.js'
import { TOKENS } from '../theme.js'

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
    expect(tone('error')).toBe(PALETTE.error)
    expect(() => tone('purple')).toThrow(/Unknown chart tone/)
  })

  // The token each design tone is, so legends styled with token classes match.
  const TOKEN_SOURCES = { ink: 'ink', quiet: 'quiet', rule: 'rule', fit: 'fit', mine: 'mine', error: 'error', text: 'quiet', grid: 'rule' }

  it('takes the design tones from the semantic tokens in both schemes', () => {
    for (const [name, token] of Object.entries(TOKEN_SOURCES)) {
      expect(LIGHT[name], name).toBe(TOKENS[token][0])
      expect(DARK[name], name).toBe(TOKENS[token][1])
    }
    expect(LIGHT.inkFill).toBe('rgba(22, 22, 22, 0.08)')
    expect(DARK.inkFill).toBe('rgba(236, 236, 232, 0.08)')
  })

  it('offers no tone outside the tokens', () => {
    expect(Object.keys(LIGHT).sort()).toEqual([...Object.keys(TOKEN_SOURCES), 'inkFill'].sort())
    expect(Object.keys(DARK).sort()).toEqual(Object.keys(LIGHT).sort())
  })

  it('is the only place chart colours are written down', () => {
    const files = chartSources()
    expect(files.length).toBeGreaterThan(5)
    const hits = files.filter((f) => COLOUR_LITERAL.test(readFileSync(f, 'utf8'))).map((f) => relative(SRC, f))
    expect(hits).toEqual([])
  })
})
