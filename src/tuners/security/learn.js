/**
 * The hardening study guide at /learn/hardening: seven chapters, one per
 * kind of exposure the security tuner's eighteen settings close. Data in the
 * frozen Guide shape (src/learn/schema.js), checked by
 * src/learn/contract.test.js. Probe ids name entries in ./probes.js; `[^id]`
 * marks point into each chapter's `sources`; `[[term]]` names an entry in
 * ui/glossary.js. It says what each restriction protects against, never how
 * to attack.
 */

const KERNEL = 'https://docs.kernel.org/admin-guide/sysctl/kernel.html'
const FS = 'https://docs.kernel.org/admin-guide/sysctl/fs.html'
const IP = 'https://docs.kernel.org/networking/ip-sysctl.html'
const SELF = 'https://docs.kernel.org/security/self-protection.html'
const MAN = 'https://man7.org/linux/man-pages'
const kernel = (anchor, name) => ({ url: `${KERNEL}#${anchor}`, label: `sysctl/kernel: ${name}` })
const fs = (anchor, name) => ({ url: `${FS}#${anchor}`, label: `sysctl/fs: ${name}` })
const ip = (anchor, name) => ({ url: `${IP}#${anchor}`, label: `IP sysctl: ${name}` })
const self = (anchor, name) => ({ url: `${SELF}#${anchor}`, label: `Kernel self-protection: ${name}` })
const man = (page, section, anchor) => ({ url: `${MAN}/man${section}/${page}.${section}.html#${anchor}`, label: `${page}(${section})` })

export const LEARN = {
  slug: 'hardening',
  title: 'How Linux hardening works',
  lead: 'See what each hardening setting keeps out of reach: kernel details, other programs, risky kernel features, shared folders and the network.',
  minutes: 22,
  parts: {
    picture:
      'Think of the machine as an office building. Each program works in a room with the rights of the user who started it. The kernel is the front desk: it holds the keys, the floor plan and the mail. Hardening decides what the front desk shows, and to whom.',
    cards: [
      { id: 'programs', title: 'Your programs', does: 'Run with the rights of the user who started them.', col: 2, row: 1 },
      { id: 'others', title: 'Other programs', does: 'They run beside yours, some as root, and each holds secrets in memory.', col: 3, row: 1, probe: 'security.yama' },
      { id: 'secrets', title: 'Kernel details', does: 'This is where kernel code sits in memory, and the kernel log.', col: 1, row: 2, probe: 'security.kallsyms' },
      { id: 'kernel', title: 'The kernel', does: 'Checks every request a program makes, and decides what it may see.', col: 2, row: 2, tone: 'fit' },
      { id: 'network', title: 'The network', does: 'Packets come in from other machines, and some name a false sender.', col: 3, row: 2, probe: 'security.ipv6' },
      { id: 'shared', title: 'Shared folders', does: 'In places such as `/tmp`, every user may create files.', col: 2, row: 3 },
    ],
    bands: [
      { label: 'Programs', rows: [1, 1] },
      { label: 'Kernel', rows: [2, 2] },
      { label: 'Files', rows: [3, 3] },
    ],
    edges: [
      { from: 'programs', to: 'others', label: 'may look inside' },
      { from: 'programs', to: 'kernel', label: 'ask by system call' },
      { from: 'kernel', to: 'secrets', label: 'keeps addresses, log' },
      { from: 'kernel', to: 'network', label: 'checks arriving packets' },
      { from: 'kernel', to: 'shared', label: 'decides who opens' },
    ],
  },
  chapters: [
    {
      id: 'what-the-kernel-shows',
      title: 'What the kernel shows users',
      oneLine: 'The kernel knows where its own code sits in memory, and keeps a log. Two settings decide which users may read those details.',
      picture: {
        text: 'A bank moves its vault to a different room each night, so a burglar cannot plan a route. That only works if nobody pins tonight\'s floor plan on the lobby wall. Hiding kernel addresses takes the plan down.',
        limit: 'A floor plan helps any burglar. Kernel addresses only help someone who already has a kernel bug to work with.',
      },
      figure: {
        kind: 'modes',
        title: 'Who can read kernel addresses and the kernel log',
        rows: [
          {
            id: 'addresses',
            label: 'Kernel addresses',
            pin: 'kptr_restrict',
            value: { probe: 'security.kptrRestrict', unit: '' },
            does: 'What users see where the kernel prints an address in `/proc`.',
            options: [
              { value: 0, label: 'hashed', does: 'The address is hashed first, so it reveals no location.' },
              { value: 1, label: 'zeros for users', does: 'Readers without `CAP_SYSLOG` see zeros.' },
              { value: 2, label: 'zeros for all', does: 'Everyone sees zeros, root included.' },
            ],
          },
          {
            id: 'log',
            label: 'Kernel log',
            pin: 'dmesg_restrict',
            value: { probe: 'security.dmesgRestrict', unit: '' },
            does: 'Who may read the kernel log with `dmesg`.',
            options: [
              { value: 0, label: 'any user reads', does: 'Every user can read the log with `dmesg`.' },
              { value: 1, label: 'admins only', does: 'Only users with `CAP_SYSLOG` can read the log.' },
            ],
          },
        ],
      },
      body: [
        'The kernel can place its code at a different address each boot. This is [[KASLR|kaslr]], and it makes an attack harder, because the attacker must first find the target[^kaslr]. Any kernel address printed for users gives that away. So the kernel docs treat printed addresses as a leak worth closing[^addresses].',
        'kernel.kptr_restrict covers addresses printed with the %pK format in `/proc` and other files[^kptr]. At 0, the default, they are hashed first; kernels 4.14 and older printed them raw[^addresses]. At 1 they print as zeros unless the reader has CAP_SYSLOG, a [[capability]][^caps]. At 2 they are zeros for everyone[^kptr].',
        'The kernel log is what `dmesg` shows. kernel.dmesg_restrict at 1 lets only users with CAP_SYSLOG read it[^dmesg]. A build option sets the default, so kernels differ[^dmesg]. The kptr_restrict docs suggest it too, so addresses in the log stay away from ordinary users[^kptr].',
      ],
      pins: [
        { key: 'kptr_restrict', layer: 'addresses', here: 'Who sees kernel addresses in `/proc` files. 1 hides them from everyone without CAP_SYSLOG and suits most machines. 2 hides them from root too, which blinds root\'s own debugging tools.' },
        { key: 'dmesg_restrict', layer: 'log', here: 'Who may read the kernel log. 1 keeps it to admins, who still read it with `sudo dmesg`. It costs little on most machines.' },
      ],
      choose: [
        {
          q: 'Do people or services without admin rights run programs on this machine?',
          check: 'sysctl kernel.kptr_restrict',
          hint: '0 prints kernel addresses as hashes on current kernels, and in full on 4.14 and older. 1 hides them from users without CAP_SYSLOG.',
          yes: { key: 'kptr_restrict', dir: 'raise' },
        },
        {
          q: 'Can a user without sudo read the kernel log?',
          check: 'sysctl kernel.dmesg_restrict',
          hint: '0 means any user can run dmesg. 1 means only admins can, for example with sudo dmesg.',
          yes: { key: 'dmesg_restrict', dir: 'raise' },
          no: { leave: true, why: 'The log is already closed to ordinary users. If nobody but admins runs programs here, the address setting matters less too.' },
        },
      ],
      symptoms: {
        low: 'Any user can read the kernel log, and old kernels show real addresses in `/proc` files.',
        high: 'Even root sees zeros in place of kernel addresses, and dmesg needs sudo.',
      },
      look: {
        cmd: 'sysctl kernel.kptr_restrict kernel.dmesg_restrict',
        for: 'kptr_restrict 1 hides addresses from users without CAP_SYSLOG, and 2 from everyone. dmesg_restrict 1 keeps the log to admins.',
      },
      sources: {
        kaslr: self('kernel-address-space-layout-randomization-kaslr', 'KASLR'),
        addresses: self('kernel-addresses', 'Kernel addresses'),
        kptr: kernel('kptr-restrict', 'kptr_restrict'),
        caps: man('capabilities', 7, 'DESCRIPTION'),
        dmesg: kernel('dmesg-restrict', 'dmesg_restrict'),
      },
    },
    {
      id: 'shuffling-program-memory',
      title: 'Shuffling program memory',
      oneLine: 'Each time a program starts, the kernel can place its parts at random addresses. One setting decides how much of the program gets shuffled.',
      picture: {
        text: 'A hotel gives each guest a different room on every visit. A thief who learned your room number last time finds a stranger there now. The more of your things the hotel moves, the less an old note helps.',
        limit: 'A thief can still knock on every door. Random placement makes guessing harder, not impossible.',
      },
      figure: {
        kind: 'modes',
        title: 'How much of a program lands at random addresses',
        rows: [
          {
            id: 'aslr',
            label: 'Address randomisation',
            pin: 'randomize_va_space',
            value: { probe: 'security.randomizeVaSpace', unit: '' },
            does: 'How much of each program the kernel moves at every start.',
            options: [
              { value: 0, label: 'off', does: 'Every part of a program lands where it did last time.' },
              { value: 1, label: 'stack and libraries', does: 'The stack, the mmap area and the vDSO land at random.' },
              { value: 2, label: 'heap too', does: 'The heap lands at random as well, which is the default.' },
            ],
          },
        ],
      },
      body: [
        'The kernel docs give the reason for moving the kernel\'s own code: an attack that cannot predict where things are is harder[^kaslr]. [[ASLR|aslr]] does the same for every program you run. It picks new addresses for the parts of a program each time it starts[^rva].',
        'kernel.randomize_va_space picks the mode[^rva]. At 0 nothing is randomised. At 1 the stack, the mmap area and the [[vDSO|vdso]] page land at random, and so do shared libraries[^rva]. The vDSO is a small library the kernel maps into every program[^vdso]. At 2 the heap is randomised too[^rva].',
        'Full randomisation is the default, unless the kernel was built for very old programs that expect a fixed heap[^rva]. The docs know of no current program it breaks, so 2 suits nearly every machine[^rva].',
      ],
      pins: [
        { key: 'randomize_va_space', layer: 'aslr', here: 'How much of each program lands at random addresses. 2, the default, moves the heap too and suits nearly every machine. Lower it only for a debugging session, then put it back.' },
      ],
      choose: [
        {
          q: 'Is address randomisation off or partial on this machine?',
          check: 'sysctl kernel.randomize_va_space',
          hint: '2 is full randomisation. A 0 or 1 is worth tracing back to whoever set it.',
          yes: { key: 'randomize_va_space', dir: 'raise' },
          no: { leave: true, why: '2 is the default and the value to keep.' },
        },
      ],
      symptoms: {
        low: 'The addresses in `/proc/self/maps` stay the same from one run to the next.',
        high: 'A very old program that expects a fixed heap may crash at start.',
      },
      look: {
        cmd: 'grep -e stack -e heap /proc/self/maps',
        for: 'Run it twice. With randomisation on, the start addresses of the heap and the stack change between runs.',
      },
      sources: {
        kaslr: self('kernel-address-space-layout-randomization-kaslr', 'KASLR'),
        rva: kernel('randomize-va-space', 'randomize_va_space'),
        vdso: man('vdso', 7, 'DESCRIPTION'),
      },
    },
    {
      id: 'looking-into-other-programs',
      title: 'Looking into other programs',
      oneLine: 'A debugger can read and change another program\'s memory, and a crash can leave that memory in a file. Two settings decide who gets that view.',
      picture: {
        text: 'In a block of flats, every family used to share one master key for all its flats. A burglar who stole one key got into them all. Now each key opens only the flats you set up yourself, and the burglar gets one flat.',
        limit: 'Keys stay where they are. A program can hand its own key out: it may name one other program that is allowed to attach to it.',
      },
      figure: {
        kind: 'modes',
        title: 'Who may look into a program, and what a crash leaves',
        groups: [
          { id: 'looking', label: 'Debuggers', does: 'A debugger or tracer reads another program, and that memory can hold credentials.' },
          { id: 'crash', label: 'Crashes' },
        ],
        rows: [
          {
            id: 'attach',
            label: 'Who may attach',
            group: 'looking',
            pin: 'ptrace_scope',
            value: { probe: 'security.ptraceScope', unit: '' },
            does: 'Which programs may read and change another program\'s memory with `ptrace`.',
            options: [
              { value: 0, label: 'same user', does: 'Any program of the same user may attach.' },
              { value: 1, label: 'descendants', does: 'Only its own descendants, or a debugger it names, may attach.' },
              { value: 2, label: 'admins', does: 'Only processes with `CAP_SYS_PTRACE` may attach.' },
              { value: 3, label: 'nobody', does: 'Nobody may attach, and the value cannot be changed.' },
            ],
          },
          {
            id: 'dumps',
            label: 'Privileged crash',
            group: 'crash',
            pin: 'suid_dumpable',
            value: { probe: 'security.suidDumpable', unit: '' },
            does: 'Whether a crashed privileged program leaves its memory in a file.',
            options: [
              { value: 0, label: 'no dump', does: 'A crashed privileged program leaves no dump.' },
              { value: 1, label: 'plain dump', does: 'It dumps like any program, which the docs call insecure.' },
              { value: 2, label: 'handler only', does: 'It dumps only to a pipe handler or a full path.' },
            ],
          },
        ],
      },
      body: [
        '[[ptrace]] lets one program watch and control another, and read and change its memory[^ptrace]. Debuggers and system call tracers are built on it[^ptrace]. Classically a program could attach to any other of the same user. One compromised program could then reach an SSH session or a key agent, and take the credentials in its memory[^yama].',
        'The Yama security module adds kernel.yama.ptrace_scope[^yama]. At 1 a program may attach only to its own descendants, so `gdb ./program` still works. At 2 only processes with CAP_SYS_PTRACE may attach, as root\'s `gdb --pid` does. At 3 nobody can, and once set the value cannot be changed[^yama].',
        'A [[core dump|core-dump]] is a file holding a crashed program\'s memory[^core]. fs.suid_dumpable decides whether [[setuid programs|setuid]], and others that changed their privileges, leave one. At 0 they don\'t. At 1 they dump like any program, which the docs call insecure: users could read privileged memory. At 2 they dump only to a pipe handler or a full path[^dumpable].',
      ],
      pins: [
        { key: 'ptrace_scope', layer: 'attach', here: 'Which programs may attach to others. 1 keeps debugging your own programs working and suits most machines. 2 leaves attaching to root. 3 turns it off until the next reboot.' },
        { key: 'suid_dumpable', layer: 'dumps', here: 'Whether privileged programs leave core dumps. 0 leaves none. 2 suits a machine whose crash handler treats such dumps with care. Leave 1 only for a debugging session.' },
      ],
      choose: [
        {
          q: 'Was fs.suid_dumpable set to 1 for debugging and left there?',
          check: 'sysctl fs.suid_dumpable',
          hint: '1 lets ordinary users read dumps of privileged programs. 0 is the default.',
          yes: { key: 'suid_dumpable', dir: 'lower' },
        },
        {
          q: 'Is this a server where nobody runs a debugger or strace?',
          check: 'sysctl kernel.yama.ptrace_scope',
          hint: '1 still lets a debugger start a program and trace it. 2 needs root to attach at all.',
          yes: { key: 'ptrace_scope', dir: 'raise' },
          no: { leave: true, why: 'Keep 1. It blocks attaching to unrelated programs, and you can still debug your own.' },
        },
      ],
      symptoms: {
        low: 'Any program can attach to your other programs, and debuggers never ask for sudo.',
        high: 'Debuggers and strace fail with a permission error unless run as root.',
      },
      look: {
        cmd: 'sysctl kernel.yama.ptrace_scope fs.suid_dumpable',
        for: 'ptrace_scope 1 limits attaching to a program\'s own descendants. suid_dumpable 0 means privileged programs leave no core dump.',
      },
      sources: {
        ptrace: man('ptrace', 2, 'DESCRIPTION'),
        yama: { url: 'https://docs.kernel.org/admin-guide/LSM/Yama.html#ptrace-scope', label: 'Yama: ptrace_scope' },
        core: man('core', 5, 'DESCRIPTION'),
        dumpable: fs('suid-dumpable', 'suid_dumpable'),
      },
    },
    {
      id: 'fewer-ways-into-the-kernel',
      title: 'Fewer ways into the kernel',
      oneLine: 'Every kernel feature a program can call is code a bug could hide in. Three settings keep some large features for trusted programs only.',
      picture: {
        text: 'A museum has one public entrance and several staff doors. Each staff door left open to the public is one more lock a thief can test. Closing those doors to visitors costs them nothing they came for.',
        limit: 'Some visitors do need a staff door. Profilers, BPF tools and containers use these features, and closing them stops those programs.',
      },
      figure: {
        kind: 'modes',
        title: 'Kernel features an ordinary user may reach',
        rows: [
          {
            id: 'perf',
            label: 'Performance events',
            pin: 'perf_event_paranoid',
            value: { probe: 'security.perfParanoid', unit: '' },
            does: 'How much of `perf_event_open()` a user without `CAP_PERFMON` gets.',
            options: [
              { value: 0, label: 'system', does: 'Users may also collect events for the whole machine.' },
              { value: 1, label: 'own all', does: 'Users may profile their own programs, kernel code included.' },
              { value: 2, label: 'own user', does: 'Users may measure only the user-space part of their own programs, which is the upstream default.' },
              { value: 3, label: 'off (3)', does: 'Debian and older Ubuntu kernels refuse unprivileged use entirely.' },
              { value: 4, label: 'off (4)', does: 'Current Ubuntu kernels and patched ones refuse it for everyone without privileges.' },
            ],
          },
          {
            id: 'bpf',
            label: 'BPF programs',
            pin: 'unprivileged_bpf_disabled',
            value: { probe: 'security.bpfDisabled', unit: '' },
            does: 'Whether users without `CAP_BPF` may load programs that run inside the kernel.',
            options: [
              { value: 0, label: 'allowed', does: 'Any user may load BPF programs into the kernel.' },
              { value: 1, label: 'off, locked', does: 'Refused until the next reboot.' },
              { value: 2, label: 'off', does: 'Refused, and an admin can change it back.' },
            ],
          },
          {
            id: 'userns',
            label: 'User namespaces',
            pin: 'user_namespaces',
            value: { probe: 'security.maxUserNamespaces', unit: '' },
            does: 'The lit number is how many each user may create, not a switch.',
            options: [
              { value: 0, label: 'blocked', does: 'Creating one fails for everyone, root included.' },
              { value: 'allowed', label: 'allowed', does: 'Each user may create namespaces up to a limit.' },
            ],
          },
        ],
      },
      body: [
        'The kernel docs name perf, BPF and user namespaces among the features to keep for trusted programs[^surface]. Each lets a program without privileges reach more kernel code. Less reachable code leaves fewer bugs an attack could use[^surface].',
        '`perf_event_open()` measures performance[^perf-call]. kernel.perf_event_paranoid limits it for users without CAP_PERFMON: at 2, the default, they cannot profile the kernel[^perf]. `bpf()` loads [[eBPF|bpf]] programs[^bpf-call]. kernel.unprivileged_bpf_disabled at 1 or 2 refuses it to users without CAP_BPF or CAP_SYS_ADMIN. 1 cannot be undone while the machine runs; 2 can[^bpf].',
        'A [[user namespace|namespace]] gives a program root inside it, with no extra rights outside[^userns]. Since Linux 3.8 any user may create one, and inside it may create other namespaces[^userns]. user.max_user_namespaces caps how many each user may create, by default half of kernel.threads-max. At 0, creating one fails for everyone, root included[^limits].',
      ],
      pins: [
        { key: 'perf_event_paranoid', layer: 'perf', here: 'How much of perf users without CAP_PERFMON get. 2, the default, allows only measuring their own user-space code. Lower opens more to them. Most machines don\'t need to change this.' },
        { key: 'unprivileged_bpf_disabled', layer: 'bpf', here: 'Whether users without privileges may load BPF programs. 2 blocks them and can be changed back; 1 blocks them until reboot. Tools that run as root keep working.' },
        { key: 'user_namespaces', layer: 'userns', here: 'Whether anyone may create a user namespace. Blocking suits a server that runs no containers or sandboxes. Rootless containers and services that use them then fail.' },
      ],
      choose: [
        {
          q: 'Is unprivileged BPF still allowed, with nothing here that needs it?',
          check: 'sysctl kernel.unprivileged_bpf_disabled',
          hint: '0 means any user may load BPF programs. Tools that run as root keep working at 1 and 2.',
          yes: { key: 'unprivileged_bpf_disabled', dir: 'raise' },
        },
        {
          q: 'Is this a server that runs no containers, sandboxes or rootless tools?',
          check: 'sysctl user.max_user_namespaces',
          hint: 'A large number is the kernel\'s own limit. 0 stops every program from creating a user namespace, root included.',
          yes: { key: 'user_namespaces', to: 'blocked' },
        },
        {
          q: 'Do developers here need to profile kernel code without sudo?',
          check: 'sysctl kernel.perf_event_paranoid',
          hint: '2 or more keeps kernel profiling for users with CAP_PERFMON. 1 opens it to everyone.',
          yes: { key: 'perf_event_paranoid', dir: 'lower' },
          no: { leave: true, why: 'The default keeps kernel profiling for privileged users, which suits most machines.' },
        },
      ],
      symptoms: {
        low: 'Any user can load BPF programs, profile more of the system and create namespaces of their own.',
        high: 'Rootless containers and services that use user namespaces fail to start, and profiling needs sudo.',
      },
      look: {
        cmd: 'sysctl kernel.perf_event_paranoid kernel.unprivileged_bpf_disabled user.max_user_namespaces',
        for: 'perf_event_paranoid 2 or more keeps kernel profiling for privileged users. unprivileged_bpf_disabled 1 or 2 blocks BPF for the rest. max_user_namespaces 0 blocks user namespaces.',
      },
      sources: {
        surface: self('reduced-access-to-syscalls', 'Reduced access to syscalls'),
        'perf-call': man('perf_event_open', 2, 'DESCRIPTION'),
        perf: kernel('perf-event-paranoid', 'perf_event_paranoid'),
        'bpf-call': man('bpf', 2, 'DESCRIPTION'),
        bpf: kernel('unprivileged-bpf-disabled', 'unprivileged_bpf_disabled'),
        userns: man('user_namespaces', 7, 'DESCRIPTION'),
        limits: man('namespaces', 7, 'DESCRIPTION'),
      },
    },
    {
      id: 'shared-folders',
      title: 'Shared folders like /tmp',
      oneLine: 'Every user may create files in /tmp. Four settings stop one user from leaving a trap there for a program that runs as someone else.',
      picture: {
        text: 'A shared office has one tray where anyone may drop papers. A prankster leaves a note saying "file this in the boss\'s drawer", and a hurried clerk obeys. These settings teach the clerk to ignore notes left by strangers.',
        limit: 'A clerk reads the note once. A program often checks a name and uses it a moment later, and the trap is laid in that gap.',
      },
      figure: {
        kind: 'modes',
        title: 'Which traps the kernel refuses in shared folders',
        rows: [
          {
            id: 'symlink',
            label: 'Symlinks',
            pin: 'protected_symlinks',
            value: { probe: 'security.protectedSymlinks', unit: '' },
            does: 'A link that leads to another file.',
            options: [
              { value: 0, label: 'followed', does: 'A program follows any link in a shared folder.' },
              { value: 1, label: 'checked', does: 'A link is followed only when it belongs to the follower or the folder\'s owner.' },
            ],
          },
          {
            id: 'hardlink',
            label: 'Hard links',
            pin: 'protected_hardlinks',
            value: { probe: 'security.protectedHardlinks', unit: '' },
            does: 'Another name for the same file.',
            options: [
              { value: 0, label: 'any file' },
              { value: 1, label: 'own files only', does: 'Users may link only files they own, or can read and write.' },
            ],
          },
          {
            id: 'fifo',
            label: 'FIFOs',
            pin: 'protected_fifos',
            value: { probe: 'security.protectedFifos', unit: '' },
            does: 'A named pipe another user may have planted before the program created its own.',
            options: [
              { value: 0, label: 'off' },
              { value: 1, label: 'world-writable' },
              { value: 2, label: 'group-writable too' },
            ],
          },
          {
            id: 'regular',
            label: 'Regular files',
            pin: 'protected_regular',
            value: { probe: 'security.protectedRegular', unit: '' },
            does: 'A file another user may have planted before the program created its own.',
            options: [
              { value: 0, label: 'off' },
              { value: 1, label: 'world-writable' },
              { value: 2, label: 'group-writable too' },
            ],
          },
        ],
      },
      body: [
        'Every user may create files in `/tmp`, and its [[sticky bit|sticky-bit]] stops them deleting each other\'s[^sticky]. A program running as root may follow a name there that another user planted. The kernel docs call this a long-standing class of bugs, a race between checking a name and using it[^symlinks].',
        'fs.protected_symlinks at 1 follows a link in such a folder only when it belongs to the follower or to the folder\'s owner[^symlinks]. fs.protected_hardlinks at 1 lets users hard-link only files they own, or can read and write[^hardlinks]. That also stops them keeping an old setuid program alive past an upgrade[^hardlinks].',
        'fs.protected_fifos and fs.protected_regular guard against a planted [[FIFO|fifo]] or file where a program meant to create its own. At 1, an open that would create the name fails in a world-writable sticky folder if another user owns what is there. The folder\'s owner is the exception. At 2 group-writable sticky folders count too[^fifos][^regular].',
      ],
      pins: [
        { key: 'protected_symlinks', layer: 'symlink', here: 'Whether programs follow other users\' links in shared folders. 1 closes the classic `/tmp` trap. Keep it at 1.' },
        { key: 'protected_hardlinks', layer: 'hardlink', here: 'Whether users may hard-link files they cannot write. 1 stops links to other users\' files. Keep it at 1.' },
        { key: 'protected_fifos', layer: 'fifo', here: 'Whether a program creating a name in a shared folder may open another user\'s FIFO there. 1 covers world-writable folders, 2 group-writable ones too.' },
        { key: 'protected_regular', layer: 'regular', here: 'The same guard for regular files: a program creating its own file will not open one another user left there first. 1 or 2, as for FIFOs.' },
      ],
      choose: [
        {
          q: 'Can programs follow a link another user planted in /tmp?',
          check: 'sysctl fs.protected_symlinks',
          hint: '0 means yes. 1 follows such a link only when the follower or the folder\'s owner owns it.',
          yes: { key: 'protected_symlinks', dir: 'raise' },
        },
        {
          q: 'Can users hard-link files they cannot write?',
          check: 'sysctl fs.protected_hardlinks',
          hint: '0 means yes. 1 allows links only to files they own, or can read and write.',
          yes: { key: 'protected_hardlinks', dir: 'raise' },
        },
        {
          q: 'Is protected_fifos or protected_regular at 0?',
          check: 'sysctl fs.protected_fifos fs.protected_regular',
          hint: '1 guards world-writable sticky folders such as /tmp. 2 adds group-writable ones.',
          yes: { key: 'protected_fifos', dir: 'raise' },
          no: { leave: true, why: 'These guards already hold for the folders users share.' },
        },
      ],
      symptoms: {
        low: 'A program running as root can be led to follow links, or open files, that other users planted in `/tmp`.',
        high: 'Opening a name another user left in a shared folder fails, when the program asked to create it.',
      },
      look: {
        cmd: 'sysctl fs.protected_symlinks fs.protected_hardlinks fs.protected_fifos fs.protected_regular',
        for: '1 for symlinks and hard links means both guards hold. For FIFOs and regular files, 1 covers world-writable sticky folders and 2 group-writable ones too.',
      },
      sources: {
        sticky: man('inode', 7, 'DESCRIPTION'),
        symlinks: fs('protected-symlinks', 'protected_symlinks'),
        hardlinks: fs('protected-hardlinks', 'protected_hardlinks'),
        fifos: fs('protected-fifos', 'protected_fifos'),
        regular: fs('protected-regular', 'protected_regular'),
      },
    },
    {
      id: 'packets-that-lie',
      title: 'Packets that lie about their path',
      oneLine: 'A packet says who sent it, and some carry directions. Five settings decide which of those claims the kernel believes, and what it says itself.',
      picture: {
        text: 'A letter claims to come from another city, but it was dropped in the local box. A careful clerk asks whether a reply would go back the way it came. Another letter says "send the boss\'s mail to this address from now on". A careful clerk ignores it.',
        limit: 'A clerk can phone the sender. The kernel can only compare a packet with its own routes, which mislead it when traffic goes out one way and returns another.',
      },
      figure: {
        kind: 'modes',
        title: 'What the kernel believes about arriving packets',
        groups: [
          { id: 'spoofing', label: 'Spoofing' },
          { id: 'redirects', label: 'Redirects' },
          { id: 'routes', label: 'Source routing' },
        ],
        rows: [
          {
            id: 'spoof',
            label: 'Reverse path',
            group: 'spoofing',
            pin: 'rp_filter',
            value: { probe: 'security.rpFilter', unit: '' },
            does: 'Whether a reply would leave by the interface the packet arrived on.',
            options: [
              { value: 0, label: 'off', does: 'No check of the sender.' },
              { value: 1, label: 'strict', does: 'Drops a packet whose interface is not the best way back to the sender.' },
              { value: 2, label: 'loose', does: 'Drops it only when no interface leads back.' },
            ],
          },
          {
            id: 'redirect4',
            label: 'IPv4 redirects',
            group: 'redirects',
            pin: 'accept_redirects',
            value: { probe: 'security.acceptRedirects', unit: '' },
            does: 'Advice from a router to use a different router.',
            options: [
              { value: 0, label: 'ignored' },
              { value: 1, label: 'accepted', does: 'The kernel takes the advice and changes its routes.' },
            ],
          },
          {
            id: 'redirect6',
            label: 'IPv6 redirects',
            group: 'redirects',
            pin: 'accept_redirects_v6',
            value: { probe: 'security.acceptRedirectsV6', unit: '' },
            does: 'The same advice, for IPv6.',
            options: [
              { value: 0, label: 'ignored' },
              { value: 1, label: 'accepted', does: 'The kernel takes the advice and changes its routes.' },
            ],
          },
          {
            id: 'send',
            label: 'Redirects it sends',
            group: 'redirects',
            pin: 'send_redirects',
            value: { probe: 'security.sendRedirects', unit: '' },
            does: 'Whether this machine tells others about a better router.',
            options: [
              { value: 0, label: 'never' },
              { value: 1, label: 'when routing', does: 'This machine sends them only when it routes traffic.' },
            ],
          },
          {
            id: 'source',
            label: 'Source routes',
            group: 'routes',
            pin: 'accept_source_route',
            value: { probe: 'security.acceptSourceRoute', unit: '' },
            does: 'Packets that carry the path they want to take.',
            options: [
              { value: 0, label: 'dropped' },
              { value: 1, label: 'accepted', does: 'The packet picks its own path through the network.' },
            ],
          },
        ],
      },
      body: [
        'net.ipv4.conf.all.rp_filter checks each arriving IPv4 packet against the routing table[^ip]. At 1, strict, it drops a packet when its interface is not the best way back to the sender. At 2, loose, only when no interface leads back. Strict mode fights [[spoofed|spoofing]] senders; loose suits routes that differ each way[^ip].',
        'An [[ICMP redirect|icmp-redirect]] is advice to use another router. accept_redirects decides whether the kernel takes it, for IPv4 and for IPv6[^ip][^ip6]. send_redirects lets this machine send them when it routes traffic[^ip]. Linux sends none while it is not acting as a router[^icmp]. accept_source_route decides whether IPv4 packets carrying their own route are accepted; hosts refuse them by default[^ip].',
        'For IPv4 redirects, an interface takes or sends them when either the `all` value or its own value allows it[^ip]. Setting `all` to 0 is then not enough on its own, so check each interface. For rp_filter the higher of the two values counts[^ip].',
      ],
      pins: [
        { key: 'rp_filter', layer: 'spoof', here: 'Whether the kernel drops IPv4 packets whose sender looks forged. 1 suits a machine with one way in and out. 2 suits several uplinks, VPNs and other uneven routes.' },
        { key: 'accept_redirects', layer: 'redirect4', here: 'Whether IPv4 redirects may change this machine\'s routes. A machine whose routes are set correctly has no use for them, so 0 suits most machines.' },
        { key: 'accept_redirects_v6', layer: 'redirect6', here: 'The same choice for IPv6 redirects. 0 suits most machines; check each interface after you set it.' },
        { key: 'send_redirects', layer: 'send', here: 'Whether this machine tells others about a better router when it forwards their traffic. Only a router needs it, so 0 suits other machines.' },
        { key: 'accept_source_route', layer: 'source', here: 'Whether IPv4 packets may choose their own path. Hosts refuse them by default, and 0 keeps it that way.' },
      ],
      choose: [
        {
          q: 'Is reverse-path filtering off, at 0?',
          check: 'sysctl net.ipv4.conf.all.rp_filter net.ipv4.conf.default.rp_filter',
          hint: '0 means no check. 1 is strict and 2 is loose. For each interface, the higher of all and its own value is used.',
          yes: { key: 'rp_filter', dir: 'raise' },
        },
        {
          q: 'Does any interface accept ICMP redirects?',
          check: 'grep . /proc/sys/net/ipv4/conf/all/accept_redirects /proc/sys/net/ipv4/conf/default/accept_redirects',
          hint: 'Each line ends in the value. A 1 on all, or on an interface, means that interface takes redirects.',
          yes: { key: 'accept_redirects', dir: 'lower' },
        },
        {
          q: 'Is this machine a router that forwards traffic for others?',
          check: 'sysctl net.ipv4.ip_forward',
          hint: '1 means it forwards packets between interfaces. 0 means it is a host.',
          yes: { leave: true, why: 'A router may need to send redirects, so leave send_redirects as it is.' },
          no: { key: 'send_redirects', dir: 'lower' },
        },
      ],
      symptoms: {
        low: 'The kernel takes any redirect it receives as advice, and does not check where packets claim to come from.',
        high: 'With strict filtering on uneven routes, replies are dropped and some connections hang.',
      },
      look: {
        cmd: 'sysctl net.ipv4.conf.all.rp_filter net.ipv4.conf.all.accept_redirects net.ipv4.conf.all.send_redirects net.ipv4.conf.all.accept_source_route',
        for: 'rp_filter 1 or 2 checks senders. A 0 for the other three means no redirects taken or sent, and no source routing.',
      },
      sources: {
        ip: ip('ip-variables', 'IP variables'),
        ip6: ip('proc-sys-net-ipv6-variables', 'IPv6 variables'),
        icmp: man('icmp', 7, 'NOTES'),
      },
    },
    {
      id: 'connection-floods',
      title: 'Floods of half-open connections',
      oneLine: 'A server remembers each request to open a connection until the client answers. One setting keeps real clients getting in when that list is full.',
      picture: {
        text: 'A restaurant writes each phone booking on a short list until the guest confirms. A prankster books every table and never confirms. With SYN cookies, the restaurant stops writing once the list is full. It gives each caller a coded ticket, and seats whoever comes back with one.',
        limit: 'A coded ticket loses nothing. SYN cookies leave out some TCP features, so the kernel docs call them a fallback.',
      },
      figure: {
        kind: 'timeline',
        title: 'Requests waiting on one listening socket during a flood',
        schematic: true,
        lines: [{ id: 'backlog', label: 'Waiting list full', does: 'Once the list holds this many requests, SYN cookies take over.', value: { probe: 'security.synBacklog', unit: 'requests' } }],
        // One line sits at level 0.5, so the curve tops out there while the list is full.
        curve: [[0, 0.05], [0.15, 0.05], [0.35, 0.5], [0.75, 0.5], [0.85, 0.15], [1, 0.05]],
        events: [
          { at: 0.15, label: 'A flood starts', does: 'Many SYN packets arrive and none is ever answered.' },
          { at: 0.35, label: 'Cookies take over', does: 'The list is full, so the kernel sends cookies instead of remembering requests.', tone: 'fit' },
          { at: 0.55, label: 'Real client gets in', does: 'A client that answers the cookie is accepted.', tone: 'fit' },
          { at: 0.75, label: 'The flood ends', does: 'The list drains and normal handling returns.' },
        ],
      },
      body: [
        'A client opens a TCP connection with a first packet, a SYN[^tcp]. The server remembers each request until the client answers, up to net.ipv4.tcp_max_syn_backlog per listening socket[^tcp]. A [[SYN flood|syn-flood]] sends many SYNs and never answers, to fill that list[^tcp].',
        'net.ipv4.tcp_syncookies at 1, the default, sends SYN cookies once the list overflows[^tcp]. At 2 it sends them always, which the docs offer for testing[^tcp]. Cookies are a last resort: they break TCP rules, leave out TCP extensions and can degrade some services[^tcp][^tcp7].',
        'If the log warns of SYN flooding but the traffic is real, the server is overloaded, not attacked. The docs then advise raising other limits, such as tcp_max_syn_backlog, rather than leaning on cookies[^tcp].',
      ],
      pins: [
        { key: 'tcp_syncookies', layer: 'backlog', here: 'Whether the kernel keeps accepting connections once a socket\'s waiting list overflows. 1 sends cookies only then, and suits nearly every machine. 2 is for testing.' },
      ],
      choose: [
        {
          q: 'Are SYN cookies off, at 0?',
          check: 'sysctl net.ipv4.tcp_syncookies',
          hint: '1 is the default, and sends cookies only when a waiting list overflows.',
          yes: { key: 'tcp_syncookies', dir: 'raise' },
        },
        {
          q: 'Does the kernel log warn about SYN flooding while the traffic is real?',
          check: 'sudo dmesg | grep -i "syn flooding"',
          hint: 'Each line names the port. Real traffic behind it means the service needs larger limits.',
          yes: { leave: true, why: 'Keep 1, and raise net.ipv4.tcp_max_syn_backlog in the network tuner instead.' },
          no: { leave: true, why: '1 is the default and suits nearly every machine.' },
        },
      ],
      symptoms: {
        low: 'During a flood, new connections to the service time out while its waiting list stays full.',
        high: 'At 2, every connection gets a cookie and loses some TCP extensions, even with no flood.',
      },
      look: {
        cmd: 'sysctl net.ipv4.tcp_syncookies net.ipv4.tcp_max_syn_backlog',
        for: 'tcp_syncookies 1 sends cookies only when a list overflows. tcp_max_syn_backlog is how many requests each listening socket remembers.',
      },
      sources: {
        tcp: ip('tcp-variables', 'TCP variables'),
        tcp7: man('tcp', 7, 'DESCRIPTION'),
      },
    },
  ],
}
