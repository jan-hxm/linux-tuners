<script setup>
import { RouterLink } from 'vue-router'
import AdSlot from '@/components/AdSlot.vue'

// Curated topic tuners. `available` ones are shipped routes; the rest are the
// roadmap toward covering the whole sysctl tree plus the key sysfs runtime
// tunables. Grouped by what an operator tunes together (so e.g. hardening keys
// from kernel/net/fs live in one "Security hardening" tuner) rather than strictly
// per /proc/sys root. Don't give a roadmap entry a route until it actually works.
const TUNERS = [
  {
    id: 'swap',
    available: true,
    to: '/swap',
    title: 'Swap & memory',
    blurb: 'Hardware-aware tuning of vm.* sysctl parameters: swappiness, watermarks, dirty-page writeback, and OOM behaviour. Live graphs of swap pressure, watermark zones, and the dirty timeline.',
    keys: ['vm.swappiness', 'vm.min_free_kbytes', 'vm.watermark_scale_factor', 'vm.dirty_ratio', '…'],
  },
  {
    id: 'systemd',
    available: true,
    to: '/systemd',
    title: 'systemd & resource limits',
    blurb: 'Tune systemd manager defaults and per-slice cgroup v2 resource control: accounting, task and FD limits, and CPU/memory/IO weights and caps for clustered and containerised Linux workloads.',
    keys: ['CPUWeight', 'MemoryMax', 'DefaultTasksMax', 'DefaultLimitNOFILE', '…'],
  },
  {
    id: 'network',
    available: false,
    title: 'Network stack',
    blurb: 'Tune net.core and net.ipv4 sysctls for throughput and latency, covering socket buffer sizes, the listen backlog, congestion control, TIME_WAIT reuse, and netfilter connection tracking.',
    keys: ['net.core.rmem_max', 'net.ipv4.tcp_congestion_control', 'net.core.somaxconn', 'net.netfilter.nf_conntrack_max', '…'],
  },
  {
    id: 'filesystem',
    available: false,
    title: 'Filesystem & file descriptors',
    blurb: 'Tune fs.* sysctls for file-heavy and event-driven workloads, covering the system-wide file-descriptor ceiling, inotify watch limits, and async I/O capacity.',
    keys: ['fs.file-max', 'fs.inotify.max_user_watches', 'fs.aio-max-nr', '…'],
  },
  {
    id: 'kernel',
    available: false,
    title: 'Kernel & scheduler',
    blurb: 'Tune kernel.* sysctls for scheduling and system behaviour, covering CFS scheduler tunables, the PID and thread ceilings, panic and printk behaviour, and user-namespace limits.',
    keys: ['kernel.sched_*', 'kernel.pid_max', 'kernel.threads-max', 'user.max_user_namespaces', '…'],
  },
  {
    id: 'hugepages',
    available: false,
    title: 'Huge pages & memory layout',
    blurb: 'Tune the rest of vm.* plus Transparent Huge Pages for large-memory workloads, covering hugepage pools, the mmap count limit, NUMA zone reclaim, and THP and KSM policy.',
    keys: ['vm.nr_hugepages', 'vm.max_map_count', 'vm.zone_reclaim_mode', '/sys/kernel/mm/transparent_hugepage', '…'],
  },
  {
    id: 'sysv-ipc',
    available: false,
    title: 'System V IPC & shared memory',
    blurb: 'Tune System V IPC limits for databases and legacy middleware, covering shared-memory segment sizes, semaphore arrays, and message-queue limits.',
    keys: ['kernel.shmmax', 'kernel.shmall', 'kernel.sem', 'kernel.msgmni', '…'],
  },
  {
    id: 'security',
    available: false,
    title: 'Security hardening',
    blurb: 'A hardening profile (CIS-benchmark style) that pulls security-relevant sysctls together from kernel, net, and fs, covering pointer and dmesg restrictions, ptrace scope, reverse-path filtering, SYN cookies, and link protections.',
    keys: ['kernel.kptr_restrict', 'kernel.yama.ptrace_scope', 'net.ipv4.tcp_syncookies', 'fs.protected_symlinks', '…'],
  },
  {
    id: 'block-io',
    available: false,
    title: 'Block I/O & storage',
    blurb: 'Tune the block layer through sysfs for storage-bound workloads, covering the per-device I/O scheduler, queue depth, and read-ahead.',
    keys: ['/sys/block/<dev>/queue/scheduler', 'nr_requests', 'read_ahead_kb', '…'],
  },
  {
    id: 'cpu-power',
    available: false,
    title: 'CPU frequency & power',
    blurb: 'Tune CPU frequency scaling and placement through sysfs, covering the cpufreq governor, min and max frequencies, the energy-vs-performance bias, and NUMA balancing.',
    keys: ['scaling_governor', 'scaling_max_freq', 'kernel.numa_balancing', '…'],
  },
]

const availableTuners = TUNERS.filter((t) => t.available)
const roadmapTuners = TUNERS.filter((t) => !t.available)
</script>

<template>
  <section class="mx-auto max-w-6xl space-y-10 p-4 sm:p-6">
    <!-- Hero -->
    <header class="overflow-hidden rounded-lg bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 px-6 py-10 text-white shadow-sm sm:px-10 sm:py-14">
      <div class="max-w-3xl">
        <p class="text-xs uppercase tracking-widest text-slate-400">linux-tuners.dev</p>
        <h1 class="mt-2 text-2xl font-semibold leading-tight tracking-tight sm:text-4xl">
          Interactive Linux config tuners, grounded in the docs.
        </h1>
        <p class="mt-4 text-sm leading-relaxed text-slate-200 sm:text-base">
          Drag sliders. Watch the impact. Copy the config. Each tuner explains every option in plain language, derives sensible defaults from your hardware, and shows the kernel-level effect live, so you understand what you're changing, not just what to type.
        </p>
        <p class="mt-4 text-xs text-slate-400">
          URL-encodable state for sharing.
        </p>
      </div>
    </header>

    <AdSlot slot="landing" label="landing top" />

    <!-- Available tuners -->
    <section class="space-y-4">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Tuners</h2>
      <ul class="grid gap-4 sm:grid-cols-2">
        <li v-for="tuner in availableTuners" :key="tuner.id">
          <RouterLink
            :to="tuner.to"
            class="flex h-full flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-400 hover:shadow"
          >
            <header class="flex items-baseline justify-between gap-2">
              <h3 class="text-lg font-semibold text-slate-900">{{ tuner.title }}</h3>
              <span class="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                Available
              </span>
            </header>
            <p class="mt-2 flex-1 text-sm text-slate-600">{{ tuner.blurb }}</p>
            <ul class="mt-3 flex flex-wrap gap-1">
              <li
                v-for="key in tuner.keys"
                :key="key"
                class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600"
              >{{ key }}</li>
            </ul>
            <p class="mt-4 text-xs font-medium text-slate-700">Open tuner →</p>
          </RouterLink>
        </li>
      </ul>
    </section>

    <!-- Roadmap -->
    <section class="space-y-4">
      <div>
        <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">On the roadmap</h2>
        <p class="mt-1 text-xs text-slate-500">
          Coverage is expanding toward the whole sysctl tree plus the key sysfs runtime tunables. Each card below is a planned tuner built on the same hardware-aware, doc-grounded model.
        </p>
      </div>
      <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <li v-for="tuner in roadmapTuners" :key="tuner.id">
          <div class="flex h-full flex-col rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5">
            <header class="flex items-baseline justify-between gap-2">
              <h3 class="text-base font-semibold text-slate-700">{{ tuner.title }}</h3>
              <span class="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                Coming soon
              </span>
            </header>
            <p class="mt-2 flex-1 text-sm text-slate-600">{{ tuner.blurb }}</p>
            <ul class="mt-3 flex flex-wrap gap-1">
              <li
                v-for="key in tuner.keys"
                :key="key"
                class="rounded bg-slate-200/60 px-1.5 py-0.5 font-mono text-[11px] text-slate-600"
              >{{ key }}</li>
            </ul>
          </div>
        </li>
      </ul>
    </section>

    <!-- Why this exists -->
    <section class="space-y-3">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Why this exists</h2>
      <div class="rounded-lg border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-700 shadow-sm sm:p-6">
        <p>
          Linux system-tuning advice lives in scattered blog posts, kernel.org pages, and tribal ops knowledge. The values you should pick depend strongly on your hardware (RAM, swap device, disk type, NIC) and your workload (Kubernetes node, database server, desktop), yet most tuning guides are static, generic, and silent about the tradeoffs.
        </p>
        <p class="mt-3">
          Each tuner here asks about your system first, derives sensible starting values from the documentation, lets you customise via sliders, and shows the kernel-level impact through live graphs grounded in the same formulas the kernel uses internally. The output is a ready-to-paste config file with citations to the source documentation.
        </p>
      </div>
    </section>
  </section>
</template>
