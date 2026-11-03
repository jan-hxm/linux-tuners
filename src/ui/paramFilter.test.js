import { describe, it, expect } from 'vitest'
import { TUNER_DOMAINS } from '@/tuners/domains.js'
import { networkDomain } from '@/tuners/network/index.js'
import { hasProTools, queryTerms, defMatches, PRO_TOOLS_MIN_PARAMS } from './paramFilter.js'

const def = (key) => networkDomain.defsByKey[key]

describe('hasProTools', () => {
  it('goes by parameter count, which today means systemd, security and network', () => {
    const withTools = TUNER_DOMAINS.filter(hasProTools).map((d) => d.id)
    expect(withTools.sort()).toEqual(['network', 'security', 'systemd'])
    for (const d of TUNER_DOMAINS) {
      expect(hasProTools(d)).toBe(Object.keys(d.defsByKey).length >= PRO_TOOLS_MIN_PARAMS)
    }
  })
})

describe('queryTerms', () => {
  it('lower-cases and splits on white space and name separators', () => {
    expect(queryTerms('  Net.IPv4.TCP_rmem ')).toEqual(['net', 'ipv4', 'tcp', 'rmem'])
    expect(queryTerms('a - b/c')).toEqual(['a', 'b', 'c'])
    expect(queryTerms('   ')).toEqual([])
    expect(queryTerms('')).toEqual([])
  })
})

describe('defMatches', () => {
  it('matches everything without terms', () => {
    expect(defMatches(def('somaxconn'), [])).toBe(true)
  })

  it('matches the title, the sysctl name and the key, separators or not', () => {
    expect(defMatches(def('rmem_max'), queryTerms('largest receive'))).toBe(true)
    expect(defMatches(def('rmem_max'), queryTerms('net.core.rmem_max'))).toBe(true)
    expect(defMatches(def('rmem_max'), queryTerms('rmem max'))).toBe(true)
    expect(defMatches(def('somaxconn'), queryTerms('rmem_max'))).toBe(false)
  })

  it('matches description text, short and long', () => {
    const d = def('somaxconn')
    const fromShort = d.shortDesc.split(/\s+/).find((w) => w.length > 6)
    expect(defMatches(d, queryTerms(fromShort))).toBe(true)
    const longText = Object.values(d.longDesc).flat().join(' ')
    const fromLong = longText.split(/\s+/).find((w) => /^[a-z]{8,}$/.test(w))
    expect(defMatches(d, queryTerms(fromLong))).toBe(true)
  })

  it('needs every term', () => {
    expect(defMatches(def('rmem_max'), queryTerms('rmem zzzz'))).toBe(false)
  })
})
