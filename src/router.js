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

// Map declarative route meta → vue-router route records, attaching the
// lazy-loaded view component for each path.
const VIEW_LOADERS = {
  '/': () => import('@/views/LandingView.vue'),
  '/swap': () => import('@/views/SwapTunerView.vue'),
  '/systemd': () => import('@/views/SystemdTunerView.vue'),
  '/impressum': () => import('@/views/ImpressumView.vue'),
  '/datenschutz': () => import('@/views/DatenschutzView.vue'),
}

const routes = [
  ...ROUTES_META.map((r) => ({
    path: r.path,
    name: r.name,
    component: VIEW_LOADERS[r.path],
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
