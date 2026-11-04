// Pins the AI-crawler policy in public/robots.txt (Design.md §5 "Routes, SEO and build").
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const text = readFileSync(new URL('../public/robots.txt', import.meta.url), 'utf8')

const TRAINING = ['GPTBot', 'ClaudeBot', 'CCBot', 'Google-Extended', 'Applebot-Extended', 'meta-externalagent', 'Bytespider']
const SEARCH = ['OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Perplexity-User', 'Claude-SearchBot', 'Claude-User', 'Googlebot', 'Bingbot']

// Consecutive User-agent lines share one group; blank lines and comments are skipped.
function parse(src) {
  const groups = []
  let cur = null
  let inRules = false
  for (const raw of src.split('\n')) {
    const line = raw.replace(/#.*/, '').trim()
    if (!line) continue
    const [k, ...rest] = line.split(':')
    const key = k.trim().toLowerCase()
    const val = rest.join(':').trim()
    if (key === 'user-agent') {
      if (!cur || inRules) {
        cur = { agents: [], rules: [] }
        groups.push(cur)
        inRules = false
      }
      cur.agents.push(val.toLowerCase())
    } else if (key === 'allow' || key === 'disallow') {
      inRules = true
      cur?.rules.push([key, val])
    }
  }
  return groups
}

const groups = parse(text)
const groupFor = (agent) =>
  groups.find((g) => g.agents.includes(agent.toLowerCase())) ?? groups.find((g) => g.agents.includes('*'))
const blocksRoot = (g) => g.rules.some(([k, v]) => k === 'disallow' && v === '/')

describe('robots.txt crawler policy', () => {
  it('has no CRLF line endings', () => {
    expect(text).not.toContain('\r')
  })

  it.each(TRAINING)('disallows training crawler %s entirely', (bot) => {
    const g = groups.find((x) => x.agents.includes(bot.toLowerCase()))
    expect(g, `${bot} needs its own group`).toBeTruthy()
    expect(blocksRoot(g)).toBe(true)
  })

  it.each(SEARCH)('does not disallow search bot %s from /', (bot) => {
    expect(blocksRoot(groupFor(bot))).toBe(false)
  })

  it('keeps /imprint and /privacy disallowed in every group that allows /', () => {
    for (const g of groups.filter((x) => !blocksRoot(x))) {
      const dis = g.rules.filter(([k]) => k === 'disallow').map(([, v]) => v)
      expect(dis, g.agents.join(',')).toEqual(expect.arrayContaining(['/imprint', '/privacy']))
    }
  })

  it('lists the sitemap', () => {
    expect(text).toMatch(/^Sitemap: https:\/\/linux-tuners\.dev\/sitemap\.xml$/m)
  })
})
