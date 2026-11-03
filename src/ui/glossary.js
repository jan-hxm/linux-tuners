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
})
