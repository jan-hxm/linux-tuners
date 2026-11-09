/**
 * The study guides (Design.md §5 "Learning pages > Routes and pages"): one
 * entry per guide slug with its tuner, its route metadata and lazy loaders
 * for its data, like TUNER_DOMAIN_LOADERS in src/router.js. Each guide gets
 * its own chunk, so a page that never shows a guide never loads one.
 *
 * Plain JS that runs under Node too (scripts/generate-static-routes.mjs reads
 * the route metadata through routes-meta.js): the loaders are dynamic imports,
 * run only when called. Whether a guide is shown is the registry's call
 * (`guide.status`, src/tuners/registry.js); a `draft` guide gets no route, no
 * link and no static page.
 *
 * Every slug here is a `guide.slug` in the registry and has a learn.js the
 * guide contract suite checks (src/learn/guides.test.js).
 */

import { TUNERS } from '../tuners/registry.js'

/**
 * @typedef {import('./schema.js').Guide} Guide
 * @typedef {import('./evidence.js').EvidenceFile} EvidenceFile
 *
 * @typedef {Object} GuideSource
 * @property {string} tunerId  the registry id of the tuner whose settings it explains
 * @property {{ title: string, description: string, ogTitle: string, priority: number,
 *   changefreq: string, jsonLdType: string }} route  route metadata (ogTitle is the guide's title)
 * @property {() => Promise<Guide>} learn  the guide's data (its LEARN)
 * @property {() => Promise<Record<string, { kind: string }>>} probes  its PROBES
 * @property {() => Promise<Record<string, EvidenceFile>>} [evidence]  the captures its
 *   figures read; the committed ones (src/learn/evidence/) unless a test gives its own
 * @property {() => Promise<object>} [domain]  the tuner's domain; the router's
 *   loader for `tunerId` unless a test gives its own
 *
 * @typedef {GuideSource & { slug: string, path: string, tunerPath: string, tunerTitle: string }} LiveGuide
 */

const committedEvidence = () => import('./evidence.js').then((m) => m.loadEvidence())

/** @type {Record<string, GuideSource>} */
export const GUIDES = {
  memory: {
    tunerId: 'swap',
    route: {
      title: 'How Linux manages memory | linux-tuners.dev',
      description:
        'A beginner guide to Linux memory: reclaim, watermarks, swap, dirty writeback, overcommit and the OOM killer, with figures measured on five kernels.',
      ogTitle: 'How Linux manages memory',
      priority: 0.8,
      changefreq: 'monthly',
      jsonLdType: 'TechArticle',
    },
    learn: () => import('../tuners/swap/learn.js').then((m) => m.LEARN),
    probes: () => import('../tuners/swap/probes.js').then((m) => m.PROBES),
  },
  hardening: {
    tunerId: 'security',
    route: {
      title: 'How Linux hardening works | linux-tuners.dev',
      description:
        'A beginner guide to Linux hardening sysctls: kernel addresses, ptrace, ASLR, BPF, user namespaces, /tmp links and network spoofing, with sources.',
      ogTitle: 'How Linux hardening works',
      priority: 0.8,
      changefreq: 'monthly',
      jsonLdType: 'TechArticle',
    },
    learn: () => import('../tuners/security/learn.js').then((m) => m.LEARN),
    probes: () => import('../tuners/security/probes.js').then((m) => m.PROBES),
  },
  'file-limits': {
    tunerId: 'filesystem',
    route: {
      title: 'How Linux limits open files and file watching | linux-tuners.dev',
      description:
        'A beginner guide to Linux file limits: open files, inotify watches and queues, and async I/O slots, with figures measured on five kernels.',
      ogTitle: 'How Linux limits open files and file watching',
      priority: 0.8,
      changefreq: 'monthly',
      jsonLdType: 'TechArticle',
    },
    learn: () => import('../tuners/filesystem/learn.js').then((m) => m.LEARN),
    probes: () => import('../tuners/filesystem/probes.js').then((m) => m.PROBES),
  },
  ipc: {
    tunerId: 'sysv-ipc',
    route: {
      title: 'How Linux programs share memory and messages | linux-tuners.dev',
      description:
        'A beginner guide to System V IPC: shared memory segments, semaphores and message queues, and the six limits the kernel sets on them, with official sources.',
      ogTitle: 'How Linux programs share memory and messages',
      priority: 0.8,
      changefreq: 'monthly',
      jsonLdType: 'TechArticle',
    },
    learn: () => import('../tuners/sysv-ipc/learn.js').then((m) => m.LEARN),
    probes: () => import('../tuners/sysv-ipc/probes.js').then((m) => m.PROBES),
  },
  networking: {
    tunerId: 'network',
    route: {
      title: 'How Linux handles network connections | linux-tuners.dev',
      description:
        'A beginner guide to the Linux network stack: socket buffers, listen queues, congestion control, ports, TIME-WAIT and connection tracking.',
      ogTitle: 'How Linux handles network connections',
      priority: 0.8,
      changefreq: 'monthly',
      jsonLdType: 'TechArticle',
    },
    learn: () => import('../tuners/network/learn.js').then((m) => m.LEARN),
    probes: () => import('../tuners/network/probes.js').then((m) => m.PROBES),
  },
}

/** The /learn index's own route metadata; the route exists only while a guide is live. */
export const LEARN_INDEX_ROUTE = {
  path: '/learn',
  name: 'learn',
  title: 'Learn how Linux settings work | linux-tuners.dev',
  description:
    'Beginner study guides to the Linux settings the tuners set: what each one acts on, with pictures, official sources and values measured on five kernels.',
  ogTitle: 'Learn how Linux settings work',
  priority: 0.8,
  changefreq: 'monthly',
  jsonLdType: 'CollectionPage',
}

/** The path of a guide's page. */
export const guidePath = (slug) => `${LEARN_INDEX_ROUTE.path}/${slug}`

/**
 * The guides with a page: each live tuner whose registry `guide` is `live`
 * and has an entry in `guides`, in registry order. A test passes its own
 * `guides` (the fixture guide) to see the whole path with a live guide.
 * @param {import('../tuners/registry.js').TunerEntry[]} [tuners]
 * @param {Record<string, GuideSource>} [guides]
 * @returns {LiveGuide[]}
 */
export function liveGuides(tuners = TUNERS, guides = GUIDES) {
  return tuners
    .filter((t) => t.status === 'live' && t.guide?.status === 'live' && Object.hasOwn(guides, t.guide.slug))
    .filter((t) => guides[t.guide.slug].tunerId === t.id)
    .map((t) => ({
      ...guides[t.guide.slug],
      slug: t.guide.slug,
      path: guidePath(t.guide.slug),
      tunerPath: t.path,
      tunerTitle: t.title,
    }))
}

export const LIVE_GUIDES = liveGuides()

/**
 * Everything a guide's page shows: the guide, its probes and the captures.
 * @param {LiveGuide} entry
 */
export async function loadGuide(entry) {
  const [learn, probes, evidence] = await Promise.all([entry.learn(), entry.probes(), (entry.evidence ?? committedEvidence)()])
  return { learn, probes, evidence }
}

/**
 * Which chapter pins each setting: `{ [defKey]: chapterId }`, for the tuner
 * cards' "How it works" links (ui/descParts.js HOW_IT_WORKS_KEY). The
 * contract suite checks that every key is pinned exactly once.
 * @param {Guide} learn
 * @returns {Record<string, string>}
 */
export function chapterIndex(learn) {
  const out = {}
  for (const ch of learn.chapters ?? []) {
    for (const pin of ch.pins ?? []) if (!Object.hasOwn(out, pin.key)) out[pin.key] = ch.id
  }
  return out
}

/**
 * The chapter index of a live guide, loading only its learn.js (for the
 * tuner page's "How it works" links: no probes, no captures).
 * @param {LiveGuide} entry
 * @returns {Promise<Record<string, string>>}
 */
export function loadChapterIndex(entry) {
  return entry.learn().then(chapterIndex)
}

/** Every setting a guide pins, in chapter order. */
export const pinnedKeys = (learn) => learn.chapters.flatMap((ch) => ch.pins.map((p) => p.key))

/**
 * The facts line under a guide's title and on its index card, built once for
 * the page and the static text: chapters, settings, minutes, kernels.
 * @param {Guide} learn
 * @param {number} kernels  how many VM images the figures were measured on
 */
export function guideFacts(learn, kernels) {
  const n = (count, one, many) => `${count} ${count === 1 ? one : many}`
  return [
    n(learn.chapters.length, 'chapter', 'chapters'),
    n(new Set(pinnedKeys(learn)).size, 'setting', 'settings'),
    `${learn.minutes} min read`,
    `Figures measured on ${n(kernels, 'kernel', 'kernels')}`,
  ]
}
