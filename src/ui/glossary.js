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
})
