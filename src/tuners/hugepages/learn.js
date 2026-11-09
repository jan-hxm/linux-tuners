/**
 * The huge pages study guide at /learn/huge-pages: six chapters on the nine
 * settings of the huge pages tuner. Data in the frozen Guide shape
 * (src/learn/schema.js), checked by src/learn/contract.test.js. Probe ids name
 * entries in ./probes.js; `[^id]` marks point into each chapter's `sources`;
 * `[[term]]` names an entry in ui/glossary.js.
 *
 * Sources are docs.kernel.org: admin-guide/mm/hugetlbpage, transhuge and ksm,
 * plus admin-guide/sysctl/vm for the vm.* keys, and the man7.org pages of
 * madvise(2), mmap(2) and mprotect(2).
 */

const MM = 'https://docs.kernel.org/admin-guide/mm'
const VM = 'https://docs.kernel.org/admin-guide/sysctl/vm.html'
const hugetlb = (anchor, name) => ({ url: `${MM}/hugetlbpage.html#${anchor}`, label: `HugeTLB pages: ${name}` })
const thp = (anchor, name) => ({ url: `${MM}/transhuge.html#${anchor}`, label: `Transparent hugepage support: ${name}` })
const ksm = (anchor, name) => ({ url: `${MM}/ksm.html#${anchor}`, label: `Kernel samepage merging: ${name}` })
const vm = (anchor, name) => ({ url: `${VM}#${anchor}`, label: `sysctl/vm: ${name}` })
const man2 = (page, anchor) => ({ url: `https://man7.org/linux/man-pages/man2/${page}.2.html#${anchor}`, label: `${page}(2): ${anchor}` })

export const LEARN = {
  slug: 'huge-pages',
  title: 'How Linux uses huge pages',
  lead: 'See how a program gets large pages of memory, reserved ahead or built by the kernel, how identical pages are merged, and how many memory mappings it may hold.',
  minutes: 15,
  parts: {
    picture:
      'Think of RAM as a warehouse floor of small shelves. A huge page is a big pallet that takes one lookup instead of hundreds. You can book pallets ahead, let the staff build them as needed, or merge identical goods.',
    cards: [
      { id: 'programs', title: 'Your programs', does: 'Ask the kernel for memory, and some ask for huge pages.', col: 1, row: 1 },
      { id: 'manager', title: "The kernel's memory manager", does: 'Hands out memory in small pages or, where it can, in huge ones.', col: 1, row: 2, probe: 'hugepages.vmSysctls' },
      { id: 'pool', title: 'Reserved pool', does: 'Huge pages set aside for programs that ask for them by name.', col: 1, row: 3, probe: 'hugepages.poolPages' },
      { id: 'thp', title: 'Transparent huge pages', does: 'Huge pages the kernel builds on its own, with no pool.', col: 2, row: 3, probe: 'hugepages.thpEnabled' },
      { id: 'ksm', title: 'KSM', does: 'Finds identical pages and keeps one copy of each.', col: 3, row: 3, probe: 'hugepages.ksmRun' },
      { id: 'tlb', title: "The CPU's TLB", does: 'Remembers recent address lookups, and a huge page needs far fewer entries.', col: 1, row: 4 },
      { id: 'pages', title: 'Small pages', does: 'Most memory is still in small pages, where identical copies can be merged.', col: 3, row: 4 },
    ],
    bands: [{ label: 'Three memory tricks', rows: [3, 3] }],
    edges: [
      { from: 'programs', to: 'manager', label: 'ask for memory' },
      { from: 'manager', to: 'pool', label: 'hands out reserved pages' },
      { from: 'pool', to: 'thp', label: 'the other way' },
      { from: 'thp', to: 'ksm', label: 'merge, not enlarge' },
      { from: 'pool', to: 'tlb', label: 'one entry each' },
      { from: 'ksm', to: 'pages', label: 'merges copies' },
      { from: 'tlb', to: 'pages', label: 'one entry per page' },
    ],
  },
  chapters: [
    {
      id: 'reserving-huge-pages',
      title: 'Reserving huge pages',
      oneLine: 'Some programs ask for huge pages by name. The kernel keeps a pool of them ready, and two settings decide how big the pool is and whether it may grow.',
      picture: {
        text: 'A restaurant holds a block of large tables for parties that booked. Those tables stay empty, and nobody else may sit there, even when the rest of the room is full. If an extra party turns up, staff may carry in a spare table.',
        limit: 'A restaurant can rearrange its floor at any moment. A huge page needs a free block of memory in one piece, so a pool asked for late may come up short.',
      },
      figure: {
        kind: 'stack',
        title: 'Where a reserved huge page sits',
        layers: [
          {
            id: 'programs',
            label: 'Your programs',
            kind: 'nodes',
            nodes: [{ id: 'ask', text: 'Asks for huge pages', sub: 'mmap or SysV memory', does: 'A program that names huge pages when it asks for memory.' }],
          },
          {
            id: 'pool',
            label: 'The pool',
            kind: 'nodes',
            nodes: [
              { id: 'total', text: 'Pages in pool', sub: 'HugePages_Total', does: 'All huge pages the kernel holds in reserve.' },
              { id: 'free', text: 'Not yet used', sub: 'HugePages_Free', does: 'Pool pages no program has touched yet.' },
              { id: 'reserved', text: 'Promised, unused', sub: 'HugePages_Rsvd', does: 'Pages promised to a program that has not used them yet.' },
              { id: 'surplus', text: 'Extra pages', sub: 'HugePages_Surp', does: 'Pages taken beyond the pool, returned when unused.' },
            ],
            values: [
              { probe: 'hugepages.poolMeminfo', path: 'HugePages_Total', unit: 'pages' },
              { probe: 'hugepages.poolMeminfo', path: 'HugePages_Free', unit: 'pages' },
              { probe: 'hugepages.poolMeminfo', path: 'HugePages_Rsvd', unit: 'pages' },
              { probe: 'hugepages.poolMeminfo', path: 'HugePages_Surp', unit: 'pages' },
              { probe: 'hugepages.poolMeminfo', path: 'Hugepagesize', unit: 'kB' },
            ],
          },
          {
            id: 'settings',
            label: 'The two settings',
            kind: 'nodes',
            nodes: [
              { id: 'size', text: 'vm.nr_hugepages', sub: 'pool size', does: 'How many pages the pool keeps.', probe: 'hugepages.poolPages' },
              { id: 'grow', text: 'vm.nr_overcommit_hugepages', sub: 'extra allowed', does: 'How many extra pages the pool may take on demand.', probe: 'hugepages.surplusPages' },
            ],
          },
          {
            id: 'ram',
            label: 'Normal memory',
            kind: 'nodes',
            nodes: [{ id: 'rest', text: 'Everything else', sub: 'programs and cache', does: 'What the pool leaves for programs and file cache.' }],
            values: [{ probe: 'hugepages.memTotal', path: 'MemTotal', unit: 'kB' }],
          },
        ],
      },
      body: [
        'A [[huge page|huge-page]] is a memory page much larger than the usual 4K. On x86, processors normally support 4K and 2M pages, and 1G where the hardware allows[^overview]. A program can use huge pages through the mmap system call or the System V shared memory calls[^overview]. The kernel keeps a pool of them, and `/proc/meminfo` shows its size as `HugePages_Total`[^overview].',
        '`vm.nr_hugepages` is the number of persistent pages of the default size. A user with root privileges can raise or lower it while the machine runs[^overview]. Pages in the pool are reserved inside the kernel, cannot be used for anything else and cannot be swapped out[^overview]. Allocating them on the boot command line is the most reliable method, since memory has not yet become fragmented[^overview].',
        '`vm.nr_overcommit_hugepages` lets the pool grow past that number when programs ask for more. These surplus pages come from the normal page pool and return to it when unused[^overview]. The pool may then be as large as `nr_hugepages` plus `nr_overcommit_hugepages`[^vmsurplus]. Whether pages can be found depends on contiguous memory being free at that moment[^overview].',
      ],
      pins: [
        { key: 'nr_hugepages', layer: 'size', here: 'How many huge pages the kernel keeps for programs that ask. Nothing else can use them. Size it to what the program needs. Most machines don\'t need to change this.' },
        { key: 'nr_overcommit_hugepages', layer: 'grow', here: 'How many extra huge pages the pool may take on demand. Unused ones go back to normal memory, but may not be there when asked. Leave it at 0 unless the program can cope.' },
      ],
      choose: [
        {
          q: 'Does a program you run say it needs huge pages, and is the pool empty?',
          check: 'grep Huge /proc/meminfo',
          hint: 'A HugePages_Total of 0 means there is no pool. The program needs a pool at least as large as it asks for.',
          yes: { key: 'nr_hugepages', dir: 'raise' },
        },
        {
          q: 'Does almost the whole pool sit unused, with HugePages_Free close to HugePages_Total?',
          check: 'grep Huge /proc/meminfo',
          hint: 'Pool pages that nobody uses are RAM that no other program can have.',
          yes: { key: 'nr_hugepages', dir: 'lower' },
        },
        {
          q: 'Does the pool run out (HugePages_Free at 0) while programs could carry on with fewer huge pages?',
          check: 'grep Huge /proc/meminfo',
          hint: 'A HugePages_Surp above 0 shows that extra pages are already being taken.',
          yes: { key: 'nr_overcommit_hugepages', dir: 'raise' },
          no: { leave: true, why: 'A pool that matches what programs use needs nothing more.' },
        },
      ],
      symptoms: {
        low: 'A program that asks for huge pages gets none, and fails to start or runs on normal pages.',
        high: 'Free memory is low although programs use little, because the pool holds RAM nothing else may use.',
      },
      look: {
        cmd: 'grep Huge /proc/meminfo',
        for: 'HugePages_Total is the pool and HugePages_Free the part not yet in use. HugePages_Rsvd is promised, HugePages_Surp is the extra pages, and Hugepagesize is one page in kB.',
      },
      sources: {
        overview: hugetlb('overview', 'overview'),
        vmsurplus: vm('nr-overcommit-hugepages', 'nr_overcommit_hugepages'),
      },
    },
    {
      id: 'huge-pages-without-a-pool',
      title: 'Huge pages without a reservation',
      oneLine: 'The kernel can also build huge pages by itself, with no pool and no change to the program. One setting decides which memory is eligible.',
      picture: {
        text: 'Instead of holding tables back, the restaurant joins small tables into a big one whenever a large party arrives and the floor allows. Nobody has to book. But it may also join tables for a guest who sits alone, and waste the space.',
        limit: 'Joining tables takes staff a moment and needs clear floor. The kernel needs free memory in one piece, and the next chapter covers what happens when there is none.',
      },
      figure: {
        kind: 'modes',
        title: 'Which memory may get a huge page',
        rows: [
          {
            id: 'setting', label: 'enabled', pin: 'thp_enabled', allValues: true, value: { probe: 'hugepages.thpEnabled', unit: '' },
            does: 'Which anonymous memory the kernel may back with huge pages on its own.',
            options: [
              { value: 'always', label: 'always', does: 'Every large region qualifies, system wide.' },
              { value: 'madvise', label: 'madvise', does: 'Only regions the program marked with MADV_HUGEPAGE.' },
              { value: 'never', label: 'never', does: 'Off, though kernels from 6.1 still act on a collapse request.' },
            ],
          },
        ],
      },
      body: [
        '[[Transparent huge pages|thp]] give a program huge pages without any change to it and without a reserved pool[^objective]. They work for [[anonymous memory|anonymous-memory]] and for tmpfs and shmem[^objective]. One huge page takes a single [[TLB]] entry where many small pages would need one each, which means fewer TLB misses[^objective].',
        '`transparent_hugepage/enabled` sets this for anonymous memory and takes three values. With `always`, huge pages are enabled system wide. With `madvise`, only regions the program marked with [[madvise]] and MADV_HUGEPAGE qualify. With `never` they are off, although on kernels from 6.1 an explicit collapse request can still produce one[^sysfs][^collapse]. The [[khugepaged]] thread collapses small pages into huge ones while the setting is `always` or `madvise`[^sysfs].',
        'With `always`, a program can use more memory than it needs: it may map a large region, touch one byte, and be given a 2M page[^objective]. That is why the docs let you limit huge pages to madvise regions[^objective]. When khugepaged starts, the kernel may also raise `vm.min_free_kbytes` to help huge page allocations.',
      ],
      pins: [
        { key: 'thp_enabled', layer: 'setting', here: 'Which memory may get huge pages on its own. madvise gives them only to programs that ask. always gives them to everything that qualifies and can waste RAM. never turns it off.' },
      ],
      choose: [
        {
          q: 'Is the setting always, while a program you run advises against transparent huge pages?',
          check: 'cat /sys/kernel/mm/transparent_hugepage/enabled',
          hint: 'The word in brackets is the active choice. If the program asks for never instead, pick that.',
          yes: { key: 'thp_enabled', to: 'madvise' },
        },
        {
          q: 'Is the setting never, while you run programs that mark their memory for huge pages, such as a virtual machine host?',
          check: 'grep AnonHugePages /proc/meminfo',
          hint: 'AnonHugePages at 0 while such a program runs means it gets no huge pages.',
          yes: { key: 'thp_enabled', to: 'madvise' },
          no: { leave: true, why: 'madvise gives huge pages to the programs that ask and leaves the rest on small pages.' },
        },
      ],
      symptoms: {
        low: 'Programs that would gain from huge pages run on small pages, with more TLB misses.',
        high: 'Some programs use more memory than they touch.',
      },
      look: {
        cmd: 'grep -e AnonHugePages -e thp_fault /proc/meminfo /proc/vmstat',
        for: 'AnonHugePages is memory now backed by huge pages, in kB. thp_fault_alloc counts huge pages given at a page fault, and thp_fault_fallback those that fell back to small pages.',
      },
      sources: {
        objective: thp('objective', 'objective'),
        sysfs: thp('global-thp-controls', 'global THP controls'),
        collapse: man2('madvise', 'DESCRIPTION'),
      },
    },
    {
      id: 'finding-a-free-block',
      title: 'Finding a free block',
      oneLine: 'A huge page needs a free block of memory in one piece. One setting decides how long a program may wait while the kernel makes one.',
      picture: {
        text: 'To join tables the restaurant needs a clear stretch of floor. If guests sit in the way, staff can ask them to move, which takes time. Staff can make the party wait, seat it at small tables now, or clear the floor later.',
        limit: 'Guests move themselves. The kernel has to copy memory to another place, and that costs processor time that every program on the machine shares.',
      },
      figure: {
        kind: 'modes',
        title: 'How hard the kernel tries for a free block',
        rows: [
          {
            id: 'modes', label: 'defrag', pin: 'thp_defrag', value: { probe: 'hugepages.thpDefrag', unit: '' },
            does: 'How long a program may wait while the kernel makes a free 2M block.',
            options: [
              { value: 'always', label: 'always', does: 'The program stalls, reclaims and compacts at once.' },
              { value: 'defer', label: 'defer', does: 'Wakes background helpers and never waits.' },
              { value: 'defer+madvise', label: 'defer+madvise', does: 'Waits if the memory asked for huge pages, else defers.' },
              { value: 'madvise', label: 'madvise', does: 'Waits only if the memory asked for huge pages.' },
              { value: 'never', label: 'never', does: 'Takes a huge page only if one is free.' },
            ],
          },
        ],
      },
      body: [
        'Huge pages need a free block of memory in one piece. When none is free, the kernel can move pages around to make one, which is [[compaction]][^vmcompact]. `transparent_hugepage/defrag` decides how hard the kernel tries when a program needs a huge page[^sysfs].',
        'With `always`, the program stalls, reclaims pages and compacts memory to get a huge page at once. `madvise`, the default, does that only for regions marked with MADV_HUGEPAGE. `defer` wakes [[kswapd]] and kcompactd so a huge page is ready soon. `defer+madvise` waits for marked regions and defers the rest. `never` takes a huge page only if one is free[^sysfs].',
        'The docs expect the CPU time spent on defragmenting to pay off, but say this is not always guaranteed[^sysfs]. Compaction moves pages that belong to other processes, which can cause latency spikes in programs unaware of it[^vmcompact]. The counters `compact_stall` and `thp_fault_fallback` in `/proc/vmstat` show how often a program waited or fell back[^monitor].',
      ],
      pins: [
        { key: 'thp_defrag', layer: 'modes', here: 'How long a program may wait for a huge page. madvise waits only for memory that asked. always waits every time. defer never waits. never takes a huge page only when one is already free.' },
      ],
      choose: [
        {
          q: 'Is defrag set to always, and do programs stall for a moment when they first touch new memory?',
          check: 'grep -e compact_stall -e thp_fault_fallback /proc/vmstat',
          hint: 'Run it twice, a minute apart. A growing compact_stall means programs waited. madvise, the default, waits only for memory that asked for huge pages.',
          yes: { key: 'thp_defrag', to: 'madvise' },
        },
        {
          q: 'Is defrag set to never or defer, while programs that ask for huge pages often get small pages instead?',
          check: 'grep -e compact_stall -e thp_fault_fallback /proc/vmstat',
          hint: 'A growing thp_fault_fallback means page faults got small pages. With madvise, memory that asked may wait for a huge page.',
          yes: { key: 'thp_defrag', to: 'madvise' },
          no: { leave: true, why: 'The default waits only for memory that asked for huge pages, which suits most machines.' },
        },
      ],
      symptoms: {
        low: 'Programs that ask for huge pages often get small pages, because nobody made room.',
        high: 'Programs pause for a moment at page faults while the kernel compacts memory.',
      },
      look: {
        cmd: 'grep -e compact_stall -e thp_fault_fallback /proc/vmstat',
        for: 'compact_stall counts times a process stalled to compact memory for a huge page. thp_fault_fallback counts page faults that used small pages instead.',
      },
      sources: {
        sysfs: thp('global-thp-controls', 'global THP controls'),
        vmcompact: vm('compaction-proactiveness', 'compaction_proactiveness'),
        monitor: thp('monitoring-usage', 'monitoring usage'),
      },
    },
    {
      id: 'merging-identical-pages',
      title: 'Merging identical pages',
      oneLine: 'Many virtual machines hold the same data. KSM finds identical pages and keeps one copy. Three settings decide whether it runs and how fast it scans.',
      picture: {
        text: 'A teacher collects homework and finds ten copies of the same handout. She keeps one and gives each pupil a note that points to it. If a pupil writes on it, that pupil gets a private copy back.',
        limit: 'The teacher can only compare what she reads. The kernel also has to scan memory to find twins, and that costs processor time.',
      },
      figure: {
        kind: 'modes',
        title: 'Whether KSM scans for twins',
        rows: [
          {
            id: 'switch', label: 'ksm/run', pin: 'ksm_run', allValues: true, value: { probe: 'hugepages.ksmRun', unit: '' },
            does: 'Whether the scanner ksmd runs, on memory programs marked with MADV_MERGEABLE.',
            options: [
              { value: 0, label: 'stopped', does: 'Stops ksmd but keeps pages already merged.' },
              { value: 1, label: 'running', does: 'ksmd scans and merges identical pages.' },
              { value: 2, label: 'unmerge', does: 'Stops ksmd and unmerges every shared page.' },
            ],
          },
        ],
      },
      body: [
        '[[KSM|ksm]] is a memory-saving feature. Its daemon, ksmd, scans areas of memory that programs registered with MADV_MERGEABLE. It looks for identical pages and replaces them with one write-protected page, which is copied if a process later changes it[^overview]. It merges only private anonymous pages, never file cache[^overview].',
        '`ksm/run` is the switch: 0 stops ksmd but keeps merged pages, 1 runs it, and 2 stops it and unmerges everything. The default is 0, so KSM does nothing until it is set to 1[^sysfs]. ksmd scans `pages_to_scan` pages (default 100) and then sleeps `sleep_millisecs` milliseconds (default 20)[^sysfs].',
        'KSM scans can use a lot of processing power, and some installations disable KSM for that reason[^madvise]. It can also use memory: each scanned page needs a small record, so pages that never merge are a loss[^profit]. The file `pages_sharing` shows how much is saved[^sysfs].',
      ],
      pins: [
        { key: 'ksm_run', layer: 'switch', here: 'Whether ksmd runs. Off, nothing is merged. On, it scans only memory that programs marked as mergeable. It was built for hosts that run many similar virtual machines.' },
        { key: 'ksm_pages_to_scan', layer: 'switch', here: 'How many pages ksmd scans before it sleeps. Higher finds identical pages sooner and costs more processor time. Lower is gentler.' },
        { key: 'ksm_sleep_millisecs', layer: 'switch', here: 'How long ksmd sleeps between batches. Longer scans more slowly and uses less processor time. Change pages_to_scan first and leave this alone.' },
      ],
      choose: [
        {
          q: 'Is this a host for several similar virtual machines, and is memory short?',
          check: 'cat /sys/kernel/mm/ksm/run',
          hint: 'A 0 means KSM is off and a 1 means ksmd is running.',
          yes: { key: 'ksm_run', to: 1 },
        },
        {
          q: 'Is ksmd running, yet pages_sharing stays near zero?',
          check: 'grep . /sys/kernel/mm/ksm/pages_shared /sys/kernel/mm/ksm/pages_sharing',
          hint: 'pages_sharing is how many extra mappings share a page, which is the memory saved. Near zero means the scanning buys nothing.',
          yes: { key: 'ksm_run', to: 0 },
        },
        {
          q: 'Does a new guest take a long time before its memory is merged?',
          check: 'cat /sys/kernel/mm/ksm/full_scans',
          hint: 'full_scans counts complete passes over all mergeable memory. Few passes over a long time mean slow scanning.',
          yes: { key: 'ksm_pages_to_scan', dir: 'raise' },
          no: { leave: true, why: 'The defaults suit most hosts, and the pause between batches rarely needs a change.' },
        },
      ],
      symptoms: {
        low: 'Identical pages stay as separate copies, and memory use stays high.',
        high: 'The ksmd thread uses noticeable processor time, and merged pages are copied again when a program writes to them.',
      },
      look: {
        cmd: 'grep . /sys/kernel/mm/ksm/run /sys/kernel/mm/ksm/pages_shared /sys/kernel/mm/ksm/pages_sharing',
        for: 'Each line starts with the file name. run is the switch. pages_shared is the shared pages in use, and pages_sharing the extra mappings that point at them.',
      },
      sources: {
        overview: ksm('overview', 'overview'),
        sysfs: ksm('ksm-daemon-sysfs-interface', 'sysfs interface'),
        madvise: ksm('controlling-ksm-with-madvise', 'controlling KSM with madvise'),
        profit: ksm('monitoring-ksm-profit', 'monitoring KSM profit'),
      },
    },
    {
      id: 'counting-mappings',
      title: 'Counting memory mappings',
      oneLine: 'Every region of memory a program maps counts toward a limit. One setting decides how many mappings one process may hold before the kernel says no.',
      picture: {
        text: 'A library card allows a fixed number of books at once. Most readers never come near it. A reader who borrows a single page from many different books reaches the cap long before the shelf is empty.',
        limit: 'Books are alike. Mappings differ widely in size, and a tiny one counts the same as a huge one.',
      },
      figure: {
        kind: 'compare',
        title: 'Memory mappings one process may hold',
        axis: 'mappings',
        scale: 'linear',
        bars: [
          {
            id: 'cap', label: 'Per process', tone: 'fit', value: { probe: 'hugepages.mapCount', unit: '' },
            does: 'The most mappings one process may hold, counting malloc, mmap, mprotect, madvise and loaded shared libraries.',
          },
        ],
        pins: [{ key: 'max_map_count', bar: 'cap' }],
      },
      body: [
        'A memory map area is one region of a process\'s address space. Map areas are created as a side effect of malloc, directly by mmap, mprotect and madvise, and when shared libraries load[^maxmap]. `vm.max_map_count` is the most a process may have, and the kernel default is 65530[^maxmap]. The bar shows the value each of our test kernels starts with.',
        'Most applications need fewer than a thousand maps. Some programs, malloc debuggers in particular, use one or two per allocation[^maxmap]. Once a process would pass the limit, mmap fails with ENOMEM[^mmap]. So does a call that splits a mapping in two, such as mprotect on part of it or munmap in its middle[^mmap][^mprotect].',
      ],
      pins: [
        { key: 'max_map_count', layer: 'cap', here: 'The most memory mappings one process may hold. A program that maps many regions fails with a "cannot allocate memory" error when it reaches the limit. Raise it only for a program whose documentation asks.' },
      ],
      choose: [
        {
          q: 'Does a program you run document a minimum for vm.max_map_count that is above the current value?',
          check: 'sysctl vm.max_map_count',
          hint: 'The number is the most mappings one process may hold. Compare it with what the program asks for.',
          yes: { key: 'max_map_count', dir: 'raise' },
        },
        {
          q: 'Does a program stop with "Cannot allocate memory" although free memory is plentiful?',
          check: 'sysctl vm.max_map_count',
          hint: 'A program that has used up its mappings fails this way even with RAM to spare.',
          yes: { key: 'max_map_count', dir: 'raise' },
          no: { leave: true, why: 'Most programs need fewer than a thousand mappings, so the current value is enough.' },
        },
      ],
      symptoms: {
        low: 'A program with many mappings fails with "Cannot allocate memory" while free memory is plentiful.',
        high: 'Nothing changes for most programs. A program that leaks mappings runs longer before the limit stops it.',
      },
      look: {
        cmd: 'sysctl vm.max_map_count',
        for: 'The most mappings one process may hold. The kernel default is 65530, and the bar shows what each test kernel sets.',
      },
      sources: {
        maxmap: vm('max-map-count', 'max_map_count'),
        mmap: man2('mmap', 'ERRORS'),
        mprotect: man2('mprotect', 'ERRORS'),
      },
    },
    {
      id: 'staying-on-one-node',
      title: 'Staying on one NUMA node',
      oneLine: 'On machines with several memory nodes, memory next to the CPU is faster. One setting decides whether the kernel frees local memory before using another node.',
      picture: {
        text: 'A workshop has two buildings. Tools in your own building are quick to fetch. When your shelf is full you can tidy it before reaching for anything, or you can walk to the other building and use its free shelf.',
        limit: 'Tidying a shelf costs you little. The kernel throws away cached file data to make room, and a program may have needed it again soon.',
      },
      figure: {
        kind: 'modes',
        title: 'What happens when local memory runs out',
        rows: [
          {
            id: 'choice', label: 'Zone reclaim', pin: 'zone_reclaim_mode', value: { probe: 'hugepages.zoneReclaim', unit: '' },
            does: 'Whether the kernel frees memory on the local node first, or allocates from another node.',
            options: [
              { value: 0, label: 'off', does: 'Allocate from other nodes at once.' },
              { value: 1, label: 'on', does: 'Free local memory first, then look further.' },
            ],
          },
        ],
      },
      body: [
        'On a machine with several [[NUMA]] nodes, `vm.zone_reclaim_mode` sets how the kernel reacts when a zone runs out of memory. At 0, the default, no zone reclaim happens, and allocations are served from other zones or nodes[^zrm]. The value is a set of bits: 1 turns zone reclaim on, 2 also writes out dirty pages, and 4 also swaps pages[^zrm].',
        'The docs advise leaving it off for file servers and for workloads that benefit from cached data, since caching is likely to matter more than data locality[^zrm]. They suggest turning it on if the workload is split so that each part fits within a NUMA node and remote access measurably hurts performance[^zrm].',
      ],
      pins: [
        { key: 'zone_reclaim_mode', layer: 'choice', here: 'Whether the kernel frees memory on the local node before using another. Off suits file servers and most machines. Turn it on only if each workload fits in one node. This tuner offers only 0 and 1.' },
      ],
      choose: [
        {
          q: 'Does this machine serve files or run a database that relies on cached data?',
          check: 'grep -e Cached -e Dirty /proc/meminfo',
          hint: 'A large Cached value is file data kept in RAM for the next read. 0, off, is the default.',
          yes: { key: 'zone_reclaim_mode', to: 0 },
        },
        {
          q: 'Is each workload split so that it fits in one node, and does remote memory measurably slow it?',
          check: 'ls /sys/devices/system/node',
          hint: 'Entries named node0, node1 and so on are the memory nodes. With only node0 there is no remote memory.',
          yes: { key: 'zone_reclaim_mode', to: 1 },
          no: { leave: true, why: 'Zone reclaim is off by default, and it only helps workloads that stay inside one node.' },
        },
      ],
      symptoms: {
        low: 'Programs on a large NUMA machine read some of their memory from a distant node.',
        high: 'Cached files are dropped while other nodes still have free memory, and file-heavy programs slow down.',
      },
      look: {
        cmd: 'ls /sys/devices/system/node',
        for: 'Entries named node0, node1 and so on are the memory nodes; the other entries are not. A machine with only node0 has no remote memory to avoid.',
      },
      sources: {
        zrm: vm('zone-reclaim-mode', 'zone_reclaim_mode'),
      },
    },
  ],
}
