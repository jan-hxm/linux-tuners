/**
 * The static page text layer (Design.md §5 "Routes, SEO and build", §9
 * "Layers"): a composition root like src/setup/, which only the build
 * (scripts/static-content.mjs, through Vite's ssrLoadModule) and tests
 * import. The SPA never loads it.
 */

export { staticSite, injectStatic, llmsTxt } from './site.js'
export { pageDoc } from './pages.js'
export { toHtml } from './html.js'
export { toMarkdown } from './markdown.js'
