/**
 * Single source of truth for per-route SEO metadata. Imported by:
 *   - src/router.js                   → applies head tags client-side on each navigation
 *   - scripts/generate-static-routes.mjs → emits one HTML file per route at build time so
 *                                          social-card crawlers (Twitter, Facebook, LinkedIn,
 *                                          Discord) see the right OG tags without running JS
 *
 * Keep the metadata declarative — no Vue imports here. Tuner routes come from
 * the registry (src/tuners/registry.js); only the landing and legal pages are
 * listed here.
 */

import { LIVE_TUNERS } from './tuners/registry.js'
import { LIVE_GUIDES, LEARN_INDEX_ROUTE } from './learn/guides.js'

export const SITE_ORIGIN = 'https://linux-tuners.dev'
export const SITE_NAME = 'linux-tuners.dev'
// Bump v whenever og-image.png changes: Discord, Slack, LinkedIn and Facebook
// cache link previews by image URL and would keep showing the old card.
export const OG_IMAGE_PATH = '/og-image.png?v=2'
export const DEFAULT_LOCALE = 'en_US'

/**
 * @typedef {Object} RouteMeta
 * @property {string}  path           Route path (e.g. '/swap')
 * @property {string}  name           Vue Router name
 * @property {string}  title          Full <title>
 * @property {string}  description    Plain-language summary for <meta name="description"> + og:description
 * @property {string}  ogTitle        Shorter title for OG card (falls back to title if omitted)
 * @property {boolean} [noindex]      When true, emit "noindex, follow" + omit from sitemap
 * @property {number}  [priority]     Sitemap priority 0..1
 * @property {string}  [changefreq]   Sitemap change frequency
 * @property {string}  [jsonLdType]   Schema.org @type for JSON-LD structured data
 * @property {string[]} [sources]     Files and folders the page's content comes from, for its
 *                                    sitemap <lastmod> (scripts/generate-static-routes.mjs)
 */

/**
 * The learn routes (Design.md §5 "Learning pages > Routes and pages"): the
 * /learn index and one page per live guide, or none at all while no guide is
 * live. A draft guide gets no route.
 * @param {import('./learn/guides.js').LiveGuide[]} guides
 * @returns {RouteMeta[]}
 */
export function learnRoutesMeta(guides) {
  if (!guides.length) return []
  const guideSources = (g) => [`src/tuners/${g.tunerId}/learn.js`, `src/tuners/${g.tunerId}/probes.js`, 'src/learn/evidence']
  return [
    { ...LEARN_INDEX_ROUTE, sources: ['src/views/LearnIndexView.vue', 'src/tuners/registry.js', ...guides.flatMap(guideSources)] },
    ...guides.map((g) => ({ path: g.path, name: `learn-${g.slug}`, ...g.route, sources: ['src/views/LearnView.vue', ...guideSources(g)] })),
  ]
}

/** @type {RouteMeta[]} */
export const ROUTES_META = [
  {
    path: '/',
    name: 'landing',
    title: 'linux-tuners.dev | hardware-aware Linux config tuners',
    description:
      'Interactive Linux config tuners with hardware-aware defaults, live impact graphs and copy-paste configs for sysctl, systemd and udev.',
    ogTitle: 'Hardware-aware Linux config tuners',
    priority: 1.0,
    changefreq: 'monthly',
    jsonLdType: 'WebSite',
  },
  {
    path: '/setup',
    name: 'setup',
    title: 'Guided Linux setup | linux-tuners.dev',
    description:
      'Tune a whole Linux machine in one pass: describe it once, go through every tuner in the order that matters, and get each sysctl, systemd and udev file.',
    ogTitle: 'Guided Linux setup',
    priority: 0.9,
    changefreq: 'monthly',
    jsonLdType: 'SoftwareApplication',
  },
  ...LIVE_TUNERS.map((t) => ({ path: t.path, name: t.id, ...t.route })),
  ...learnRoutesMeta(LIVE_GUIDES),
  {
    path: '/imprint',
    name: 'imprint',
    title: 'Imprint | linux-tuners.dev',
    description: 'Imprint per § 5 TMG (German Telemedia Act).',
    ogTitle: 'Imprint',
    noindex: true,
  },
  {
    path: '/privacy',
    name: 'privacy',
    title: 'Privacy policy | linux-tuners.dev',
    description: 'Information on the processing of personal data per Art. 13 GDPR.',
    ogTitle: 'Privacy policy',
    noindex: true,
  },
]

/** Fast lookup by path. */
export const ROUTE_META_BY_PATH = Object.fromEntries(ROUTES_META.map((r) => [r.path, r]))

/**
 * Build the JSON-LD structured-data object for a given route. Returned as a
 * plain JS object that should be stringified into a <script type="application/ld+json">.
 *
 * @param {RouteMeta} route
 * @returns {Object|null}
 */
export function jsonLdFor(route) {
  if (!route.jsonLdType) return null
  const url = `${SITE_ORIGIN}${route.path === '/' ? '' : route.path}`

  if (route.jsonLdType === 'WebSite') {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_ORIGIN,
      description: route.description,
    }
  }

  if (route.jsonLdType === 'SoftwareApplication') {
    return {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: route.ogTitle ?? route.title,
      url,
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Linux',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      description: route.description,
      isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_ORIGIN },
    }
  }

  if (route.jsonLdType === 'TechArticle') {
    return {
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline: route.ogTitle ?? route.title,
      url,
      description: route.description,
      inLanguage: 'en',
      proficiencyLevel: 'Beginner',
      isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_ORIGIN },
    }
  }

  return {
    '@context': 'https://schema.org',
    '@type': route.jsonLdType,
    name: route.ogTitle ?? route.title,
    url,
    description: route.description,
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_ORIGIN },
  }
}
