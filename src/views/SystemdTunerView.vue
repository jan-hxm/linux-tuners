<script setup>
import { RouterLink } from 'vue-router'

const PLANNED_AREAS = [
  {
    title: 'systemd resource accounting',
    blurb: 'DefaultCPUAccounting, DefaultMemoryAccounting, DefaultIOAccounting — system-wide defaults that govern what every unit gets accounted for.',
    keys: ['system.conf · Default*Accounting', 'slice defaults'],
  },
  {
    title: '/etc/security/limits.conf',
    blurb: 'Per-user and per-group ulimits — nofile, nproc, memlock, stack size. Critical for databases, container runtimes, and high-connection services.',
    keys: ['nofile', 'nproc', 'memlock', 'stack'],
  },
  {
    title: 'Slice & cgroup defaults',
    blurb: 'CPU weight, memory limits, IO bandwidth for the system.slice and user.slice hierarchies that contain everything systemd launches.',
    keys: ['CPUWeight', 'MemoryMax', 'IOWeight'],
  },
]
</script>

<template>
  <section class="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
    <header class="overflow-hidden rounded-lg bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 px-6 py-10 text-white shadow-sm sm:px-10">
      <p class="text-xs uppercase tracking-widest text-slate-400">Tuner</p>
      <h1 class="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
        systemd & resource limits
      </h1>
      <p class="mt-2 inline-block rounded-full bg-amber-400/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-200">
        Coming soon
      </p>
      <p class="mt-4 max-w-2xl text-sm leading-relaxed text-slate-200">
        A tuner for systemd resource accounting defaults, slice configuration, and per-user/per-group resource limits — built in the same style as the
        <RouterLink to="/swap" class="underline hover:text-white">Swap & memory tuner</RouterLink>:
        hardware- and workload-aware defaults, live impact graphs, and a copy-pasteable config file.
      </p>
    </header>

    <section class="space-y-3">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Planned coverage</h2>
      <ul class="space-y-3">
        <li
          v-for="area in PLANNED_AREAS"
          :key="area.title"
          class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <h3 class="text-sm font-semibold text-slate-900">{{ area.title }}</h3>
          <p class="mt-1 text-sm text-slate-600">{{ area.blurb }}</p>
          <p class="mt-2 font-mono text-[11px] text-slate-500">
            {{ area.keys.join(' · ') }}
          </p>
        </li>
      </ul>
    </section>

    <section class="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm">
      <p>
        In the meantime, the
        <RouterLink to="/swap" class="font-semibold text-slate-900 underline hover:no-underline">Swap & memory tuner</RouterLink>
        is ready to use, and the
        <a href="https://github.com/jan-hxm/linux-tuners" target="_blank" rel="noopener" class="font-semibold text-slate-900 underline hover:no-underline">repository</a>
        tracks development progress.
      </p>
    </section>
  </section>
</template>
