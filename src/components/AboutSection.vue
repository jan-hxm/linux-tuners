<script setup>
import { ref, onMounted } from 'vue'

const expanded = ref(false)

// Expand if the user navigated here with #about (separate from the lz-string
// state hash, which would never be the literal string "about").
onMounted(() => {
  if (typeof window !== 'undefined' && window.location.hash === '#about') {
    expanded.value = true
  }
})

function toggle() {
  expanded.value = !expanded.value
}
</script>

<template>
  <section id="about" class="rounded-lg border border-slate-200 bg-white shadow-sm">
    <button
      type="button"
      class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      :aria-expanded="expanded"
      aria-controls="about-content"
      @click="toggle"
    >
      <div>
        <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {{ expanded ? '▾' : '▸' }} About this tool
        </h2>
        <p class="text-xs text-slate-500">
          Methodology, limitations, sources, and disclaimer.
        </p>
      </div>
    </button>

    <div
      v-if="expanded"
      id="about-content"
      class="space-y-6 border-t border-slate-200 px-4 py-4 text-sm leading-relaxed text-slate-800"
    >
      <section>
        <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Methodology</h3>
        <p class="mt-1">
          The tuner derives starting values for each <code class="font-mono">vm.*</code> parameter from your hardware spec (RAM, swap size, swap device, workload, cgroup version) and the published recommendations in the kernel docs and the August 2025 Kubernetes swap-tuning blog. Per-device caps (e.g. swappiness ≤ 60 on rotational disks, ≤ 200 on zram/zswap) are enforced both as slider ranges and as validation warnings.
        </p>
        <p class="mt-2">
          The three live graphs are <strong>teaching models</strong>:
        </p>
        <ul class="mt-1 list-disc space-y-1 pl-5">
          <li>
            <strong>Swap pressure curve</strong>: a piecewise model — no swap above the high watermark, linear ramp through the kswapd band scaled by swappiness, steeper ramp from low to min watermark for direct reclaim.
          </li>
          <li>
            <strong>Watermark zones</strong>: derived directly from the kernel formula
            <code class="font-mono">window_pages = total_managed_pages × watermark_scale_factor / 10000</code>,
            with the system-wide min/low/high heights shown as a stacked bar.
          </li>
          <li>
            <strong>Dirty writeback timeline</strong>: a 120-second simulation of a constant 1%/s synthetic write workload, with the background flusher absorbing ~60% of the rate above <code class="font-mono">dirty_background_ratio</code> and a synchronous stall ceiling at <code class="font-mono">dirty_ratio</code>.
          </li>
        </ul>
      </section>

      <section>
        <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Limitations</h3>
        <ul class="mt-1 list-disc space-y-1 pl-5">
          <li>The graphs are simplified pedagogical models, not kernel-accurate predictions. NUMA effects, per-zone watermarks, transparent huge pages, and MGLRU are not modelled.</li>
          <li>Per-cgroup swappiness (cgroup v1 only) is not configurable here — the tool emits system-wide values that <code class="font-mono">sudo sysctl --system</code> applies to all cgroups.</li>
          <li>Real-time kernel metrics (/proc/meminfo, PSI) are not imported; the tuner is purely a configuration-time aid.</li>
          <li>The starting defaults are intended for typical Linux server workloads. Always test in a non-production environment before applying.</li>
        </ul>
      </section>

      <section>
        <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Sources</h3>
        <ul class="mt-1 list-disc space-y-1 pl-5">
          <li>
            Kernel administrator docs —
            <a href="https://docs.kernel.org/admin-guide/sysctl/vm.html" class="text-sky-700 underline" target="_blank" rel="noopener">
              docs.kernel.org/admin-guide/sysctl/vm.html ↗
            </a>
          </li>
          <li>
            "Tuning Linux Swap for Kubernetes: A Deep Dive" (Kubernetes blog, Aug 2025) —
            <a href="https://kubernetes.io/blog/2025/08/19/tuning-linux-swap-for-kubernetes-a-deep-dive/" class="text-sky-700 underline" target="_blank" rel="noopener">
              kubernetes.io/blog ↗
            </a>
          </li>
          <li>Red Hat performance tuning guide (for the database preset)</li>
        </ul>
      </section>

      <section>
        <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Disclaimer</h3>
        <p class="mt-1">
          The author of this tool is not responsible for any system behaviour resulting from applying the generated configuration. Always validate values against your kernel version and test on a non-production node first. Misconfigured memory-reclaim parameters can cause data loss, OOM-killed processes, or system-wide stalls.
        </p>
      </section>

      <section>
        <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Licence</h3>
        <p class="mt-1">
          Released under the MIT licence — see the
          <a href="https://github.com/jan-hxm/swap-sysctl-generator/blob/main/LICENSE" class="text-sky-700 underline" target="_blank" rel="noopener">
            LICENSE file ↗
          </a>
          in the repository.
        </p>
      </section>
    </div>
  </section>
</template>