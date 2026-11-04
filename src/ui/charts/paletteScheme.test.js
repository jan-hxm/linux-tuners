// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest'

describe('palette scheme', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('follows prefers-color-scheme, including a change while open', async () => {
    let onChange
    const query = { matches: true, addEventListener: (_, fn) => (onChange = fn) }
    vi.stubGlobal('matchMedia', (q) => (q === '(prefers-color-scheme: dark)' ? query : { matches: false }))
    const { PALETTE, LIGHT, DARK, tone, prefersDark } = await import('./palette.js')

    expect(prefersDark.value).toBe(true)
    expect(PALETTE.ink).toBe(DARK.ink)
    expect(tone('error')).toBe(DARK.error)

    query.matches = false
    onChange()
    expect(prefersDark.value).toBe(false)
    expect(PALETTE.ink).toBe(LIGHT.ink)
  })
})
