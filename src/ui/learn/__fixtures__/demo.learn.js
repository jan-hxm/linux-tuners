/**
 * A stand-in for L1's fixture guide (src/learn/__fixtures__/demo.learn.js),
 * written to the frozen shapes in PLAN-learn.md so the figure components can
 * be tested before L1 merges. Delete this folder at the merge and point the
 * tests at L1's fixture and valueFor().
 *
 * Every figure kind and template part is used once: chapter one has a stack,
 * chapter two a timeline, chapter three a side by side.
 */

export const DEMO_DEFS = {
  alpha: { key: 'alpha', sysctlName: 'demo.alpha', title: 'Alpha level', kernelDocsUrl: 'https://docs.kernel.org/admin-guide/sysctl/vm.html' },
  beta: { key: 'beta', sysctlName: 'demo.beta', title: 'Beta reserve', kernelDocsUrl: 'https://docs.kernel.org/admin-guide/sysctl/vm.html' },
  gamma: { key: 'gamma', sysctlName: 'demo.gamma', title: 'Gamma interval', kernelDocsUrl: 'https://docs.kernel.org/admin-guide/sysctl/vm.html' },
  delta: { key: 'delta', sysctlName: 'demo.delta', title: 'Delta cluster', kernelDocsUrl: 'https://docs.kernel.org/admin-guide/sysctl/vm.html' },
}

export const DEMO_PROBES = {
  'demo.watermarks': { kind: 'zoneinfo' },
  'demo.kswapd': { kind: 'thread', name: 'kswapd0' },
  'demo.minFree': { kind: 'sysctl', name: 'vm.min_free_kbytes' },
  'demo.swaps': { kind: 'file', path: '/proc/swaps', exists: true },
}

const SOURCES = {
  vm: { url: 'https://docs.kernel.org/admin-guide/sysctl/vm.html', label: 'Documentation for /proc/sys/vm' },
  zones: { url: 'https://docs.kernel.org/mm/physical_memory.html', label: 'Physical memory' },
}

export const DEMO_LEARN = {
  slug: 'demo',
  title: 'How the demo machine works',
  lead: 'A short guide that uses every part of the template, for tests.',
  minutes: 5,
  parts: {
    picture: 'Think of a desk and a filing cabinet: the desk is fast and small, the cabinet is slow and large.',
    cards: [
      { id: 'apps', title: 'Programs', does: 'ask for memory', col: 1, row: 1 },
      { id: 'cache', title: 'Page cache', does: 'keeps file data', col: 2, row: 1, tone: 'fit', probe: 'demo.minFree' },
      { id: 'reclaim', title: 'Reclaim', does: 'frees memory', col: 2, row: 2, tone: 'fit', probe: 'demo.kswapd' },
      { id: 'disk', title: 'Disk', does: 'holds files and swap', col: 2, row: 3 },
    ],
    bands: [
      { label: 'RAM', rows: [1, 2] },
      { label: 'DISK', rows: [3, 3] },
    ],
    edges: [
      { from: 'apps', to: 'cache', label: 'read files' },
      { from: 'cache', to: 'reclaim', label: 'when low' },
      { from: 'reclaim', to: 'disk', label: 'writes out' },
    ],
  },
  chapters: [
    {
      id: 'when-reclaim-starts',
      title: 'When reclaim starts',
      oneLine: 'The kernel keeps a little memory free and starts freeing more when it gets close to the line.',
      picture: { text: 'Picture a fuel gauge with three marks on it.', limit: 'A gauge empties at a steady rate; memory use jumps.' },
      figure: {
        kind: 'stack',
        title: 'Free memory in one zone',
        layers: [
          {
            id: 'levels',
            label: 'Free pages',
            kind: 'bands',
            bands: [
              { id: 'above-high', text: 'Above high' },
              { id: 'low-to-high', text: 'Low to high' },
              { id: 'below-min', text: 'Below min' },
            ],
            values: [
              { probe: 'demo.watermarks', path: 'Normal.min', unit: 'pages' },
              { probe: 'demo.watermarks', path: 'Normal.high', unit: 'pages' },
            ],
          },
          {
            id: 'threads',
            label: 'Who frees',
            kind: 'nodes',
            nodes: [
              { id: 'kswapd', text: 'kswapd', sub: 'in the background', probe: 'demo.kswapd' },
              { id: 'direct', text: 'Direct reclaim', sub: 'the program waits' },
            ],
          },
        ],
      },
      body: [
        'The kernel keeps three marks per zone.[^zones] Below the low mark [[kswapd]] wakes up.',
        'Raising `demo.alpha` moves every mark up.[^vm]',
      ],
      pins: [
        { key: 'alpha', here: 'Moves all three marks up or down together.', layer: 'levels' },
        { key: 'beta', here: 'Sets how far apart the marks sit.', layer: 'below-min' },
      ],
      choose: [
        { q: 'Do programs stall while memory is low?', check: 'grep allocstall /proc/vmstat', hint: 'the numbers grow', yes: { key: 'alpha', dir: 'raise' } },
        { q: 'Is most memory free most of the time?', check: 'free -m', hint: 'the free column', yes: { leave: true, why: 'reclaim rarely runs' }, no: { key: 'beta', dir: 'lower' } },
      ],
      symptoms: { low: 'Programs pause for a moment when memory runs short.', high: 'Memory sits unused that programs could have had.' },
      look: { cmd: 'cat /proc/zoneinfo', for: 'the min, low and high lines of the Normal zone' },
      sources: SOURCES,
    },
    {
      id: 'writing-changes',
      title: 'Writing changes to disk',
      oneLine: 'Changed file data waits in memory, then the kernel writes it out.',
      picture: { text: 'Picture an outbox that is emptied every few seconds.', limit: 'The outbox also empties when it gets too full.' },
      figure: {
        kind: 'timeline',
        title: 'Dirty data over time',
        schematic: true,
        lines: [
          { id: 'hard', label: 'Writers wait', value: { probe: 'demo.minFree', path: '', unit: 'kB' } },
          { id: 'soft', label: 'Background writing', value: { probe: 'demo.watermarks', path: 'Normal.low', unit: 'pages' } },
        ],
        curve: [[0, 0.1], [0.3, 0.5], [0.5, 0.7], [0.6, 0.3], [1, 0.2]],
        events: [
          { at: 0.3, label: 'background writing starts', tone: 'fit' },
          { at: 0.5, label: 'writers wait', tone: 'error' },
        ],
      },
      body: ['Dirty data is written back in the background.[^vm]'],
      pins: [{ key: 'gamma', here: 'Sets how often the writer wakes.', layer: 'soft' }],
      choose: [{ q: 'Do writes stall in bursts?', check: 'grep Dirty /proc/meminfo', hint: 'a large number', yes: { key: 'gamma', dir: 'lower' } }],
      symptoms: { low: 'The disk is busy all the time with small writes.', high: 'Writes stall in long bursts.' },
      look: { cmd: 'grep -E "Dirty|Writeback" /proc/meminfo', for: 'how much data waits to be written' },
      sources: { vm: SOURCES.vm },
    },
    {
      id: 'swapping-in',
      title: 'Swapping back in',
      oneLine: 'When a page comes back from swap, its neighbours come with it.',
      picture: { text: 'Picture fetching one folder and taking the ones beside it too.', limit: 'The neighbours are not always needed.' },
      figure: {
        kind: 'sideBySide',
        title: 'Pages read per fault',
        states: [
          { label: 'Cluster 0', cells: 8, lit: 1, setting: { key: 'delta', value: 0 } },
          { label: 'Cluster 3', cells: 8, lit: 8, setting: { key: 'delta', value: 3 } },
        ],
        backedBy: { vmTest: 'swap readahead follows page-cluster' },
      },
      body: ['Each fault reads a cluster of pages.[^vm]'],
      pins: [{ key: 'delta', here: 'Sets how many pages come along.' }],
      choose: [{ q: 'Is swap on a spinning disk?', check: 'cat /sys/block/sda/queue/rotational', hint: '1 means spinning', yes: { key: 'delta', dir: 'raise' }, no: { key: 'delta', dir: 'lower' } }],
      symptoms: { low: 'Swapping in on a spinning disk is slow.', high: 'Memory fills with pages nobody asked for.' },
      look: { cmd: 'swapon --show', for: 'where swap lives' },
      sources: { vm: SOURCES.vm },
    },
  ],
}

/** The five images, in the suite's order, as IMAGES_ORDER will give them. */
export const DEMO_IMAGES = [
  { id: 'debian-13', label: 'Debian 13' },
  { id: 'ubuntu-24.04', label: 'Ubuntu 24.04' },
  { id: 'fedora-43', label: 'Fedora 43' },
  { id: 'debian-11', label: 'Debian 11' },
  { id: 'ubuntu-18.04', label: 'Ubuntu 18.04' },
]

/** Captures for two images; the other three have none (missing). */
export const DEMO_EVIDENCE = {
  'debian-13': {
    image: 'debian-13',
    kernel: '6.12.48+deb13-amd64',
    capturedAt: '2026-11-09T10:00:00Z',
    guestMemoryMiB: 3072,
    probes: {
      'demo.watermarks': { status: 'ok', value: { Normal: { min: 4096, low: 5120, high: 6144 } } },
      'demo.kswapd': { status: 'ok', value: true },
      'demo.minFree': { status: 'ok', value: 67584 },
      'demo.swaps': { status: 'absent', reason: 'no swap configured' },
    },
  },
  'fedora-43': {
    image: 'fedora-43',
    kernel: '6.17.1-300.fc43.x86_64',
    capturedAt: '2026-11-09T10:00:00Z',
    guestMemoryMiB: 3072,
    probes: {
      'demo.watermarks': { status: 'ok', value: { Normal: { min: 3900, low: 4875, high: 5850 } } },
      'demo.kswapd': { status: 'ok', value: true },
    },
  },
}
