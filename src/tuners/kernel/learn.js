/**
 * The kernel limits study guide at /learn/kernel-limits: five chapters on the
 * process limits, key quotas, panics, Magic SysRq and console log levels that
 * the kernel tuner's nine settings act on. Data in the frozen Guide shape
 * (src/learn/schema.js), checked by src/learn/contract.test.js. Probe ids
 * name entries in ./probes.js; `[^id]` marks point into each chapter's
 * `sources`; `[[term]]` names an entry in ui/glossary.js.
 */

const SYSCTL = 'https://docs.kernel.org/admin-guide/sysctl/kernel.html'
const KEYS = 'https://docs.kernel.org/security/keys/core.html'
const sysctl = (anchor, name) => ({ url: `${SYSCTL}#${anchor}`, label: `sysctl/kernel: ${name}` })
const keys = (anchor, name) => ({ url: `${KEYS}#${anchor}`, label: `Kernel key retention service: ${name}` })
const man = (section, page, name) => ({ url: `https://man7.org/linux/man-pages/man${section}/${page}.${section}.html`, label: name })

export const LEARN = {
  slug: 'kernel-limits',
  title: 'Kernel limits, crashes and the console',
  lead: 'See what the kernel counts, what it does when it hits a fault, and which of those limits and reactions you can set.',
  minutes: 18,
  parts: {
    picture:
      'Think of the kernel as the manager of a building. It gives every worker a numbered badge and keeps a safe for each tenant. If it finds a fault in the building, it decides whether to carry on or shut up for the night.',
    cards: [
      { id: 'programs', title: 'Your programs', does: 'Start processes and threads, and store credentials as keys.', col: 1, row: 1 },
      { id: 'keys', title: 'Kernel keys', does: 'Security data the kernel keeps for each user, up to a quota.', col: 2, row: 1, probe: 'kernel.keyUsers' },
      { id: 'pids', title: 'Process IDs', does: 'A number for every process and thread. The limits say how many can exist.', col: 1, row: 2, probe: 'kernel.pidMax' },
      { id: 'kernel', title: 'The kernel itself', does: 'Runs everything, and can hit a fault in its own code.', col: 1, row: 3 },
      { id: 'console', title: 'The console', does: 'Shows the kernel messages that are urgent enough.', col: 2, row: 3, probe: 'kernel.printk' },
      { id: 'panic', title: 'Panic and reboot', does: 'Stops the machine, then reboots or waits for you.', col: 1, row: 4, probe: 'kernel.panic' },
      { id: 'sysrq', title: 'Magic SysRq', does: 'Emergency commands from the keyboard.', col: 2, row: 4, probe: 'kernel.sysrq' },
    ],
    bands: [
      { label: 'Programs', rows: [1, 1] },
      { label: 'Kernel', rows: [2, 4] },
    ],
    edges: [
      { from: 'programs', to: 'keys', label: 'store credentials' },
      { from: 'programs', to: 'pids', label: 'start processes and threads' },
      { from: 'pids', to: 'kernel', label: 'limits are checked here' },
      { from: 'kernel', to: 'console', label: 'prints messages' },
      { from: 'kernel', to: 'panic', label: 'a fault can lead to' },
      { from: 'sysrq', to: 'panic', label: 'can reboot or crash it' },
    ],
  },
  chapters: [
    {
      id: 'process-limits',
      title: 'How many processes can exist',
      oneLine: 'Every process and thread takes a number. Two settings cap how high the numbers go and how many threads may exist at once.',
      picture: {
        text: 'A cloakroom hands out numbered tickets. When the numbers run out, nobody new can leave a coat, even if the room has space. A second sign limits how many coats the room takes in total.',
        limit: 'Ticket numbers wrap around and get reused. A number is free again once its coat has left, so the cap is on numbers in use, not on tickets ever given.',
      },
      figure: {
        kind: 'stack',
        title: 'Four limits that can refuse a new process or thread',
        layers: [
          { id: 'ask', label: 'A program asks', kind: 'nodes', nodes: [{ id: 'fork', text: 'fork() or a new thread', sub: 'wants a process ID' }] },
          {
            id: 'limits',
            label: 'Limits that can say no',
            kind: 'nodes',
            nodes: [
              { id: 'user', text: 'Per-user process limit', sub: 'RLIMIT_NPROC' },
              { id: 'threads', text: 'Threads, system-wide', sub: 'kernel.threads-max', probe: 'kernel.threadsMax' },
              { id: 'pid', text: 'Highest process ID', sub: 'kernel.pid_max', probe: 'kernel.pidMax' },
              { id: 'cgroup', text: 'Group process limit', sub: 'pids.max' },
            ],
            values: [
              { probe: 'kernel.pidMax', unit: '' },
              { probe: 'kernel.threadsMax', unit: 'threads' },
            ],
          },
          { id: 'answer', label: 'The answer', kind: 'nodes', nodes: [{ id: 'eagain', text: 'EAGAIN', sub: 'the call fails, nothing is created' }] },
        ],
      },
      body: [
        'Each process and thread gets a [[process ID|pid]]. The kernel counts upward and, when the next number reaches `kernel.pid_max`, wraps back to a low one. Numbers of that value or larger are never given out[^pid]. The default is 32768, and on 64-bit it can go up to 2^22[^proc].',
        'A new process or thread can fail with the error EAGAIN for four reasons: the per-user process limit, `kernel.threads-max`, `kernel.pid_max`, or the process limit of the cgroup it belongs to[^fork]. Only the middle two are set here.',
        '`kernel.threads-max` is the system-wide cap on threads created with fork()[^threads]. At boot the kernel sizes it so that, with that many threads, their structures take at most an eighth of RAM pages. A value outside the allowed range is refused with EINVAL[^threads].',
      ],
      pins: [
        { key: 'pid_max', layer: 'pid', here: 'Where process IDs wrap, and so a ceiling on processes and threads. Raise it only when fork fails with EAGAIN near this number. Most machines don\'t need to change this.' },
        { key: 'threads_max', layer: 'threads', here: 'The system-wide thread cap, set from RAM at boot. Raise it only when it is the limit being reached. Lowering it makes new threads fail sooner.' },
      ],
      choose: [
        {
          q: 'Do programs fail to start with "Resource temporarily unavailable" while the process count is close to kernel.pid_max?',
          check: 'sysctl kernel.pid_max kernel.threads-max',
          hint: 'These are the two ceilings. Compare them with the number of processes and threads running.',
          yes: { key: 'pid_max', dir: 'raise' },
        },
        {
          q: 'Do new threads fail while the thread count is close to kernel.threads-max?',
          check: 'sysctl kernel.threads-max',
          hint: 'The value is the most threads the whole machine may have at once.',
          yes: { key: 'threads_max', dir: 'raise' },
          no: { leave: true, why: 'Both limits are sized for typical machines, and most never reach them.' },
        },
      ],
      symptoms: {
        low: 'New programs and threads fail with EAGAIN once the limit is reached, while memory is still free.',
        high: 'The limit is out of reach, so nothing visible changes.',
      },
      look: {
        cmd: 'sysctl kernel.pid_max kernel.threads-max',
        for: 'The two ceilings. Compare them with how many processes and threads the machine runs at its busiest.',
      },
      sources: {
        pid: sysctl('pid-max', 'pid_max'),
        threads: sysctl('threads-max', 'threads-max'),
        proc: man(5, 'proc_sys_kernel', 'proc_sys_kernel(5)'),
        fork: { url: 'https://man7.org/linux/man-pages/man2/fork.2.html#ERRORS', label: 'fork(2): errors' },
      },
    },
    {
      id: 'key-quotas',
      title: 'Keys and their quotas',
      oneLine: 'The kernel keeps small secrets for programs, such as tokens and keys. Each user may hold only so many, and so many bytes of them.',
      picture: {
        text: 'A bank gives each customer one safe-deposit box with a limit: so many items, and so much weight. Past either limit the clerk refuses, however much room the vault has.',
        limit: 'Bank customers rent boxes one by one. Programs create keys by themselves, often without the user knowing, so a quota can fill without anyone choosing to fill it.',
      },
      figure: {
        kind: 'stack',
        title: 'Two quotas for each user',
        layers: [
          { id: 'owner', label: 'Who owns keys', kind: 'nodes', nodes: [{ id: 'user', text: 'A user ID', sub: 'every ID is tracked on its own' }] },
          {
            id: 'quota',
            label: 'The quotas',
            kind: 'nodes',
            nodes: [
              { id: 'count', text: 'Number of keys', sub: 'kernel.keys.maxkeys', probe: 'kernel.maxkeys' },
              { id: 'bytes', text: 'Bytes of keys', sub: 'kernel.keys.maxbytes', probe: 'kernel.maxbytes' },
            ],
            values: [
              { probe: 'kernel.maxkeys', unit: 'keys' },
              { probe: 'kernel.maxbytes', unit: 'bytes' },
            ],
          },
          {
            id: 'root',
            label: 'Root is separate',
            kind: 'nodes',
            nodes: [{ id: 'root-quota', text: 'Root has its own quotas', sub: 'root_maxkeys and root_maxbytes' }],
            values: [
              { probe: 'kernel.rootMaxkeys', unit: 'keys' },
              { probe: 'kernel.rootMaxbytes', unit: 'bytes' },
            ],
          },
          { id: 'table', label: 'Where to look', kind: 'nodes', nodes: [{ id: 'users', text: '/proc/key-users', sub: 'what each user holds', probe: 'kernel.keyUsers' }] },
        ],
      },
      body: [
        'The kernel can hold security data for programs as [[keys|kernel-key]]. Each key has a description and may have a payload, the data itself[^overview]. The facility lets kernel components keep or cache things like authentication and encryption keys[^keyrings].',
        'Every user ID is tracked against two quotas: how many keys it owns, and how much space their descriptions and payloads use. A change that would put the user over quota is refused with the error EDQUOT[^service].',
        '`kernel.keys.maxkeys` and `kernel.keys.maxbytes` set those quotas for every non-root user. Root has its own pair[^proc]. The defaults are 200 keys and 20000 bytes[^keyrings]. `/proc/key-users` shows each user\'s holdings against the limits[^proc].',
      ],
      pins: [
        { key: 'maxkeys', layer: 'quota', here: 'How many keys each non-root user may own. Raise it when adding keys fails with EDQUOT and /proc/key-users shows a user at the limit. Most machines don\'t need to change this.' },
        { key: 'maxbytes', layer: 'quota', here: 'How many bytes of descriptions and payloads each non-root user may hold. Raise it when the bytes column reaches its maximum. Root has its own limit.' },
      ],
      choose: [
        {
          q: 'Does adding a key fail with "Disk quota exceeded" on a machine with free disk space?',
          check: 'cat /proc/key-users',
          hint: 'Each line is one user. Compare the keys held with the keys allowed.',
          yes: { key: 'maxkeys', dir: 'raise' },
        },
        {
          q: 'Is a user\'s byte count in /proc/key-users at its maximum, while the key count is not?',
          check: 'cat /proc/key-users',
          hint: 'The byte figure is shown as used over maximum, next to the key count.',
          yes: { key: 'maxbytes', dir: 'raise' },
          no: { leave: true, why: 'The defaults cover ordinary desktops and servers, which hold few keys per user.' },
        },
      ],
      symptoms: {
        low: 'Adding a key fails with EDQUOT once a user holds its limit of keys or bytes.',
        high: 'Users can hold more keys, and the kernel memory those keys use is not swapped out.',
      },
      look: {
        cmd: 'cat /proc/key-users',
        for: 'One line for each user ID that has a key. The key count and the byte count each sit next to the maximum the user may hold.',
      },
      sources: {
        overview: keys('key-overview', 'Overview'),
        service: keys('key-service-overview', 'Service overview'),
        keyrings: man(7, 'keyrings', 'keyrings(7)'),
        proc: keys('new-procfs-files', 'New procfs files'),
      },
    },
    {
      id: 'after-a-fault',
      title: 'After a fault: panic and reboot',
      oneLine: 'When the kernel finds a fault in itself, it carries on or stops. Three settings say which faults stop it, and whether the machine then restarts.',
      picture: {
        text: 'A factory machine jams. The operator can wave it on and hope, or hit the stop button. After a stop, the plant either restarts the line by itself after a pause, or waits for a technician.',
        limit: 'A factory halts cleanly. A kernel that has found a fault in its own code cannot be sure it is safe to continue, which is what makes a stop worth considering.',
      },
      figure: {
        kind: 'stack',
        title: 'From a fault to a reboot',
        layers: [
          {
            id: 'fault',
            label: 'A fault',
            kind: 'nodes',
            nodes: [
              { id: 'oops', text: 'An oops or BUG', sub: 'kernel.panic_on_oops', probe: 'kernel.panicOnOops' },
              { id: 'lockup', text: 'A soft lockup', sub: 'kernel.softlockup_panic', probe: 'kernel.softlockupPanic' },
            ],
            values: [
              { probe: 'kernel.panicOnOops', unit: '' },
              { probe: 'kernel.softlockupPanic', unit: '' },
              { probe: 'kernel.watchdogThresh', unit: 'seconds' },
            ],
          },
          {
            id: 'choice',
            label: 'What the kernel does',
            kind: 'nodes',
            nodes: [
              { id: 'carry-on', text: 'Carry on', sub: 'the default for both' },
              { id: 'panic', text: 'Panic', sub: 'the machine stops' },
            ],
          },
          {
            id: 'after',
            label: 'After a panic',
            kind: 'nodes',
            nodes: [
              { id: 'wait', text: 'Wait', sub: 'kernel.panic is 0' },
              { id: 'reboot', text: 'Reboot', sub: 'kernel.panic is a number of seconds' },
            ],
            values: [{ probe: 'kernel.panic', unit: 'seconds' }],
          },
        ],
      },
      body: [
        'An [[oops|oops]] is the kernel reporting a fault or a BUG in its own code. With `kernel.panic_on_oops` at 0 it tries to continue. At 1 it panics at once[^oops].',
        'A [[soft lockup|soft-lockup]] is the kernel looping in kernel mode for more than 20 seconds, twice the default of `kernel.watchdog_thresh`[^lockup]. By default it is only logged. Setting `kernel.softlockup_panic` to 1 makes it panic[^softlockup].',
        'A [[panic|kernel-panic]] stops the machine. `kernel.panic` decides what follows. At 0 the kernel loops forever, below 0 it reboots at once, and above 0 it reboots after that many seconds[^panic]. Panic on oops needs a non-zero `kernel.panic` to end in a reboot[^oops].',
      ],
      pins: [
        { key: 'panic', layer: 'after', here: 'Seconds to wait after a panic before rebooting. At 0 the machine stays stopped until someone resets it. A server nobody watches usually wants a number above 0.' },
        { key: 'panic_on_oops', layer: 'oops', here: 'Whether an oops or BUG panics the kernel. Off, it tries to continue. On suits machines that restart by themselves, together with kernel.panic above 0.' },
        { key: 'softlockup_panic', layer: 'lockup', here: 'Whether a soft lockup panics the kernel. Off, it is only logged. Turn it on only if lockups have really hung this machine.' },
      ],
      choose: [
        {
          q: 'After a crash, does the machine stay frozen until someone resets it?',
          check: 'sysctl kernel.panic',
          hint: 'A value of 0 means the kernel stays stopped after a panic. A number above 0 is seconds until the reboot.',
          yes: { key: 'panic', dir: 'raise' },
        },
        {
          q: 'Did an oops in the kernel log come before the machine began to misbehave?',
          check: 'sudo dmesg | grep -i -e oops -e "BUG:"',
          hint: 'Any line means the kernel hit a fault in its own code and, by default, carried on.',
          yes: { key: 'panic_on_oops', dir: 'raise' },
        },
        {
          q: 'Does the kernel log report a soft lockup before the machine hangs?',
          check: 'sudo dmesg | grep -i "soft lockup"',
          hint: 'A line means a CPU stayed in kernel code too long without letting other tasks run.',
          yes: { key: 'softlockup_panic', dir: 'raise' },
          no: { leave: true, why: 'The defaults let the kernel carry on, which suits a machine you can reach and inspect.' },
        },
      ],
      symptoms: {
        low: 'After a fault the kernel carries on, and after a panic the machine stays stopped until someone resets it.',
        high: 'Any oops or lockup stops the machine at once, and it reboots by itself if kernel.panic is above 0.',
      },
      look: {
        cmd: 'sysctl kernel.panic kernel.panic_on_oops kernel.softlockup_panic',
        for: 'kernel.panic is the wait in seconds, 0 meaning no reboot. The other two are 1 when that fault panics the kernel, 0 when it does not.',
      },
      sources: {
        oops: sysctl('panic-on-oops', 'panic_on_oops'),
        softlockup: sysctl('softlockup-panic', 'softlockup_panic'),
        panic: sysctl('panic', 'panic'),
        lockup: { url: 'https://docs.kernel.org/admin-guide/lockup-watchdogs.html#softlockup-detector', label: 'Lockup watchdogs: softlockup detector' },
      },
    },
    {
      id: 'magic-sysrq',
      title: 'Commands for a hung machine',
      oneLine: 'The Magic SysRq key sends the kernel an emergency command from the keyboard. One setting decides which commands it may obey.',
      picture: {
        text: 'A building has an emergency panel behind glass with a few labelled switches: stop the lifts, unlock the doors, cut the power. The manager decides which switches are wired up.',
        limit: 'Switches in a building are used by trained staff. SysRq works for anyone at the keyboard or serial console, so wiring up too many has a cost.',
      },
      figure: {
        kind: 'stack',
        title: 'From a key press to a command',
        layers: [
          {
            id: 'entry',
            label: 'How a command arrives',
            kind: 'nodes',
            nodes: [
              { id: 'keyboard', text: 'Alt+SysRq and a letter', sub: 'on an x86 keyboard' },
              { id: 'serial', text: 'A break, then a letter', sub: 'on a serial console' },
              { id: 'trigger', text: 'A write to /proc/sysrq-trigger', sub: 'always allowed for an administrator', probe: 'kernel.sysrqTrigger' },
            ],
          },
          { id: 'gate', label: 'The gate', kind: 'nodes', nodes: [{ id: 'mask', text: 'kernel.sysrq', sub: '0 off, 1 all, else a bitmask', probe: 'kernel.sysrq' }], values: [{ probe: 'kernel.sysrq', unit: '' }] },
          {
            id: 'commands',
            label: 'Some commands',
            kind: 'nodes',
            nodes: [
              { id: 's', text: 's: sync disks' },
              { id: 'u', text: 'u: remount read-only' },
              { id: 'b', text: 'b: reboot now' },
              { id: 'ei', text: 'e and i: end all processes' },
            ],
          },
        ],
      },
      body: [
        'On an x86 keyboard you press Alt, SysRq and a command letter. A serial console sends a break, then the letter within 5 seconds[^sysrq]. Writing one letter to `/proc/sysrq-trigger` is always allowed for an administrator, whatever the setting[^sysrq].',
        '`kernel.sysrq` decides what the keyboard may do. 0 disables SysRq and 1 enables everything. Any other number is a bitmask: 16 allows sync, 32 remount read-only, 64 signalling of processes and 128 reboot and power off[^sysrq]. So 176 allows 16, 32 and 128.',
        'The letter s syncs mounted filesystems and u remounts them read-only. The letter b reboots at once, without syncing or unmounting[^sysrq]. The letters e and i send SIGTERM and SIGKILL to every process except init[^sysrq].',
      ],
      pins: [
        { key: 'sysrq', layer: 'gate', here: 'Which SysRq commands the keyboard may use. 0 turns them off, 1 allows all, and 176 allows sync, remount read-only and reboot. Remember that anyone at the keyboard can then use them.' },
      ],
      choose: [
        {
          q: 'Is the machine sometimes so frozen that only the power button helps, and are SysRq letters ignored?',
          check: 'sysctl kernel.sysrq',
          hint: 'A value of 0 means SysRq is off. 176 allows sync, remount read-only and reboot.',
          yes: { key: 'sysrq', dir: 'raise' },
        },
        {
          q: 'Can people you do not trust reach the keyboard or the serial console?',
          check: 'sysctl kernel.sysrq',
          hint: 'At 1 anyone there can reboot the machine or end every process.',
          yes: { key: 'sysrq', dir: 'lower' },
          no: { leave: true, why: 'The setting only matters once a machine hangs, and a distribution default is a reasonable start.' },
        },
      ],
      symptoms: {
        low: 'SysRq letters do nothing, so a frozen machine needs the power button.',
        high: 'Anyone at the keyboard or serial console can reboot the machine or end every process.',
      },
      look: {
        cmd: 'sysctl kernel.sysrq',
        for: '0 is off and 1 is everything. Other numbers add up the allowed functions, for example 16 for sync, 32 for remount read-only and 128 for reboot.',
      },
      sources: {
        sysrq: { url: 'https://docs.kernel.org/admin-guide/sysrq.html', label: 'Linux Magic System Request Key Hacks' },
      },
    },
    {
      id: 'console-messages',
      title: 'Which messages reach the console',
      oneLine: 'Every kernel message has a level of urgency. One setting holds four numbers that decide which levels print on the console.',
      picture: {
        text: 'A building has an intercom. Fire alarms always sound, but chatter about the lifts only plays if the volume is turned up. Turning the intercom down does not stop the log book from filling.',
        limit: 'A log book is a real place. For the kernel, only the console printing is covered by this setting, and the sources used here do not say how long other copies keep a message.',
      },
      figure: {
        kind: 'sideBySide',
        title: 'Message levels 0 to 7 printed on the console',
        states: [
          { label: 'Console level 7', cells: 8, lit: 7, setting: { key: 'printk', value: '7 4 1 7' } },
          { label: 'Console level 4', cells: 8, lit: 4, setting: { key: 'printk', value: '4 4 1 7' } },
          { label: 'Console level 1', cells: 8, lit: 1, setting: { key: 'printk', value: '1 4 1 7' } },
        ],
        backedBy: { probe: 'kernel.printk' },
      },
      body: [
        'Every kernel message has a [[log level|loglevel]] from 0 (emergency) to 7 (debug). A message with no level gets the default message level[^syslog].',
        '`kernel.printk` holds four numbers: the console level, the default message level, the minimum console level and the default console level[^printk]. The kernel prints a message on the console only if its level is lower than the console level[^syslog].',
        'The console level is 7 by default, and 4 when the boot command line has `quiet`[^syslog]. A program can change it with a syslog call, between 1 and 8, but never below the minimum console level[^syslog].',
      ],
      pins: [
        { key: 'printk', here: 'Four log levels: console, default message, minimum console and default console. Lower the first to quiet the console. The other three are best left as they are.' },
      ],
      choose: [
        {
          q: 'Does a text login or the console fill up with driver messages?',
          check: 'sysctl kernel.printk',
          hint: 'The first number is the console level. Messages with a lower level than it are printed.',
          yes: { key: 'printk', dir: 'lower' },
        },
        {
          q: 'Are warnings you need missing from the console?',
          check: 'sysctl kernel.printk',
          hint: 'Warnings have level 4, so the console level must be 5 or higher to print them.',
          yes: { key: 'printk', dir: 'raise' },
          no: { leave: true, why: 'The console level only changes what is printed on the console, so the default is fine unless it bothers you.' },
        },
      ],
      symptoms: {
        low: 'Only the most urgent messages reach the console. Warnings and anything below them stay off it.',
        high: 'The console fills with notices, information and debug lines.',
      },
      look: {
        cmd: 'sysctl kernel.printk',
        for: 'Four numbers in order: console level, default message level, minimum console level, default console level.',
      },
      sources: {
        printk: sysctl('printk', 'printk'),
        syslog: { url: 'https://man7.org/linux/man-pages/man2/syslog.2.html#DESCRIPTION', label: 'syslog(2): description' },
      },
    },
  ],
}
