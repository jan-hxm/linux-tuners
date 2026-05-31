<script setup>
import { RouterLink } from 'vue-router'
import AdSlot from '@/components/AdSlot.vue'

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
    available: false,
    to: '/systemd',
    title: 'systemd & resource limits',
    blurb: 'Coming soon — tune systemd resource accounting defaults, slice configuration, and /etc/security/limits.conf for clustered and containerised Linux workloads.',
    keys: ['DefaultMemoryAccounting', 'DefaultCPUAccounting', 'limits.nofile', '…'],
  },
]
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
          Drag sliders. Watch the impact. Copy the config. Each tuner explains every option in plain language, derives sensible defaults from your hardware, and shows the kernel-level effect live — so you understand what you're changing, not just what to type.
        </p>
        <p class="mt-4 text-xs text-slate-400">
          URL-encodable state for sharing.
        </p>
      </div>
    </header>

    <AdSlot slot="landing" label="landing top" />

    <!-- Tuner grid -->
    <section class="space-y-4">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Tuners</h2>
      <ul class="grid gap-4 sm:grid-cols-2">
        <li v-for="tuner in TUNERS" :key="tuner.id">
          <RouterLink
            v-if="tuner.available"
            :to="tuner.to"
            class="flex h-full flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-400 hover:shadow"
          >
            <header class="flex items-baseline justify-between gap-2">
              <h3 class="text-lg font-semibold text-slate-900">{{ tuner.title }}</h3>
              <span class="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                Available
              </span>
            </header>
            <p class="mt-2 flex-1 text-sm text-slate-600">{{ tuner.blurb }}</p>
            <p class="mt-3 truncate font-mono text-[11px] text-slate-500" :title="tuner.keys.join(' · ')">
              {{ tuner.keys.join(' · ') }}
            </p>
            <p class="mt-4 text-xs font-medium text-slate-700">Open tuner →</p>
          </RouterLink>

          <div
            v-else
            class="flex h-full flex-col rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5"
          >
            <header class="flex items-baseline justify-between gap-2">
              <h3 class="text-lg font-semibold text-slate-700">{{ tuner.title }}</h3>
              <span class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                Coming soon
              </span>
            </header>
            <p class="mt-2 flex-1 text-sm text-slate-600">{{ tuner.blurb }}</p>
            <p class="mt-3 truncate font-mono text-[11px] text-slate-500" :title="tuner.keys.join(' · ')">
              {{ tuner.keys.join(' · ') }}
            </p>
          </div>
        </li>
      </ul>
    </section>

    <!-- Why this exists -->
    <section class="space-y-3">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Why this exists</h2>
      <div class="rounded-lg border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-700 shadow-sm sm:p-6">
        <p>
          Linux system-tuning advice lives in scattered blog posts, kernel.org pages, and tribal ops knowledge. The values you should pick depend strongly on your hardware (RAM, swap device, disk type, NIC) and your workload (Kubernetes node, database server, desktop) — yet most tuning guides are static, generic, and silent about the tradeoffs.
        </p>
        <p class="mt-3">
          Each tuner here asks about your system first, derives sensible starting values from the documentation, lets you customise via sliders, and shows the kernel-level impact through live graphs grounded in the same formulas the kernel uses internally. The output is a ready-to-paste config file with citations to the source documentation.
        </p>
      </div>
    </section>
  </section>
</template>
