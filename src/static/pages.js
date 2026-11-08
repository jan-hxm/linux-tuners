/**
 * What each page says as static text, for readers that don't run JavaScript
 * (Design.md §5 "Routes, SEO and build"). Every page is built from
 * definitions: the registry, each domain's defs, sections, presets, page copy
 * and About content, and the config its generateConfig writes for the default
 * profile. Nothing here reads user state, and nothing branches on a tuner id.
 */

import { LIVE_TUNERS, PLANNED_TUNERS } from '@/tuners/registry.js'
import { TUNER_DOMAINS } from '@/tuners/domains.js'
import { ROUTE_META_BY_PATH, SITE_ORIGIN } from '@/routes-meta.js'
import { presetParams } from '@/core/createTunerStore.js'
import { differingKeys, valueTypeOf } from '@/core/valueTypes.js'
import { optionLabel } from '@/core/profile.js'
import { DESC_PARTS } from '@/ui/descParts.js'
import { GLOSSARY } from '@/ui/glossary.js'
import { NEED_THIS_HEADING, needThisRows } from '@/ui/needThis.js'
import { installGuide } from '@/ui/installGuide.js'
import { controlMetaFor } from '@/ui/controls/meta.js'
import { LANDING_COPY, routeSummary } from '@/ui/landing.js'
import { MACHINE_ROLES, tunersForRole } from '@/core/machineRoles.js'
import { LIVE_GUIDES, LEARN_INDEX_ROUTE, guideFacts, loadGuide } from '@/learn/guides.js'
import { IMAGES_ORDER, valueFor } from '@/learn/evidence.js'
import {
  answerText, backedByText, cardGroups, defName, defTitle, edgeRows, formatValue, noText, numberedSources, probeRef,
  refName, settingText, splitFootnotes, stackRefs,
} from '@/ui/learn/figureText.js'
import { settingHref } from '@/ui/focusSetting.js'
import { text, code, bold, link, rich, heading, paragraph, list, defs, codeBlock, joinSegments } from './nodes.js'

const DOMAINS_BY_ID = Object.fromEntries(TUNER_DOMAINS.map((d) => [d.id, d]))

/** The canonical URL of a route path. */
export const pageUrl = (path) => `${SITE_ORIGIN}${path}`

/** A range as the card prints it, `0–200`; fixed to en-US so every build agrees. */
const rangeText = ({ min, max }) => `${min.toLocaleString('en-US')}–${max.toLocaleString('en-US')}`

const row = (term, ...desc) => ({ term: [text(term)], desc: desc.flat() })

/**
 * One parameter, as its card and "Learn more" show it.
 *
 * @param {import('@/core/types.js').TunerDomain} domain
 * @param {string} key
 * @param {{ hardware: Object, defaults: Object }} profile
 */
function parameterBlocks(domain, key, { hardware, defaults }) {
  const def = domain.defsByKey[key]
  const format = (value) => domain.formatValue(value, def, hardware)
  const range = domain.rangeFor(key, hardware)

  const rows = [row('Name', code(def.sysctlName))]
  if (def.alsoSets?.length) rows.push(row('Also sets', joinSegments(def.alsoSets.map((name) => [code(name)]), ', ')))
  if (def.sysfsPath) rows.push(row('Path', code(def.sysfsPath)))
  rows.push(row(domain.defaultLabel, text(format(def.kernelDefault))))
  if (!valueTypeOf(def).equals(defaults[key], def.kernelDefault)) rows.push(row('For the default profile', text(format(defaults[key]))))
  if (controlMetaFor(def).showsRange && !range.elements) rows.push(row('Range', text(rangeText(range))))
  if (def.options?.length) rows.push(row('Options', text(def.options.map((o) => o.label).join('; '))))
  if (def.segmentLabels?.length) rows.push(row('Options', text(def.segmentLabels.join('; '))))
  if (def.zones?.length) rows.push(row('Zones', text(def.zones.map((z) => z.label).join('; '))))

  const blocks = [heading(3, def.title), defs(rows), paragraph(text(def.shortDesc))]
  if (def.kernelDefaultNote) blocks.push(paragraph(text(def.kernelDefaultNote)))
  for (const part of DESC_PARTS) {
    const paras = def.longDesc[part.key]
    if (!paras?.length) continue
    blocks.push(heading(4, part.label), ...paras.map((p) => paragraph(rich(p))))
  }
  if (def.tuningTip) blocks.push(paragraph(bold('Rule of thumb:'), text(` ${def.tuningTip}`)))
  if (def.dangerousIfZero) blocks.push(paragraph(bold('Danger at 0:'), text(' setting this to 0 is documented as dangerous.')))
  // The card shows the contextual note only for its context (a Kubernetes
  // workload); here it is labelled with that context and always listed.
  const note = def[domain.noteKey] ?? def.contextNote ?? null
  if (note) {
    const { label, badge, url } = domain.context
    blocks.push(paragraph(bold(`${label} (${badge}):`), text(` ${note} `), link('Source', url)))
  }
  blocks.push(paragraph(link(domain.docsLabel, def.kernelDocsUrl)))
  return blocks
}

/**
 * A tuner page: the hero, "Do I need this?", the profile, each section's
 * parameters, presets, graphs, the config for the default profile with its
 * install steps, and the About content.
 *
 * Each section lists in full the parameters visible under the default
 * profile (`visibleKeys`), and names the rest with their short description:
 * those apply only to some profiles (an older kernel, a mode another setting
 * turns on), as on the page.
 *
 * @param {import('@/core/types.js').TunerDomain} domain
 * @param {import('@/tuners/registry.js').TunerEntry} entry
 * @param {{ now: Date }} options  The date the example config carries
 * @returns {import('./nodes.js').Doc}
 */
export function tunerDoc(domain, entry, { now }) {
  const hardware = domain.defaultHardware
  const defaults = domain.deriveDefaults(hardware)
  const { page, about, profile } = domain
  const blocks = [heading(1, page.title), paragraph(rich(page.intro))]

  if (entry.setup) {
    blocks.push(heading(2, NEED_THIS_HEADING), defs(needThisRows(entry.setup).map((r) => row(r.label, text(r.text)))))
  }

  const summary = profile.summary(hardware, (key, value) => optionLabel(profile.fields, key, value)).join(' · ')
  blocks.push(
    heading(2, page.profileStep.title),
    paragraph(text(page.profileStep.subtitle)),
    list(profile.fields.map((f) => [text(f.label)])),
    paragraph(text('Every value on this page is for the default profile: '), rich(summary), text('.')),
  )

  for (const section of domain.sections) {
    const visible = domain.visibleKeys(section, defaults, hardware)
    const hidden = section.keys.filter((k) => !visible.includes(k))
    blocks.push(heading(2, section.title), paragraph(text(section.summary)))
    for (const key of visible) blocks.push(...parameterBlocks(domain, key, { hardware, defaults }))
    if (hidden.length) {
      blocks.push(
        paragraph(text('Shown only when the profile or another setting makes them apply:')),
        list(hidden.map((k) => {
          const def = domain.defsByKey[k]
          return [bold(def.title), text(' ('), code(def.sysctlName), text(`): ${def.shortDesc}`)]
        })),
      )
    }
  }

  blocks.push(heading(2, 'Presets'), paragraph(text('Each preset starts from the default profile\'s values and changes these:')))
  for (const preset of domain.presets) {
    const values = presetParams(domain, hardware, preset.values)
    const changed = differingKeys(domain.defsByKey, values, defaults)
    blocks.push(heading(3, preset.label), paragraph(text(preset.description)))
    if (!changed.length) {
      blocks.push(paragraph(text('Matches the default profile\'s values.')))
      continue
    }
    blocks.push(list(changed.map((key) => {
      const def = domain.defsByKey[key]
      const format = (value) => domain.formatValue(value, def, hardware)
      return [code(def.sysctlName), text(`: ${format(defaults[key])} → ${format(values[key])}`)]
    })))
  }

  if (domain.graphTabs.length) {
    blocks.push(heading(2, 'Graphs'), list(domain.graphTabs.map((tab) => [bold(`${tab.label}:`), text(` ${tab.blurb}`)])))
  }

  const files = domain.generateConfig({ hardware, params: defaults, presetLabel: null, customised: false, now })
  blocks.push(
    heading(2, page.exportStep.title),
    paragraph(text(page.exportStep.subtitle)),
    paragraph(text('The tuner writes this for the default profile, and rewrites it live as you change the values:')),
  )
  for (const file of files) blocks.push(paragraph(code(file.path)), codeBlock(file.content))
  const guide = installGuide(files)
  blocks.push(heading(3, 'Install, check and undo'))
  guide.groups.forEach((group, i) => {
    blocks.push(paragraph(bold(`${i + 1}. ${group.title}.`), text(` ${group.text}`)), codeBlock(group.commands.join('\n')))
  })
  blocks.push(paragraph(bold(guide.undoTitle), text(` ${guide.undoText}`)), codeBlock(guide.undo.join('\n')))

  blocks.push(heading(2, about.heading), ...about.intro.map((p) => paragraph(rich(p))))
  for (const section of about.sections) {
    blocks.push(heading(3, section.title))
    for (const block of section.blocks) {
      blocks.push(block.p ? paragraph(rich(block.p)) : list(block.ul.map((item) => rich(item))))
    }
  }

  return { title: page.title, url: pageUrl(entry.path), blocks }
}

/**
 * The landing page, in the live page's order: the hero, the key to the three
 * marks, why the site exists, the route for each machine role, and every
 * tuner with its question, setting count, files and link. The copy is the
 * live page's (ui/landing.js), so readers without JavaScript get the same
 * story.
 */
export function landingDoc() {
  const meta = ROUTE_META_BY_PATH['/']
  const setup = ROUTE_META_BY_PATH['/setup']
  const { hero, key, why, start, tuners } = LANDING_COPY
  const titles = (list) => list.map((t) => t.title).join(', ')
  const blocks = [
    heading(1, hero.title),
    paragraph(text(hero.lead)),
    paragraph(text(hero.trust)),
    heading(2, key.label),
    defs(key.marks.map((m) => row(m.label, text(m.text)))),
    heading(2, why.heading),
    paragraph(text(why.text)),
    defs([
      row(why.forum.label, code(why.forum.line), text(`: ${why.forum.points.join('. ')}.`)),
      row(why.site.label, text(`${why.site.points.join('. ')}.`)),
    ]),
    heading(2, start.heading),
    paragraph(text(start.intro)),
    list(MACHINE_ROLES.map((r) => {
      const { recommended, optional } = tunersForRole(LIVE_TUNERS, r.value)
      const fine = optional.length ? ` ${start.fineToLeave}: ${titles(optional)}.` : ''
      return [bold(routeSummary(r.label, recommended.length)), text(` ${titles(recommended)}.${fine}`)]
    })),
    paragraph(link(setup.ogTitle ?? setup.title, pageUrl(setup.path)), text(`: ${setup.description}`)),
    heading(2, tuners.heading),
  ]
  for (const tuner of LIVE_TUNERS) {
    const { settingCount, writes } = tuner
    blocks.push(
      heading(3, tuner.title),
      paragraph(bold(tuner.question)),
      paragraph(text(tuner.blurb)),
      defs([
        row(tuners.columns.settings, text(settingCount)),
        row(tuners.columns.writes, joinSegments(writes.map((path) => [code(path)]), ', ')),
      ]),
      list(tuner.keys.filter((k) => k !== '…').map((k) => [code(k)])),
      paragraph(link(`Open the ${tuner.title} tuner`, pageUrl(tuner.path))),
    )
  }
  if (PLANNED_TUNERS.length) {
    blocks.push(paragraph(text(`${tuners.planned}: `), ...PLANNED_TUNERS.map((t, i) => [bold(t.title), text(` (${t.blurb})${i < PLANNED_TUNERS.length - 1 ? '; ' : ''}`)])))
  }
  return { title: meta.ogTitle ?? meta.title, url: `${SITE_ORIGIN}/`, blocks }
}

/** The guided setup: the steps, which are the live tuners in the registry's setup order. */
export function setupDoc() {
  const meta = ROUTE_META_BY_PATH['/setup']
  const blocks = [
    heading(1, meta.ogTitle ?? meta.title),
    paragraph(text(meta.description)),
    heading(2, 'The steps'),
    list(LIVE_TUNERS.map((t) => [link(t.title, pageUrl(t.path)), text(`: ${t.setup.why}`)]), { ordered: true }),
  ]
  return { title: meta.ogTitle ?? meta.title, url: pageUrl(meta.path), blocks }
}

// ── Study guides ──────────────────────────────────────────────────────────

/**
 * @typedef {Object} LoadedGuide  A live guide with its data, as loadStaticGuides() gives it
 * @property {import('@/learn/guides.js').LiveGuide} entry
 * @property {import('@/learn/schema.js').Guide} learn
 * @property {Record<string, import('@/learn/evidence.js').EvidenceFile>} evidence
 * @property {Record<string, any>} [defsByKey]  the tuner's defs; the domain's unless a test gives its own
 */

/**
 * Every live guide with its data, for pageDoc. The guides load lazily (one
 * chunk each in the app), so the build awaits them once before it writes.
 * @param {import('@/learn/guides.js').LiveGuide[]} [entries]
 * @returns {Promise<LoadedGuide[]>}
 */
export async function loadStaticGuides(entries = LIVE_GUIDES) {
  return Promise.all(entries.map(async (entry) => {
    const { learn, evidence } = await loadGuide(entry)
    const domain = entry.domain ? await entry.domain() : DOMAINS_BY_ID[entry.tunerId]
    return { entry, learn, evidence, defsByKey: domain?.defsByKey ?? {} }
  }))
}

/** One value on every image: "Debian 13, kernel 6.12.48: 2,000 pages", or "not measured". */
function measuredRow(ref, evidence) {
  const parts = IMAGES_ORDER.map((img) => {
    const r = valueFor(ref, img.id, evidence)
    const where = r.kernel ? `${img.label}, kernel ${r.kernel}` : img.label
    return `${where}: ${formatValue(r, ref.unit)}`
  })
  return { term: [code(refName(ref))], desc: [text(`${parts.join('; ')}.`)] }
}

/** A figure as lists: its parts, then each value it shows on every kernel. */
function figureBlocks(figure, evidence, defsByKey) {
  const blocks = [heading(3, figure.title)]
  let refs = []
  if (figure.kind === 'stack') {
    blocks.push(paragraph(text('Layers from the top:')))
    blocks.push(list(figure.layers.map((layer) => {
      const items = layer.kind === 'bands'
        ? (layer.bands ?? []).map((b) => b.text)
        : (layer.nodes ?? []).map((n) => [n.text, n.sub].filter(Boolean).join(', '))
      return [bold(`${layer.label}:`), text(` ${items.join('; ')}.`)]
    })))
    refs = stackRefs(figure)
  } else if (figure.kind === 'timeline') {
    blocks.push(paragraph(text('A schematic timeline: the order is real, the distances are not.')))
    blocks.push(paragraph(text(`Lines from the top: ${figure.lines.map((l) => l.label).join(', ')}.`)))
    blocks.push(list([...figure.events].sort((a, b) => a.at - b.at).map((e) => [text(e.label)]), { ordered: true }))
    refs = figure.lines.map((l) => l.value)
  } else if (figure.kind === 'sideBySide') {
    blocks.push(list(figure.states.map((st) => [bold(`${st.label}:`), text(` ${settingText(st.setting, defsByKey)}, ${st.lit} of ${st.cells} lit.`)])))
    const backed = backedByText(figure.backedBy)
    if (backed) blocks.push(paragraph(text(backed)))
  }
  if (refs.length) blocks.push(paragraph(text('Measured on each kernel:')), defs(refs.map((r) => measuredRow(r, evidence))))
  return blocks
}

/** A body paragraph with its `[^id]` marks as `[n]`, numbered as on the page. */
function bodyParagraph(para, sources) {
  const segments = splitFootnotes(para).flatMap((part) => {
    if (part.text) return rich(part.text)
    const n = sources.find((s) => s.id === part.note)?.n
    return n ? [text(`[${n}]`)] : []
  })
  return paragraph(segments)
}

/** A card's measured value on every kernel, for the Start here list. */
function cardMeasured(card, evidence) {
  if (!card.probe) return ''
  const values = IMAGES_ORDER.map((img) => `${img.label} ${formatValue(valueFor(probeRef(card.probe), img.id, evidence))}`)
  return ` Measured: ${values.join(', ')}.`
}

/**
 * One guide's page: the header, Start here, the chapter map and every
 * chapter in the template order, figures as lists with their measured values
 * and the kernel each was measured on, and the chooser as the static flow.
 * @param {LoadedGuide} guide
 * @returns {import('./nodes.js').Doc}
 */
export function learnDoc({ entry, learn, evidence, defsByKey = {} }) {
  const url = pageUrl(entry.path)
  const tune = (key) => pageUrl(settingHref(entry.tunerPath, key))
  const blocks = [
    heading(1, learn.title),
    paragraph(rich(learn.lead)),
    paragraph(text(guideFacts(learn, IMAGES_ORDER.length).join(' · '))),
    paragraph(link(`Tune these settings in the ${entry.tunerTitle} tuner`, pageUrl(entry.tunerPath))),
    heading(2, 'Start here'),
    paragraph(rich(learn.parts.picture)),
    list(cardGroups(learn.parts).flatMap((g) => g.cards.map((c) => [
      bold(`${g.label ? `${g.label}, ` : ''}${c.title}:`),
      text(` ${c.does}${cardMeasured(c, evidence)}`),
    ]))),
  ]
  const edges = edgeRows(learn.parts)
  if (edges.length) blocks.push(paragraph(text('How the parts connect:')), list(edges.map((e) => [text(e.text)])))

  blocks.push(heading(2, 'The chapters'), list(learn.chapters.map((ch) => [
    link(ch.title, `${url}#${ch.id}`),
    text(': '),
    ...rich(ch.oneLine),
    text(' Settings: '),
    ...joinSegments(ch.pins.map((p) => [code(defName(p.key, defsByKey))]), ', '),
    text('.'),
  ]), { ordered: true }))

  for (const ch of learn.chapters) {
    const sources = numberedSources(ch)
    blocks.push(
      heading(2, ch.title),
      paragraph(rich(ch.oneLine)),
      heading(3, 'Picture it'),
      paragraph(rich(ch.picture.text)),
      paragraph(bold('Where the picture stops:'), text(' '), rich(ch.picture.limit)),
      ...figureBlocks(ch.figure, evidence, defsByKey),
      ...ch.body.map((para) => bodyParagraph(para, sources)),
      heading(3, 'Settings here'),
      defs(ch.pins.map((pin) => ({
        term: [code(defName(pin.key, defsByKey))],
        desc: [
          ...(defTitle(pin.key, defsByKey) ? [bold(`${defTitle(pin.key, defsByKey)}.`), text(' ')] : []),
          ...rich(pin.here),
          text(' '),
          link('Tune it', tune(pin.key)),
        ],
      }))),
      heading(3, 'Should you change it?'),
      list(ch.choose.map((q, i) => [
        bold(q.q),
        text(' How to check: '),
        code(q.check),
        text(' ('),
        ...rich(q.hint),
        text(`). Yes: ${answerText(q.yes, defsByKey)} No: ${noText(ch.choose, i, defsByKey)}`),
      ]), { ordered: true }),
      heading(3, "What you notice if it's wrong"),
      defs([
        { term: [text('Too low')], desc: rich(ch.symptoms.low) },
        { term: [text('Too high')], desc: rich(ch.symptoms.high) },
      ]),
      heading(3, 'Look on your machine'),
      codeBlock(ch.look.cmd),
      paragraph(text('Look for '), rich(ch.look.for), text('.')),
      heading(3, 'Sources'),
      list(sources.map((src) => [text(`[${src.n}] `), link(src.label, src.url)])),
    )
  }
  return { title: learn.title, url, blocks }
}

/** The /learn index: every live guide with its lead, facts and tuner. */
export function learnIndexDoc(guides) {
  const blocks = [heading(1, LEARN_INDEX_ROUTE.ogTitle), paragraph(text(LEARN_INDEX_ROUTE.description))]
  for (const { entry, learn } of guides) {
    blocks.push(
      heading(2, learn.title),
      paragraph(rich(learn.lead)),
      paragraph(text(guideFacts(learn, IMAGES_ORDER.length).join(' · '))),
      paragraph(link(`Read ${learn.title}`, pageUrl(entry.path)), text(' · '), link(`Open the ${entry.tunerTitle} tuner`, pageUrl(entry.tunerPath))),
    )
  }
  return { title: LEARN_INDEX_ROUTE.ogTitle, url: pageUrl(LEARN_INDEX_ROUTE.path), blocks }
}

/**
 * The doc for a route, or null for a page with no static text (the legal pages).
 *
 * @param {string} path  A path from ROUTES_META
 * @param {{ now: Date, guides?: LoadedGuide[] }} options  `guides`: the live
 *   guides with their data (loadStaticGuides()); without them a learn route has no doc
 * @returns {import('./nodes.js').Doc | null}
 */
export function pageDoc(path, { now, guides = [] }) {
  const entry = LIVE_TUNERS.find((t) => t.path === path)
  const guide = guides.find((g) => g.entry.path === path)
  const doc =
    path === '/' ? landingDoc()
    : path === '/setup' ? setupDoc()
    : entry ? tunerDoc(DOMAINS_BY_ID[entry.id], entry, { now })
    : path === LEARN_INDEX_ROUTE.path && guides.length ? learnIndexDoc(guides)
    : guide ? learnDoc(guide)
    : null
  return doc && withGlossary(doc)
}

/**
 * Appends the definitions of the glossary terms the page uses, in order of
 * first use. The live page opens them inline (ui/GlossaryTerm.vue); here they
 * are text at the end, never only a `title` tooltip (Design.md §7).
 * @param {import('./nodes.js').Doc} doc
 */
function withGlossary(doc) {
  const ids = new Set()
  const scan = (segments) => segments.forEach((s) => s.type === 'term' && Object.hasOwn(GLOSSARY, s.id) && ids.add(s.id))
  for (const block of doc.blocks) {
    if (block.kind === 'paragraph') scan(block.segments)
    else if (block.kind === 'list') block.items.forEach(scan)
    else if (block.kind === 'defs') block.rows.forEach((r) => (scan(r.term), scan(r.desc)))
  }
  if (!ids.size) return doc
  const rows = [...ids].map((id) => ({ term: [text(GLOSSARY[id].term)], desc: [text(GLOSSARY[id].definition)] }))
  return { ...doc, blocks: [...doc.blocks, heading(2, 'Glossary'), defs(rows)] }
}
