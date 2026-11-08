/**
 * Fixture guide for the guide contract suite, the figure components (L2) and
 * the learn pages (L5). It uses every figure kind, every template part and
 * every optional field, so each can be rendered before a real guide exists.
 * Its defs belong to no tuner and its evidence (./evidence/*.json) is made up;
 * it must never be routed outside tests.
 *
 * It passes validateGuide as `draft` with no evidence and as `live` with the
 * fixture evidence.
 */

/** The fixture tuner's defs: only what the guide and its pins read. */
export const DEFS = [
  { key: 'reserve_kbytes', sysctlName: 'demo.reserve_kbytes', title: 'Free memory reserve', shortDesc: 'Memory the kernel keeps free for urgent requests.', unit: 'kB', kernelDefault: 4000 },
  { key: 'fill_ratio', sysctlName: 'demo.fill_ratio', title: 'Fill ratio', shortDesc: 'How full memory gets before the worker starts.', unit: '%', kernelDefault: 10 },
  { key: 'wake_interval', sysctlName: 'demo.wake_interval', title: 'Wake interval', shortDesc: 'How often the worker checks for work.', unit: 'cs', kernelDefault: 500 },
  { key: 'batch_order', sysctlName: 'demo.batch_order', title: 'Batch size', shortDesc: 'Pages read together, as a power of two.', unit: '', kernelDefault: 3 },
  { key: 'mode', sysctlName: 'demo.mode', title: 'Promise mode', shortDesc: 'Whether the kernel promises more memory than it has.', unit: 'mode', kernelDefault: 0 },
]

export const DEFS_BY_KEY = Object.fromEntries(DEFS.map((d) => [d.key, d]))

const VM_DOCS = { url: 'https://docs.kernel.org/admin-guide/sysctl/vm.html', label: 'Documentation for /proc/sys/vm' }

export const LEARN = {
  slug: 'demo',
  title: 'How a demo tuner works',
  lead: 'A sample guide for the tests and the figure components. Its numbers are **fixture data**, not measurements.',
  minutes: 5,
  parts: {
    picture: 'Programs ask for memory, the [[page cache]] fills the rest, and a worker frees memory before it runs out.',
    cards: [
      { id: 'programs', title: 'Programs', does: 'Ask the kernel for memory.', col: 1, row: 1 },
      { id: 'cache', title: 'Page cache', does: 'Keeps file data in spare memory.', col: 2, row: 1, probe: 'demo.meminfo' },
      { id: 'reserve', title: 'Reserve', does: 'Memory kept free for urgent requests.', col: 3, row: 1, probe: 'demo.reserve' },
      { id: 'worker', title: 'Worker', does: 'Frees memory in the background.', col: 2, row: 2, tone: 'fit', probe: 'demo.worker' },
      { id: 'disk', title: 'Disk', does: 'Holds swapped out memory.', col: 3, row: 2, probe: 'demo.swaps' },
    ],
    bands: [
      { label: 'Memory', rows: [1, 1] },
      { label: 'Background', rows: [2, 2] },
    ],
    edges: [
      { from: 'programs', to: 'cache', label: 'read files into' },
      { from: 'cache', to: 'reserve', label: 'leaves room for' },
      { from: 'worker', to: 'cache', label: 'frees' },
      { from: 'worker', to: 'disk', label: 'writes to' },
    ],
  },
  chapters: [
    {
      id: 'keeping-a-reserve',
      title: 'Keeping a reserve',
      oneLine: 'The kernel keeps some memory free, so an urgent request never waits for [[reclaim]].',
      picture: {
        text: 'Think of a desk with a drawer of spare paper. You keep the drawer stocked, so a sudden note never waits for a trip to the store.',
        limit: 'The picture stops at the drawer: memory has three levels, not one.',
      },
      figure: {
        kind: 'stack',
        title: 'Where the reserve sits',
        layers: [
          {
            id: 'programs',
            label: 'Programs',
            kind: 'nodes',
            nodes: [
              { id: 'app', text: 'Your program', sub: 'asks for memory' },
              { id: 'kswapd', text: 'kswapd0', sub: 'frees memory in the background', probe: 'demo.worker' },
            ],
          },
          {
            id: 'free-memory',
            label: 'Free memory',
            kind: 'bands',
            bands: [
              { id: 'above-high', text: 'Above high: nothing to do' },
              { id: 'low-to-high', text: 'Between low and high: the worker frees memory' },
              { id: 'below-min', text: 'Below min: the program waits' },
            ],
            values: [
              { probe: 'demo.watermarks', path: 'Normal.min', unit: 'pages' },
              { probe: 'demo.watermarks', path: 'Normal.low', unit: 'pages' },
              { probe: 'demo.watermarks', path: 'Normal.high', unit: 'pages' },
            ],
          },
          {
            id: 'disk',
            label: 'Disk',
            kind: 'nodes',
            nodes: [{ id: 'swap', text: 'Swap', probe: 'demo.swaps' }],
          },
        ],
      },
      body: [
        'Each memory zone has three [[watermarks|watermark]]: min, low and high.[^vm] Below low, `kswapd` starts to free pages.[^vm]',
        'The **reserve** setting moves all three levels together. A larger reserve wakes the worker sooner and leaves less memory for programs.[^vm]',
      ],
      pins: [
        { key: 'reserve_kbytes', here: 'Sets the size of the reserve, which moves all three levels.', layer: 'free-memory' },
        { key: 'fill_ratio', here: 'How full memory may get before the worker starts.' },
      ],
      choose: [
        {
          q: 'Do programs stall while memory is low?',
          check: "grep -E '^allocstall' /proc/vmstat",
          hint: 'Counters that grow between two reads mean a program waited for memory.',
          yes: { key: 'reserve_kbytes', dir: 'raise' },
        },
        {
          q: 'Are programs short of memory?',
          check: 'free -m',
          hint: 'Look at the available column.',
          yes: { key: 'reserve_kbytes', dir: 'lower' },
          no: { leave: true, why: 'The reserve is doing its job, so the default fits.' },
        },
      ],
      symptoms: {
        low: 'Programs pause for a moment when memory runs short.',
        high: 'Less memory is left for programs and the cache.',
      },
      look: { cmd: "grep -A 4 'zone *Normal' /proc/zoneinfo", for: 'The min, low and high lines of the Normal zone, in pages.' },
      sources: { vm: VM_DOCS },
    },
    {
      id: 'waking-the-worker',
      title: 'Waking the worker',
      oneLine: 'The worker sleeps until free memory falls to the low level, then frees memory until it is back above high.',
      picture: {
        text: 'Think of a fuel gauge with two marks. You fill up at the lower mark and stop at the upper one.',
        limit: 'A tank empties at a steady rate; memory use jumps.',
      },
      figure: {
        kind: 'timeline',
        title: 'Free memory over time',
        schematic: true,
        lines: [
          { id: 'low', label: 'low level', value: { probe: 'demo.watermarks', path: 'Normal.low', unit: 'pages' } },
          { id: 'high', label: 'high level', value: { probe: 'demo.watermarks', path: 'Normal.high', unit: 'pages' } },
        ],
        curve: [[0, 0.9], [0.3, 0.5], [0.45, 0.3], [0.5, 0.25], [0.7, 0.6], [1, 0.85]],
        events: [
          { at: 0.4, label: 'A program stalls', tone: 'error' },
          { at: 0.5, label: 'Worker wakes', tone: 'fit' },
          { at: 0.8, label: 'Worker sleeps' },
        ],
      },
      body: ['The worker wakes when free memory drops below the low level and sleeps once it passes high.[^vm]'],
      pins: [{ key: 'wake_interval', here: 'How often the worker looks for work while it is awake.', layer: 'low' }],
      choose: [
        {
          q: 'Does the worker run most of the time?',
          check: "grep -E '^pgscan_kswapd' /proc/vmstat",
          hint: 'A counter that grows fast means the worker is busy.',
          yes: { key: 'wake_interval', dir: 'lower' },
          no: { leave: true, why: 'The worker keeps up, so leave the interval alone.' },
        },
      ],
      symptoms: {
        low: 'The worker uses more CPU than it needs to.',
        high: 'Free memory runs out before the worker catches up.',
      },
      look: { cmd: 'cat /proc/pressure/memory', for: 'The some line: the share of time a task waited for memory.' },
      sources: { vm: VM_DOCS },
    },
    {
      id: 'reading-in-batches',
      title: 'Reading in batches',
      oneLine: 'When a swapped page comes back, the kernel can read its neighbours in the same trip.',
      picture: {
        text: 'Fetching one file from the archive, you take the folders next to it as well.',
        limit: 'The neighbours on disk are not always the ones you need next.',
      },
      figure: {
        kind: 'sideBySide',
        title: 'Pages read per swap-in',
        states: [
          { label: 'Batch off', cells: 8, lit: 1, setting: { key: 'batch_order', value: 0 } },
          { label: 'Batch of eight', cells: 8, lit: 8, setting: { key: 'batch_order', value: 3 } },
        ],
        backedBy: { vmTest: 'on a swap file it reads ahead at the default and not at 0' },
      },
      body: ['The setting is a power of two: 3 reads up to eight pages at once, 0 reads one.[^vm]'],
      pins: [{ key: 'batch_order', here: 'The size of each batch, as a power of two.' }],
      choose: [
        {
          q: 'Does the machine swap to a fast disk?',
          check: 'swapon --show',
          hint: 'The NAME column shows each swap device.',
          yes: { key: 'batch_order', dir: 'lower' },
          no: { leave: true, why: 'On a slow disk, larger batches save seek time.' },
        },
      ],
      symptoms: {
        low: 'Each swap-in waits for the disk on its own.',
        high: 'Swap-ins read pages nobody asked for.',
      },
      look: { cmd: "grep -E '^(swap_ra|pswpin) ' /proc/vmstat", for: 'How many swap-ins came through readahead.' },
      sources: { vm: VM_DOCS },
    },
    {
      id: 'promising-memory',
      title: 'Promising memory',
      oneLine: 'The kernel can promise programs more memory than it has, betting they never use it all.',
      picture: {
        text: 'A bank lends out more money than it holds, because not everyone withdraws at once.',
        limit: 'A bank can call in loans; the kernel can only stop a program.',
      },
      figure: {
        kind: 'sideBySide',
        title: 'Memory promised against memory there',
        states: [
          { label: 'Strict', cells: 10, lit: 6, setting: { key: 'mode', value: 'strict' } },
          { label: 'Relaxed', cells: 10, lit: 10, setting: { key: 'mode', value: 0 } },
        ],
        backedBy: { probe: 'demo.zram' },
      },
      body: [
        'In the strict mode the kernel refuses a request it could not cover.[^proc] When memory does run out, the [[OOM killer]] picks a process to stop.[^vm]',
      ],
      pins: [{ key: 'mode', here: 'Whether the kernel may promise more than it has.' }],
      choose: [
        {
          q: 'Do programs fail to start with out of memory errors?',
          check: 'sudo dmesg -T',
          hint: 'Look for lines about the OOM killer.',
          yes: { key: 'mode', dir: 'raise' },
          no: { leave: true, why: 'Nothing runs out, so the default mode fits.' },
        },
      ],
      symptoms: {
        low: 'Programs that reserve a lot of memory fail to start.',
        high: 'The OOM killer stops programs when memory runs out.',
      },
      look: { cmd: 'sysctl vm.overcommit_memory', for: 'The current mode, 0, 1 or 2.' },
      sources: {
        vm: VM_DOCS,
        proc: { url: 'https://man7.org/linux/man-pages/man5/proc_sys_vm.5.html', label: 'proc_sys_vm(5)' },
      },
    },
  ],
}
