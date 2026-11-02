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

export const SITE_ORIGIN = 'https://linux-tuners.dev'
export const SITE_NAME = 'linux-tuners.dev'
export const OG_IMAGE_PATH = '/og-image.png'
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
 */

/** @type {RouteMeta[]} */
export const ROUTES_META = [
  {
    path: '/',
    name: 'landing',
    title: 'linux-tuners.dev | hardware-aware Linux config tuners',
    description:
      'Interactive Linux configuration tuners with hardware-aware defaults, live impact graphs, and copy-pasteable configs. Tune swap, memory reclaim, dirty-page writeback, and more.',
    ogTitle: 'Hardware-aware Linux config tuners',
    priority: 1.0,
    changefreq: 'monthly',
    jsonLdType: 'WebSite',
  },
  ...LIVE_TUNERS.map((t) => ({ path: t.path, name: t.id, ...t.route })),
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

  return {
    '@context': 'https://schema.org',
    '@type': route.jsonLdType,
    name: route.ogTitle ?? route.title,
    url,
    description: route.description,
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_ORIGIN },
  }
}
