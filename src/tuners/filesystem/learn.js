/**
 * The file limits study guide at /learn/file-limits: four chapters down the
 * limits the filesystem tuner's six settings set. Data in the frozen Guide
 * shape (src/learn/schema.js), checked by src/learn/contract.test.js. Probe
 * ids name entries in ./probes.js; `[^id]` marks point into each chapter's
 * `sources`; `[[term]]` names an entry in ui/glossary.js.
 */

const FS = 'https://docs.kernel.org/admin-guide/sysctl/fs.html'
const MAN = 'https://man7.org/linux/man-pages'
const fs = (anchor, name) => ({ url: `${FS}#${anchor}`, label: `sysctl/fs: ${name}` })
const man = (section, page, anchor, label) => ({ url: `${MAN}/man${section}/${page}.${section}.html${anchor ? `#${anchor}` : ''}`, label })
const procSysFs = () => man(5, 'proc_sys_fs', '', 'proc_sys_fs(5)')
const inotify = () => man(7, 'inotify', '', 'inotify(7)')

export const LEARN = {
  slug: 'file-limits',
  title: 'How Linux limits open files and file watching',
  lead: 'Follow a program as it opens files, watches them for changes and queues disk requests, and see which limit stops it at each step.',
  minutes: 12,
  parts: {
    picture:
      'Think of a library with a front desk. Every book you borrow is written in a ledger. The desk limits how many books one reader may hold and how many the whole library has out. Notices, and orders for the stacks, have limits of their own.',
    cards: [
      { id: 'open-programs', title: 'Programs that open files', does: 'Open files, sockets and pipes, and read and write them.', col: 1, row: 1 },
      { id: 'process-limit', title: 'Per-process limit', does: 'How many files one program may hold open. It cannot be raised past fs.nr_open.', col: 2, row: 1, probe: 'filesystem.nrOpen' },
      { id: 'file-table', title: 'System-wide table', does: 'One entry for every open file on the machine, capped by fs.file-max.', col: 3, row: 1, probe: 'filesystem.fileNr', tone: 'fit' },
      { id: 'watch-programs', title: 'Programs that watch files', does: 'Editors, sync tools and dev servers that want to hear about changes.', col: 1, row: 2 },
      { id: 'watches', title: 'inotify instances and watches', does: 'Each instance holds watches on files and directories. Both are counted per user.', col: 2, row: 2, probe: 'filesystem.inotifyDir', tone: 'fit' },
      { id: 'event-queue', title: 'Event queue', does: 'Changes wait here until the program reads them. A full queue drops events.', col: 3, row: 2, probe: 'filesystem.maxQueuedEvents' },
      { id: 'aio-programs', title: 'Programs that queue disk requests', does: 'Databases that ask for many reads and writes at once.', col: 1, row: 3 },
      { id: 'aio-slots', title: 'Request slots', does: 'Slots reserved with io_setup(), counted across the machine and capped by fs.aio-max-nr.', col: 2, row: 3, probe: 'filesystem.aioNr', tone: 'fit' },
    ],
    bands: [
      { label: 'Open files', rows: [1, 1] },
      { label: 'Watching', rows: [2, 2] },
      { label: 'Async I/O', rows: [3, 3] },
    ],
    edges: [
      { from: 'open-programs', to: 'process-limit', label: 'each open() is checked against it' },
      { from: 'process-limit', to: 'file-table', label: 'each open file takes an entry' },
      { from: 'watch-programs', to: 'watches', label: 'add watches' },
      { from: 'watches', to: 'event-queue', label: 'changes become events' },
      { from: 'aio-programs', to: 'aio-slots', label: 'reserve slots' },
    ],
  },
  chapters: [
    {
      id: 'open-files',
      title: 'Open files',
      oneLine: 'Every open file takes a place in two counts: one for the program, one for the whole machine. Two settings cap them.',
      picture: {
        text: 'A library lets each reader hold only so many books, and keeps a ledger of every book out. A reader may ask for a higher personal limit, but never above a ceiling set by the head librarian. The ledger itself has a maximum too.',
        limit: 'Books are real objects. Open files are only entries in a table, and one file opened twice can take two entries.',
      },
      figure: {
        kind: 'stack',
        title: 'Where an open file is counted',
        layers: [
          { id: 'program', label: 'Your program', kind: 'nodes', nodes: [{ id: 'open', text: 'A program opens a file', sub: 'open(2) returns a file descriptor' }] },
          {
            id: 'process',
            label: 'Per-process limit',
            kind: 'nodes',
            nodes: [
              { id: 'soft', text: 'Soft limit', sub: 'what the kernel enforces' },
              { id: 'hard', text: 'Hard limit', sub: 'ceiling for the soft limit' },
            ],
          },
          {
            id: 'ceiling',
            label: 'Highest hard limit',
            kind: 'nodes',
            nodes: [{ id: 'nr-open', text: 'fs.nr_open', sub: 'no hard limit can go above it' }],
            values: [{ probe: 'filesystem.nrOpen', unit: 'files' }],
          },
          {
            id: 'table',
            label: 'System-wide table',
            kind: 'nodes',
            nodes: [{ id: 'entries', text: 'Open files, all programs', sub: 'capped by fs.file-max', probe: 'filesystem.fileNr' }],
            values: [{ probe: 'filesystem.fileMax', unit: 'files' }],
          },
        ],
      },
      body: [
        'A program refers to an open file by a small number, a [[file descriptor]]. Each call to open() also creates an entry in a system-wide table of open files[^open]. A program that reaches its own limit on descriptors gets the error EMFILE[^rlimit].',
        'fs.nr_open puts a ceiling on how far that per-process limit can be raised[^procsys]. The ceiling holds for privileged and unprivileged programs alike[^procsys]. Its default is 1048576[^nr-open]. Trying to raise the hard limit above it fails[^rlimit].',
        'fs.file-max limits open files for all programs together[^procsys]. Calls that hit it fail with ENFILE, and the kernel log says "VFS: file-max limit reached"[^file-max]. Processes with CAP_SYS_ADMIN can override it[^procsys].',
      ],
      pins: [
        { key: 'nr_open', layer: 'ceiling', here: "The highest value a program's open-file limit can be raised to. Most machines don't need to change this. Keep it at or above the default." },
        { key: 'file_max', layer: 'table', here: 'How many files all programs together may have open. Raise it when the log reports the limit reached. Keep it well above the number in use.' },
      ],
      choose: [
        {
          q: 'Do programs fail with "Too many open files in system", or does the kernel log say the file-max limit was reached?',
          check: 'cat /proc/sys/fs/file-nr',
          hint: 'The first number is the files open now and the third is the limit. A first number close to the third means the table is nearly full.',
          yes: { key: 'file_max', dir: 'raise' },
        },
        {
          q: 'Does a program need a per-process limit higher than the hard limit it can get?',
          check: 'grep "open files" /proc/self/limits',
          hint: 'The Hard limit column is the highest a program can set for itself. fs.nr_open is the ceiling above it.',
          yes: { key: 'nr_open', dir: 'raise' },
          no: { leave: true, why: 'The defaults are enough until a program asks for more files than they allow.' },
        },
      ],
      symptoms: {
        low: 'Programs fail to open files with "Too many open files", even the login you need to fix it.',
        high: 'Nothing visible. A limit only matters when programs open that many files.',
      },
      look: {
        cmd: 'cat /proc/sys/fs/file-nr',
        for: 'Three numbers: files open now, free entries (always 0 on current kernels), and the fs.file-max limit.',
      },
      sources: {
        open: man(2, 'open', 'DESCRIPTION', 'open(2): description'),
        rlimit: man(2, 'getrlimit', 'DESCRIPTION', 'getrlimit(2): description'),
        procsys: procSysFs(),
        'nr-open': fs('nr-open', 'nr_open'),
        'file-max': fs('file-max-file-nr', 'file-max and file-nr'),
      },
    },
    {
      id: 'watching-files',
      title: 'Watching files for changes',
      oneLine: 'A program can ask to be told when files change. The kernel caps how many instances and watches each user may create.',
      picture: {
        text: 'You hand the librarian slips asking to be told when a shelf changes. Each slip names one shelf. A person may keep only so many slips, and own only so many notice boards to receive the news.',
        limit: 'A slip covers one shelf, never the shelves inside it. Watching a whole room takes a slip for every shelf, and the kernel adds none for you.',
      },
      figure: {
        kind: 'stack',
        title: 'What a file watcher holds',
        layers: [
          { id: 'watcher', label: 'A file watcher', kind: 'nodes', nodes: [{ id: 'init', text: 'Calls inotify_init()', sub: 'gets a file descriptor' }] },
          {
            id: 'instances',
            label: 'Instances',
            kind: 'nodes',
            nodes: [{ id: 'instance', text: 'inotify instance', sub: 'has its own event queue', probe: 'filesystem.inotifyDir' }],
            values: [{ probe: 'filesystem.maxUserInstances', unit: 'per user' }],
          },
          {
            id: 'watches',
            label: 'Watches',
            kind: 'nodes',
            nodes: [
              { id: 'dir-watch', text: 'Watch on a directory', sub: 'not recursive' },
              { id: 'file-watch', text: 'Watch on a file' },
            ],
            values: [{ probe: 'filesystem.maxUserWatches', unit: 'per user' }],
          },
        ],
      },
      body: [
        '[[inotify]] lets a program ask the kernel to report events on files and directories[^inotify]. Calling inotify_init(2) creates an instance with its own event queue and returns a file descriptor[^init]. The program then adds watches, each naming a file or directory and the events it wants[^add].',
        'Watching a directory is not recursive. To follow subdirectories, the program must add a watch for each one[^inotify]. A tool that follows a big source tree therefore needs many watches.',
        'Both limits count per real user ID[^inotify]. A user over the instance limit gets EMFILE from inotify_init(2)[^init]. Over the watch limit, inotify_add_watch(2) fails with ENOSPC, which also covers the kernel failing to allocate what it needs[^add].',
      ],
      pins: [
        { key: 'max_user_watches', layer: 'watches', here: "How many files and directories one user may watch in total. Raise it when a watcher reports it cannot watch more. All of that user's watchers share it." },
        { key: 'max_user_instances', layer: 'instances', here: 'How many inotify instances one user may create. Each running watcher needs at least one. Raise it when starting another watcher fails with "Too many open files".' },
      ],
      choose: [
        {
          q: 'Does an editor, dev server or sync tool say it cannot watch more files, or "No space left on device", while the disk has room?',
          check: 'sysctl fs.inotify.max_user_watches',
          hint: 'This is the limit for one user, shared by every watcher that user runs.',
          yes: { key: 'max_user_watches', dir: 'raise' },
        },
        {
          q: 'Does starting one more watcher fail with "Too many open files" while that program has few files open?',
          check: 'sysctl fs.inotify.max_user_instances',
          hint: 'Every running watcher of one user takes at least one instance from this shared limit.',
          yes: { key: 'max_user_instances', dir: 'raise' },
          no: { leave: true, why: 'The defaults suit machines that run only a few watchers.' },
        },
      ],
      symptoms: {
        low: 'A watcher stops following new directories, or fails to start, with "No space left on device" or "Too many open files".',
        high: 'Nothing visible until programs add watches. Each added watch means the kernel tracks one more file or directory.',
      },
      look: {
        cmd: 'sysctl fs.inotify.max_user_watches fs.inotify.max_user_instances',
        for: 'The two per-user limits. Compare them with how many watchers and how large a tree your user has.',
      },
      sources: {
        inotify: inotify(),
        init: man(2, 'inotify_init', 'ERRORS', 'inotify_init(2): errors'),
        add: man(2, 'inotify_add_watch', 'ERRORS', 'inotify_add_watch(2): errors'),
      },
    },
    {
      id: 'event-queue',
      title: 'The event queue',
      oneLine: 'Changes wait in a queue until the program reads them. One setting says how long the queue may grow before the kernel drops events.',
      picture: {
        text: "News about changed shelves lands in a tray on the program's desk. The program reads it when it can. A big delivery fills the tray faster than it empties. When the tray is full, a note says so and the rest is thrown away.",
        limit: 'A tray holds paper in order. The kernel also merges identical events in a row, so the queue is not a count of what happened.',
      },
      figure: {
        kind: 'timeline',
        title: 'The event queue of one watcher during a burst of changes',
        schematic: true,
        lines: [{ id: 'queue-limit', label: 'Queue limit', value: { probe: 'filesystem.maxQueuedEvents', unit: 'events' } }],
        curve: [[0, 0.05], [0.2, 0.05], [0.4, 0.3], [0.55, 0.5], [0.7, 0.5], [0.85, 0.2], [1, 0.05]],
        events: [
          { at: 0.2, label: 'A burst of changes starts' },
          { at: 0.55, label: 'The queue is full and events are dropped', tone: 'error' },
          { at: 0.85, label: 'The program has read the queue down', tone: 'fit' },
        ],
      },
      body: [
        "When a watched file changes, the kernel adds an event to the instance's queue. The program reads the events with read(2)[^inotify]. If successive events are identical and the older is still unread, they are merged into one[^inotify]. That is why a program cannot use inotify to count file events reliably[^inotify].",
        'fs.inotify.max_queued_events is the upper limit on events in a queue. It is applied when a program calls inotify_init(2)[^inotify]. Events beyond the limit are dropped, but an IN_Q_OVERFLOW event is always generated[^inotify].',
        'A program that receives IN_Q_OVERFLOW knows its queue overflowed, though not which changes it missed. A larger limit gives a slow reader more room before that happens.',
      ],
      pins: [
        { key: 'max_queued_events', layer: 'queue-limit', here: 'How many events one queue holds before the kernel drops the rest. Raise it when a tool reports lost events. It is read when an instance is created, so restart the watcher after changing it.' },
      ],
      choose: [
        {
          q: 'Does a watching tool report that its event queue overflowed, or that it lost events during a big copy or checkout?',
          check: 'sysctl fs.inotify.max_queued_events',
          hint: 'This is the length of each queue. A tool that reads slowly, or a burst of many changes, can fill it.',
          yes: { key: 'max_queued_events', dir: 'raise' },
          no: { leave: true, why: 'The default queue is long enough while readers keep up with the changes.' },
        },
      ],
      symptoms: {
        low: 'A burst of changes overflows the queue, and the watcher misses events.',
        high: 'A slow watcher can fall further behind before any event is dropped.',
      },
      look: {
        cmd: 'sysctl fs.inotify.max_queued_events',
        for: 'The queue length of each instance created from now on.',
      },
      sources: {
        inotify: inotify(),
      },
    },
    {
      id: 'async-io',
      title: 'Asynchronous I/O',
      oneLine: 'Databases reserve request slots before they queue reads and writes. One setting caps the slots reserved across the whole machine.',
      picture: {
        text: 'A restaurant takes table reservations before guests arrive. Each booking holds seats for a number of people. The restaurant stops taking bookings once all its bookable seats are promised.',
        limit: 'Real seats take floor space. Here the limit is a counter, and raising it sets nothing aside.',
      },
      figure: {
        kind: 'stack',
        title: 'How request slots are counted',
        layers: [
          { id: 'database', label: 'A database', kind: 'nodes', nodes: [{ id: 'setup', text: 'Calls io_setup(n)', sub: 'asks for room for n operations' }] },
          {
            id: 'count',
            label: 'Slots reserved',
            kind: 'nodes',
            nodes: [{ id: 'aio-nr', text: 'fs.aio-nr', sub: 'the running total, all programs', probe: 'filesystem.aioNr' }],
            values: [{ probe: 'filesystem.aioNr', unit: 'slots' }],
          },
          {
            id: 'cap',
            label: 'The cap',
            kind: 'nodes',
            nodes: [
              { id: 'within', text: 'Below the cap', sub: 'the context is created' },
              { id: 'over', text: 'At the cap', sub: 'io_setup() fails with EAGAIN' },
            ],
            values: [{ probe: 'filesystem.aioMaxNr', unit: 'slots' }],
          },
        ],
      },
      body: [
        'With [[native async I/O|native-aio]], a program first calls io_setup(2) to create a context able to process n operations at once[^io]. Many databases use this interface.',
        'fs.aio-nr is the running total of events asked for by io_setup calls across all active contexts[^procsys]. fs.aio-max-nr is the highest value it may reach. When aio-nr reaches the limit, io_setup fails with EAGAIN[^aio].',
        'Raising fs.aio-max-nr does not preallocate or resize any kernel data structures[^aio]. Several instances on one host can add up past the limit, since all count together.',
      ],
      pins: [
        { key: 'aio_max_nr', layer: 'cap', here: 'The most request slots all programs together may reserve. Raise it when a database cannot set up async I/O. Raising it reserves nothing by itself.' },
      ],
      choose: [
        {
          q: 'Does a database report that it cannot set up asynchronous I/O, or does an io_setup call fail with EAGAIN?',
          check: 'grep . /proc/sys/fs/aio-nr /proc/sys/fs/aio-max-nr',
          hint: 'An aio-nr close to aio-max-nr means the slots are used up. Run it while the database is running.',
          yes: { key: 'aio_max_nr', dir: 'raise' },
          no: { leave: true, why: 'Programs that do not use native async I/O never touch this limit.' },
        },
      ],
      symptoms: {
        low: 'A database or other program fails to start, saying it cannot set up async I/O.',
        high: 'Nothing visible. The limit only sets a ceiling on the counter.',
      },
      look: {
        cmd: 'grep . /proc/sys/fs/aio-nr /proc/sys/fs/aio-max-nr',
        for: 'aio-nr is the slots reserved now and aio-max-nr is the cap. Programs fail at the cap.',
      },
      sources: {
        io: man(2, 'io_setup', 'DESCRIPTION', 'io_setup(2): description'),
        procsys: procSysFs(),
        aio: fs('aio-nr-aio-max-nr', 'aio-nr and aio-max-nr'),
      },
    },
  ],
}
