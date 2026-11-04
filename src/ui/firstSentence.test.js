import { describe, it, expect } from 'vitest'
import { splitFirstSentence } from './firstSentence.js'
import { parseRichText } from './richText.js'
import { TUNER_DOMAINS } from '@/tuners/domains.js'
import { DESC_PARTS } from './descParts.js'

/** Parsed segments with adjacent text merged and whitespace collapsed. */
function normalised(text) {
  const out = []
  for (const seg of parseRichText(text)) {
    const s = seg.type === 'text' ? { ...seg, text: seg.text.replace(/\s+/g, ' ') } : seg
    const last = out.at(-1)
    if (s.type === 'text' && last?.type === 'text') last.text += s.text
    else out.push(s)
  }
  return out
}

/** Every note the card can show in its margin, from every def of every tuner. */
function allNotes() {
  const notes = []
  for (const domain of TUNER_DOMAINS) {
    for (const def of Object.values(domain.defsByKey)) {
      const where = `${domain.id}/${def.key ?? def.sysctlName}`
      for (const { key } of DESC_PARTS) for (const para of def.longDesc?.[key] ?? []) notes.push([where, para])
      if (def.tuningTip) notes.push([where, def.tuningTip])
      const context = def[domain.noteKey] ?? def.contextNote
      if (context) notes.push([where, context])
    }
  }
  return notes
}

describe('splitFirstSentence', () => {
  it('splits after the first sentence', () => {
    expect(splitFirstSentence('One thing. Another thing.')).toEqual({ head: 'One thing.', tail: 'Another thing.' })
    expect(splitFirstSentence('Really? Yes.')).toEqual({ head: 'Really?', tail: 'Yes.' })
    expect(splitFirstSentence('It is "on." Then off.')).toEqual({ head: 'It is "on."', tail: 'Then off.' })
  })

  it('keeps a one-sentence note whole', () => {
    expect(splitFirstSentence('Only this.')).toEqual({ head: 'Only this.', tail: '' })
    expect(splitFirstSentence('No full stop at all')).toEqual({ head: 'No full stop at all', tail: '' })
    expect(splitFirstSentence('Trailing space.  ')).toEqual({ head: 'Trailing space.  ', tail: '' })
  })

  it('does not split numbers, dotted names or abbreviations', () => {
    expect(splitFirstSentence('Use 0.5 here. Then more.').head).toBe('Use 0.5 here.')
    expect(splitFirstSentence('Set pids.max and go. Then.').head).toBe('Set pids.max and go.')
    expect(splitFirstSentence('A slice, e.g. user.slice, works. Then.').head).toBe('A slice, e.g. user.slice, works.')
    expect(splitFirstSentence('Fast swap, i.e. zram, wins. Then.').head).toBe('Fast swap, i.e. zram, wins.')
    expect(splitFirstSentence('Some (e.g. a database) need it. Then.').head).toBe('Some (e.g. a database) need it.')
    expect(splitFirstSentence('Logs, caches, etc. grow. Then.').head).toBe('Logs, caches, etc. grow.')
  })

  it('does not split inside parentheses', () => {
    expect(splitFirstSentence('It waits (about 5 s. or so) first. Then.').head).toBe('It waits (about 5 s. or so) first.')
    expect(splitFirstSentence('It waits (see below.) Then more.').head).toBe('It waits (see below.)')
  })

  it('never splits inside markup', () => {
    expect(splitFirstSentence('Run `a. b` now. Then.').head).toBe('Run `a. b` now.')
    expect(splitFirstSentence('It is **very. bad** here. Then.').head).toBe('It is **very. bad** here.')
    expect(splitFirstSentence('See [[the OOM killer. X|oom-killer]] act. Then.').head).toBe('See [[the OOM killer. X|oom-killer]] act.')
    expect(splitFirstSentence('Read [the docs. now](https://example.org/a) first. Then.').head).toBe('Read [the docs. now](https://example.org/a) first.')
  })

  it('keeps markup in the tail intact', () => {
    const { head, tail } = splitFirstSentence('First. Then [[OOM killer]] and `x.y`.')
    expect(head).toBe('First.')
    expect(normalised(tail)).toEqual(normalised('Then [[OOM killer]] and `x.y`.'))
  })

  const notes = allNotes()

  it('covers the notes of every tuner', () => {
    expect(new Set(notes.map(([where]) => where.split('/')[0])).size).toBe(TUNER_DOMAINS.length)
  })

  it.each(notes)('gives %s a sound first sentence', (_where, text) => {
    const { head, tail } = splitFirstSentence(text)
    expect(head.trim()).not.toBe('')
    if (tail) {
      expect(head).toMatch(/[.!?]["'”’)\]]*$/)
      // Head and tail together render exactly what the note renders, so no
      // markup was cut in two.
      expect(normalised(`${head} ${tail}`)).toEqual(normalised(text))
      for (const part of [head, tail]) {
        expect(normalised(part).filter((s) => s.type === 'text').map((s) => s.text).join('')).not.toMatch(/`|\*\*|\[\[|\]\]/)
      }
    } else {
      expect(head).toBe(text)
    }
  })
})
