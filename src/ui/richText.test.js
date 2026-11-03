import { describe, it, expect } from 'vitest'
import { parseRichText, termId } from './richText.js'

describe('parseRichText', () => {
  it('splits code, bold and links out of plain text', () => {
    expect(parseRichText('Set `vm.swappiness` to **10**, see [docs](https://kernel.org/x).')).toEqual([
      { type: 'text', text: 'Set ' },
      { type: 'code', text: 'vm.swappiness' },
      { type: 'text', text: ' to ' },
      { type: 'bold', text: '10' },
      { type: 'text', text: ', see ' },
      { type: 'link', text: 'docs', href: 'https://kernel.org/x' },
      { type: 'text', text: '.' },
    ])
  })

  it('reads [[label]] as a glossary term whose id is the label in kebab case', () => {
    expect(parseRichText('the [[OOM killer]] runs')).toEqual([
      { type: 'text', text: 'the ' },
      { type: 'term', text: 'OOM killer', id: 'oom-killer' },
      { type: 'text', text: ' runs' },
    ])
    expect(termId(' Page   cache ')).toBe('page-cache')
  })

  it('reads [[label|id]] as a term with its own id', () => {
    expect(parseRichText('[[dirty pages|dirty-page]] and [[eBPF|bpf]]')).toEqual([
      { type: 'term', text: 'dirty pages', id: 'dirty-page' },
      { type: 'text', text: ' and ' },
      { type: 'term', text: 'eBPF', id: 'bpf' },
    ])
  })

  it('keeps a term apart from a link that follows it', () => {
    expect(parseRichText('[[cgroup]] [v2](https://docs.kernel.org/)')).toEqual([
      { type: 'term', text: 'cgroup', id: 'cgroup' },
      { type: 'text', text: ' ' },
      { type: 'link', text: 'v2', href: 'https://docs.kernel.org/' },
    ])
  })

  it('leaves malformed markup as plain text for the contract suite to catch', () => {
    for (const text of ['[[unclosed', '[[a|Bad Id]]', '[[]]', '[x](http://insecure)']) {
      expect(parseRichText(text)).toEqual([{ type: 'text', text }])
    }
  })
})
