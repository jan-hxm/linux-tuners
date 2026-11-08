import { h } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import {
  ROUTES_META,
  ROUTE_META_BY_PATH,
  SITE_NAME,
  SITE_ORIGIN,
  OG_IMAGE_PATH,
  DEFAULT_LOCALE,
  jsonLdFor,
} from './routes-meta.js'
import { LIVE_TUNERS } from './tuners/registry.js'
import { LIVE_GUIDES, LEARN_INDEX_ROUTE, loadGuide, loadChapterIndex } from './learn/guides.js'

// Lazy-loaded domain module per live tuner, keyed by registry id. Kept here
// rather than in the registry so the registry stays plain data and each tuner
// gets its own chunk. Every live registry entry needs one
// (src/tuners/registry.test.js).
const TUNER_DOMAIN_LOADERS = {
  swap: () => import('@/tuners/swap/index.js').then((m) => m.swapDomain),
  systemd: () => import('@/tuners/systemd/index.js').then((m) => m.systemdDomain),
  security: () => import('@/tuners/security/index.js').then((m) => m.securityDomain),
  network: () => import('@/tuners/network/index.js').then((m) => m.networkDomain),
  filesystem: () => import('@/tuners/filesystem/index.js').then((m) => m.filesystemDomain),
  hugepages: () => import('@/tuners/hugepages/index.js').then((m) => m.hugepagesDomain),
  'sysv-ipc': () => import('@/tuners/sysv-ipc/index.js').then((m) => m.sysvIpcDomain),
  kernel: () => import('@/tuners/kernel/index.js').then((m) => m.kernelDomain),
  'block-io': () => import('@/tuners/block-io/index.js').then((m) => m.blockIoDomain),
}

/**
 * What a tuner page knows of its live guide: where it is, and a lazy lookup
 * of the chapter that pins each setting (loaded only once the page asks, so a
 * tuner with a draft guide or none pays nothing). Null without a live guide.
 */
function guideLinkFor(tunerId) {
  const g = LIVE_GUIDES.find((entry) => entry.tunerId === tunerId)
  return g ? { path: g.path, title: g.route.ogTitle, chapters: () => loadChapterIndex(g) } : null
}

/** A lazy route component that renders the shared TunerPage for one domain. */
function tunerView(loadDomain) {
  return () =>
    Promise.all([loadDomain(), import('@/ui/TunerPage.vue')]).then(([domain, { default: TunerPage }]) => {
      const guide = guideLinkFor(domain.id)
      return {
        name: `TunerView-${domain.id}`,
        render: () => h(TunerPage, { domain, guide }),
      }
    })
}

export const TUNER_VIEWS = Object.fromEntries(
  Object.entries(TUNER_DOMAIN_LOADERS).map(([id, load]) => [id, tunerView(load)]),
)

/**
 * A live guide's page: the guide's data, its captures and its tuner's domain
 * (for the settings' names and the "Tune it" links), loaded together.
 * @param {import('./learn/guides.js').LiveGuide} entry
 */
function guideView(entry) {
  const loadDomain = entry.domain ?? TUNER_DOMAIN_LOADERS[entry.tunerId]
  return () =>
    Promise.all([loadGuide(entry), loadDomain(), import('@/views/LearnView.vue')]).then(([data, domain, { default: LearnView }]) => ({
      name: `LearnView-${entry.slug}`,
      render: () => h(LearnView, { entry, ...data, domain }),
    }))
}

/** The /learn index: every live guide's data, so the cards need no loading state. */
function learnIndexView() {
  return () =>
    Promise.all([Promise.all(LIVE_GUIDES.map((g) => g.learn())), import('@/views/LearnIndexView.vue')]).then(([learns, { default: LearnIndexView }]) => ({
      name: 'LearnIndexView',
      render: () => h(LearnIndexView, { guides: LIVE_GUIDES.map((entry, i) => ({ entry, learn: learns[i] })) }),
    }))
}

/** Lazy views for the learn routes (none while no guide is live). */
export const LEARN_VIEWS = LIVE_GUIDES.length
  ? Object.fromEntries([[LEARN_INDEX_ROUTE.path, learnIndexView()], ...LIVE_GUIDES.map((g) => [g.path, guideView(g)])])
  : {}

const PAGE_VIEWS = {
  '/': () => import('@/views/LandingView.vue'),
  '/setup': () => import('@/setup/SetupView.vue'),
  '/imprint': () => import('@/views/ImpressumView.vue'),
  '/privacy': () => import('@/views/DatenschutzView.vue'),
}

const TUNER_VIEW_BY_PATH = Object.fromEntries(LIVE_TUNERS.map((t) => [t.path, TUNER_VIEWS[t.id]]))

// Map declarative route meta → vue-router route records, attaching the
// lazy-loaded view component for each path. Exported for tests that mount
// the app on a memory history.
export const routes = [
  ...ROUTES_META.map((r) => ({
    path: r.path,
    name: r.name,
    component: PAGE_VIEWS[r.path] ?? TUNER_VIEW_BY_PATH[r.path] ?? LEARN_VIEWS[r.path],
    meta: r,
  })),
  {
    path: '/:pathMatch(.*)*',
    redirect: { name: 'landing' },
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash) return { el: to.hash, behavior: 'smooth' }
    // A query change on the same page (the landing role picker) stays put.
    if (to.path === from.path) return false
    return { top: 0 }
  },
})

router.afterEach((to) => {
  if (typeof document === 'undefined') return
  const meta = ROUTE_META_BY_PATH[to.path] ?? ROUTE_META_BY_PATH['/']
  applyHead(meta)
})

function applyHead(route) {
  const url = `${SITE_ORIGIN}${route.path === '/' ? '/' : route.path}`
  const ogTitle = route.ogTitle ?? route.title

  document.title = route.title
  setMeta('description', route.description)
  setMeta('robots', route.noindex ? 'noindex, follow' : 'index, follow')

  // Open Graph
  setMeta('og:type', 'website', 'property')
  setMeta('og:site_name', SITE_NAME, 'property')
  setMeta('og:locale', DEFAULT_LOCALE, 'property')
  setMeta('og:title', ogTitle, 'property')
  setMeta('og:description', route.description, 'property')
  setMeta('og:url', url, 'property')
  setMeta('og:image', `${SITE_ORIGIN}${OG_IMAGE_PATH}`, 'property')

  // Twitter card
  setMeta('twitter:card', 'summary_large_image')
  setMeta('twitter:title', ogTitle)
  setMeta('twitter:description', route.description)
  setMeta('twitter:image', `${SITE_ORIGIN}${OG_IMAGE_PATH}`)

  // Canonical link
  setLink('canonical', url)

  // JSON-LD structured data (one script tag, replaced per route)
  const ld = jsonLdFor(route)
  setJsonLd(ld)
}

/**
 * @param {string} name
 * @param {string} content
 * @param {'name'|'property'} [attr]
 */
function setMeta(name, content, attr = 'name') {
  let el = document.head.querySelector(`meta[${attr}="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

function setJsonLd(data) {
  const existing = document.head.querySelector('script[type="application/ld+json"][data-route]')
  if (existing) existing.remove()
  if (!data) return
  const el = document.createElement('script')
  el.type = 'application/ld+json'
  el.setAttribute('data-route', '1')
  el.textContent = JSON.stringify(data)
  document.head.appendChild(el)
}
