import { describe, it, expect } from 'vitest'
import { toHtml, escapeHtml } from './html.js'
import { toMarkdown, escapeMarkdown } from './markdown.js'
import { text, code, bold, link, rich, heading, paragraph, list, defs, codeBlock } from './nodes.js'

const doc = (...blocks) => ({ title: 'T', url: 'https://linux-tuners.dev/t', blocks })
const html = (...blocks) => toHtml(doc(...blocks))
const md = (...blocks) => toMarkdown(doc(...blocks))

describe('toHtml', () => {
  it('wraps the page in one <main>', () => {
    const out = html(heading(1, 'Title'), paragraph(text('Body')))
    expect(out.match(/<main/g)).toHaveLength(1)
    expect(out).toBe('<main class="static-doc">\n<h1>Title</h1>\n<p>Body</p>\n</main>')
  })

  it('escapes every text node', () => {
    const out = html(
      heading(2, 'a < b & "c"'),
      paragraph(text(`<script>alert('x')</script>`), code('<b>'), bold('&amp;')),
      list([[text('<i>')]]),
      defs([{ term: [text('<dt>')], desc: [text('"q"')] }]),
      codeBlock('</code></pre><img src=x onerror=alert(1)>'),
    )
    expect(out).toContain('<h2>a &lt; b &amp; &quot;c&quot;</h2>')
    expect(out).toContain('&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;')
    expect(out).toContain('<code>&lt;b&gt;</code><strong>&amp;amp;</strong>')
    expect(out).toContain('<li>&lt;i&gt;</li>')
    expect(out).toContain('<dt>&lt;dt&gt;</dt><dd>&quot;q&quot;</dd>')
    expect(out).toContain('<pre><code>&lt;/code&gt;&lt;/pre&gt;&lt;img src=x onerror=alert(1)&gt;</code></pre>')
    expect(out).not.toMatch(/<script|<img/)
  })

  it('escapes quotes in attributes', () => {
    expect(escapeHtml(`"'<>&`)).toBe('&quot;&#39;&lt;&gt;&amp;')
  })

  it('links only https URLs, with rel="noopener" outside the site', () => {
    expect(html(paragraph(link('Docs', 'https://docs.kernel.org/x')))).toContain('<a href="https://docs.kernel.org/x" rel="noopener">Docs</a>')
    expect(html(paragraph(link('Swap', 'https://linux-tuners.dev/swap')))).toContain('<a href="https://linux-tuners.dev/swap">Swap</a>')
    for (const href of ['javascript:alert(1)', 'http://example.com', 'https://x.dev/"onmouseover="a', 'https://x.dev/ y', '//x.dev']) {
      const out = html(paragraph(link('L<', href)))
      expect(out, href).not.toContain('<a')
      expect(out, href).toContain('L&lt;')
    }
  })

  it('renders the rich-text markup from the data files', () => {
    const out = html(paragraph(rich('Set `vm.x` **now**, see [docs](https://docs.kernel.org/a).')))
    expect(out).toContain('<p>Set <code>vm.x</code> <strong>now</strong>, see <a href="https://docs.kernel.org/a" rel="noopener">docs</a>.</p>')
  })

  it('turns a known glossary term into <dfn> and an unknown one into plain text', () => {
    const out = html(paragraph(rich('The [[OOM killer]] and [[a ghost|no-such-term]].')))
    expect(out).toContain('<dfn>OOM killer</dfn>')
    expect(out).toContain(' and a ghost.')
    expect(out).not.toContain('[[')
  })

  it('writes ordered lists, definition lists and code blocks semantically', () => {
    const out = html(list([[text('a')], [text('b')]], { ordered: true }), defs([{ term: [text('T')], desc: [code('v')] }]), codeBlock('x = 1\ny = 2'))
    expect(out).toContain('<ol><li>a</li><li>b</li></ol>')
    expect(out).toContain('<dl><div><dt>T</dt><dd><code>v</code></dd></div></dl>')
    expect(out).toContain('<pre><code>x = 1\ny = 2</code></pre>')
  })
})

describe('toMarkdown', () => {
  it('puts the canonical page under the title and ends with one newline', () => {
    expect(md(heading(1, 'Title'), paragraph(text('Body')))).toBe('# Title\n\nInteractive page: https://linux-tuners.dev/t\n\nBody\n')
  })

  it('escapes characters that would start markup in plain text', () => {
    expect(escapeMarkdown('a*b `c` [d] <e> \\')).toBe('a\\*b \\`c\\` \\[d\\] \\<e> \\\\')
    expect(md(paragraph(text('vm.* and [x](y)')))).toContain('vm.\\* and \\[x\\](y)')
  })

  it('writes glossary terms as plain text and links as [label](url)', () => {
    const out = md(paragraph(rich('The [[OOM killer]], [[a ghost|no-such-term]] and [docs](https://docs.kernel.org/a).')))
    expect(out).toContain('The OOM killer, a ghost and [docs](https://docs.kernel.org/a).')
    expect(md(paragraph(link('bad', 'javascript:alert(1)')))).not.toContain('](')
  })

  it('fences code blocks and code spans, longer than any backtick run inside', () => {
    expect(md(codeBlock('a = 1'))).toContain('```\na = 1\n```')
    expect(md(codeBlock('x ``` y'))).toContain('````\nx ``` y\n````')
    expect(md(paragraph(code('a`b')))).toContain('`` a`b ``')
  })

  it('writes headings, lists and definition rows', () => {
    const out = md(heading(2, 'H'), list([[text('a')], [text('b')]], { ordered: true }), list([[text('c')]]), defs([{ term: [text('T')], desc: [bold('v')] }]))
    expect(out).toContain('## H\n\n1. a\n2. b\n\n- c\n\n- **T**: **v**')
  })
})
