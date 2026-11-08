/**
 * Post-build step, run by generate-static-routes.mjs after it has written each
 * route's HTML: gives readers that don't run JavaScript (search and AI
 * crawlers, text browsers) each page's substance as static text, built from
 * the tuner definitions by src/static/ (Design.md §5 "Routes, SEO and build").
 *
 *   - Each route's static HTML goes inside its <div id="app">, which
 *     app.mount() replaces, and each tuner's head gets a Markdown alternate.
 *   - dist/<tuner>.md, dist/index.md, dist/learn.md and dist/learn/<slug>.md
 *     for live study guides, dist/llms.txt and dist/llms-full.txt.
 *   - _headers rules for those files, appended to dist/_headers.
 *
 * src/static/ imports the domains, which need Vite (the `@/` alias, `vue`), so
 * it is loaded through a Vite dev server in middleware mode, closed after.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createServer } from 'vite'

/** Loads src/static/ through Vite and returns its exports. */
async function withStaticModule(rootDir, use) {
  const server = await createServer({
    root: rootDir,
    configFile: path.join(rootDir, 'vite.config.js'),
    appType: 'custom',
    logLevel: 'error',
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
    // lz-string is CommonJS with no named exports Node can see, so it is
    // pre-bundled for SSR rather than imported by Node directly.
    ssr: { noExternal: ['lz-string'], optimizeDeps: { include: ['lz-string'] } },
  })
  try {
    return await use(await server.ssrLoadModule('/src/static/index.js'))
  } finally {
    await server.close()
  }
}

/** dist/<route>/index.html, or dist/index.html for '/'. */
function htmlPathFor(distDir, routePath) {
  // Paths become directories under dist/; refuse anything but one or two plain segments (/learn/<slug>).
  if (!/^\/[a-z0-9-]*(\/[a-z0-9-]+)?$/.test(routePath)) throw new Error(`unsafe route path: ${routePath}`)
  return routePath === '/' ? path.join(distDir, 'index.html') : path.join(distDir, routePath.slice(1), 'index.html')
}

/**
 * @param {{ rootDir: string, distDir: string, now?: Date }} options
 *   `now` is the one date every example config in the build carries.
 */
export async function writeStaticContent({ rootDir, distDir, now = new Date() }) {
  return withStaticModule(rootDir, async ({ staticSite, injectStatic, loadStaticGuides }) => {
    const guides = await loadStaticGuides()
    const { pages, llmsTxt, llmsFullTxt, headers } = staticSite({ now, guides })

    let markdownFiles = 0
    for (const page of pages) {
      const htmlPath = htmlPathFor(distDir, page.path)
      await fs.writeFile(htmlPath, injectStatic(await fs.readFile(htmlPath, 'utf8'), page), 'utf8')
      if (page.markdownPath) {
        if (!/^[a-z0-9-]+(\/[a-z0-9-]+)?\.md$/.test(page.markdownPath)) throw new Error(`unsafe Markdown path: ${page.markdownPath}`)
        const mdPath = path.join(distDir, page.markdownPath)
        await fs.mkdir(path.dirname(mdPath), { recursive: true })
        await fs.writeFile(mdPath, page.markdown, 'utf8')
        markdownFiles += 1
      }
    }
    await fs.writeFile(path.join(distDir, 'llms.txt'), llmsTxt, 'utf8')
    await fs.writeFile(path.join(distDir, 'llms-full.txt'), llmsFullTxt, 'utf8')
    await fs.appendFile(path.join(distDir, '_headers'), headers, 'utf8')

    console.log(`Added static text to ${pages.length} page(s); wrote ${markdownFiles} Markdown file(s), llms.txt and llms-full.txt.`)
  })
}
