/**
 * The disk I/O study guide at /learn/disk-io: five chapters down the path a
 * read takes from a program to the disk, one per queue attribute the block
 * I/O tuner writes as udev rules. Data in the frozen Guide shape
 * (src/learn/schema.js), checked by src/learn/contract.test.js. Probe ids
 * name entries in ./probes.js; `[^id]` marks point into each chapter's
 * `sources`; `[[term]]` names an entry in ui/glossary.js.
 */

const ABI = 'https://docs.kernel.org/admin-guide/abi-stable.html'
const BLK_MQ = 'https://docs.kernel.org/block/blk-mq.html'
const BFQ = 'https://docs.kernel.org/block/bfq-iosched.html'
const UDEV = 'https://man7.org/linux/man-pages/man7/udev.7.html'
const abi = (attr) => ({ url: `${ABI}#abi-sys-block-disk-queue-${attr.replace(/_/g, '-')}`, label: `Kernel ABI: queue/${attr}` })
const blkMq = (anchor, name) => ({ url: `${BLK_MQ}#${anchor}`, label: `blk-mq: ${name}` })
const bfq = (anchor, name) => ({ url: `${BFQ}#${anchor}`, label: `BFQ: ${name}` })

/** The four disks of the capture guest, as figure nodes reading one attribute each. */
const disks = (probe) => [
  { id: 'nvme', text: 'NVMe drive', sub: 'nvme0n1', probe: `block-io.nvme${probe}` },
  { id: 'ssd', text: 'SATA SSD', sub: 'sda', probe: `block-io.ssd${probe}` },
  { id: 'hdd', text: 'SATA hard disk', sub: 'sdb', probe: `block-io.hdd${probe}` },
  { id: 'virtio', text: 'Virtual disk', sub: 'vda', probe: `block-io.virtio${probe}` },
]

export const LEARN = {
  slug: 'disk-io',
  title: 'How Linux reads and writes disks',
  lead: 'Follow a read from your program down to the disk, and see where each disk setting acts on the way. Then see how a udev rule makes those settings stick.',
  minutes: 15,
  parts: {
    picture:
      'Think of a post office. Letters arrive at the counter, get bundled by street and sorted into a route, then go out in the van. The post office keeps a card of rules for each van, and a clerk fills it in when a new van arrives.',
    cards: [
      { id: 'programs', title: 'Your programs', does: 'Read and write files.', col: 1, row: 1 },
      { id: 'cache', title: 'File cache', does: 'Keeps file data in RAM, and reads ahead when a file is read in order.', col: 1, row: 2 },
      { id: 'block-layer', title: 'Block layer', does: 'Turns reads and writes into requests, and merges neighbouring ones.', col: 1, row: 3, probe: 'block-io.sysBlock' },
      { id: 'udev', title: 'udev', does: 'Writes your settings into each disk\'s queue when the disk appears.', col: 2, row: 3, probe: 'block-io.udevd' },
      { id: 'scheduler', title: 'I/O scheduler', does: 'Decides the order waiting requests go out in, or passes them straight on.', col: 1, row: 4 },
      { id: 'disk', title: 'Your disk', does: 'An NVMe drive, a SATA disk or a virtual disk. It says whether it spins.', col: 1, row: 5 },
    ],
    bands: [
      { label: 'RAM', rows: [2, 2] },
      { label: 'Kernel', rows: [3, 4] },
      { label: 'Hardware', rows: [5, 5] },
    ],
    edges: [
      { from: 'programs', to: 'cache', label: 'read and write files' },
      { from: 'cache', to: 'block-layer', label: 'reads what is missing, writes changes' },
      { from: 'udev', to: 'block-layer', label: 'writes the queue settings' },
      { from: 'block-layer', to: 'scheduler', label: 'queues requests' },
      { from: 'scheduler', to: 'disk', label: 'sends them on' },
    ],
  },
  chapters: [
    {
      id: 'spinning-disk-or-flash',
      title: 'Spinning disk or flash',
      oneLine: 'Every disk tells the kernel whether it spins. One flag holds the answer, and the tuner writes your settings as udev rules.',
      picture: {
        text: 'One librarian fetches books from tall shelves, so she collects them in aisle order and saves steps. Another has every book on one desk and takes them in any order. A sign on the door says which library this is.',
        limit: 'A librarian can look at the shelves. The kernel cannot see inside the disk, so it believes the flag, even where a virtual disk reports it wrong.',
      },
      figure: {
        kind: 'stack',
        title: 'What each disk reports',
        layers: [
          { id: 'disks', label: 'Your disks', kind: 'nodes', nodes: disks('Rotational') },
          {
            id: 'flag',
            label: 'queue/rotational',
            kind: 'bands',
            bands: [
              { id: 'spins', text: '1: rotational, a disk that spins and moves a head' },
              { id: 'flash', text: '0: non-rotational, flash with no moving parts' },
            ],
          },
          {
            id: 'rules',
            label: 'Who writes it',
            kind: 'nodes',
            nodes: [
              { id: 'driver', text: 'The disk itself', sub: 'when it is found' },
              { id: 'udevd', text: 'udev', sub: 'your rule, when the disk appears', probe: 'block-io.udevd' },
            ],
          },
        ],
      },
      body: [
        'The kernel reaches each disk through the [[block layer]], which keeps settings for every disk under `/sys/block/<disk>/queue`[^abi-rot]. One of them, rotational, says whether the disk is of rotational type[^abi-rot]. A hard disk has moving parts, so random access costs it time; flash has no such penalty[^background].',
        'The BFQ scheduler may idle a moment for a program\'s next request, which typically boosts throughput on rotational disks[^bfq-work]. On our test machines every virtual disk read 1, as if it spun, whatever stored it on the host. The file can be written, so you can correct it[^abi-rot].',
        'To set them at every boot and on every new disk, the tuner writes [[udev]] rules. udev receives an event from the kernel each time a device is added or changes, and checks its rules against it[^udev]. A rule whose matches all fit gets applied, and its `ATTR` assignment writes the value into the disk\'s file[^udev-rules].',
      ],
      pins: [
        { key: 'rotational', layer: 'virtio', here: 'Whether the kernel treats the disk as spinning. Real disks report it themselves, so most machines don\'t need to change this. Set 0 on a virtual disk the host keeps on flash.' },
      ],
      choose: [
        {
          q: 'Is this a virtual machine whose disk the host keeps on SSD or NVMe?',
          check: 'cat /sys/block/vda/queue/rotational',
          hint: '1 means the kernel treats the disk as spinning. Your host or cloud provider can tell you what storage sits behind it.',
          yes: { key: 'rotational', to: 0 },
          no: { leave: true, why: 'A real disk reports the flag itself, and a virtual disk on spinning storage is right at 1.' },
        },
      ],
      symptoms: {
        low: 'A spinning disk marked 0 loses the idling BFQ uses to cut its seeks.',
        high: 'A flash disk marked 1 gets idling it doesn\'t need, which can cost throughput.',
      },
      look: {
        cmd: 'grep -H . /sys/block/*/queue/rotational',
        for: 'Each line names a disk and its flag: 1 for spinning, 0 for flash.',
      },
      sources: {
        'abi-rot': abi('rotational'),
        background: blkMq('background', 'Background'),
        'bfq-work': bfq('how-does-bfq-work', 'How does BFQ work?'),
        udev: { url: `${UDEV}#DESCRIPTION`, label: 'udev(7): Description' },
        'udev-rules': { url: `${UDEV}#RULES_FILES`, label: 'udev(7): Rules files' },
      },
    },
    {
      id: 'choosing-the-scheduler',
      title: 'Choosing the scheduler',
      oneLine: 'Requests for a disk wait in a queue. The I/O scheduler decides their order, and on a fast drive it can step aside.',
      picture: {
        text: 'At a post office counter, one clerk sorts letters by street, so the van drives the route once. Another gives every customer a fair turn. On a quiet day the clerk passes letters straight to the van.',
        limit: 'A clerk sees every letter in the building. A scheduler only reorders requests waiting in the same queue, and the order they finish in is not guaranteed.',
      },
      figure: {
        kind: 'stack',
        title: 'The four schedulers',
        layers: [
          { id: 'requests', label: 'Waiting requests', kind: 'nodes', nodes: [{ id: 'queued', text: 'Requests for one disk', sub: 'reads and writes' }] },
          {
            id: 'schedulers',
            label: 'The scheduler',
            kind: 'nodes',
            nodes: [
              { id: 'none', text: 'none', sub: 'no reordering' },
              { id: 'mq-deadline', text: 'mq-deadline', sub: 'sector order, with deadlines' },
              { id: 'bfq', text: 'bfq', sub: 'fair shares, quick to respond' },
              { id: 'kyber', text: 'kyber', sub: 'throttles to latency targets' },
            ],
          },
          { id: 'disks', label: 'What each disk runs', kind: 'nodes', nodes: disks('Scheduler') },
        ],
      },
      body: [
        'Reads and writes reach the block layer as requests[^operation]. An [[I/O scheduler|io-scheduler]] may reorder them, for fairness or for speed, and only among requests in the same queue[^sched]. Each disk names its choices in `/sys/block/<disk>/queue/scheduler`, with the active one in brackets. Writing a name there switches to it, and tries to load its module if needed[^abi-sched].',
        'none places requests in the queue without any reordering[^sched]. mq-deadline serves batches in increasing sector order, and gives each request a deadline so none waits too long[^deadline]. bfq gives each program a share of the disk and keeps interactive ones quick, even during big copies[^bfq-desk]. kyber throttles requests to meet a read and a write latency target[^kyber].',
        'Every scheduler adds work per request. The BFQ docs measured 1.9 microseconds per request for bfq on a laptop CPU, against 0.7 for mq-deadline[^bfq-cost]. They put bfq\'s ceiling at 250 to 400 thousand requests a second on average CPUs, below what fast NVMe drives can do[^bfq-cost].',
      ],
      pins: [
        { key: 'scheduler', layer: 'hdd', here: 'Which scheduler orders this disk\'s requests. none suits NVMe and virtual disks, mq-deadline a server\'s SATA disk, and bfq a desktop that must stay responsive during big copies.' },
      ],
      choose: [
        {
          q: 'Is this an NVMe drive or a virtual disk running a scheduler other than none?',
          check: 'cat /sys/block/nvme0n1/queue/scheduler',
          hint: 'The name in brackets is active. none skips the work a scheduler does on every request, which costs the least CPU time.',
          yes: { key: 'scheduler', to: 'none' },
        },
        {
          q: 'Is this a desktop on a SATA disk whose apps stall while a big copy or update runs?',
          check: 'cat /sys/block/sda/queue/scheduler',
          hint: 'The name in brackets is active. bfq is built to keep apps quick during heavy background I/O.',
          yes: { key: 'scheduler', to: 'bfq' },
          no: { leave: true, why: 'The scheduler the disk runs now suits how it is used.' },
        },
      ],
      symptoms: {
        low: 'With none or mq-deadline on a desktop hard disk, apps can stall for as long as a big copy runs.',
        high: 'With bfq on a fast NVMe drive, the CPU limits how many requests a second get through.',
      },
      look: {
        cmd: 'grep -H . /sys/block/*/queue/scheduler',
        for: 'Each line names a disk and the schedulers it can use. The one in brackets is active.',
      },
      sources: {
        operation: blkMq('operation', 'Operation'),
        sched: blkMq('io-schedulers', 'IO Schedulers'),
        'abi-sched': abi('scheduler'),
        deadline: { url: 'https://docs.kernel.org/block/deadline-iosched.html', label: 'Deadline IO scheduler tunables' },
        'bfq-desk': bfq('low-latency-for-interactive-applications', 'Low latency for interactive applications'),
        kyber: { url: 'https://docs.kernel.org/block/kyber-iosched.html', label: 'Kyber I/O scheduler tunables' },
        'bfq-cost': bfq('bfq-budget-fair-queueing', 'BFQ (Budget Fair Queueing)'),
      },
    },
    {
      id: 'how-many-requests-wait',
      title: 'How many requests wait',
      oneLine: 'A scheduler holds requests before it passes them to the disk. One setting caps how many it may hold.',
      picture: {
        text: 'A cloakroom has a rack of numbered tags. Each coat gets one while it waits. When the tags run out, new guests wait at the door. A bigger rack lets the attendant sort more coats at once.',
        limit: 'Guests at the back of a cloakroom line can see how long it is. A request that arrives at a deep queue waits behind everything already in it.',
      },
      figure: {
        kind: 'stack',
        title: 'Where requests wait',
        layers: [
          { id: 'programs', label: 'Programs', kind: 'nodes', nodes: [{ id: 'send', text: 'Programs send requests' }] },
          { id: 'scheduler-queue', label: 'Requests the scheduler may hold', kind: 'nodes', nodes: disks('Requests') },
          { id: 'hardware', label: 'Hardware queues', kind: 'nodes', nodes: [{ id: 'dispatch', text: 'Hardware dispatch queues', sub: 'the last step before the driver' }] },
        ],
      },
      body: [
        'The kernel\'s request queueing, blk-mq, has two stages: software staging queues and [[hardware queues|hardware-queue]][^operation]. Requests wait in the software stage when a scheduler is attached or when they may be merged[^operation]. The hardware stage is the last step before the disk\'s driver takes over[^hw].',
        'nr_requests controls how many requests may be allocated in the block layer[^abi-nr]. It counts one set of tags, so the whole device\'s total depends on its hardware queues and on whether a scheduler is set[^abi-nr]. Each request carries a tag, a number from 0 up to the queue\'s size[^tags].',
        'Our VM tests found that with a scheduler the kernel takes 4 to 2048, and refuses more. The kernel source sets the depth again whenever the scheduler changes, so set it after the scheduler.',
      ],
      pins: [
        { key: 'nr_requests', layer: 'hdd', here: 'How many requests the scheduler may hold per hardware queue. Deeper lets a hard disk with many readers sort more; shallower keeps each wait short. Most machines don\'t need to change this.' },
      ],
      choose: [
        {
          q: 'Does a hard disk serve many programs reading at once, busy but slow?',
          check: 'cat /sys/block/sdb/queue/nr_requests',
          hint: 'This is the depth now. A deeper queue gives the scheduler more requests to sort by position on the disk.',
          yes: { key: 'nr_requests', dir: 'raise' },
          no: { leave: true, why: 'The depth the kernel sets with the scheduler suits most disks.' },
        },
      ],
      symptoms: {
        low: 'Under many parallel readers, a hard disk gets fewer requests to sort and seeks more.',
        high: 'A request that arrives behind a long queue waits longer before the disk sees it.',
      },
      look: {
        cmd: 'grep -H . /sys/block/*/queue/nr_requests',
        for: 'Each line names a disk and how many requests it may hold.',
      },
      sources: {
        operation: blkMq('operation', 'Operation'),
        hw: blkMq('hardware-dispatch-queues', 'Hardware dispatch queues'),
        'abi-nr': abi('nr_requests'),
        tags: blkMq('tag-based-completion', 'Tag-based completion'),
      },
    },
    {
      id: 'reading-ahead',
      title: 'Reading ahead',
      oneLine: 'When a program reads a file in order, the kernel fetches the next part before it is asked. One setting caps how far ahead.',
      picture: {
        text: 'You read a long book on a train. A friend hands you the next chapter before you finish this one, so you never wait. If you skip around, the friend carries chapters you never read.',
        limit: 'Carrying a chapter costs the friend nothing. Reading ahead keeps the disk busy and takes room in RAM, even for data no program asks for.',
      },
      figure: {
        kind: 'sideBySide',
        title: 'Pages read ahead in one go, at most, in 4 KiB pages',
        states: [
          { label: 'The usual default', cells: 64, lit: 32, setting: { key: 'read_ahead_kb', value: 128 } },
          { label: 'Fedora 43, hard disk', cells: 64, lit: 64, setting: { key: 'read_ahead_kb', value: 256 } },
        ],
        backedBy: { vmTest: 'each kind of disk starts with the read-ahead the drawer says, and the lsblk check works' },
      },
      body: [
        'Reading a file goes through the [[page cache]], which keeps file data in RAM[^page-cache]. [[Read-ahead|readahead]] reads content into the page cache before the program asks for it[^ra]. It starts when a read finds a page missing, or reaches a page that an earlier read-ahead marked[^ra].',
        'Each read-ahead is sized from the one before, often doubled[^ra]. read_ahead_kb caps it: the most kilobytes to read ahead for filesystems on this disk[^abi-ra]. Our VM tests found most disks starting at 128 KiB. Fedora 43 started its virtual disks at 8192 and its hard disk at 256.',
        'A wider window helps programs that stream large files, such as backups and media servers. Random reads gain little from it, and the extra pages take room other files could use.',
      ],
      pins: [
        { key: 'read_ahead_kb', here: 'The most the kernel reads ahead on this disk, in KiB. Higher helps backups, media and large scans; lower suits small random reads. 128 suits mixed use.' },
      ],
      choose: [
        {
          q: 'Does this disk mostly stream large files, such as backups, media or big scans?',
          check: 'cat /sys/block/sdb/queue/read_ahead_kb',
          hint: 'The value is in KiB. 128 is the usual start.',
          yes: { key: 'read_ahead_kb', dir: 'raise' },
        },
        {
          q: 'Does the disk serve small random reads, like a database, with a window far above 128?',
          check: 'grep -H . /sys/block/*/queue/read_ahead_kb',
          hint: 'A large window on random reads fetches data nobody asked for.',
          yes: { key: 'read_ahead_kb', dir: 'lower' },
          no: { leave: true, why: 'The window the disk starts with suits mixed use.' },
        },
      ],
      symptoms: {
        low: 'Large files read in order arrive slower than the disk can deliver.',
        high: 'Random reads fetch data nobody uses, and other files drop out of the cache sooner.',
      },
      look: {
        cmd: 'grep -H . /sys/block/*/queue/read_ahead_kb',
        for: 'Each line names a disk and its read-ahead window in KiB.',
      },
      sources: {
        'page-cache': { url: 'https://docs.kernel.org/admin-guide/mm/concepts.html#page-cache', label: 'Memory concepts: Page cache' },
        ra: { url: 'https://docs.kernel.org/core-api/mm-api.html#readahead', label: 'Memory management APIs: Readahead' },
        'abi-ra': abi('read_ahead_kb'),
      },
    },
    {
      id: 'merging-requests',
      title: 'Merging requests',
      oneLine: 'Reads and writes to neighbouring parts of a disk can travel as one larger request. One setting decides whether the kernel tries to merge them.',
      picture: {
        text: 'Three parcels go to the same street. The post office bundles them into one delivery, so the van makes one trip. Checking each new parcel for a match takes the clerk a moment.',
        limit: 'A clerk sees an address at a glance. The kernel has to look through its queue, and under random loads that look finds nothing.',
      },
      figure: {
        kind: 'stack',
        title: 'Three neighbouring reads',
        layers: [
          {
            id: 'arrive',
            label: 'Requests that arrive',
            kind: 'nodes',
            nodes: [
              { id: 'r1', text: 'Sectors 3 to 6' },
              { id: 'r2', text: 'Sectors 6 to 7' },
              { id: 'r3', text: 'Sectors 7 to 9' },
            ],
          },
          {
            id: 'modes',
            label: 'queue/nomerges',
            kind: 'bands',
            bands: [
              { id: 'all', text: '0: every kind of merge is tried, the default' },
              { id: 'simple', text: '1: only the one-shot merge with the previous request' },
              { id: 'off', text: '2: no merging' },
            ],
          },
          {
            id: 'result',
            label: 'What the disk gets',
            kind: 'nodes',
            nodes: [
              { id: 'merged', text: 'One request', sub: 'sectors 3 to 9, when merged' },
              { id: 'separate', text: 'Three requests', sub: 'when merging is off' },
            ],
          },
          { id: 'disks', label: 'Merging on each disk', kind: 'nodes', nodes: disks('Nomerges') },
        ],
      },
      body: [
        'The software staging queues can merge requests for neighbouring [[sectors|sector]]. Requests for sectors 3 to 6, 6 to 7 and 7 to 9 can become one request for 3 to 9[^staging]. That means fewer requests, even on flash, where random access costs no more than reading in order[^staging].',
        'For loads known to be random, merge tries always fail and spend extra CPU time in the kernel[^abi-nm]. nomerges turns them off in steps. At 1 only the one-shot merge with the previous request stays, and at 2 nothing is tried. 0, the default, tries every kind[^abi-nm].',
        'The kernel counts merges for every disk. Fields 2 and 6 of `/sys/block/<disk>/stat` count the reads and writes it merged[^iostats].',
      ],
      pins: [
        { key: 'nomerges', layer: 'modes', here: 'Whether the kernel tries to merge neighbouring requests. Keep 0; try 1 only on a fast NVMe drive under purely random I/O at very high request rates.' },
      ],
      choose: [
        {
          q: 'Is this a fast NVMe drive serving only random I/O at very high request rates?',
          check: 'cat /sys/block/nvme0n1/stat',
          hint: 'Fields 2 and 6 count merged reads and writes. If they barely grow while the drive is busy, merge tries are mostly failing.',
          yes: { key: 'nomerges', dir: 'raise' },
          no: { leave: true, why: 'Merging means fewer, larger requests whenever reads or writes sit next to each other.' },
        },
      ],
      symptoms: {
        low: 'Under purely random loads, CPU time goes to merge checks that always fail.',
        high: 'Reads and writes in order reach the disk as many small requests.',
      },
      look: {
        cmd: 'grep -H . /sys/block/*/queue/nomerges',
        for: 'Each line names a disk and its mode: 0 tries every merge, 1 only the simple one, 2 none.',
      },
      sources: {
        staging: blkMq('software-staging-queues', 'Software staging queues'),
        'abi-nm': abi('nomerges'),
        iostats: { url: 'https://docs.kernel.org/admin-guide/iostats.html', label: 'I/O statistics fields' },
      },
    },
  ],
}
