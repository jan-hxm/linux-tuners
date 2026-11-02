/**
 * Static metadata for every hardening sysctl the tuner exposes, from kernel,
 * net and fs. Each entry is the single source of truth for the key's name,
 * group, kernel default, accepted values, description and source link.
 *
 * Segmented controls stand for the values 0..n-1, one label each; toggles are
 * 0/1. `alsoSets` names the keys written with the same value (the
 * `conf.default` twin of a `conf.all` key). `kernelDefaultNote` qualifies a
 * kernel default that depends on the kernel version or the distribution build.
 *
 * @typedef {'kernel' | 'network' | 'filesystem'} SecurityGroup
 *
 * @typedef {Object} SecurityValues
 * @property {0|1|2}   kptr_restrict              0 hashes only on 4.15+
 * @property {0|1}     dmesg_restrict
 * @property {0|1|2|3|4} perf_event_paranoid      -1 (open to all) is not offered; 3 and 4 need a distro patch
 * @property {0|1|2|3} ptrace_scope               3 can't be lowered until reboot
 * @property {0|1|2}   randomize_va_space
 * @property {0|1|2}   unprivileged_bpf_disabled  1 can't be lowered until reboot; 2 needs 5.13+
 * @property {'allowed'|'blocked'} user_namespaces  'allowed' leaves user.max_user_namespaces out
 * @property {0|1|2}   rp_filter
 * @property {0|1|2}   tcp_syncookies
 * @property {0|1}     accept_redirects
 * @property {0|1}     accept_redirects_v6
 * @property {0|1}     send_redirects
 * @property {0|1}     accept_source_route
 * @property {0|1}     protected_symlinks
 * @property {0|1}     protected_hardlinks
 * @property {0|1|2}   protected_fifos            Needs 4.19+
 * @property {0|1|2}   protected_regular          Needs 4.19+
 * @property {0|1|2}   suid_dumpable
 */

const KERNEL_DOCS = 'https://docs.kernel.org/admin-guide/sysctl/kernel.html'
const FS_DOCS = 'https://docs.kernel.org/admin-guide/sysctl/fs.html'
const NET_DOCS = 'https://docs.kernel.org/networking/ip-sysctl.html'
const YAMA_DOCS = 'https://docs.kernel.org/admin-guide/LSM/Yama.html'

/** Source for the CIS notes; rendered as a plain "Source" link. */
export const CIS_BENCHMARKS = 'https://www.cisecurity.org/cis-benchmarks'

const OFF_ON = { on: 'on', off: 'off' }

export const PARAMETER_DEFS = [
  // ── Kernel ────────────────────────────────────────────────────────────────
  {
    key: 'kptr_restrict',
    title: 'Hide kernel addresses',
    tier: 'essential',
    sysctlName: 'kernel.kptr_restrict',
    group: 'kernel',
    control: 'segmented',
    segmentLabels: ['0: unrestricted', '1: hide from users', '2: hide from all'],
    shortDesc: 'Whether kernel addresses in /proc files are shown, hashed or hidden.',
    longDesc: {
      what: [
        'Kernel code prints some pointers with the %pK format, for example in /proc/modules and in many driver files. Knowing where the kernel sits in memory is the first step of most kernel exploits, because it defeats the address randomisation (KASLR) that would otherwise make them guess.',
        'At 0 kernel 4.15 and newer hash those addresses, so they are unique but useless to an attacker; older kernels print them in full. At 1 they print as zeros unless the reader has CAP_SYSLOG, and at 2 they print as zeros for everyone, root included.',
      ],
      when: [
        'The same setting decides who sees real addresses in /proc/kallsyms. At 0, every user does when perf_event_paranoid is 1 or lower; at 1 only CAP_SYSLOG holders do. Use 1 on most systems; 2 also blinds root tools such as perf and crash analysers.',
      ],
    },
    tuningTip: 'Use 1 so only privileged tools see addresses; 2 if root never needs them.',
    kernelDocsUrl: `${KERNEL_DOCS}#kptr-restrict`,
    cisNote: null,
    kernelDefault: 0,
    kernelMin: 0,
    kernelMax: 2,
    step: 1,
    unit: 'segment',
  },
  {
    key: 'dmesg_restrict',
    title: 'Restrict the kernel log',
    tier: 'essential',
    sysctlName: 'kernel.dmesg_restrict',
    group: 'kernel',
    type: 'bool',
    control: 'toggle',
    toggleLabels: { on: 'on: only CAP_SYSLOG can read the kernel log', off: 'off: every user can read the kernel log' },
    shortDesc: 'Whether unprivileged users may read the kernel log with dmesg.',
    longDesc: {
      what: [
        'The kernel log records driver messages, crashes and oopses, and those often contain kernel addresses and other details useful to an attacker. When this is on, reading it needs CAP_SYSLOG, which in practice means root.',
      ],
      when: [
        'Several distributions build their kernels with this on by default (the CONFIG_SECURITY_DMESG_RESTRICT option). Turning it on costs little: admins still read the log with sudo dmesg or journalctl -k.',
      ],
    },
    tuningTip: 'Turn it on; read the log with sudo dmesg or journalctl -k.',
    kernelDocsUrl: `${KERNEL_DOCS}#dmesg-restrict`,
    cisNote: null,
    kernelDefault: 0,
    kernelMin: 0,
    kernelMax: 1,
    step: 1,
    unit: 'bool',
  },
  {
    key: 'perf_event_paranoid',
    title: 'Restrict perf profiling',
    tier: 'advanced',
    sysctlName: 'kernel.perf_event_paranoid',
    group: 'kernel',
    control: 'segmented',
    segmentLabels: ['0: system-wide', '1: own processes', '2: own, user space', '3: none (Debian)', '4: none (patched)'],
    shortDesc: 'How much of the perf profiling interface unprivileged users get.',
    longDesc: {
      what: [
        'perf_event_open() gives programs access to CPU performance counters, tracepoints and kernel profiling. It is a large, complex interface, and it has been the source of several kernel vulnerabilities, so it is restricted for users without CAP_PERFMON (or CAP_SYS_ADMIN on kernels before 5.8).',
        'At 0 users may also collect CPU-wide events; at 1 they may profile their own processes including kernel code; at 2 (the upstream default) only the user-space part of their own processes. The value -1, open to everyone, is not offered here.',
      ],
      watch: [
        'Debian and Android kernels carry a patch that blocks unprivileged perf entirely from 3 up, and so did older Ubuntu kernels (18.04). Current Ubuntu kernels (24.04) block it only from 4, start at 4, and treat 3 like 2. Upstream kernels accept 3 and 4 and treat both like 2, so 4 is the value that blocks perf wherever a patch exists.',
      ],
    },
    tuningTip: 'Keep 2 for developers who profile their own code; use 4 on servers.',
    kernelDocsUrl: `${KERNEL_DOCS}#perf-event-paranoid`,
    cisNote: null,
    kernelDefault: 2,
    kernelDefaultNote: 'Debian kernels start at 3, current Ubuntu kernels at 4.',
    kernelMin: 0,
    kernelMax: 4,
    step: 1,
    unit: 'segment',
  },
  {
    key: 'ptrace_scope',
    title: 'Restrict ptrace',
    tier: 'essential',
    sysctlName: 'kernel.yama.ptrace_scope',
    group: 'kernel',
    control: 'segmented',
    segmentLabels: ['0: classic', '1: descendants', '2: admin only', '3: disabled'],
    shortDesc: 'Which processes may attach to others with ptrace (debuggers, strace).',
    longDesc: {
      what: [
        'ptrace lets one process inspect and change the memory of another. Classically any process could attach to every other process of the same user, so a single compromised program could read the SSH keys or browser passwords held by all the others.',
        'The Yama security module narrows that. At 1 a process may only attach to its own descendants, unless the target allows it explicitly, which keeps gdb ./program and strace ./program working. At 2 only processes with CAP_SYS_PTRACE may attach; at 3 nobody can.',
      ],
      watch: [
        'Value 3 can\'t be changed again until the next reboot. The key only exists when the kernel is built with Yama, which the major distributions do.',
      ],
    },
    tuningTip: 'Use 1 where people debug, 2 on servers, 3 only if nothing ever needs ptrace.',
    kernelDocsUrl: `${YAMA_DOCS}#ptrace-scope`,
    cisNote: 'CIS Linux benchmarks require ptrace to be restricted, which means at least 1.',
    kernelDefault: 1,
    kernelMin: 0,
    kernelMax: 3,
    step: 1,
    unit: 'segment',
  },
  {
    key: 'randomize_va_space',
    title: 'Address randomisation (ASLR)',
    tier: 'advanced',
    sysctlName: 'kernel.randomize_va_space',
    group: 'kernel',
    control: 'segmented',
    segmentLabels: ['0: off', '1: partial', '2: full'],
    shortDesc: 'Address space layout randomisation (ASLR) for user processes.',
    longDesc: {
      what: [
        'ASLR places the stack, shared libraries, mmap areas and the heap at random addresses each time a program starts, so an exploit can\'t rely on knowing where its target is in memory.',
      ],
      when: [
        'At 2 (the default) everything including the heap is randomised. At 1 the heap (brk) stays put, which only very old binaries need. At 0 ASLR is off entirely, which is occasionally done for debugging and should never stay that way.',
      ],
    },
    tuningTip: 'Leave it at 2.',
    kernelDocsUrl: `${KERNEL_DOCS}#randomize-va-space`,
    cisNote: 'CIS Linux benchmarks require 2 (full randomisation).',
    kernelDefault: 2,
    kernelMin: 0,
    kernelMax: 2,
    step: 1,
    unit: 'segment',
  },
  {
    key: 'unprivileged_bpf_disabled',
    title: 'Block unprivileged BPF',
    tier: 'essential',
    sysctlName: 'kernel.unprivileged_bpf_disabled',
    group: 'kernel',
    control: 'segmented',
    segmentLabels: ['0: allowed', '1: off, locked', '2: off'],
    shortDesc: 'Whether users without privileges may load BPF programs.',
    longDesc: {
      what: [
        'The bpf() system call loads small programs into the kernel, checked first by the BPF verifier. When unprivileged users may call it, every user can reach the verifier, and verifier bugs have led to several local privilege escalations.',
        'At 1 unprivileged bpf() is off and can\'t be turned back on until the next reboot. At 2 it is off but an admin can change it again. Value 2 needs kernel 5.13 or newer; older upstream kernels accept only 1 and reject writing 0, so this tuner sets 1 there and leaves the key out of the file at 0. Some distribution kernels before 5.13 (Debian 11, Ubuntu 18.04) carry the newer code and start at 2; on those, 1 swaps a reversible setting for one that holds until reboot.',
      ],
      watch: [
        'Kernels built with CONFIG_BPF_UNPRIV_DEFAULT_OFF start at 2. That option is on by default from kernel 5.16 and in the major distributions\' kernels, so writing 0 on a current kernel turns unprivileged BPF back on. Tools such as bpftrace and most BPF-based monitoring run as root and are not affected.',
      ],
    },
    tuningTip: 'Use 2 on 5.13+, 1 on older kernels, unless something really needs unprivileged BPF.',
    kernelDocsUrl: `${KERNEL_DOCS}#unprivileged-bpf-disabled`,
    cisNote: null,
    kernelDefault: 2,
    kernelDefaultNote: 'From 5.16, and in most distribution kernels; older kernels, or ones built without CONFIG_BPF_UNPRIV_DEFAULT_OFF, start at 0.',
    kernelMin: 0,
    kernelMax: 2,
    step: 1,
    unit: 'segment',
  },
  {
    key: 'user_namespaces',
    title: 'User namespaces',
    tier: 'advanced',
    sysctlName: 'user.max_user_namespaces',
    group: 'kernel',
    type: 'enum',
    control: 'select',
    // 'allowed' keeps the kernel's own limit and is left out of the file.
    options: [
      { value: 'allowed', label: 'allowed (kernel limit)' },
      { value: 'blocked', sysctlValue: '0', label: '0: blocked for everyone' },
    ],
    shortDesc: 'Whether any process may create a user namespace.',
    longDesc: {
      what: [
        'A user namespace gives a process root inside it, with every capability over the mount, network and other namespaces it creates there. That lets unprivileged users reach kernel code otherwise kept for root, such as netfilter and filesystem mounting, and bugs there have led to many local privilege escalations.',
        'The kernel limits how many each user may create, at half of kernel.threads-max by default. At 0 nobody can create one, root included, and the change applies at once. Rootless containers (Podman, rootless Docker), Flatpak and the sandboxes of Chromium-based browsers need them, and so do systemd services with PrivateUsers=: uuidd on Debian and Ubuntu and chrony-wait on Fedora fail to start.',
      ],
      watch: [
        'Debian and Ubuntu kernels also have kernel.unprivileged_userns_clone, which blocks only unprivileged users at 0, and Ubuntu 24.04 already stops them from gaining privileges in one through AppArmor, unless a program\'s AppArmor profile allows it.',
      ],
    },
    tuningTip: 'Block them on servers that run no containers; keep them where something sandboxes.',
    kernelDocsUrl: 'https://docs.kernel.org/admin-guide/sysctl/user.html#max-user-namespaces',
    cisNote: null,
    kernelDefault: 'allowed',
    kernelDefaultNote: 'The limit is half of kernel.threads-max, which follows RAM: about 7,800 on a 2 GB machine.',
    kernelMin: 0,
    kernelMax: 0,
    unit: 'enum',
  },

  // ── Network ───────────────────────────────────────────────────────────────
  {
    key: 'rp_filter',
    title: 'Reverse-path filter',
    tier: 'essential',
    sysctlName: 'net.ipv4.conf.all.rp_filter',
    alsoSets: ['net.ipv4.conf.default.rp_filter'],
    group: 'network',
    control: 'segmented',
    segmentLabels: ['0: off', '1: strict', '2: loose'],
    shortDesc: 'Reverse-path filtering: drop packets whose source address looks spoofed.',
    longDesc: {
      what: [
        'For each incoming IPv4 packet the kernel can check whether it would route a reply back out the same way. Strict mode (1, RFC 3704) drops the packet if the interface it arrived on is not the best route back to its source. Loose mode (2) only drops it if the source is not reachable through any interface.',
      ],
      when: [
        'Strict mode stops spoofed traffic best, but it drops legitimate packets on asymmetric routes: multi-homed hosts, routers with several uplinks, some VPNs and some container network plugins. Loose mode is the safe choice there, and it is what systemd sets by default.',
      ],
      watch: [
        'The kernel uses the higher of conf.all and each interface\'s own value, and loose (2) counts as higher than strict (1). systemd sets every interface to 2, so strict mode only takes effect once the interface values are lowered too; the generated file explains how.',
      ],
    },
    tuningTip: 'Use strict (1) on single-homed servers, loose (2) wherever routes can be asymmetric.',
    kernelDocsUrl: NET_DOCS,
    cisNote: 'CIS Linux benchmarks set 1 (strict) on all and default.',
    kernelDefault: 0,
    kernelMin: 0,
    kernelMax: 2,
    step: 1,
    unit: 'segment',
  },
  {
    key: 'tcp_syncookies',
    title: 'SYN cookies',
    tier: 'essential',
    sysctlName: 'net.ipv4.tcp_syncookies',
    group: 'network',
    control: 'segmented',
    segmentLabels: ['0: off', '1: on overflow', '2: always'],
    shortDesc: 'SYN cookies: keep accepting connections during a SYN flood.',
    longDesc: {
      what: [
        'A SYN flood fills a listening socket\'s queue of half-open connections so that real clients can\'t connect. With SYN cookies the kernel stops queueing once the queue overflows and encodes the connection state in the sequence number of its reply instead, so legitimate clients still get through.',
        'At 1 (the default) cookies are only used when the queue overflows, which also shows a warning in the kernel log. At 2 every connection gets a cookie, even without a flood; that mode is meant for testing. The setting covers IPv6 as well.',
      ],
    },
    tuningTip: 'Leave it at 1; if the log warns about SYN flooding on a busy server, raise the listen backlog instead of turning cookies off.',
    kernelDocsUrl: NET_DOCS,
    cisNote: 'CIS Linux benchmarks set 1.',
    kernelDefault: 1,
    kernelMin: 0,
    kernelMax: 2,
    step: 1,
    unit: 'segment',
  },
  {
    key: 'accept_redirects',
    title: 'Accept IPv4 redirects',
    tier: 'essential',
    sysctlName: 'net.ipv4.conf.all.accept_redirects',
    alsoSets: ['net.ipv4.conf.default.accept_redirects'],
    group: 'network',
    type: 'bool',
    control: 'toggle',
    toggleLabels: { on: 'on: accept ICMP redirects', off: 'off: ignore ICMP redirects' },
    toggleDanger: true,
    shortDesc: 'Whether IPv4 ICMP redirects may change this host\'s routes.',
    longDesc: {
      what: [
        'An ICMP redirect tells a host to send traffic for some destination through a different gateway. Anyone on the local network can forge one, so accepting them lets an attacker reroute traffic through a machine they control.',
      ],
      watch: [
        'Hosts with a correct routing table never need them. On a host that doesn\'t forward, the kernel accepts redirects on an interface if either conf.all or the interface itself allows them. Writing conf.default also updates existing interfaces whose own value was never set, but an interface whose value something else set keeps it, so check the interfaces after applying.',
      ],
    },
    tuningTip: 'Turn it off everywhere.',
    kernelDocsUrl: NET_DOCS,
    cisNote: 'CIS Linux benchmarks set 0 on all and default.',
    kernelDefault: 1,
    kernelMin: 0,
    kernelMax: 1,
    step: 1,
    unit: 'bool',
  },
  {
    key: 'accept_redirects_v6',
    title: 'Accept IPv6 redirects',
    tier: 'advanced',
    sysctlName: 'net.ipv6.conf.all.accept_redirects',
    alsoSets: ['net.ipv6.conf.default.accept_redirects'],
    group: 'network',
    type: 'bool',
    control: 'toggle',
    toggleLabels: { on: 'on: accept ICMPv6 redirects', off: 'off: ignore ICMPv6 redirects' },
    toggleDanger: true,
    shortDesc: 'Whether IPv6 ICMP redirects may change this host\'s routes.',
    longDesc: {
      what: [
        'The IPv6 version of the same attack: a forged ICMPv6 redirect from the local network points traffic at the wrong next hop. Hosts with a correct routing table don\'t need redirects.',
      ],
      watch: [
        'IPv6 works differently from IPv4 here: the kernel only looks at each interface\'s own value. conf.all has no effect, and conf.default only reaches interfaces created later, so interfaces that already exist, often including the main one at boot, keep accepting redirects. The generated file shows how to switch them off too.',
        'These keys only exist while IPv6 is enabled, so they are left out of the file when the profile says IPv6 is off.',
      ],
    },
    tuningTip: 'Turn it off everywhere.',
    kernelDocsUrl: NET_DOCS,
    cisNote: 'CIS Linux benchmarks set 0 on all and default.',
    kernelDefault: 1,
    kernelMin: 0,
    kernelMax: 1,
    step: 1,
    unit: 'bool',
  },
  {
    key: 'send_redirects',
    title: 'Send redirects',
    tier: 'advanced',
    sysctlName: 'net.ipv4.conf.all.send_redirects',
    alsoSets: ['net.ipv4.conf.default.send_redirects'],
    group: 'network',
    type: 'bool',
    control: 'toggle',
    toggleLabels: { on: 'on: send ICMP redirects', off: 'off: never send ICMP redirects' },
    shortDesc: 'Whether this host sends ICMP redirects when it forwards traffic.',
    longDesc: {
      what: [
        'A router sends a redirect when it forwards a packet back out the interface it came in on, to tell the sender about a shorter path. A host that isn\'t a router has no reason to send them, and one that does reveals routing information.',
      ],
      watch: [
        'Like accept_redirects, the kernel sends redirects on an interface if either conf.all or the interface allows it, so check interfaces that already exist.',
      ],
    },
    tuningTip: 'Turn it off unless the machine is a router.',
    kernelDocsUrl: NET_DOCS,
    cisNote: 'CIS Linux benchmarks set 0 on all and default unless the host is a router.',
    kernelDefault: 1,
    kernelMin: 0,
    kernelMax: 1,
    step: 1,
    unit: 'bool',
  },
  {
    key: 'accept_source_route',
    title: 'Accept source routing',
    tier: 'advanced',
    sysctlName: 'net.ipv4.conf.all.accept_source_route',
    alsoSets: ['net.ipv4.conf.default.accept_source_route'],
    group: 'network',
    type: 'bool',
    control: 'toggle',
    toggleLabels: { on: 'on: accept source-routed packets', off: 'off: drop source-routed packets' },
    toggleDanger: true,
    shortDesc: 'Whether IPv4 packets may choose their own path (source routing).',
    longDesc: {
      what: [
        'A source-routed packet carries the list of hops it wants to take. Honouring it lets a sender steer traffic around firewalls or make it appear to come from a trusted network.',
        'Hosts drop these packets by default. Setting the key explicitly keeps it that way even if something else on the system changes it.',
      ],
    },
    tuningTip: 'Keep it off.',
    kernelDocsUrl: NET_DOCS,
    cisNote: 'CIS Linux benchmarks set 0 on all and default.',
    kernelDefault: 0,
    kernelMin: 0,
    kernelMax: 1,
    step: 1,
    unit: 'bool',
  },

  // ── Filesystem ────────────────────────────────────────────────────────────
  {
    key: 'protected_symlinks',
    title: 'Protect symlinks',
    tier: 'essential',
    sysctlName: 'fs.protected_symlinks',
    group: 'filesystem',
    type: 'bool',
    control: 'toggle',
    toggleLabels: OFF_ON,
    shortDesc: 'Block following other users\' symlinks in shared directories like /tmp.',
    longDesc: {
      what: [
        'A classic attack plants a symlink in a world-writable directory such as /tmp, waits for a privileged program to write a file of that name, and makes it overwrite /etc/shadow instead.',
        'When this is on, a symlink in a sticky world-writable directory is only followed if it belongs to the follower or to the directory\'s owner. systemd turns it on by default, so on most distributions it already is.',
      ],
    },
    tuningTip: 'Turn it on.',
    kernelDocsUrl: `${FS_DOCS}#protected-symlinks`,
    cisNote: null,
    kernelDefault: 0,
    kernelMin: 0,
    kernelMax: 1,
    step: 1,
    unit: 'bool',
  },
  {
    key: 'protected_hardlinks',
    title: 'Protect hard links',
    tier: 'essential',
    sysctlName: 'fs.protected_hardlinks',
    group: 'filesystem',
    type: 'bool',
    control: 'toggle',
    toggleLabels: OFF_ON,
    shortDesc: 'Block hard links to files the user doesn\'t own or can\'t write.',
    longDesc: {
      what: [
        'Without this, any user can create a hard link to a file they can\'t write, such as a setuid binary, and keep it around after an update has replaced the original, or trick a privileged program into changing it.',
        'When this is on, users may only hard-link files they own or can read and write. systemd turns it on by default.',
      ],
    },
    tuningTip: 'Turn it on.',
    kernelDocsUrl: `${FS_DOCS}#protected-hardlinks`,
    cisNote: null,
    kernelDefault: 0,
    kernelMin: 0,
    kernelMax: 1,
    step: 1,
    unit: 'bool',
  },
  {
    key: 'protected_fifos',
    title: 'Protect FIFOs',
    tier: 'advanced',
    sysctlName: 'fs.protected_fifos',
    group: 'filesystem',
    control: 'segmented',
    segmentLabels: ['0: off', '1: world-writable dirs', '2: group-writable too'],
    shortDesc: 'Block opening other users\' FIFOs in shared sticky directories.',
    longDesc: {
      what: [
        'Like the symlink attack, but with a named pipe: a user plants a FIFO in /tmp where a privileged program expects to create a file, and the program ends up writing into the attacker\'s pipe.',
        'At 1 an O_CREAT open of a FIFO the opener doesn\'t own fails in sticky world-writable directories, unless the FIFO belongs to the directory\'s owner. At 2 the same applies to group-writable sticky directories. Needs kernel 4.19 or newer; systemd sets 1.',
      ],
    },
    tuningTip: 'Use 1, or 2 for the strictest setting.',
    kernelDocsUrl: `${FS_DOCS}#protected-fifos`,
    cisNote: null,
    kernelDefault: 0,
    kernelMin: 0,
    kernelMax: 2,
    step: 1,
    unit: 'segment',
  },
  {
    key: 'protected_regular',
    title: 'Protect regular files',
    tier: 'advanced',
    sysctlName: 'fs.protected_regular',
    group: 'filesystem',
    control: 'segmented',
    segmentLabels: ['0: off', '1: world-writable dirs', '2: group-writable too'],
    shortDesc: 'Block opening other users\' files in shared sticky directories.',
    longDesc: {
      what: [
        'The same protection for regular files: a privileged program that opens a predictable name in /tmp with O_CREAT can\'t be made to write into a file an attacker created there first.',
        'Levels 1 and 2 work as for protected_fifos. Needs kernel 4.19 or newer; systemd sets 1.',
      ],
    },
    tuningTip: 'Use 1, or 2 for the strictest setting.',
    kernelDocsUrl: `${FS_DOCS}#protected-regular`,
    cisNote: null,
    kernelDefault: 0,
    kernelMin: 0,
    kernelMax: 2,
    step: 1,
    unit: 'segment',
  },
  {
    key: 'suid_dumpable',
    title: 'Core dumps of setuid programs',
    tier: 'essential',
    sysctlName: 'fs.suid_dumpable',
    group: 'filesystem',
    control: 'segmented',
    segmentLabels: ['0: no dumps', '1: debug (insecure)', '2: root only'],
    shortDesc: 'Whether setuid and other privileged processes write core dumps.',
    longDesc: {
      what: [
        'A core dump is a copy of a crashed process\'s memory. For a setuid program or one that changed its privileges, that memory can hold password hashes, keys and other secrets, so by default (0) such processes don\'t dump at all.',
        'At 1 they dump as if they were ordinary processes, readable by the user who ran them; the kernel documents this as insecure and for debugging only. At 2 the dump is readable by root only, and it is only written when kernel.core_pattern is a pipe (as with systemd-coredump or apport) or an absolute path.',
      ],
      watch: [
        'On Ubuntu, apport sets this to 2 each time it starts, after the sysctl files are applied, so 0 doesn\'t hold unless apport is turned off. The generated file says how.',
      ],
    },
    tuningTip: 'Use 0; 2 if a crash handler such as systemd-coredump needs those dumps.',
    kernelDocsUrl: `${FS_DOCS}#suid-dumpable`,
    cisNote: 'CIS Linux benchmarks set 0 as part of restricting core dumps.',
    kernelDefault: 0,
    kernelMin: 0,
    kernelMax: 2,
    step: 1,
    unit: 'segment',
  },
]

/** Quick lookup by key. */
export const PARAMETER_DEFS_BY_KEY = Object.fromEntries(PARAMETER_DEFS.map((p) => [p.key, p]))

/** All parameter keys, in display order. */
export const PARAMETER_KEYS = PARAMETER_DEFS.map((p) => p.key)
