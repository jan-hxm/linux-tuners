/**
 * The memory study guide at /learn/memory: six chapters down the layers the
 * swap tuner's twelve settings act on. Data in the frozen Guide shape
 * (src/learn/schema.js), checked by src/learn/contract.test.js. Probe ids
 * name entries in ./probes.js; `[^id]` marks point into each chapter's
 * `sources`; `[[term]]` names an entry in ui/glossary.js. Figure labels
 * name a part in a few words; what it does is its `does`, shown as a
 * tooltip on the page and inline on the static page.
 */

/** Pages of 4 kB: the page size on x86-64, which every VM test image runs. */
const KB_PER_PAGE = 4
const pages = (path) => ({ probe: 'swap.zoneWatermarks', path, unit: 'pages' })

const VM = 'https://docs.kernel.org/admin-guide/sysctl/vm.html'
const CONCEPTS = 'https://docs.kernel.org/admin-guide/mm/concepts.html'
const vm = (anchor, name) => ({ url: `${VM}#${anchor}`, label: `sysctl/vm: ${name}` })
const concepts = (anchor, name) => ({ url: `${CONCEPTS}#${anchor}`, label: `Memory concepts: ${name}` })

export const LEARN = {
  slug: 'memory',
  title: 'How Linux manages memory',
  lead: 'Follow a request for memory from your program down to the disk, and see where each memory setting acts on the way.',
  minutes: 20,
  parts: {
    picture:
      'Think of RAM as your desk and the disk as a filing cabinet. The desk is fast but small. When it fills up, the kernel clears space. It puts back printouts that have a copy in the cabinet. Notes that exist only on the desk go into a spare drawer.',
    cards: [
      { id: 'programs', title: 'Your programs', does: 'They ask the kernel for memory, and read and write files.', col: 1, row: 1 },
      { id: 'manager', title: 'Memory manager', does: 'The part of the kernel that hands out memory, and decides what to free when it runs short.', col: 1, row: 2, probe: 'swap.vmSysctls' },
      { id: 'kswapd', title: 'kswapd', does: 'Frees memory in the background, before programs have to wait.', col: 2, row: 2, probe: 'swap.kswapd' },
      { id: 'program-memory', title: 'Program memory', does: "Each program's own working data, with no copy on disk.", col: 1, row: 3, probe: 'swap.memAnon', path: 'AnonPages', unit: 'kB' },
      { id: 'file-cache', title: 'File cache', does: 'Copies of files kept in RAM, so the next read skips the disk.', col: 2, row: 3, probe: 'swap.memCache', path: 'Cached', unit: 'kB' },
      { id: 'swap', title: 'Swap', does: 'Space where program memory waits when RAM runs short.', col: 1, row: 4, probe: 'swap.swaps' },
      { id: 'files', title: 'Your files', does: 'What the file cache copies, and where changes are written back.', col: 2, row: 4 },
    ],
    bands: [
      { label: 'RAM', rows: [3, 3] },
      { label: 'Disk', rows: [4, 4] },
    ],
    edges: [
      { from: 'programs', to: 'manager', label: 'ask for memory' },
      { from: 'manager', to: 'kswapd', label: 'wakes when low' },
      { from: 'manager', to: 'program-memory', label: 'hands out pages' },
      { from: 'kswapd', to: 'file-cache', label: 'drops copies' },
      { from: 'program-memory', to: 'swap', label: 'moved out' },
      { from: 'file-cache', to: 'files', label: 'changes written back' },
    ],
    scale: {
      label: 'RAM',
      total: { probe: 'swap.memSize', path: 'MemTotal', unit: 'kB' },
      segments: [
        { id: 'program-memory', label: 'Program memory', value: { probe: 'swap.memAnon', path: 'AnonPages', unit: 'kB' }, does: 'Memory programs wrote to that has no file behind it, `AnonPages` in /proc/meminfo.' },
        { id: 'file-cache', label: 'File cache', value: { probe: 'swap.memCache', path: 'Cached', unit: 'kB' }, does: 'Copies of files kept in RAM, `Cached` in /proc/meminfo.' },
        { id: 'rest', label: 'Free or kernel', does: 'Free memory, and what the kernel holds for itself, such as its own caches.' },
      ],
    },
  },
  chapters: [
    {
      id: 'what-reclaim-chooses',
      title: 'What reclaim chooses',
      oneLine: 'When RAM runs short, the kernel frees some. Two settings decide what goes first: copies of files, program memory, or remembered file names.',
      picture: {
        text: 'Your desk is full. You can put back a printout, since the original sits in the cabinet. Or you can box up your own notes, which takes longer because nobody else has a copy. One dial says which you reach for first.',
        limit: 'You clear one pile at a time. The kernel often frees only file cache while it has plenty, then mixes in program memory. The dial sets the mix.',
      },
      figure: {
        kind: 'stack',
        title: 'What the kernel can free',
        layers: [
          { id: 'programs', label: 'Your programs', kind: 'nodes', nodes: [{ id: 'ask', text: 'Needs more memory', does: 'A program needs more memory than is free.' }] },
          {
            id: 'reclaim',
            label: 'Reclaim',
            kind: 'nodes',
            nodes: [{ id: 'choose', text: 'Picks what to free', does: 'The kernel weighs file cache against program memory, as the two settings say.' }],
            values: [
              { probe: 'swap.swappiness', unit: '', label: 'vm.swappiness' },
              { probe: 'swap.vfsCachePressure', unit: '', label: 'vm.vfs_cache_pressure' },
            ],
          },
          {
            id: 'ram',
            label: 'RAM',
            kind: 'nodes',
            nodes: [
              { id: 'anon', text: 'Program memory', does: 'It has no copy on disk, so it goes to swap before its RAM is reused.', probe: 'swap.memAnon', path: 'AnonPages', unit: 'kB' },
              { id: 'cache', text: 'File cache', does: 'A copy of a file, which the kernel can drop and read again.', probe: 'swap.memCache', path: 'Cached', unit: 'kB' },
              { id: 'names', text: 'File names', does: 'Names and details of files the kernel looked up: dentries and inodes.', probe: 'swap.dentryState' },
            ],
          },
          {
            id: 'disk',
            label: 'Disk',
            kind: 'nodes',
            nodes: [
              { id: 'swap', text: 'Swap', does: 'Where program memory goes when it leaves RAM.', probe: 'swap.swaps' },
              { id: 'files', text: 'Your files', does: 'Where the file cache copies came from.' },
            ],
          },
        ],
      },
      body: [
        'RAM holds two main kinds of memory. [[File cache|page-cache]] is a copy of data already on disk, so the kernel can drop it and read it again later[^reclaim]. [[Program memory|anonymous-memory]] has no file behind it, so it must be written to [[swap]] before its RAM can be reused[^anon]. Freeing memory like this is called [[reclaim]][^reclaim].',
        'vm.swappiness tells the kernel how costly swap is compared with rereading files. Lower values say swap is costly, so file cache is freed more readily. At 100 both count as equal, and higher values favour swap[^swappiness]. Values above 100 make sense when swap is fast, such as [[zram]] in compressed RAM[^swappiness].',
        'The kernel also keeps the file names it has looked up, and the details of each file, in the [[dentry and inode caches|dentry-cache]]. The vm.vfs_cache_pressure setting decides how readily it frees those compared with file cache[^vfs]. Lower keeps them longer. At 0 they are never freed, which can run the machine out of memory[^vfs].',
      ],
      pins: [
        { key: 'swappiness', layer: 'reclaim', here: 'How costly the kernel thinks swap is. Lower frees file cache more readily and keeps programs in RAM. Higher moves idle program memory to swap sooner.' },
        { key: 'vfs_cache_pressure', layer: 'ram', here: 'How readily the kernel forgets file names and details. Lower keeps them longer, higher frees them sooner. Never set it to 0. Most machines don\'t need to change this.' },
      ],
      choose: [
        {
          q: 'Do programs you left idle pause for a moment when you come back to them?',
          check: 'free -h',
          hint: 'Swap used above zero, next to a large buff/cache, means program memory went to swap while file copies stayed.',
          yes: { key: 'swappiness', dir: 'lower' },
        },
        {
          q: 'Is your swap in compressed RAM, while the disk keeps rereading the same files?',
          check: 'swapon --show',
          hint: 'A NAME starting with /dev/zram means swap lives in compressed RAM, which is fast.',
          yes: { key: 'swappiness', dir: 'raise' },
        },
        {
          q: 'Does walking a large tree of files get slow again soon after it was fast?',
          check: 'cat /proc/sys/fs/dentry-state',
          hint: 'The first number is how many file names the kernel remembers. A big drop between runs means they were freed.',
          yes: { key: 'vfs_cache_pressure', dir: 'lower' },
          no: { leave: true, why: 'The defaults weigh file cache and program memory sensibly for most machines.' },
        },
      ],
      symptoms: {
        low: 'Programs stay quick to wake, but the disk rereads the same files more often.',
        high: 'Programs you left idle pause for a moment when you return to them.',
      },
      look: { cmd: 'free -h', for: 'The buff/cache column is mostly file cache. Swap used above zero means some program memory sits in swap.' },
      sources: {
        reclaim: concepts('reclaim', 'Reclaim'),
        anon: concepts('anonymous-memory', 'Anonymous Memory'),
        swappiness: vm('swappiness', 'swappiness'),
        vfs: vm('vfs-cache-pressure', 'vfs_cache_pressure'),
      },
    },
    {
      id: 'when-reclaim-starts',
      title: 'When reclaim starts',
      oneLine: 'The kernel keeps a little RAM free at all times. Two settings decide how big that reserve is and how early the freeing starts.',
      picture: {
        text: "Think of a fuel gauge with three marks. At the low mark a helper starts refilling the tank while you drive. At the high mark it stops. Below the lowest mark you must pull over and refill it yourself.",
        limit: 'Fuel only runs down while you drive. Free memory goes up and down all the time, and each zone of RAM has its own gauge.',
      },
      figure: {
        kind: 'gauge',
        title: 'Free memory in the Normal zone and its three watermarks',
        axis: 'free pages',
        marks: [
          { id: 'min', label: 'min', value: pages('Normal.min'), tone: 'error', does: 'Below it, a program asking for memory frees some itself, and waits.' },
          { id: 'low', label: 'low', value: pages('Normal.low'), does: 'Below it, kswapd wakes and frees memory in the background.' },
          { id: 'high', label: 'high', value: pages('Normal.high'), does: 'Above it, kswapd goes back to sleep.' },
        ],
        zones: [
          { id: 'below-min', label: 'programs wait', to: 'min', tone: 'error', does: 'Direct reclaim: a program asking for memory frees some itself, and stalls until enough is free.' },
          { id: 'min-low', label: 'kswapd awake', from: 'min', to: 'low', tone: 'fit', does: 'kswapd is awake and frees memory in the background, and programs do not wait yet.' },
          { id: 'low-high', label: 'kswapd keeps freeing', from: 'low', to: 'high', tone: 'fit', does: 'Once awake, kswapd keeps freeing memory until free memory is back above high.' },
          { id: 'above-high', label: 'kswapd sleeps', from: 'high', does: 'kswapd goes back to sleep, and programs keep running.' },
        ],
        // The marks are in pages, MemTotal in kB.
        zoom: { label: 'All RAM', full: { probe: 'swap.memSize', path: 'MemTotal', unit: 'kB' }, fullPerUnit: KB_PER_PAGE },
        pins: [
          { key: 'min_free_kbytes', mark: 'min', value: { probe: 'swap.minFree', unit: 'kB' } },
          { key: 'watermark_scale_factor', from: 'min', to: 'high', value: { probe: 'swap.watermarkScale', unit: '' } },
        ],
      },
      body: [
        'The kernel splits RAM into ranges it manages on their own, called [[zones|memory-zone]][^zones]. Each zone has three free-memory levels, its [[watermarks|watermark]]: min, low and high[^zone]. Below low, a kernel thread that frees memory in the background wakes up. It is called [[kswapd]]. Above high, it stops again[^zone].',
        'If kswapd falls behind and free memory drops below min, a program asking for memory may have to free some itself. This is [[direct reclaim|reclaim]], and the program stalls until enough is free[^reclaim]. The allocstall counters in `/proc/vmstat` count these stalls[^wsf].',
        'vm.min_free_kbytes sets the min level, shared out among zones by size[^min-free]. The kernel picks it from your RAM, and may raise it when [[transparent huge pages|thp]] are on, as on our test machines. A value you write stays, unless memory is added or huge pages are switched on later. vm.watermark_scale_factor sets the gap between the levels. A wider gap wakes kswapd earlier and keeps it working until more is free[^wsf].',
      ],
      pins: [
        { key: 'min_free_kbytes', layer: 'min', here: 'Sets the min mark, a reserve the kernel keeps for its own urgent needs. Most machines don\'t need to change this. Far too low risks hangs; far too high runs memory out at once.' },
        { key: 'watermark_scale_factor', here: 'Sets the gap between the marks. Wider wakes kswapd earlier and lets it free more before sleeping, so programs stall less. The cost is a little more RAM kept free.' },
      ],
      choose: [
        {
          q: 'Do programs pause for a moment when memory is nearly full?',
          check: 'grep allocstall /proc/vmstat',
          hint: 'Run it twice, a minute apart. Numbers that grow mean programs had to free memory themselves.',
          yes: { key: 'watermark_scale_factor', dir: 'raise' },
        },
        {
          q: 'Does the kernel log mention a "page allocation failure"?',
          check: 'sudo dmesg | grep -i "page allocation failure"',
          hint: 'Any line means a request found no free memory it was allowed to take, often one from a driver that cannot wait. A bigger reserve leaves more for those.',
          yes: { key: 'min_free_kbytes', dir: 'raise' },
          no: { leave: true, why: 'Both defaults scale with your RAM, and that suits most machines.' },
        },
      ],
      symptoms: {
        low: 'Programs freeze for a moment when memory fills up, and allocstall keeps growing.',
        high: 'Free memory stays high, and less is left over for programs and file cache.',
      },
      look: {
        cmd: 'grep -e Node -e " min " -e " low " -e " high " /proc/zoneinfo',
        for: 'Each Node line names a zone. The min, low and high lines under it are that zone\'s marks, counted in pages.',
      },
      sources: {
        zones: concepts('zones', 'Zones'),
        zone: { url: 'https://docs.kernel.org/mm/physical_memory.html#zone-structure', label: 'Physical memory: zone structure' },
        reclaim: concepts('reclaim', 'Reclaim'),
        'min-free': vm('min-free-kbytes', 'min_free_kbytes'),
        wsf: vm('watermark-scale-factor', 'watermark_scale_factor'),
      },
    },
    {
      id: 'swapping-out-and-back-in',
      title: 'Swapping out and back in',
      oneLine: 'When a program needs memory that was moved to swap, the kernel reads it back. One setting decides how many neighbouring pieces come along.',
      picture: {
        text: 'You fetch one sheet from a box in the cabinet. The sheets around it were boxed at the same time, so you grab a few of those too. If you need them next, you saved a trip.',
        limit: 'Carrying a few extra sheets costs you nothing. Reading extra pages makes the first read slower, and the guess is wasted when the program needs other pages.',
      },
      figure: {
        kind: 'sideBySide',
        title: 'Pages read back from swap in one go, at most',
        states: [
          { label: 'Default', cells: 16, lit: 8, asked: 2, setting: { key: 'page_cluster', value: 3 } },
          { label: 'Readahead off', cells: 16, lit: 1, start: 2, asked: 2, setting: { key: 'page_cluster', value: 0 } },
        ],
        legend: { asked: 'asked for', lit: 'read along', off: 'stays in swap' },
        backedBy: { vmTest: 'on a swap file it reads ahead at the default and not at 0' },
      },
      body: [
        'The kernel divides RAM into small blocks of the same size, called [[pages|page]][^primer]. Moving a page of program memory to swap is swapping out. When the program uses that page again, the kernel reads it back from swap, which is swapping in[^page-cluster].',
        'Along with the page the program needs, the kernel can read pages stored next to it in swap. Those were swapped out together. This is swap [[readahead]][^page-cluster]. vm.page-cluster sets how many: 0 means one page, and each step up doubles it[^page-cluster].',
        'Lower values make the first read faster, but the pages that follow may each need a read of their own[^page-cluster]. Our VM tests saw readahead from a swap file at the default and none at 0. On zram they saw none for memory only one program uses, even at the default.',
      ],
      pins: [
        { key: 'page_cluster', here: 'How many pages come back from swap in one go, as a power of two. Lower can suit swap in compressed RAM. Most machines with swap on a disk don\'t need to change this.' },
      ],
      choose: [
        {
          q: 'Do programs pause when they come back from swap, and does your swap live in compressed RAM?',
          check: 'swapon --show',
          hint: 'A NAME starting with /dev/zram means swap lives in compressed RAM.',
          yes: { key: 'page_cluster', dir: 'lower' },
          no: { leave: true, why: 'Readahead pays off for swap on a disk, and the default suits it.' },
        },
      ],
      symptoms: {
        low: 'Programs coming back from swap fault in page by page, with many small reads.',
        high: 'Each return from swap takes longer, and pages read along may never be used.',
      },
      look: {
        cmd: 'grep -e pswpin -e swap_ra /proc/vmstat',
        for: 'pswpin counts pages read back from swap. swap_ra counts pages read ahead, and swap_ra_hit those a program then used.',
      },
      sources: {
        primer: concepts('virtual-memory-primer', 'Virtual Memory Primer'),
        'page-cluster': vm('page-cluster', 'page-cluster'),
      },
    },
    {
      id: 'writing-changes-to-disk',
      title: 'Writing changes to disk',
      oneLine: 'When a program saves to a file, the change sits in RAM before it reaches the disk. Four settings decide how much can wait, and for how long.',
      picture: {
        text: 'You edit printouts on your desk and file the changes later, in batches. Once the pile of edited sheets passes one mark, a helper starts filing them. If it grows past a second mark, you stop editing and help file.',
        limit: 'A pile on a desk survives a power cut. Changes still in RAM are lost when the power goes, so how long they wait matters.',
      },
      figure: {
        kind: 'gauge',
        title: 'Changed file data waiting in RAM, as a share of available memory',
        axis: 'dirty data',
        range: { from: 0, to: 30 },
        marks: [
          { id: 'background', label: 'background', value: { probe: 'swap.dirtyBackgroundRatio', unit: '%' }, does: 'Past it, the flusher threads start writing in the background.' },
          { id: 'ceiling', label: 'limit', value: { probe: 'swap.dirtyRatio', unit: '%' }, tone: 'error', does: 'Past it, a program that keeps writing must write data out itself.' },
        ],
        zones: [
          { id: 'waiting', label: 'waits in RAM', to: 'background', does: 'Changed data waits in RAM until it grows old or passes the background mark.' },
          { id: 'flushing', label: 'background writing', from: 'background', to: 'ceiling', tone: 'fit', does: 'The flusher threads write changed data out while programs keep going.' },
          { id: 'throttled', label: 'writers must help', from: 'ceiling', tone: 'error', does: 'A program that keeps writing must write data out itself, so it slows down.' },
        ],
        // Schematic: level 1 is the background mark and 2 the limit, as measured.
        curve: {
          points: [[0, 0.2], [0.1, 0.2], [0.3, 1], [0.5, 1.8], [0.6, 2], [0.75, 2], [0.85, 1.2], [1, 0.4]],
          events: [
            { at: 0.1, label: 'a big write starts' },
            { at: 0.3, label: 'flushers start', tone: 'fit', does: 'Dirty data passed the background mark, so the flusher threads start writing.' },
            { at: 0.6, label: 'the writer helps', tone: 'error', does: 'Dirty data reached the limit, so the program that writes must write data out itself.' },
            { at: 0.75, label: 'the write ends' },
          ],
        },
        pins: [
          { key: 'dirty_background_ratio', mark: 'background' },
          { key: 'dirty_ratio', mark: 'ceiling' },
        ],
      },
      body: [
        'When a program writes to a file, the kernel changes the copy in file cache first and marks it as a [[dirty page]][^page-cache]. Writing it to disk later is called [[writeback]]. Until then the change exists only in RAM[^page-cache].',
        'Kernel threads that write in the background, the [[flusher threads|flusher-thread]], start once dirty data passes vm.dirty_background_ratio of available memory[^bg]. Past vm.dirty_ratio, a program that keeps writing must write out data itself[^ratio]. Available memory here means free and reclaimable memory, not all of RAM[^ratio].',
        'Two timers matter as well. The flusher threads wake every vm.dirty_writeback_centisecs to write out old data[^wb]. Data dirty for longer than vm.dirty_expire_centisecs is written at the next wake-up[^exp]. Both count hundredths of a second, and 0 for the wake-up timer turns periodic writeback off[^wb].',
      ],
      pins: [
        { key: 'dirty_background_ratio', layer: 'background', here: 'When background writing starts, as a share of available memory. Lower starts it sooner, in smaller batches. Keep it below dirty_ratio.' },
        { key: 'dirty_ratio', layer: 'ceiling', here: 'Where a program that writes has to help write data out. Lower keeps less unwritten data in RAM. Higher lets a big write run longer before the program has to help.' },
        { key: 'dirty_expire_centisecs', here: 'How old changed data may get before the next wake-up writes it. Lower narrows what a power cut can lose. Higher lets more changes batch together.' },
        { key: 'dirty_writeback_centisecs', here: 'How often the flusher threads wake to write old data. At 0 periodic writing stops, so keep it above 0. Most machines don\'t need to change this.' },
      ],
      choose: [
        {
          q: 'Does the machine stall for seconds during big copies, then catch up?',
          check: 'grep -e Dirty -e Writeback /proc/meminfo',
          hint: 'Run it during a copy. Dirty is data waiting for the disk, and Writeback is data on its way there.',
          yes: { key: 'dirty_ratio', dir: 'lower' },
        },
        {
          q: 'After a crash or power cut, are the latest changes to files missing?',
          check: 'sysctl vm.dirty_expire_centisecs',
          hint: 'The value is in hundredths of a second: how long changed data may wait in RAM.',
          yes: { key: 'dirty_expire_centisecs', dir: 'lower' },
          no: { leave: true, why: 'The defaults suit most machines and disks.' },
        },
      ],
      symptoms: {
        low: 'The disk is busy more often, with smaller writes.',
        high: 'Big writes run fast at first, then stall for seconds while data drains to disk.',
      },
      look: {
        cmd: 'grep -e Dirty -e Writeback /proc/meminfo',
        for: 'Dirty is changed data still in RAM. Writeback is data being written right now. Both are in kB.',
      },
      sources: {
        'page-cache': concepts('page-cache', 'Page cache'),
        bg: vm('dirty-background-ratio', 'dirty_background_ratio'),
        ratio: vm('dirty-ratio', 'dirty_ratio'),
        wb: vm('dirty-writeback-centisecs', 'dirty_writeback_centisecs'),
        exp: vm('dirty-expire-centisecs', 'dirty_expire_centisecs'),
      },
    },
    {
      id: 'promising-memory',
      title: 'Promising memory',
      oneLine: 'Programs often ask for more memory than they use. One setting decides whether the kernel promises it anyway, and another sets the limit in strict mode.',
      picture: {
        text: 'An airline sells more seats than the plane has, because some passengers never show up. Most days it works out. If everyone comes, someone has to stay behind.',
        limit: 'An airline knows its seat count before anyone boards. The kernel finds out it is short only when programs start using what they were promised.',
      },
      figure: {
        kind: 'stack',
        title: 'What happens to a request for memory',
        layers: [
          { id: 'request', label: 'The request', kind: 'nodes', nodes: [{ id: 'ask', text: 'Request for memory', does: 'A program asks for memory: a promise, not RAM yet.' }] },
          {
            id: 'policy',
            label: 'The kernel answers',
            kind: 'nodes',
            nodes: [
              { id: 'mode0', text: 'Mode 0', does: 'Refuses only obvious overcommits; the default.' },
              { id: 'mode1', text: 'Mode 1', does: 'Always says yes.' },
              { id: 'mode2', text: 'Mode 2', does: 'Refuses any promise past the commit limit.' },
            ],
            values: [
              { probe: 'swap.overcommitMemory', unit: 'mode', label: 'vm.overcommit_memory' },
              { probe: 'swap.overcommitRatio', unit: '%', label: 'vm.overcommit_ratio' },
            ],
          },
          {
            id: 'accounts',
            label: 'What has been promised',
            kind: 'nodes',
            nodes: [
              { id: 'committed', text: 'Promised so far', sub: 'Committed_AS', does: 'Everything promised so far, used or not.', probe: 'swap.memCommit', path: 'Committed_AS', unit: 'kB' },
              { id: 'limit', text: 'Commit limit', sub: 'CommitLimit', does: 'The limit mode 2 enforces: all of swap plus a share of RAM.', probe: 'swap.memCommit', path: 'CommitLimit', unit: 'kB' },
            ],
            values: [
              { probe: 'swap.memCommit', path: 'Committed_AS', unit: 'kB' },
              { probe: 'swap.memCommit', path: 'CommitLimit', unit: 'kB' },
            ],
          },
          {
            id: 'memory',
            label: 'RAM and swap',
            kind: 'nodes',
            nodes: [
              { id: 'ram', text: 'RAM', probe: 'swap.memSize', path: 'MemTotal', unit: 'kB' },
              { id: 'swap', text: 'Swap', probe: 'swap.swaps' },
            ],
            values: [
              { probe: 'swap.memSize', path: 'MemTotal', unit: 'kB' },
              { probe: 'swap.memSize', path: 'SwapTotal', unit: 'kB' },
            ],
          },
        ],
      },
      body: [
        'Asking for memory and using it are two steps. A request only reserves room, and RAM is handed out when the program first writes there[^anon]. Many programs ask for large amounts in case they need them, and use little of it[^om].',
        'Promising more than RAM and swap hold is called [[overcommit]]. vm.overcommit_memory picks the policy[^om]. In mode 0, the default, the kernel refuses only obvious overcommits. Mode 1 always says yes, and the OOM killer steps in if memory really runs out. Mode 2 tries to prevent any overcommit[^om].',
        'In mode 2 the limit, the [[commit limit]], is all of swap plus a share of RAM set by vm.overcommit_ratio[^acct]. A request past it then usually fails with an error, rather than a program being killed later[^acct]. The ratio has no effect in modes 0 and 1[^acct].',
      ],
      pins: [
        { key: 'overcommit_memory', layer: 'policy', here: 'How the kernel answers requests for memory. Mode 0 suits a typical system, and most machines don\'t need to change this. Mode 1 suits huge sparse reservations; mode 2 refuses promises past the limit.' },
        { key: 'overcommit_ratio', layer: 'accounts', here: 'The share of RAM that counts toward the commit limit in mode 2. Higher allows more promises, lower keeps more headroom. In modes 0 and 1 it does nothing.' },
      ],
      choose: [
        {
          q: 'Do programs fail with "Cannot allocate memory" while free still shows memory available?',
          check: 'grep Commit /proc/meminfo',
          hint: 'If overcommit_memory is 2 (strict), Committed_AS close to CommitLimit means the limit refused the request.',
          yes: { key: 'overcommit_ratio', dir: 'raise' },
        },
        {
          q: 'Does a program that reserves a huge, mostly empty area fail to start?',
          check: 'sysctl vm.overcommit_memory',
          hint: 'Some scientific code works this way, with large sparse arrays. Mode 0 refuses requests far beyond RAM and swap.',
          yes: { key: 'overcommit_memory', dir: 'raise' },
          no: { leave: true, why: 'Mode 0 is the default and fits a typical system.' },
        },
      ],
      symptoms: {
        low: 'In strict mode, programs fail to start with "Cannot allocate memory" while RAM is free.',
        high: 'Programs always start, but when memory really runs out the OOM killer ends one.',
      },
      look: {
        cmd: 'grep Commit /proc/meminfo',
        for: 'CommitLimit is the limit mode 2 enforces. Committed_AS is everything promised so far, used or not.',
      },
      sources: {
        anon: concepts('anonymous-memory', 'Anonymous Memory'),
        om: vm('overcommit-memory', 'overcommit_memory'),
        acct: { url: 'https://docs.kernel.org/mm/overcommit-accounting.html', label: 'Overcommit Accounting' },
      },
    },
    {
      id: 'running-out',
      title: 'Running out',
      oneLine: 'Sometimes nothing more can be freed. The kernel then ends one program to save the rest or, if you choose, stops the whole machine.',
      picture: {
        text: 'The desk is full, the cabinet is full, and work must go on. Someone picks one project taking up a lot of room and throws it out. Everyone else keeps working.',
        limit: 'A person could argue for their project. A program cannot, and anything it held only in memory is gone when it is killed.',
      },
      figure: {
        kind: 'stack',
        title: 'When memory runs out',
        layers: [
          { id: 'pressure', label: 'Memory runs out', kind: 'nodes', nodes: [{ id: 'stuck', text: 'Reclaim cannot free enough' }] },
          {
            id: 'choice',
            label: 'What the kernel does',
            kind: 'nodes',
            nodes: [
              { id: 'killer', text: 'OOM killer', does: 'Ends one program, and the machine runs on.' },
              { id: 'panic', text: 'Kernel panic', does: 'The whole machine stops.' },
            ],
            values: [{ probe: 'swap.panicOnOom', unit: '', label: 'vm.panic_on_oom' }],
          },
        ],
      },
      body: [
        'Memory can run out on a busy machine, with reclaim unable to free enough to carry on[^oom]. The kernel then runs the [[OOM killer]], which picks one program and kills it, so the memory it held comes free[^oom]. It normally picks a program hogging memory, which frees a lot when killed[^pick].',
        'vm.panic_on_oom changes that. When it is on, the kernel causes a [[kernel panic]] instead, and the machine stops[^panic]. The kernel docs offer it for clusters that fail over to another machine[^panic]. Even then, a program held to part of the memory by a CPU set or memory policy may still be killed, with no panic[^panic].',
        'Whether a panicked machine restarts on its own depends on another setting, kernel.panic, not this one[^kpanic].',
      ],
      pins: [
        { key: 'panic_on_oom', layer: 'choice', here: 'Whether running out of memory stops the whole machine. Off, the OOM killer ends one program. On suits clusters that fail over. Most machines don\'t need to change this.' },
      ],
      choose: [
        {
          q: 'When memory ran out, did a half-working machine cause more trouble than a restart would have?',
          check: 'sudo dmesg | grep -i "out of memory"',
          hint: 'Lines like these show the OOM killer ran, and which program it ended.',
          yes: { key: 'panic_on_oom', dir: 'raise' },
          no: { leave: true, why: 'Ending one program keeps the rest of the machine running, which suits most machines.' },
        },
      ],
      symptoms: {
        low: 'A program vanishes when memory runs out, and the kernel log says which one.',
        high: 'The whole machine goes down when memory runs out, unless only a cgroup or CPU set ran short.',
      },
      look: {
        cmd: 'sudo dmesg | grep -i "out of memory"',
        for: 'A line with "Out of memory" names the program the OOM killer ended. "Memory cgroup out of memory" means a group of programs hit its own limit. Older kernels say "Kill process", newer ones "Killed process".',
      },
      sources: {
        oom: concepts('oom-killer', 'OOM killer'),
        pick: vm('oom-kill-allocating-task', 'oom_kill_allocating_task'),
        panic: vm('panic-on-oom', 'panic_on_oom'),
        kpanic: { url: 'https://docs.kernel.org/admin-guide/sysctl/kernel.html#panic', label: 'sysctl/kernel: panic' },
      },
    },
  ],
}
