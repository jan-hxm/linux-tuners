/**
 * Terms that recur across tuners, defined once. Copy marks a term with
 * `[[label]]` or `[[label|id]]` (ui/richText.js), and RichText renders it as a
 * button that opens the definition inline (ui/GlossaryTerm.vue). Design.md §5
 * "Domain modules behind a shared store and UI" and §8.
 *
 * Definitions are plain text (no markup, no em dashes) written for a reader
 * who knows Linux but not kernel internals. The contract suite fails on a
 * `[[…]]` whose id is not a key here, and glossary.test.js on an entry no copy
 * uses.
 *
 * @typedef {{ term: string, definition: string }} GlossaryEntry
 */

/** @type {Readonly<Record<string, GlossaryEntry>>} */
export const GLOSSARY = Object.freeze({
  'page-cache': {
    term: 'Page cache',
    definition:
      'Copies of file data the kernel keeps in otherwise unused RAM so the next read skips the disk. It shows as "buff/cache" in free. Clean cache can be dropped at any moment, so it is the first thing the kernel takes back when memory runs short.',
  },
  'anonymous-memory': {
    term: 'Anonymous memory',
    definition:
      "Memory with no file behind it: a process's heap, stack and private allocations. The kernel can't simply drop it the way it drops page cache; to free it, it has to write it to swap first.",
  },
  reclaim: {
    term: 'Reclaim',
    definition:
      'How the kernel frees memory when it runs low: it drops clean page cache, writes dirty pages back to disk, and swaps out anonymous memory. kswapd does it in the background; when that falls behind, the process asking for memory does it itself (direct reclaim) and stalls.',
  },
  watermark: {
    term: 'Watermark',
    definition:
      "One of three free-memory levels per memory zone (min, low, high). Below low, kswapd wakes and reclaims until free memory is back above high. Below min, allocations stall in direct reclaim, and only the kernel's own emergency allocations may dip further.",
  },
  kswapd: {
    term: 'kswapd',
    definition:
      'The kernel thread (one per NUMA node) that reclaims memory in the background, so programs rarely have to wait for it. It wakes at the low watermark and sleeps again at the high one.',
  },
  'dirty-page': {
    term: 'Dirty page',
    definition:
      'A page of page cache that a program has changed but the kernel has not yet written to disk. It holds data that exists only in RAM, so it must be written back before its memory can be reused.',
  },
  writeback: {
    term: 'Writeback',
    definition:
      'The kernel writing dirty pages from the page cache to their files on disk, in the background or when a program has to wait for it. Until a page is written back, a crash or power loss loses its changes.',
  },
  'oom-killer': {
    term: 'OOM killer',
    definition:
      'What the kernel runs when it is out of memory (OOM) and reclaim cannot free enough: it picks a process, mostly by memory size and its oom_score_adj, and kills it. Within a cgroup with a memory limit, it picks only from that cgroup.',
  },
  cgroup: {
    term: 'cgroup',
    definition:
      'A control group: a set of processes the kernel accounts and limits together, for CPU, memory, I/O and process count. systemd puts every service, user session and slice in its own cgroup; cgroup v2 is the single unified hierarchy current distributions use.',
  },
  namespace: {
    term: 'Namespace',
    definition:
      'A kernel feature that gives a group of processes its own view of one resource, such as process IDs, mounts, the network stack, IPC objects or user IDs. Containers are built from namespaces, so a setting can apply per namespace rather than to the whole host.',
  },
  bpf: {
    term: 'eBPF',
    definition:
      'Small programs loaded into the running kernel through the bpf() system call, checked by a verifier, then attached to events such as packets, system calls or cgroups. Tracing, firewalls, container networking and systemd use it.',
  },
  conntrack: {
    term: 'conntrack',
    definition:
      "The kernel's connection tracking table (part of netfilter): one entry per network flow, so the firewall, NAT and Docker or Kubernetes service routing know which connection each packet belongs to. When the table is full, new connections are dropped.",
  },
  'file-descriptor': {
    term: 'File descriptor',
    definition:
      'A small number a process uses to refer to something it has open: a file, a socket, a pipe or a device. Each process has a limit on how many it can hold at once (ulimit -n, RLIMIT_NOFILE).',
  },
  thp: {
    term: 'Transparent huge pages (THP)',
    definition:
      'The kernel backing ordinary program memory with 2 MiB pages on its own, without the program asking for a reserved pool. It saves page-table lookups but can cost latency when the kernel has to assemble the large pages.',
  },
  'huge-page': {
    term: 'Huge page',
    definition:
      'A memory page larger than the usual 4 KiB, typically 2 MiB or 1 GiB on x86. One huge page replaces hundreds of small ones in the page tables and the TLB, which speeds up programs with large working sets.',
  },
  tlb: {
    term: 'TLB',
    definition:
      "The translation lookaside buffer: a small cache in the CPU of recent virtual-to-physical address translations. A miss costs a walk through the page tables, so fewer, larger pages mean fewer misses.",
  },
  numa: {
    term: 'NUMA',
    definition:
      'Non-uniform memory access: on machines with several CPU sockets (and some large single CPUs), each group of cores has memory attached to it that is faster to reach than the memory of the other groups. Each group with its memory is a NUMA node.',
  },
  // swap guide
  swap: {
    term: 'Swap',
    definition:
      'Space on a disk, or in compressed RAM, where the kernel moves program memory when RAM runs short. Reading it back is slower than reading RAM. swapon --show lists the swap a machine has.',
  },
  page: {
    term: 'Page',
    definition:
      'The fixed-size block the kernel manages memory in: 4 KiB on x86, and on most other systems. RAM, file cache and swap are all handed out and counted in pages.',
  },
  'memory-zone': {
    term: 'Memory zone',
    definition:
      'A range of RAM the kernel manages on its own, such as DMA32 or Normal on x86. Each zone has its own free-memory watermarks, listed in /proc/zoneinfo.',
  },
  readahead: {
    term: 'Readahead',
    definition:
      'Reading a few neighbouring pages along with the one a program asked for, on the guess that it needs them next. A right guess saves later reads; a wrong one costs time and memory.',
  },
  zram: {
    term: 'zram',
    definition:
      'A swap device in compressed RAM. Swapped-out pages are compressed and kept in memory instead of on a disk, so reading them back usually needs no disk access.',
  },
  'dentry-cache': {
    term: 'Dentry and inode caches',
    definition:
      'The kernel keeps the file names it has looked up (dentries) in memory, with file details such as size and owner (inodes). The next lookup of the same path then skips the disk.',
  },
  'flusher-thread': {
    term: 'Flusher thread',
    definition:
      'A kernel thread that writes dirty pages to disk in the background, so the programs that changed them can carry on. It also wakes on a timer to write out data that has waited too long.',
  },
  overcommit: {
    term: 'Overcommit',
    definition:
      'Promising programs more memory than RAM and swap hold, on the bet that they will not all use what they asked for. Memory a program has asked for but not yet written to takes no RAM.',
  },
  'commit-limit': {
    term: 'Commit limit',
    definition:
      'The most memory the kernel will promise in total when overcommit is strict (vm.overcommit_memory = 2). It is all of swap plus a share of RAM. /proc/meminfo shows it as CommitLimit, and what has been promised as Committed_AS.',
  },
  'kernel-panic': {
    term: 'Kernel panic',
    definition:
      'The kernel stopping the whole machine on purpose because it cannot safely go on. Every program stops with it; the kernel.panic setting decides whether the machine then reboots on its own.',
  },
  // security guide
  capability: {
    term: 'Capability',
    definition:
      "One slice of root's power that the kernel checks on its own, such as CAP_SYSLOG to read the kernel log or CAP_SYS_PTRACE to trace any process. Root holds them all; a program can be given one without the rest.",
  },
  kaslr: {
    term: 'KASLR',
    definition:
      'Kernel address space layout randomisation: the kernel placing its own code and data at different addresses each boot, when it is built for it, so an attack cannot count on where they are.',
  },
  aslr: {
    term: 'ASLR',
    definition:
      "Address space layout randomisation: the kernel placing a program's stack, libraries and heap at random addresses each time it starts, so an attack on the program cannot count on where they are.",
  },
  vdso: {
    term: 'vDSO',
    definition:
      'A small shared library the kernel maps into every program, so a few frequent system calls, such as reading the clock, run without entering the kernel.',
  },
  ptrace: {
    term: 'ptrace',
    definition:
      'The system call that debuggers and tracers such as gdb and strace use to watch another process, stop it, and read or change its memory and registers.',
  },
  'core-dump': {
    term: 'Core dump',
    definition:
      "A file holding a copy of a program's memory at the moment it crashed, for a debugger such as gdb to inspect afterwards.",
  },
  setuid: {
    term: 'Setuid program',
    definition:
      "A program file marked to run with its owner's rights, often root's, whoever starts it. passwd works this way, so any user can change their own password.",
  },
  'sticky-bit': {
    term: 'Sticky bit',
    definition:
      "A permission bit on a folder: files in it can be renamed or deleted only by their owner, the folder's owner or a privileged process. /tmp has it, so users cannot remove each other's files.",
  },
  fifo: {
    term: 'FIFO',
    definition:
      'A named pipe: a name in a folder that one program writes into and another reads from. The data passes through the kernel and is never stored on disk.',
  },
  spoofing: {
    term: 'Spoofing',
    definition:
      'Sending network packets with a false sender address, so they seem to come from a machine that never sent them.',
  },
  'icmp-redirect': {
    term: 'ICMP redirect',
    definition:
      'A message from a router telling a host to send traffic for some destination through a different router on the same network.',
  },
  'syn-flood': {
    term: 'SYN flood',
    definition:
      "An attack that sends many requests to open TCP connections and never completes them, to fill the server's list of half-open connections so real clients cannot connect.",
  },

  // filesystem guide
  inotify: {
    term: 'inotify',
    definition:
      'A kernel feature that tells a program when files or directories change. The program adds a watch for each file or directory it cares about, and reads the events from a queue. Editors, sync tools and dev servers use it.',
  },
  'native-aio': {
    term: 'Native async I/O',
    definition:
      'The kernel interface where a program calls io_setup() to reserve request slots, then queues reads and writes and carries on while they run. Some databases use it. It is not the same as io_uring.',
  },

  // sysv-ipc guide
  'sysv-ipc': {
    term: 'System V IPC',
    definition:
      'Three older kernel tools that let programs on one machine work together: shared memory segments, semaphores and message queues. Programs create them with calls such as shmget(), semget() and msgget(), and the kernel limits how many of each may exist.',
  },
  'shm-segment': {
    term: 'Shared memory segment',
    definition:
      'A block of memory that the kernel lets several programs use at once. A change one program makes is visible to the others. A segment exists until it is removed, even when no program has it attached.',
  },
  semaphore: {
    term: 'Semaphore',
    definition:
      'A counter that programs use to take turns or to wait for each other. A program that needs the counter to be higher than it is waits until another program raises it. System V semaphores are created in groups called sets.',
  },

  // network guide
  socket: {
    term: 'Socket',
    definition:
      'The kernel object a program uses for one network connection or one listening port. Each socket has a receive buffer for data that has arrived and a send buffer for data on its way out.',
  },
  handshake: {
    term: 'TCP handshake',
    definition:
      'The three packets that open a TCP connection: the client sends SYN, the server answers SYN-ACK, and the client confirms with ACK. Only then does the connection count as established.',
  },
  'congestion-control': {
    term: 'Congestion control',
    definition:
      'How TCP decides how much data a connection may have in flight before replies come back, so it fills the path without overflowing it. The kernel can hold several algorithms, such as cubic and reno.',
  },
  qdisc: {
    term: 'Queueing discipline (qdisc)',
    definition:
      'The queue in front of a network interface that holds packets waiting to leave and decides which goes next. tc qdisc show lists the ones each interface has.',
  },
  mtu: {
    term: 'MTU',
    definition:
      'Maximum transmission unit: the largest packet a network link carries in one piece. A path through tunnels or VPNs can have a smaller one than the links at either end.',
  },
  'time-wait': {
    term: 'TIME-WAIT',
    definition:
      'The state a TCP connection stays in for a while after it closes, so late packets from it cannot be mistaken for a new connection between the same addresses and ports.',
  },
  nat: {
    term: 'NAT',
    definition:
      'Network address translation: rewriting the addresses or ports of packets on their way through, as home routers and container hosts do. The kernel applies the same rewrite to every packet of a connection.',
  },

  // block-io guide
  'block-layer': {
    term: 'Block layer',
    definition:
      'The part of the kernel between filesystems and disk drivers. It turns reads and writes into requests, merges and orders them, and hands them to the driver. Its settings for each disk are files under /sys/block/<disk>/queue.',
  },
  'io-scheduler': {
    term: 'I/O scheduler',
    definition:
      'The part of the block layer that decides the order in which waiting requests go to a disk. Each disk has its own: none, mq-deadline, bfq or kyber.',
  },
  'hardware-queue': {
    term: 'Hardware queue',
    definition:
      'The last queue in the block layer before the disk driver takes a request. How many a disk has depends on the drive and its driver, and never exceeds the number of CPU cores.',
  },
  udev: {
    term: 'udev',
    definition:
      'The service that handles device events from the kernel. When a device appears or changes, it checks its rules against the device, and a matching rule can write a setting for it. Local rules live in /etc/udev/rules.d.',
  },
  sector: {
    term: 'Sector',
    definition:
      'A numbered block of a disk. Requests name the sectors they read or write, so the kernel can tell when two requests sit next to each other and merge them.',
  },
})
