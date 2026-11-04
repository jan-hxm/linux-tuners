import { describe, it, expect } from 'vitest'
import { IMAGES } from '../../../vm/lib/images.mjs'
import { TESTED_DISTROS, TESTED_KERNELS, testedOnText } from './testedOn.js'

const cmp = (a, b) => a.split('.').map(Number).reduce((d, n, i) => d || n - Number(b.split('.')[i]), 0)

describe('colophon testing claim', () => {
  it('names exactly the images the VM suite boots', () => {
    const claimed = TESTED_DISTROS.flatMap((d) => d.versions.map((v) => `${d.name.toLowerCase()}-${v}`))
    expect(claimed.sort()).toEqual(Object.keys(IMAGES).sort())
  })

  it('gives the kernel range of those images', () => {
    const kernels = Object.values(IMAGES).map((i) => i.profile.swap.kernelVersion).sort(cmp)
    expect(TESTED_KERNELS).toEqual({ from: kernels[0], to: kernels.at(-1) })
  })

  it('reads as the approved sentence', () => {
    expect(testedOnText()).toBe('Debian 11 and 13, Ubuntu 18.04 and 24.04 and Fedora 43 (kernels 4.15 to 6.17)')
  })
})
