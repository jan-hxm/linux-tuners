/**
 * The landing page's copy and its tuner-table rows, as plain data and plain
 * JS. Both the live page (views/LandingView.vue) and its static text
 * (static/pages.js `landingDoc`, which also feeds index.md) read them, so a
 * reader without JavaScript gets the same story. Nothing here reads state.
 */

export const LANDING_COPY = Object.freeze({
  hero: {
    title: 'Understand every setting before you change it.',
    lead: 'Describe your machine. Each kernel and systemd setting starts at a value that fits it, with the reasoning written beside it. When you are done, you copy the files, with the steps to apply and undo them.',
    pickRole: 'Pick your machine type',
    browse: 'Browse tuners',
    trust: 'Free. Runs in your browser. Nothing is sent anywhere.',
  },
  specimen: {
    caption: 'Try it. Every setting on this site reads like this.',
    loading: 'Loading the example setting.',
  },
  // The three marks (REDESIGN §3). The first one's label is the domain's
  // defaultLabel on a tuner page; here it speaks for every tuner.
  key: {
    label: 'How to read the marks',
    marks: [
      { kind: 'default', label: 'Kernel default', text: 'What the kernel, or systemd, ships with.' },
      { kind: 'fit', label: 'Fits your machine', text: 'Worked out from what you say about the machine, with the reason beside it.' },
      { kind: 'mine', label: 'Changed by you', text: 'A value you moved away from the one that fits, with a way back to it.' },
    ],
  },
  why: {
    heading: 'Most advice gives every machine the same number.',
    text: 'Tuning tips live in old forum threads and scattered kernel pages. The right value depends on your RAM, disks, network and workload, but most guides skip that, and they rarely say what you give up.',
    forum: {
      label: 'A forum thread',
      line: 'vm.swappiness=1',
      points: ['Same for every machine', 'No trade-off named', 'No source, no undo'],
    },
    site: {
      label: 'This site',
      points: ['Worked out for your machine', 'What you gain and give up', 'Cited, with the undo command'],
    },
  },
  start: {
    heading: 'What is this machine for?',
    intro: 'Pick the closest match. The route shows which tuners matter and in what order.',
    anyMachine: 'Any machine',
    setupButton: 'Start guided setup',
    setupNote: 'The guided setup walks through the route for one machine, then shows every file it needs.',
    fineToLeave: 'Usually fine to leave',
  },
  tuners: {
    heading: 'Or open one tuner directly',
    tableLabel: 'Every tuner, with the question it answers',
    columns: { question: 'The question', tuner: 'Tuner', settings: 'Settings', writes: 'Writes' },
    planned: 'Coming next',
  },
})

/**
 * The route's header line: "Database: 9 tuners, in this order." With no role
 * picked, every tuner in setup order.
 *
 * @param {string | undefined} roleLabel
 * @param {number} count
 */
export function routeSummary(roleLabel, count) {
  const tuners = count === 1 ? '1 tuner' : `${count} tuners`
  return roleLabel ? `${roleLabel}: ${tuners}, in this order.` : `${LANDING_COPY.start.anyMachine}: all ${tuners}, in setup order.`
}

// One fixed date: only the file paths are read, never the dated header.
const PATHS_DATE = new Date(0)

/**
 * A tuner table row's numbers, from the tuner's domain: how
 * many settings the tuner has, and the files it writes for its default
 * profile.
 *
 * @param {import('@/core/types.js').TunerDomain} domain
 * @returns {{ settings: number, writes: string[] }}
 */
export function tunerFacts(domain) {
  const hardware = domain.defaultHardware
  const files = domain.generateConfig({
    hardware,
    params: domain.deriveDefaults(hardware),
    presetLabel: null,
    customised: false,
    now: PATHS_DATE,
  })
  return { settings: domain.parameterKeys.length, writes: [...new Set(files.map((f) => f.path))] }
}
