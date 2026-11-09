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
  { key: 'floor_kbytes', sysctlName: 'demo.floor_kbytes', title: 'Floor', shortDesc: 'The lowest mark on the gauge.', unit: 'kB', kernelDefault: 8000 },
  { key: 'gap_factor', sysctlName: 'demo.gap_factor', title: 'Gap factor', shortDesc: 'How far apart the marks sit.', unit: '', kernelDefault: 10 },
  {
    key: 'mode', sysctlName: 'demo.mode', title: 'Promise mode', shortDesc: 'Whether the kernel promises more memory than it has.', unit: 'mode', kernelDefault: 0,
    options: [
      { value: 'relaxed', sysctlValue: '0', label: '0: relaxed, promise more than there is' },
      { value: 'strict', sysctlValue: '2', label: '2: strict, never promise more' },
    ],
  },
  // Figures v3: compare, tree and modes.
  { key: 'buf_sizes', sysctlName: 'demo.buf_sizes', title: 'Socket buffer sizes', shortDesc: 'The smallest, starting and largest buffer of a socket.', unit: 'bytes', kernelDefault: '4096 131072 6291456' },
  { key: 'buf_max', sysctlName: 'demo.buf_max', title: 'Buffer ceiling', shortDesc: 'The most a program may ask for.', unit: 'bytes', kernelDefault: 212992 },
  { key: 'unit_weight', sysctlName: 'CPUWeight', title: 'CPU weight', shortDesc: 'A share of CPU time against siblings.', unit: '', kernelDefault: 100 },
  {
    key: 'page_mode', sysctlName: 'demo.page_mode', title: 'Huge page mode', shortDesc: 'When the kernel backs memory with huge pages.', unit: 'mode', kernelDefault: 'madvise',
    options: [
      { value: 'always', label: 'always' },
      { value: 'madvise', label: 'madvise: only memory that asks for it' },
      { value: 'never', label: 'never' },
    ],
  },
  { key: 'key_mask', sysctlName: 'demo.key_mask', title: 'Magic key mask', shortDesc: 'Which magic keys work, as a sum of bits.', unit: '', kernelDefault: 176, kernelMin: 0, kernelMax: 511 },
  {
    key: 'scheduler', sysctlName: 'demo.scheduler', title: 'I/O scheduler', shortDesc: 'How a disk orders its requests.', unit: '', kernelDefault: 'mq-deadline',
    options: [
      { value: 'none', label: 'none' },
      { value: 'mq-deadline', label: 'mq-deadline' },
      { value: 'bfq', label: 'bfq' },
    ],
  },
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
      { id: 'cache', title: 'Page cache', does: 'Keeps file data in spare memory.', col: 2, row: 1, probe: 'demo.meminfo', path: 'Cached', unit: 'kB' },
      { id: 'reserve', title: 'Reserve', does: 'Memory kept free for urgent requests.', col: 3, row: 1, probe: 'demo.reserve' },
      { id: 'worker', title: 'Worker', does: 'Frees memory in the background.', col: 2, row: 2, tone: 'fit', probe: 'demo.worker' },
      { id: 'disk', title: 'Disk', does: 'Holds `swapped out` memory.', col: 3, row: 2, probe: 'demo.swaps' },
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
    scale: {
      label: 'Memory',
      total: { probe: 'demo.meminfo', path: 'MemTotal', unit: 'kB' },
      segments: [
        { id: 'programs', label: 'Programs', value: { probe: 'demo.meminfo', path: 'AnonPages', unit: 'kB' }, does: 'Memory the programs wrote to.' },
        { id: 'cache', label: 'Page cache', value: { probe: 'demo.meminfo', path: 'Cached', unit: 'kB' } },
        { id: 'rest', label: 'Free or kernel', does: 'Everything else, **free** or kept by the kernel.' },
      ],
    },
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
              { id: 'kswapd', text: 'kswapd0', sub: 'the worker', does: 'Frees memory in the background.', probe: 'demo.worker' },
            ],
          },
          {
            id: 'free-memory',
            label: 'Free memory',
            kind: 'bands',
            bands: [
              { id: 'above-high', text: 'Above high', does: 'Nothing to do.' },
              { id: 'low-to-high', text: 'Low to high', does: 'The worker frees memory.' },
              { id: 'below-min', text: 'Below min', does: 'The program waits.' },
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
          { id: 'low', label: 'low level', does: 'The worker wakes below it.', value: { probe: 'demo.watermarks', path: 'Normal.low', unit: 'pages' } },
          { id: 'high', label: 'high level', value: { probe: 'demo.watermarks', path: 'Normal.high', unit: 'pages' } },
        ],
        curve: [[0, 0.9], [0.3, 0.5], [0.45, 0.3], [0.5, 0.25], [0.7, 0.6], [1, 0.85]],
        events: [
          { at: 0.4, label: 'A program stalls', does: 'It frees memory itself, and waits.', tone: 'error' },
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
          { label: 'Batch off', cells: 12, lit: 1, start: 2, asked: 2, setting: { key: 'batch_order', value: 0 } },
          { label: 'Batch of eight', cells: 12, lit: 8, asked: 2, setting: { key: 'batch_order', value: 3 } },
        ],
        legend: { asked: 'asked for', lit: 'read along', off: 'stays on disk' },
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
          yes: { key: 'mode', to: 'relaxed' },
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
    {
      id: 'reading-the-gauge',
      title: 'Reading the gauge',
      oneLine: 'Free memory sits on a scale with three marks, drawn to scale from the capture.',
      picture: {
        text: 'Think of a fuel gauge with three marks, and a helper who refills the tank between them.',
        limit: 'Fuel only goes down while you drive; free memory moves both ways.',
      },
      figure: {
        kind: 'gauge',
        title: 'Free memory in the Normal zone',
        axis: 'free pages',
        marks: [
          { id: 'min', label: 'min', value: { probe: 'demo.watermarks', path: 'Normal.min', unit: 'pages' }, does: 'Below it a program frees memory **itself**.', tone: 'error' },
          { id: 'low', label: 'low', value: { probe: 'demo.watermarks', path: 'Normal.low', unit: 'pages' } },
          { id: 'high', label: 'high', value: { probe: 'demo.watermarks', path: 'Normal.high', unit: 'pages' }, tone: 'fit' },
        ],
        zones: [
          { id: 'below-min', label: 'programs wait', to: 'min', tone: 'error', does: 'A program asking for memory frees some itself.' },
          { id: 'min-high', label: 'worker frees', from: 'min', to: 'high', tone: 'fit', does: 'The worker frees memory in the background.' },
          { id: 'above-high', label: 'worker sleeps', from: 'high' },
        ],
        range: { from: 0, to: 8000 },
        zoom: { label: 'All memory', full: { probe: 'demo.meminfo', path: 'MemTotal', unit: 'kB' }, fullPerUnit: 4 },
        curve: {
          points: [[0, 3.6], [0.3, 1.5], [0.45, 0.8], [0.6, 2], [0.8, 3.2], [1, 3.5]],
          events: [
            { at: 0.45, label: 'a program waits', tone: 'error', does: 'Free memory fell below min.' },
            { at: 0.8, label: 'worker sleeps' },
          ],
        },
        pins: [
          { key: 'floor_kbytes', mark: 'min', value: { probe: 'demo.reserve', unit: 'kB' } },
          { key: 'gap_factor', from: 'low', to: 'high' },
        ],
      },
      body: ['The floor sets the min mark, and the gap factor how far apart the marks sit.[^vm]'],
      pins: [
        { key: 'floor_kbytes', layer: 'min', here: 'Sets the min mark.' },
        { key: 'gap_factor', layer: 'min-high', here: 'Sets the gap between the marks.' },
      ],
      choose: [
        {
          q: 'Do programs stall when memory is nearly full?',
          check: "grep -E '^allocstall' /proc/vmstat",
          hint: 'Counters that grow mean a program waited.',
          yes: { key: 'gap_factor', dir: 'raise' },
          no: { leave: true, why: 'The marks sit where they should.' },
        },
      ],
      symptoms: {
        low: 'Programs pause when memory fills up.',
        high: 'More memory stays free than needed.',
      },
      look: { cmd: "grep -A 4 'zone *Normal' /proc/zoneinfo", for: 'The min, low and high lines of the Normal zone, in pages.' },
      sources: { vm: VM_DOCS },
    },
    {
      id: 'comparing-sizes',
      title: 'Comparing sizes',
      oneLine: 'A socket buffer has three sizes, thousands of times apart, so the bars share a log scale.',
      picture: {
        text: 'Think of glasses, a jug and a barrel side by side. Each step up holds many times more than the last.',
        limit: 'A barrel stays one size; a socket buffer grows and shrinks between its sizes.',
      },
      figure: {
        kind: 'compare',
        title: 'Receive buffer sizes',
        axis: 'buffer size',
        scale: 'log',
        groups: [
          { id: 'per-socket', label: 'Each socket', does: 'Sizes the kernel gives each new socket, and lets it grow to.' },
          { id: 'whole-system', label: 'Whole system' },
        ],
        bars: [
          { id: 'buf-min', label: 'Smallest', group: 'per-socket', value: { probe: 'demo.bufSizes', path: '0', unit: 'bytes' }, does: 'A socket keeps at least this much, even when memory is short.' },
          { id: 'buf-start', label: 'Start', group: 'per-socket', tone: 'fit', value: { probe: 'demo.bufSizes', path: '1', unit: 'bytes' } },
          { id: 'buf-largest', label: 'Largest', group: 'per-socket', value: { probe: 'demo.bufSizes', path: '2', unit: 'bytes', label: 'Largest buffer' }, does: 'Automatic tuning grows a busy socket up to this.' },
          { id: 'buf-total', label: 'Extra per socket', group: 'whole-system', value: { probe: 'demo.bufTotal', unit: 'bytes' } },
        ],
        marks: [
          { id: 'ceiling', label: 'Asked-for ceiling', tone: 'error', value: { probe: 'demo.bufMax', unit: 'bytes' }, does: 'A program that sets its own buffer size gets at most this.' },
        ],
        pins: [
          { key: 'buf_sizes', bar: 'buf-largest' },
          { key: 'buf_max', mark: 'ceiling' },
        ],
      },
      body: ['The three sizes are one setting, written as three numbers.[^ip] The ceiling caps only a size a program asks for itself.[^ip]'],
      pins: [
        { key: 'buf_sizes', layer: 'per-socket', here: 'Sets the smallest, starting and largest buffer of each socket.' },
        { key: 'buf_max', layer: 'ceiling', here: 'Caps the buffer a program asks for by itself.' },
      ],
      choose: [
        {
          q: 'Do long transfers stall below the line speed?',
          check: 'sysctl net.ipv4.tcp_rmem',
          hint: 'The last number is the largest buffer a socket can grow to.',
          yes: { key: 'buf_sizes', dir: 'raise' },
          no: { leave: true, why: 'The buffers keep up with the line.' },
        },
      ],
      symptoms: {
        low: 'Fast links stay slow over long distances.',
        high: 'Many busy sockets hold a lot of memory.',
      },
      look: { cmd: 'sysctl net.ipv4.tcp_rmem net.core.rmem_max', for: 'Three sizes in bytes, then the ceiling.' },
      sources: { ip: { url: 'https://docs.kernel.org/networking/ip-sysctl.html', label: 'IP sysctl' } },
    },
    {
      id: 'sharing-the-cpu',
      title: 'Sharing the CPU',
      oneLine: 'Services sit in slices, and each slice shares the CPU with its siblings by weight.',
      picture: {
        text: 'Think of a family budget split between households, and each household splitting its share again.',
        limit: 'Money left over is gone; CPU time a slice does not use goes to the others.',
      },
      figure: {
        kind: 'tree',
        title: 'Where a service runs',
        root: {
          id: 'root-slice',
          label: 'Root slice',
          does: 'Holds every process on the machine.',
          children: [
            {
              id: 'system-slice',
              label: 'System services',
              value: { probe: 'demo.sliceWeight', unit: '', label: 'System CPU weight' },
              does: 'Holds the services the system starts.',
              children: [
                { id: 'web-service', label: 'web.service' },
                { id: 'db-service', label: 'db.service', does: 'A database, sharing the slice with the web server.' },
              ],
            },
            {
              id: 'user-slice',
              label: 'User sessions',
              value: { probe: 'demo.userWeight', unit: '' },
              children: [{ id: 'login', label: 'Your login' }],
            },
          ],
        },
        pins: [{ key: 'unit_weight', node: 'system-slice' }],
      },
      body: ['A slice with twice the weight of its sibling gets twice the CPU time when both are busy.[^rc]'],
      pins: [{ key: 'unit_weight', layer: 'system-slice', here: 'Sets the share of the system services against your sessions.' }],
      choose: [
        {
          q: 'Do your sessions feel slow while services are busy?',
          check: 'systemctl show -p CPUWeight user.slice',
          hint: 'A weight of 100 is the default share.',
          yes: { key: 'unit_weight', dir: 'lower' },
          no: { leave: true, why: 'The default weights share the CPU evenly.' },
        },
      ],
      symptoms: {
        low: 'Services fall behind while you work.',
        high: 'Your sessions lag while services run.',
      },
      look: { cmd: 'systemctl show -p CPUWeight system.slice', for: 'The weight of the system slice.' },
      sources: { rc: { url: 'https://man7.org/linux/man-pages/man5/systemd.resource-control.5.html', label: 'systemd.resource-control(5)' } },
    },
    {
      id: 'picking-a-mode',
      title: 'Picking a mode',
      oneLine: 'Some settings choose one of a few modes, and one sums several switches into one number.',
      picture: {
        text: 'Think of a row of light switches. Most rows let one switch be on; one row lets any of them be on.',
        limit: 'A switch stays where you put it; the kernel may refuse a mode the hardware lacks.',
      },
      figure: {
        kind: 'modes',
        title: 'Modes set on this kernel',
        groups: [
          { id: 'kernel', label: 'Kernel' },
          { id: 'disks', label: 'Disks', does: 'Each disk picks its own scheduler.' },
        ],
        rows: [
          {
            id: 'page-mode',
            label: 'Huge pages',
            group: 'kernel',
            pin: 'page_mode',
            value: { probe: 'demo.pageMode', unit: '' },
            does: 'When the kernel backs memory with huge pages.',
            options: [
              { value: 'always', label: 'always' },
              { value: 'madvise', label: 'when asked', does: 'Only memory a program marks for it.' },
              { value: 'never', label: 'never' },
            ],
          },
          {
            id: 'key-mask',
            label: 'Magic keys',
            group: 'kernel',
            pin: 'key_mask',
            bits: true,
            value: { probe: 'demo.keyMask', unit: '' },
            options: [
              { value: 2, label: 'console level' },
              { value: 4, label: 'keyboard' },
              { value: 8, label: 'debug dumps' },
              { value: 16, label: 'sync' },
              { value: 32, label: 'remount read-only' },
              { value: 64, label: 'signals' },
              { value: 128, label: 'reboot' },
              { value: 256, label: 'nice real-time' },
            ],
          },
          {
            id: 'ssd-scheduler',
            label: 'SSD',
            group: 'disks',
            pin: 'scheduler',
            value: { probe: 'demo.schedSsd', unit: '' },
            options: [
              { value: 'none', label: 'none' },
              { value: 'mq-deadline', label: 'mq-deadline' },
              { value: 'bfq', label: 'bfq' },
            ],
          },
          {
            id: 'hdd-scheduler',
            label: 'Hard disk',
            group: 'disks',
            allValues: true,
            value: { probe: 'demo.schedHdd', unit: '' },
            options: [
              { value: 'none', label: 'none' },
              { value: 'mq-deadline', label: 'mq-deadline' },
              { value: 'bfq', label: 'bfq' },
              { value: 'kyber', label: 'kyber' },
            ],
          },
        ],
      },
      body: ['A mode setting takes one word.[^vm] The key mask adds up one number per key group, so 176 is 16 plus 32 plus 128.[^vm]'],
      pins: [
        { key: 'page_mode', layer: 'page-mode', here: 'Picks when the kernel uses huge pages.' },
        { key: 'key_mask', layer: 'key-mask', here: 'Picks which magic keys work.' },
        { key: 'scheduler', layer: 'disks', here: 'Picks how each disk orders its requests.' },
      ],
      choose: [
        {
          q: 'Does the machine use a fast SSD?',
          check: 'cat /sys/block/sda/queue/scheduler',
          hint: 'The word in brackets is the scheduler in use.',
          yes: { key: 'scheduler', to: 'none' },
          no: { leave: true, why: 'A slower disk gains from a scheduler.' },
        },
      ],
      symptoms: {
        low: 'A disk orders requests it could have served at once.',
        high: 'A slow disk serves requests in a poor order.',
      },
      look: { cmd: 'cat /sys/kernel/mm/transparent_hugepage/enabled', for: 'The word in brackets is the mode in use.' },
      sources: { vm: VM_DOCS },
    },
  ],
}
