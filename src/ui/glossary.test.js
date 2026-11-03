import { describe, it, expect } from 'vitest'
import { GLOSSARY } from './glossary.js'
import { parseRichText } from './richText.js'
import { TUNER_DOMAINS } from '@/tuners/domains.js'

/** Every string under a value, depth first. */
function strings(value, out = []) {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) value.forEach((v) => strings(v, out))
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => strings(v, out))
  return out
}

describe('glossary (Design.md §8)', () => {
  it('gives every entry a kebab-case id, a name and a plain-text definition', () => {
    for (const [id, entry] of Object.entries(GLOSSARY)) {
      expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      expect(entry.term.length, id).toBeGreaterThan(0)
      expect(entry.definition.length, id).toBeGreaterThan(40)
      // Shown as text, so no markup and no em dash.
      expect(parseRichText(entry.definition), id).toEqual([{ type: 'text', text: entry.definition }])
      expect(`${entry.term} ${entry.definition}`, id).not.toContain('—')
    }
  })

  it('has no entry that no tuner copy uses', () => {
    const used = new Set()
    for (const domain of TUNER_DOMAINS) {
      const copy = [domain.page, domain.about, ...Object.values(domain.defsByKey).map((d) => d.longDesc)]
      for (const text of strings(copy)) {
        for (const seg of parseRichText(text)) if (seg.type === 'term') used.add(seg.id)
      }
    }
    expect(Object.keys(GLOSSARY).filter((id) => !used.has(id))).toEqual([])
  })
})
