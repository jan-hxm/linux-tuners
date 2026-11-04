#!/usr/bin/env node
/**
 * Post-build step:
 *   1. For every public (non-noindex) route, write `dist/<path>/index.html`
 *      containing the SPA shell with that route's title, description, OG and
 *      Twitter tags, JSON-LD, and canonical URL baked in. Crawlers that don't
 *      execute JS (Twitter, Facebook, LinkedIn, Discord previewers) see the
 *      right card preview; the SPA hydrates on top of that HTML when a real
 *      visitor lands.
 *   2. Emit `dist/sitemap.xml` from the route metadata (tuner routes come from
 *      the registry, src/tuners/registry.js) so it always reflects
 *      reality and never drifts from the router.
 *
 * Run automatically via `npm run build` (postbuild hook in package.json).
 */

import { execFileSync } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { LIVE_TUNERS } from '../src/tuners/registry.js'
import { TOKENS, FONT_SANS } from '../src/ui/theme.js'

import {
  ROUTES_META,
  SITE_ORIGIN,
  SITE_NAME,
  OG_IMAGE_PATH,
  DEFAULT_LOCALE,
  jsonLdFor,
} from '../src/routes-meta.js'
import { writeStaticContent } from './static-content.mjs'

// The 404 page loads no CSS bundle, so it gets the design's paper and ink and
// the system part of the sans stack: no webfont on a page the app never runs.
const SYSTEM_SANS = FONT_SANS.filter((family) => !family.includes('Host Grotesk')).join(', ')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '..')
const DIST_DIR = path.join(ROOT_DIR, 'dist')

// The files a page's content comes from, for its sitemap <lastmod>. A tuner
// page is its own src/tuners/<id>/ folder; the landing cards come from the
// registry, and the guided setup is its own folder and the registry. Shared UI
// is left out, or every tweak would mark every page changed.
const PAGE_SOURCES = {
  '/': ['src/views/LandingView.vue', 'src/tuners/registry.js'],
  '/setup': ['src/setup', 'src/tuners/registry.js'],
}
const sourcesFor = (route) => PAGE_SOURCES[route.path] ?? [`src/tuners/${route.name}`]

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT_DIR, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
}

/**
 * The date of the last commit touching the page's sources, or null when git
 * can't tell: no git, or a shallow clone, where every file looks changed in
 * the one commit it has.
 */
function lastCommitDate(route) {
  try {
    if (git('rev-parse', '--is-shallow-repository') !== 'false') return null
    return git('log', '-1', '--format=%cs', '--', ...sourcesFor(route)) || null
  } catch {
    return null
  }
}

async function main() {
  const templatePath = path.join(DIST_DIR, 'index.html')
  const template = await fs.readFile(templatePath, 'utf8')

  let wrote = 0
  for (const route of ROUTES_META) {
    // Paths become directories under dist/; refuse anything but one plain segment.
    if (!/^\/[a-z0-9-]*$/.test(route.path)) throw new Error(`unsafe route path: ${route.path}`)
    if (route.path === '/') continue // root index.html already exists from Vite
    const html = renderForRoute(template, route)
    const outPath = path.join(DIST_DIR, route.path.slice(1), 'index.html')
    await fs.mkdir(path.dirname(outPath), { recursive: true })
    await fs.writeFile(outPath, html, 'utf8')
    wrote += 1
  }

  await fs.writeFile(path.join(DIST_DIR, '404.html'), render404(), 'utf8')

  // Sitemap covers indexable routes only.
  const sitemap = renderSitemap(ROUTES_META.filter((r) => !r.noindex))
  await fs.writeFile(path.join(DIST_DIR, 'sitemap.xml'), sitemap, 'utf8')

  console.log(
    `Wrote ${wrote} per-route HTML file(s) and sitemap.xml with ${ROUTES_META.filter((r) => !r.noindex).length} entries.`,
  )

  // Last: fills each route's <div id="app"> (dist/index.html too), so any
  // step that copies the shell must run before it.
  await writeStaticContent({ rootDir: ROOT_DIR, distDir: DIST_DIR })
}

/**
 * The static page Cloudflare Pages serves, with a real 404 status, for any path
 * that has no file. No scripts, no ads, not indexable.
 */
export function render404() {
  const links = LIVE_TUNERS.map(
    (t) => `        <li><a href="${escapeHtml(t.path)}">${escapeHtml(t.title)}</a></li>`,
  ).join('\n')
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>Page not found | ${escapeHtml(SITE_NAME)}</title>
    <style>
      body { margin: 0; font-family: ${SYSTEM_SANS}; background: ${TOKENS.paper[0]}; color: ${TOKENS.ink[0]}; line-height: 1.5; }
      main { max-width: 36rem; margin: 0 auto; padding: 3rem 1rem; }
      h1 { font-size: 1.5rem; font-weight: 500; letter-spacing: -0.02em; margin: 0 0 0.75rem; }
      a { color: inherit; text-underline-offset: 3px; }
      a:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
      ul { padding-left: 1.25rem; }
      @media (prefers-color-scheme: dark) {
        body { background: ${TOKENS.paper[1]}; color: ${TOKENS.ink[1]}; }
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Page not found</h1>
      <p>There is nothing at this address. Go to the <a href="/">${escapeHtml(SITE_NAME)} home page</a> or pick a tuner:</p>
      <ul>
${links}
      </ul>
    </main>
  </body>
</html>
`
}

function renderForRoute(template, route) {
  const url = `${SITE_ORIGIN}${route.path === '/' ? '/' : route.path}`
  const ogTitle = route.ogTitle ?? route.title
  const robots = route.noindex ? 'noindex, follow' : 'index, follow'
  const ogImage = `${SITE_ORIGIN}${OG_IMAGE_PATH}`
  const ld = jsonLdFor(route)
  const jsonLdScript = ld
    ? `\n    <script type="application/ld+json">${JSON.stringify(ld)}</script>`
    : ''

  let html = template

  html = replaceTag(html, /<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(route.title)}</title>`)
  html = replaceMeta(html, 'name', 'description', route.description)
  html = replaceMeta(html, 'name', 'robots', robots)
  html = replaceLink(html, 'canonical', url)

  html = replaceMeta(html, 'property', 'og:title', ogTitle)
  html = replaceMeta(html, 'property', 'og:description', route.description)
  html = replaceMeta(html, 'property', 'og:url', url)
  html = replaceMeta(html, 'property', 'og:site_name', SITE_NAME)
  html = replaceMeta(html, 'property', 'og:locale', DEFAULT_LOCALE)
  html = replaceMeta(html, 'property', 'og:image', ogImage)

  html = replaceMeta(html, 'name', 'twitter:title', ogTitle)
  html = replaceMeta(html, 'name', 'twitter:description', route.description)
  html = replaceMeta(html, 'name', 'twitter:image', ogImage)

  // Inject route-specific JSON-LD just before </head>.
  if (jsonLdScript) html = html.replace('</head>', `${jsonLdScript}\n  </head>`)

  return html
}

function replaceTag(html, regex, replacement) {
  if (!regex.test(html)) return html
  return html.replace(regex, replacement)
}

function replaceMeta(html, attr, name, content) {
  // Match either order of attributes inside the tag, with whatever content.
  const pattern = new RegExp(
    `<meta\\s+([^>]*\\b${attr}="${escapeRegex(name)}"[^>]*)>`,
    'i',
  )
  const newTag = `<meta ${attr}="${name}" content="${escapeHtml(content)}" />`
  if (!pattern.test(html)) {
    // Inject just before </head> if it didn't already exist.
    return html.replace('</head>', `    ${newTag}\n  </head>`)
  }
  return html.replace(pattern, newTag)
}

function replaceLink(html, rel, href) {
  const pattern = new RegExp(`<link\\s+rel="${escapeRegex(rel)}"[^>]*>`, 'i')
  const newTag = `<link rel="${rel}" href="${escapeHtml(href)}" />`
  if (!pattern.test(html)) {
    return html.replace('</head>', `    ${newTag}\n  </head>`)
  }
  return html.replace(pattern, newTag)
}

function renderSitemap(routes) {
  const today = new Date().toISOString().slice(0, 10)
  const entries = routes
    .map(
      (r) => `  <url>
    <loc>${SITE_ORIGIN}${r.path === '/' ? '/' : r.path}</loc>
    <lastmod>${lastCommitDate(r) ?? today}</lastmod>
    <changefreq>${r.changefreq ?? 'monthly'}</changefreq>
    <priority>${r.priority?.toFixed?.(1) ?? '0.5'}</priority>
  </url>`,
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((err) => {
    console.error('[generate-static-routes] failed:', err)
    process.exit(1)
  })
}
