/**
 * Everything the build writes for readers that don't run JavaScript
 * (Design.md §5 "Routes, SEO and build"): each route's static HTML for its
 * <div id="app">, a Markdown copy of each tuner and the landing page,
 * llms.txt, llms-full.txt and the response headers for those files.
 * scripts/static-content.mjs calls staticSite() and writes the result.
 */

import { ROUTES_META, ROUTE_META_BY_PATH, SITE_NAME } from '@/routes-meta.js'
import { LIVE_TUNERS } from '@/tuners/registry.js'
import { TUNER_DOMAINS } from '@/tuners/domains.js'
import { LIVE_GUIDES, LEARN_INDEX_ROUTE } from '@/learn/guides.js'
import { pageDoc, pageUrl } from './pages.js'
import { toHtml } from './html.js'
import { toMarkdown } from './markdown.js'

/**
 * @typedef {Object} StaticPage
 * @property {string}      path          The route path
 * @property {string}      html          The <main> that goes inside <div id="app">
 * @property {string|null} markdownPath  Its Markdown file under dist/ ("swap.md", "learn/memory.md"), or null for none
 * @property {string|null} markdown
 */

/** The Markdown file of a route that has one: the landing page, every tuner and the learn pages. */
function markdownPathFor(path, guides = LIVE_GUIDES) {
  if (path === '/') return 'index.md'
  const learn = path === LEARN_INDEX_ROUTE.path || guides.some((g) => g.path === path)
  return learn || LIVE_TUNERS.some((t) => t.path === path) ? `${path.slice(1)}.md` : null
}

/** Fails when a live guide's page lacks a chapter, which would mean a broken static page. */
function assertLearnDoc(path, markdown, guides) {
  const guide = guides.find((g) => g.entry.path === path)
  if (!guide) return
  const missing = guide.learn.chapters.map((ch) => ch.title).filter((t) => !markdown.includes(t))
  if (missing.length) throw new Error(`static page ${path} is missing: ${missing.join(', ')}`)
}

/**
 * Fails when a live tuner's doc lacks a parameter or a preset, which would
 * mean an empty or broken static page.
 */
function assertTunerDoc(path, markdown) {
  const entry = LIVE_TUNERS.find((t) => t.path === path)
  if (!entry) return
  const domain = TUNER_DOMAINS.find((d) => d.id === entry.id)
  const missing = [
    ...Object.values(domain.defsByKey).map((def) => def.sysctlName),
    ...domain.presets.map((p) => p.label),
  ].filter((s) => !markdown.includes(s))
  if (missing.length) throw new Error(`static page ${path} is missing: ${missing.join(', ')}`)
}

/**
 * @param {{ now: Date, guides?: import('./pages.js').LoadedGuide[], routes?: import('@/routes-meta.js').RouteMeta[] }} options
 *   `now`: one date for every example config in the build. `guides`: the live
 *   guides with their data (pages.js loadStaticGuides()), which every learn
 *   route needs. `routes`: ROUTES_META unless a test gives its own.
 * @returns {{ pages: StaticPage[], llmsTxt: string, llmsFullTxt: string, headers: string }}
 */
export function staticSite({ now, guides = [], routes = ROUTES_META }) {
  const entries = guides.map((g) => g.entry)
  /** @type {StaticPage[]} */
  const pages = []
  for (const route of routes) {
    const doc = pageDoc(route.path, { now, guides })
    const learnRoute = route.path === LEARN_INDEX_ROUTE.path || route.path.startsWith(`${LEARN_INDEX_ROUTE.path}/`)
    if (!doc && learnRoute) throw new Error(`static page ${route.path} has no guide data: pass loadStaticGuides()`)
    if (!doc) continue
    if (!doc.blocks.length) throw new Error(`static page ${route.path} is empty`)
    const markdownPath = markdownPathFor(route.path, entries)
    const markdown = toMarkdown(doc)
    assertTunerDoc(route.path, markdown)
    assertLearnDoc(route.path, markdown, guides)
    pages.push({ path: route.path, html: toHtml(doc), markdownPath, markdown: markdownPath ? markdown : null })
  }
  return { pages, llmsTxt: llmsTxt(entries), llmsFullTxt: llmsFullTxt(pages, entries), headers: markdownHeaders(pages) }
}

/** The URL of a route's Markdown file. */
const markdownUrl = (path, guides) => pageUrl(`/${markdownPathFor(path, guides)}`)

/**
 * llms.txt (llmstxt.org): the site, then one line per Markdown page.
 * @param {import('@/learn/guides.js').LiveGuide[]} [guides]  the live guides
 */
export function llmsTxt(guides = []) {
  const landing = ROUTE_META_BY_PATH['/']
  const setup = ROUTE_META_BY_PATH['/setup']
  return [
    `# ${SITE_NAME}`,
    '',
    `> ${landing.description}`,
    '',
    'Each tuner explains every parameter it sets, with its default, range, sources and presets, and shows the config file it writes for a default profile. The pages below are Markdown copies of the interactive tuners.',
    '',
    '## Tuners',
    '',
    ...LIVE_TUNERS.map((t) => `- [${t.title}](${markdownUrl(t.path, guides)}): ${t.blurb}`),
    '',
    ...(guides.length
      ? [
          '## Guides',
          '',
          ...guides.map((g) => `- [${g.route.ogTitle}](${markdownUrl(g.path, guides)}): ${g.route.description}`),
          '',
        ]
      : []),
    '## Optional',
    '',
    `- [Overview](${markdownUrl('/', guides)}): every tuner on one page, with a link to each.`,
    ...(guides.length ? [`- [${LEARN_INDEX_ROUTE.ogTitle}](${markdownUrl(LEARN_INDEX_ROUTE.path, guides)}): every study guide, with a link to each.`] : []),
    `- [${setup.ogTitle ?? setup.title}](${pageUrl(setup.path)}): ${setup.description}`,
    '',
  ].join('\n')
}

/** llms-full.txt: llms.txt's heading, then every tuner's Markdown in setup order, then every guide's. */
function llmsFullTxt(pages, guides = []) {
  const landing = ROUTE_META_BY_PATH['/']
  const tuners = LIVE_TUNERS.map((t) => pages.find((p) => p.path === t.path).markdown)
  const learn = guides.map((g) => pages.find((p) => p.path === g.path)?.markdown).filter(Boolean)
  return [`# ${SITE_NAME}\n\n> ${landing.description}\n`, ...tuners, ...learn].join('\n---\n\n')
}

/**
 * Cloudflare Pages _headers rules for the Markdown and llms files, one block
 * per file, appended to the copy of public/_headers in dist/. The Markdown
 * files stay out of the index, and name their HTML page as canonical.
 */
function markdownHeaders(pages) {
  const blocks = pages
    .filter((p) => p.markdownPath)
    .map((p) => [
      `/${p.markdownPath}`,
      '  Content-Type: text/markdown; charset=utf-8',
      '  X-Robots-Tag: noindex',
      `  Link: <${pageUrl(p.path)}>; rel="canonical"`,
    ].join('\n'))
  for (const file of ['/llms.txt', '/llms-full.txt']) blocks.push(`${file}\n  Content-Type: text/plain; charset=utf-8`)
  return `\n# Generated by scripts/static-content.mjs: the Markdown copies and llms files.\n${blocks.join('\n')}\n`
}

const APP_DIV = '<div id="app"></div>'

/**
 * Puts a page's static HTML into the SPA shell's <div id="app">, which
 * app.mount() replaces, and adds the Markdown alternate link to the head.
 *
 * @param {string} shell  The route's HTML file, with an empty <div id="app"></div>
 * @param {StaticPage} page
 */
export function injectStatic(shell, page) {
  if (shell.split(APP_DIV).length !== 2) throw new Error(`expected one empty ${APP_DIV} in the page for ${page.path}`)
  let html = shell.replace(APP_DIV, () => `<div id="app">\n${page.html}\n</div>`)
  if (page.markdownPath) {
    if (!html.includes('</head>')) throw new Error(`no </head> in the page for ${page.path}`)
    html = html.replace('</head>', () => `  <link rel="alternate" type="text/markdown" href="/${page.markdownPath}" />\n  </head>`)
  }
  return html
}
