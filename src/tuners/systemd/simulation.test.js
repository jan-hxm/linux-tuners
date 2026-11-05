import { describe, it, expect } from 'vitest'
import { cpuShares, memoryBudget } from './simulation.js'
import { deriveDefaults } from './calculations.js'
import { DEFAULT_SYSTEMD_SPEC } from './profile.js'
import { PALETTE } from '@/ui/charts/palette.js'

const hw = { ...DEFAULT_SYSTEMD_SPEC }
const params = deriveDefaults(hw)

describe('systemd simulation tones', () => {
  it('marks the tuned slice and greys its siblings', () => {
    const tones = cpuShares(hw, params).segments.map((s) => [s.isTarget, s.tone])
    expect(tones).toContainEqual([true, 'ink'])
    expect(tones.filter(([isTarget]) => !isTarget).every(([, t]) => t === 'rule')).toBe(true)
  })

  it('colours every memory segment with a palette tone', () => {
    // Both limits set, so all three zones (normal, throttle, OOM) render.
    const segments = memoryBudget(hw, { ...params, memory_high: 60, memory_max: 80 }).segments
    expect(segments.map((s) => s.tone)).toEqual(['rule', 'quiet', 'error'])
    for (const s of segments) expect(PALETTE).toHaveProperty(s.tone)
  })
})
