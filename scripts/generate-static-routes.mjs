#!/usr/bin/env node
/**
 * Post-build step:
 *   1. For every public (non-noindex) route, write `dist/<path>/index.html`
 *      containing the SPA shell with that route's title, description, OG and
 *      Twitter tags, JSON-LD, and canonical URL baked in. Crawlers that don't
 *      execute JS (Twitter, Facebook, LinkedIn, Discord previewers) see the
 *      right card preview; the SPA hydrates on top of that HTML when a real
 *      visitor lands.
 *   2. Emit `dist/sitemap.xml` from the route metadata so it always reflects
 *      reality and never drifts from the router.
 *
 * Run automatically via `npm run build` (postbuild hook in package.json).
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  ROUTES_META,
  SITE_ORIGIN,
  SITE_NAME,
  OG_IMAGE_PATH,
  DEFAULT_LOCALE,
  jsonLdFor,
} from '../src/routes-meta.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST_DIR = path.resolve(__dirname, '..', 'dist')

async function main() {
  const templatePath = path.join(DIST_DIR, 'index.html')
  const template = await fs.readFile(templatePath, 'utf8')

  let wrote = 0
  for (const route of ROUTES_META) {
    if (route.path === '/') continue // root index.html already exists from Vite
    const html = renderForRoute(template, route)
    const outPath = path.join(DIST_DIR, route.path.slice(1), 'index.html')
    await fs.mkdir(path.dirname(outPath), { recursive: true })
    await fs.writeFile(outPath, html, 'utf8')
    wrote += 1
  }

  // Sitemap covers indexable routes only.
  const sitemap = renderSitemap(ROUTES_META.filter((r) => !r.noindex))
  await fs.writeFile(path.join(DIST_DIR, 'sitemap.xml'), sitemap, 'utf8')

  console.log(
    `Wrote ${wrote} per-route HTML file(s) and sitemap.xml with ${ROUTES_META.filter((r) => !r.noindex).length} entries.`,
  )
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
    <lastmod>${today}</lastmod>
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
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

main().catch((err) => {
  console.error('[generate-static-routes] failed:', err)
  process.exit(1)
})
