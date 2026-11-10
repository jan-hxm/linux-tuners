/**
 * The System V IPC study guide at /learn/ipc: four chapters, one per kind of
 * object the sysv-ipc tuner's six settings limit. Data in the frozen Guide
 * shape (src/learn/schema.js), checked by src/learn/contract.test.js. Probe
 * ids name entries in ./probes.js; a few bars are examples of a busy machine,
 * which the page says are examples (the settings' defaults stay measured); `[^id]` marks point into each chapter's
 * `sources`; `[[term]]` names an entry in ui/glossary.js.
 */

const KERNEL = 'https://docs.kernel.org/admin-guide/sysctl/kernel.html'
const kernel = (anchor, name) => ({ url: `${KERNEL}#${anchor}`, label: `sysctl/kernel: ${name}` })
const man = (section, page, anchor, label) => ({
  url: `https://man7.org/linux/man-pages/man${section}/${page}.${section}.html${anchor ? `#${anchor}` : ''}`,
  label: `${page}(${section}): ${label}`,
})
const SYSVIPC = man(7, 'sysvipc', 'DESCRIPTION', 'Description')
const PROC_KERNEL = man(5, 'proc_sys_kernel', 'DESCRIPTION', 'kernel files')
const PROC_SYSVIPC = man(5, 'proc_sysvipc', 'DESCRIPTION', '/proc/sysvipc')

export const LEARN = {
  slug: 'ipc',
  title: 'How Linux programs share memory and messages',
  lead: 'Follow the three tools programs use to work together on one machine, and see which limit the kernel puts on each. Most machines never need to change any of them.',
  minutes: 10,
  parts: {
    picture:
      'Programs on one machine sometimes need to work together. [[System V IPC|sysv-ipc]] gives them three tools: a block of memory they share, a counter to take turns, and a mailbox for messages. The kernel keeps count of each kind and stops at a limit.',
    cards: [
      { id: 'sharers', title: 'Programs that share data', does: 'Read and write the same block of memory.', col: 1, row: 1 },
      { id: 'waiters', title: 'Programs taking turns', does: 'Wait on a counter until it is their turn.', col: 2, row: 1 },
      { id: 'senders', title: 'Programs that send notes', does: 'Leave messages for another program to read later.', col: 3, row: 1 },
      { id: 'segment', title: 'Shared memory segment', does: 'A block of memory that several programs use at once.', col: 1, row: 2, probe: 'sysv-ipc.sysvipcShm' },
      { id: 'semaphores', title: 'Semaphore set', does: 'A group of counters that programs change in one step.', col: 2, row: 2, probe: 'sysv-ipc.sysvipcSem' },
      { id: 'queue', title: 'Message queue', does: 'A mailbox where messages wait until a program reads them.', col: 3, row: 2, probe: 'sysv-ipc.sysvipcMsg' },
      { id: 'segment-limit', title: 'Segment limit', does: 'How many segments may exist at once.', col: 1, row: 3, probe: 'sysv-ipc.shmmni' },
      { id: 'semaphore-limits', title: 'Semaphore limits', does: 'Four numbers: per set, in total, per call and how many sets.', col: 2, row: 3, probe: 'sysv-ipc.sem' },
      { id: 'queue-limits', title: 'Queue limits', does: 'How many queues, how long a message, how big a queue.', col: 3, row: 3, probe: 'sysv-ipc.msgmni' },
    ],
    bands: [
      { label: 'Programs', rows: [1, 1] },
      { label: 'Kernel objects', rows: [2, 2] },
      { label: 'Limits', rows: [3, 3] },
    ],
    edges: [
      { from: 'sharers', to: 'segment', label: 'use' },
      { from: 'waiters', to: 'semaphores', label: 'change' },
      { from: 'senders', to: 'queue', label: 'send to' },
      { from: 'segment', to: 'segment-limit', label: 'counted against' },
      { from: 'semaphores', to: 'semaphore-limits', label: 'counted against' },
      { from: 'queue', to: 'queue-limits', label: 'counted against' },
    ],
  },
  chapters: [
    {
      id: 'shared-memory',
      title: 'Shared memory segments',
      oneLine: 'Programs can share a block of memory instead of copying data. The kernel counts these blocks, and one setting caps how many may exist at once.',
      picture: {
        text: 'A whiteboard hangs in a corridor between two offices. Anyone who knows where it is can read it or write on it, so nobody carries notes back and forth. The building keeps a register of whiteboards, and the register has a fixed number of lines.',
        limit: 'A whiteboard has one writer at a time by habit. Shared memory does not make programs take turns, so they often pair it with the counters in a later chapter.',
      },
      figure: {
        kind: 'compare',
        title: 'The segment count limit',
        axis: 'segments',
        scale: 'log',
        bars: [
          {
            id: 'segments',
            label: 'Segments allowed',
            tone: 'fit',
            value: { probe: 'sysv-ipc.shmmni', unit: 'segments' },
            does: 'The most segments at once; shmmax and shmall are not offered, as both default to no limit.',
          },
          { id: 'database', label: 'A database uses', value: { example: 300, unit: 'segments', label: 'Segments a database uses' }, does: 'An example of a busy database server, well inside the limit.' },
        ],
        pins: [{ key: 'shmmni', bar: 'segments' }],
      },
      body: [
        'Shared memory lets several programs use one region of memory[^sysv]. A program asks for a [[segment|shm-segment]] with `shmget()`. The call returns the identifier of the segment for a given key, and a new segment starts filled with zeros[^shmget].',
        'The kernel keeps a list of segments. `kernel.shmmni` is the most segments that may exist at once, 4096 by default[^shmmni]. When the list is full, `shmget()` fails with the error ENOSPC[^shmget-err]. The file `/proc/sysvipc/shm` shows the segments that exist, one per line[^procsysvipc].',
        'Two older limits barely matter now. `kernel.shmmax` caps the size of one segment, and `kernel.shmall` caps all segments together, counted in pages[^shmmax][^shmall]. Since Linux 3.16 both default to effectively no limit[^shmget-notes], so this tuner does not offer them.',
      ],
      pins: [
        { key: 'shmmni', layer: 'segments', here: 'The most segments that may exist at once. A full list makes shmget() fail with ENOSPC. Raise it only when software you run asks for more. Most machines don\'t need to change this.' },
      ],
      choose: [
        {
          q: 'Does a program fail with ENOSPC when it creates a shared memory segment?',
          check: 'cat /proc/sysvipc/shm',
          hint: 'Each line after the header is one segment. Compare the count with `sysctl kernel.shmmni`. ENOSPC here means a limit was reached, not that a disk is full.',
          yes: { key: 'shmmni', dir: 'raise' },
          no: { leave: true, why: 'Nothing points at this limit, so keep the kernel default.' },
        },
      ],
      symptoms: {
        low: 'Programs that create a segment fail with ENOSPC once the list is full.',
        high: 'Nothing you can see. The limit only allows more segments, it does not create any.',
      },
      look: {
        cmd: 'cat /proc/sysvipc/shm',
        for: 'One line per segment after the header line. Count them and compare with `sysctl kernel.shmmni`.',
      },
      sources: {
        sysv: SYSVIPC,
        shmget: man(2, 'shmget', 'DESCRIPTION', 'Description'),
        'shmget-err': man(2, 'shmget', 'ERRORS', 'Errors'),
        'shmget-notes': man(2, 'shmget', 'NOTES', 'Notes'),
        shmmni: kernel('shmmni', 'shmmni'),
        shmmax: kernel('shmmax', 'shmmax'),
        shmall: kernel('shmall', 'shmall'),
        procsysvipc: PROC_SYSVIPC,
      },
    },
    {
      id: 'forgotten-segments',
      title: 'Segments nobody removed',
      oneLine: 'A shared memory segment can outlive every program that used it. One setting removes a segment once nothing uses it any more.',
      picture: {
        text: 'A whiteboard stays in the corridor after everyone has left the building, until someone takes it down. One option is a house rule: once the last person walks away from a board, the cleaners remove it.',
        limit: 'The cleaners cannot tell a forgotten board from one a colleague means to come back to. The kernel cannot either, so the rule can remove a board somebody still wanted.',
      },
      figure: {
        kind: 'modes',
        title: 'Removal of unused segments',
        rows: [
          {
            id: 'rmid',
            label: 'Remove when unused',
            pin: 'shm_rmid_forced',
            value: { probe: 'sysv-ipc.shmRmidForced', unit: '' },
            options: [
              { value: 0, label: 'Off', does: 'A segment stays until someone removes it, even with nobody attached.' },
              { value: 1, label: 'On', does: 'The kernel destroys a segment once its last program detaches or exits.' },
            ],
          },
        ],
      },
      body: [
        'A segment is not tied to the programs that use it. Removing one with `shmctl()` marks it for destruction, and the kernel destroys it only after every program has detached[^shmctl]. If nobody removes it, the pages it used stay in memory or swap[^shmctl].',
        'The `ipcrm` tool removes a segment by hand, as root or as the segment\'s creator or owner. The segment still goes only after every attached program has detached[^ipcrm].',
        'When `kernel.shm_rmid_forced` is 1, the kernel destroys a segment once its attach count reaches zero, after a detach or when a process ends. It also destroys segments that were created but never attached, when the creating process exits[^rmid]. The manual page warns that this can break applications[^proc-kernel].',
      ],
      pins: [
        { key: 'shm_rmid_forced', layer: 'rmid', here: 'Off by default. On, the kernel destroys a segment when its last user leaves. That frees forgotten ones but breaks software that leaves a segment for a later program. Leave it off unless you know the software.' },
      ],
      choose: [
        {
          q: 'Did software start failing to find a segment after you turned this setting on?',
          check: 'sysctl kernel.shm_rmid_forced',
          hint: 'A value of 1 means segments are destroyed once nothing is attached. A program that creates a segment and exits loses it.',
          yes: { key: 'shm_rmid_forced', dir: 'lower' },
        },
        {
          q: 'Do segments with nobody attached pile up after crashes or logouts?',
          check: 'cat /proc/sysvipc/shm',
          hint: 'The header names the columns. A segment whose nattch is 0 has no program attached.',
          yes: { key: 'shm_rmid_forced', dir: 'raise' },
          no: { leave: true, why: 'Nothing leaks and nothing needs cleaning up, so keep the default of off.' },
        },
      ],
      symptoms: {
        low: 'Segments with nobody attached pile up after crashes and keep their memory until someone removes them.',
        high: 'A program cannot find a segment another program created, because the kernel destroyed it once nothing was attached.',
      },
      look: {
        cmd: 'cat /proc/sysvipc/shm',
        for: 'The header names the columns. A segment whose nattch is 0 has no program attached.',
      },
      sources: {
        shmctl: man(2, 'shmctl', 'DESCRIPTION', 'Description'),
        ipcrm: man(1, 'ipcrm', 'DESCRIPTION', 'Description'),
        rmid: kernel('shm-rmid-forced', 'shm_rmid_forced'),
        'proc-kernel': PROC_KERNEL,
      },
    },
    {
      id: 'semaphores',
      title: 'Taking turns with semaphores',
      oneLine: 'Programs use semaphores to take turns. One setting holds four limits: semaphores in a set, in total, operations per call, and how many sets.',
      picture: {
        text: 'A car park has a sign that shows the free spaces. A car takes a space when it enters and gives it back when it leaves. At zero the next car waits at the barrier. The sign is the semaphore, and the cars are programs.',
        limit: 'A car park has one sign. The kernel groups semaphores into sets, and a program can change several signs of a set in one step.',
      },
      figure: {
        kind: 'compare',
        title: 'The four semaphore limits',
        axis: 'count',
        scale: 'log',
        bars: [
          { id: 'per-set', label: 'Per set', value: { probe: 'sysv-ipc.sem', path: '0', unit: '', label: 'SEMMSL' }, does: 'SEMMSL: the most semaphores in one set.' },
          { id: 'in-total', label: 'In total', value: { probe: 'sysv-ipc.sem', path: '1', unit: '', label: 'SEMMNS' }, does: 'SEMMNS: the most semaphores in all sets together.' },
          { id: 'per-call', label: 'Per call', value: { probe: 'sysv-ipc.sem', path: '2', unit: '', label: 'SEMOPM' }, does: 'SEMOPM: the most operations in one semop() call.' },
          { id: 'sets', label: 'Sets', value: { probe: 'sysv-ipc.sem', path: '3', unit: '', label: 'SEMMNI' }, does: 'SEMMNI: the most semaphore sets.' },
        ],
        pins: [{ key: 'sem', bar: 'per-set' }],
      },
      body: [
        'A [[semaphore]] is a counter that programs use to take turns. Semaphores come in groups called sets, and `semop()` applies operations to one set[^semop]. Adding to a counter never blocks. Taking away more than it holds makes the caller wait[^semop]. The operations of one call happen together or not at all[^semop].',
        '`kernel.sem` holds four limits, in this order[^sem]. SEMMSL is the most semaphores in one set. SEMMNS is the most in all sets together. SEMOPM is the most operations in one `semop()` call. SEMMNI is the most sets[^sem].',
        'Going over a limit makes a call fail. `semget()` fails with EINVAL for too many semaphores in a set, and with ENOSPC past SEMMNI or SEMMNS[^semget-err]. `semop()` fails with E2BIG past SEMOPM[^semop-err]. Before Linux 3.19 SEMMSL, SEMOPM and SEMMNI defaulted to 250, 32 and 128; now they are 32000, 500 and 32000[^semget-notes][^semop-notes].',
      ],
      pins: [
        { key: 'sem', layer: 'per-set', here: 'Four numbers: SEMMSL, SEMMNS, SEMOPM, SEMMNI, in that order. Write all four. Old installation guides list numbers below the defaults, which only lower the limits. Raise one only when software asks.' },
      ],
      choose: [
        {
          q: 'Did you copy numbers such as 250 32000 32 128 from an old installation guide?',
          check: 'sysctl kernel.sem',
          hint: 'The four numbers are SEMMSL, SEMMNS, SEMOPM and SEMMNI. Before Linux 3.19 the defaults were 250, 32 and 128 for the first, third and fourth, so old guides list small numbers.',
          yes: { key: 'sem', dir: 'raise' },
        },
        {
          q: 'Does a program stop with ENOSPC, EINVAL or E2BIG from a semaphore call?',
          check: 'cat /proc/sysvipc/sem',
          hint: 'Each line after the header is one set. Compare the count with SEMMNI in `sysctl kernel.sem`.',
          yes: { key: 'sem', dir: 'raise' },
          no: { leave: true, why: 'Nothing points at the semaphore limits, so keep the kernel defaults.' },
        },
      ],
      symptoms: {
        low: 'A semaphore call fails with ENOSPC, EINVAL or E2BIG, and the program stops with a semaphore error.',
        high: 'Nothing you can see. The limits only allow more, they do not create any.',
      },
      look: {
        cmd: 'sysctl kernel.sem',
        for: 'Four numbers: SEMMSL, SEMMNS, SEMOPM and SEMMNI, in that order.',
      },
      sources: {
        semop: man(2, 'semop', 'DESCRIPTION', 'Description'),
        'semop-err': man(2, 'semop', 'ERRORS', 'Errors'),
        'semop-notes': man(2, 'semop', 'NOTES', 'Notes'),
        'semget-err': man(2, 'semget', 'ERRORS', 'Errors'),
        'semget-notes': man(2, 'semget', 'NOTES', 'Notes'),
        sem: PROC_KERNEL,
      },
    },
    {
      id: 'message-queues',
      title: 'Message queues',
      oneLine: 'Programs can leave each other messages in a queue. Three settings cap how many queues exist, how long one message may be, and how much a queue holds.',
      picture: {
        text: 'A shelf of pigeonholes in an office. Anyone can drop a note in a slot, and the owner collects it later. The shelf has a fixed number of slots, each slot holds only so much, and no note may be longer than a page.',
        limit: 'A slot is full when it runs out of room. A queue is measured in bytes of message text, so a few long messages fill it as fast as many short ones.',
      },
      figure: {
        kind: 'compare',
        title: 'Message and queue sizes',
        axis: 'bytes',
        scale: 'linear',
        bars: [
          { id: 'typical', label: 'A typical message', value: { example: 2048, unit: 'bytes', label: 'A typical message' }, does: 'An example of a message a program sends: far below the longest one allowed.' },
          { id: 'message', label: 'One message', value: { probe: 'sysv-ipc.msgmax', unit: 'bytes', label: 'msgmax' }, does: 'The longest text one message may carry.' },
          {
            id: 'queue',
            label: 'One queue',
            tone: 'fit',
            value: { probe: 'sysv-ipc.msgmnb', unit: 'bytes', label: 'msgmnb' },
            does: 'What a new queue holds; msgmni, the count of queues, is a count and is not drawn.',
          },
        ],
        pins: [
          { key: 'msgmax', bar: 'message' },
          { key: 'msgmnb', bar: 'queue' },
          { key: 'msgmni', bar: 'queue', value: { probe: 'sysv-ipc.msgmni', unit: '' } },
        ],
      },
      body: [
        'System V message queues let programs exchange data as separate messages[^sysv]. `msgget()` makes a queue and `msgsnd()` adds a message to one[^msgget][^msgsnd]. All three limits here are set per [[IPC namespace|namespace]][^limits].',
        '`kernel.msgmni` is the most queues that may exist, 32000 by default. `msgget()` fails with ENOSPC when a new queue would pass it[^msgget-err][^msgget-notes]. `kernel.msgmax` is the longest message text, 8192 bytes by default, and a longer message fails with EINVAL[^limits][^msgsnd-err].',
        '`kernel.msgmnb` is the size a new queue starts with, 16384 bytes by default[^msgget][^limits]. When a queue is full, `msgsnd()` waits, or fails with EAGAIN if the program asked not to wait[^msgsnd]. Raising one queue above msgmnb needs the capability CAP_SYS_RESOURCE[^msgctl].',
      ],
      pins: [
        { key: 'msgmni', layer: 'queue', here: 'The most queues that may exist at once. A new queue past it fails with ENOSPC. Raise it only when software asks, since the default is already large.' },
        { key: 'msgmax', layer: 'message', here: 'The longest message text one send may carry, in bytes. A longer one fails with EINVAL. Keep it at or below msgmnb, or a large message may never fit in a queue.' },
        { key: 'msgmnb', layer: 'queue', here: 'How many bytes a new queue holds before senders wait. Higher lets more pile up, and every full queue takes more memory. Raise it only when software asks.' },
      ],
      choose: [
        {
          q: 'Does sending one large message fail with EINVAL?',
          check: 'sysctl kernel.msgmax',
          hint: 'Compare the size your program sends with this number in bytes. A longer message is refused.',
          yes: { key: 'msgmax', dir: 'raise' },
        },
        {
          q: 'Do senders wait, or fail with EAGAIN, while a queue stays full?',
          check: 'sysctl kernel.msgmnb',
          hint: 'A larger queue buys time when readers are briefly slow. It does not help if readers never catch up.',
          yes: { key: 'msgmnb', dir: 'raise' },
        },
        {
          q: 'Does a program fail with ENOSPC when it creates a new queue?',
          check: 'cat /proc/sysvipc/msg',
          hint: 'Each line after the header is one queue. Compare the count with `sysctl kernel.msgmni`.',
          yes: { key: 'msgmni', dir: 'raise' },
          no: { leave: true, why: 'Nothing points at the message limits, so keep the kernel defaults.' },
        },
      ],
      symptoms: {
        low: 'A long message is refused with EINVAL, senders wait on a full queue, or a new queue fails with ENOSPC.',
        high: 'Each queue may hold more, so messages waiting in queues can take more memory in total.',
      },
      look: {
        cmd: 'cat /proc/sysvipc/msg',
        for: 'One line per queue after the header line. Count them and compare with `sysctl kernel.msgmni`.',
      },
      sources: {
        sysv: SYSVIPC,
        msgget: man(2, 'msgget', 'DESCRIPTION', 'Description'),
        'msgget-err': man(2, 'msgget', 'ERRORS', 'Errors'),
        'msgget-notes': man(2, 'msgget', 'NOTES', 'Notes'),
        msgsnd: man(2, 'msgsnd', 'DESCRIPTION', 'Description'),
        'msgsnd-err': man(2, 'msgsnd', 'ERRORS', 'Errors'),
        msgctl: man(2, 'msgctl', 'DESCRIPTION', 'Description'),
        limits: kernel('msgmax-msgmnb-and-msgmni', 'msgmax, msgmnb and msgmni'),
      },
    },
  ],
}
