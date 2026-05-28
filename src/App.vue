<script setup>
import { useTunerStore } from '@/stores/tuner.js'

const tuner = useTunerStore()
</script>

<template>
  <main class="mx-auto max-w-5xl p-6">
    <header class="mb-6">
      <h1 class="text-2xl font-semibold tracking-tight">sysctl swap tuner</h1>
      <p class="text-sm text-slate-600">
        Hardware-aware vm.* tuning, live graphs, copy-pasteable config.
      </p>
    </header>

    <section class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 class="text-sm font-medium uppercase tracking-wide text-slate-500">Foundation in place</h2>
      <p class="mt-2 text-sm text-slate-700">
        Hardware: {{ tuner.hardware.ramGiB }} GiB RAM, {{ tuner.hardware.swapGiB }} GiB
        {{ tuner.hardware.swapDevice }} swap, workload =
        <span class="font-mono">{{ tuner.hardware.workload }}</span>.
      </p>
      <p class="mt-2 text-sm text-slate-700">
        Resolved {{ Object.keys(tuner.params).length }} vm.* parameters from defaults.
      </p>
    </section>
  </main>
</template>