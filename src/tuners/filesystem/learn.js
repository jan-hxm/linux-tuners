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
const procSysFs = () => man(5, 'proc_sys_fs', 'DESCRIPTION', 'proc_sys_fs(5): description')
const inotify = () => man(7, 'inotify', 'DESCRIPTION', 'inotify(7): description')
const inotifyNotes = () => man(7, 'inotify', 'NOTES', 'inotify(7): notes')

/**
 * One busy machine behind the examples: the idle test guest holds almost no
 * open files, watches or async I/O slots, so these show what a loaded one
 * might look like. The page says they are examples. The limits stay measured.
 */
const BUSY = {
  openFiles: { example: 12000, unit: 'files', label: "Busy server's open files" },
  ideWatches: { example: 60000, unit: '', label: 'A big IDE project' },
  queued: { example: 9000, unit: 'events', label: 'Events waiting now' },
  aioSlots: { example: 20000, unit: 'slots', label: "Database's reserved slots" },
}

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
      { id: 'process-limit', title: 'Per-process limit', does: 'How many files one program may hold open, never above `fs.nr_open`.', col: 2, row: 1, probe: 'filesystem.nrOpen' },
      { id: 'file-table', title: 'System-wide table', does: 'One entry for every open file on the machine, capped by `fs.file-max`.', col: 3, row: 1, probe: 'filesystem.fileNr', tone: 'fit' },
      { id: 'watch-programs', title: 'Programs that watch files', does: 'Editors, sync tools and dev servers that want to hear about changes.', col: 1, row: 2 },
      { id: 'watches', title: 'inotify instances and watches', does: 'Each instance holds watches on files and directories, and both are counted per user.', col: 2, row: 2, probe: 'filesystem.inotifyDir', tone: 'fit' },
      { id: 'event-queue', title: 'Event queue', does: 'Changes wait here until the program reads them, and a full queue drops events.', col: 3, row: 2, probe: 'filesystem.maxQueuedEvents' },
      { id: 'aio-programs', title: 'Programs queuing disk I/O', does: 'Programs, often databases, that ask for many reads and writes at once.', col: 1, row: 3 },
      { id: 'aio-slots', title: 'Request slots', does: 'Slots reserved with `io_setup()`, counted across the machine and capped by `fs.aio-max-nr`.', col: 2, row: 3, probe: 'filesystem.aioNr', tone: 'fit' },
    ],
    bands: [
      { label: 'Open files', rows: [1, 1] },
      { label: 'Watching', rows: [2, 2] },
      { label: 'Async I/O', rows: [3, 3] },
    ],
    edges: [
      { from: 'open-programs', to: 'process-limit', label: 'open() is checked' },
      { from: 'process-limit', to: 'file-table', label: 'files take entries' },
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
        kind: 'compare',
        title: 'Files a busy server holds open, against the highest hard limit',
        axis: 'open files',
        scale: 'log',
        groups: [
          { id: 'program', label: 'Per program', does: 'Each program has its own soft and hard limit, and no hard limit can go above `fs.nr_open`.' },
          { id: 'machine', label: 'Whole machine', does: 'One table holds every open file of every program.' },
        ],
        bars: [
          { id: 'nr-open', label: 'Highest hard limit', group: 'program', value: { probe: 'filesystem.nrOpen', unit: 'files' }, does: "The ceiling for any program's hard limit, set by `fs.nr_open`." },
          { id: 'file-max', label: "Busy server's open files", group: 'machine', tone: 'fit', value: BUSY.openFiles, does: 'An example total, capped by `fs.file-max`, which reads as no practical limit on most test kernels.' },
        ],
        pins: [
          { key: 'nr_open', bar: 'nr-open' },
          { key: 'file_max', bar: 'file-max', value: { probe: 'filesystem.fileMax', unit: 'files' } },
        ],
      },
      body: [
        'A program refers to an open file by a small number, a [[file descriptor]]. Each call to open() also creates an entry in a system-wide table of open files[^open]. The kernel enforces a soft limit on descriptors, and a hard limit is the ceiling the soft limit can be raised to[^rlimit]. A program that reaches its limit gets the error EMFILE[^rlimit].',
        'fs.nr_open puts a ceiling on how far that per-process limit can be raised[^procsys]. The ceiling holds for privileged and unprivileged programs alike[^procsys]. Its default is 1048576[^nr-open]. Trying to raise a hard limit above it fails with EPERM[^rlimit-err].',
        'fs.file-max limits open files for all programs together[^procsys]. Calls that hit it fail with ENFILE, and the kernel log shows a line starting "VFS: file-max limit"[^file-max]. Processes with CAP_SYS_ADMIN can override it[^procsys].',
      ],
      pins: [
        { key: 'nr_open', layer: 'nr-open', here: "The highest value a program's open-file limit can be raised to. Most machines don't need to change this. Keep it at or above the default." },
        { key: 'file_max', layer: 'file-max', here: 'How many files all programs together may have open. Raise it when the log reports the limit reached. Keep it well above the number in use.' },
      ],
      choose: [
        {
          q: 'Do programs fail with "Too many open files in system", or does the kernel log say the file-max limit was reached?',
          check: 'cat /proc/sys/fs/file-nr',
          hint: 'The first number is the files open now and the third is the limit. A first number close to the third means the table is nearly full.',
          yes: { key: 'file_max', dir: 'raise' },
        },
        {
          q: 'Does a program need an open-file limit above fs.nr_open?',
          check: 'sysctl fs.nr_open',
          hint: "No hard limit can be raised above this number, root included. Raising it changes no program's limit by itself: that program's hard limit must be raised too.",
          yes: { key: 'nr_open', dir: 'raise' },
          no: { leave: true, why: 'The defaults are enough until a program asks for more files than they allow.' },
        },
      ],
      symptoms: {
        low: 'Programs fail to open files with "Too many open files in system", even the login you need to fix it.',
        high: 'Nothing visible. A limit only matters when programs open that many files.',
      },
      look: {
        cmd: 'cat /proc/sys/fs/file-nr',
        for: 'Three numbers: files open now, free entries (always 0 since Linux 2.6), and the fs.file-max limit.',
      },
      sources: {
        open: man(2, 'open', 'DESCRIPTION', 'open(2): description'),
        rlimit: man(2, 'getrlimit', 'DESCRIPTION', 'getrlimit(2): description'),
        'rlimit-err': man(2, 'getrlimit', 'ERRORS', 'getrlimit(2): errors'),
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
        kind: 'compare',
        title: 'What one user may hold: watchers and what they watch',
        axis: 'per user',
        scale: 'log',
        bars: [
          { id: 'instances', label: 'Watchers (instances)', value: { probe: 'filesystem.maxUserInstances', unit: '' }, does: 'Each running watcher takes at least one inotify instance, with its own event queue.' },
          { id: 'watches', label: 'Watched files and folders', tone: 'fit', value: { probe: 'filesystem.maxUserWatches', unit: '' }, does: 'Each watch names one file or directory, and a directory watch is not recursive.' },
          { id: 'ide', label: 'A big IDE project', tone: 'error', value: BUSY.ideWatches, does: 'An example: one watch for every folder and file of a big project can pass the limit.' },
        ],
        pins: [
          { key: 'max_user_instances', bar: 'instances' },
          { key: 'max_user_watches', bar: 'watches' },
        ],
      },
      body: [
        '[[inotify]] lets a program ask the kernel to report events on files and directories[^inotify]. Calling inotify_init(2) creates an instance with its own event queue and returns a file descriptor[^init]. The program then adds watches, each naming a file or directory and the events it wants[^add].',
        'Watching a directory is not recursive. To follow subdirectories, the program must add a watch for each one[^notes]. A tool that follows a big source tree therefore needs many watches.',
        'Both limits count per user[^inotify]. A user over the instance limit gets EMFILE from inotify_init(2)[^init-err]. Over the watch limit, inotify_add_watch(2) fails with ENOSPC, which also covers the kernel failing to allocate what it needs[^add-err].',
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
        notes: inotifyNotes(),
        init: man(2, 'inotify_init', 'DESCRIPTION', 'inotify_init(2): description'),
        'init-err': man(2, 'inotify_init', 'ERRORS', 'inotify_init(2): errors'),
        add: man(2, 'inotify_add_watch', 'DESCRIPTION', 'inotify_add_watch(2): description'),
        'add-err': man(2, 'inotify_add_watch', 'ERRORS', 'inotify_add_watch(2): errors'),
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
        kind: 'gauge',
        title: "Events waiting in one watcher's queue, up to the limit",
        axis: 'queued events',
        marks: [
          { id: 'queue-limit', label: 'Queue limit', tone: 'error', value: { probe: 'filesystem.maxQueuedEvents', unit: 'events' }, does: 'Past it the kernel drops events and sends one overflow event instead.' },
        ],
        zones: [
          { id: 'room', label: 'room in the queue', to: 'queue-limit', tone: 'fit', does: 'Events wait here until the program reads them.' },
          { id: 'overflow', label: 'events dropped', from: 'queue-limit', tone: 'error', does: 'The queue is full, so new events are dropped and the program gets an overflow event.' },
        ],
        // The tank filled to an example amount, below the measured limit.
        level: { label: 'example fill', value: BUSY.queued, does: 'An example queue partway through a burst: room is left, but a slow reader is falling behind.' },
        // Schematic: level 1 is the queue limit, as measured.
        curve: {
          points: [[0, 0.05], [0.2, 0.05], [0.4, 0.5], [0.55, 1], [0.7, 1], [0.85, 0.3], [1, 0.05]],
          events: [
            { at: 0.2, label: 'a burst starts' },
            { at: 0.55, label: 'the queue is full', tone: 'error', does: 'The queue reached the limit, so further events are dropped.' },
            { at: 0.85, label: 'the program caught up', tone: 'fit', does: 'The program has read the queue down.' },
          ],
        },
        pins: [{ key: 'max_queued_events', mark: 'queue-limit' }],
      },
      body: [
        "When a watched file changes, the kernel adds an event to the instance's queue. The program reads the events with read(2)[^inotify]. If successive events are identical and the older is still unread, they are merged into one[^notes]. That is why a program cannot use inotify to count file events reliably[^notes].",
        'fs.inotify.max_queued_events is the upper limit on events in a queue. The kernel reads it when a program calls inotify_init(2), so it sets the limit of each new queue[^inotify]. Events beyond the limit are dropped, but an IN_Q_OVERFLOW event is always generated[^inotify].',
        'The overflow event names no watch, so the program learns that events were lost but not which ones[^inotify]. A careful program then rescans what it watches[^notes]. A larger limit gives a slow reader more room before that happens.',
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
        notes: inotifyNotes(),
      },
    },
    {
      id: 'async-io',
      title: 'Asynchronous I/O',
      oneLine: 'Programs such as databases reserve request slots before they queue reads and writes. One setting caps the slots reserved across the whole machine.',
      picture: {
        text: 'A restaurant takes table reservations before guests arrive. Each booking holds seats for a number of people. The restaurant stops taking bookings once all its bookable seats are promised.',
        limit: 'Real seats take floor space. Here the limit is a counter, and raising it sets nothing aside.',
      },
      figure: {
        kind: 'gauge',
        title: 'Async I/O request slots reserved, up to the cap',
        axis: 'slots reserved',
        marks: [
          { id: 'aio-nr', label: "Database's reserved slots", value: BUSY.aioSlots, does: 'An example: the running total of slots a database reserved with `io_setup()` calls.' },
          { id: 'cap', label: 'The cap', tone: 'error', value: { probe: 'filesystem.aioMaxNr', unit: 'slots' }, does: 'An `io_setup()` call that would pass it fails with EAGAIN.' },
        ],
        zones: [
          { id: 'free', label: 'slots still free', from: 'aio-nr', to: 'cap', tone: 'fit', does: 'A new `io_setup()` call succeeds while it stays below the cap.' },
          { id: 'refused', label: 'requests refused', from: 'cap', tone: 'error', does: 'Calls that would pass the cap fail with EAGAIN.' },
        ],
        pins: [{ key: 'aio_max_nr', mark: 'cap' }],
      },
      body: [
        'With [[native async I/O|native-aio]], a program first calls io_setup(2) to create a context able to process n operations at once[^io].',
        'fs.aio-nr is the running total of events asked for by io_setup calls across all active contexts[^procsys]. fs.aio-max-nr is the highest value it may reach. An io_setup call that would take aio-nr past it fails with EAGAIN[^aio][^io-err].',
        'Raising fs.aio-max-nr does not preallocate or resize any kernel data structures[^aio]. Since every program counts toward one total, several databases on one host can reach the limit together, though none would alone[^procsys].',
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
        'io-err': man(2, 'io_setup', 'ERRORS', 'io_setup(2): errors'),
        procsys: procSysFs(),
        aio: fs('aio-nr-aio-max-nr', 'aio-nr and aio-max-nr'),
      },
    },
  ],
}
