<script setup>
/**
 * Mobile-only sticky impact summary. On large screens the GraphPanel sits in a
 * sticky sidebar next to the parameter list, so dragging a slider shows the
 * effect live. Below `lg` that two-column layout collapses and the graph drops
 * below the entire parameter list, so a phone user can't see the simulation
 * react while tuning. This bar pins the same `impact` metrics to the bottom of
 * the viewport on small screens, restoring live feedback. Hidden at `lg` where
 * the real graph panel is visible. See CLAUDE.md "UI/UX & accessibility".
 */
defineProps({
  /** @type {{id:string,label:string,value:string,band:string}[]} */
  impact: { type: Array, default: () => [] },
})

function bandClass(band) {
  return {
    none: 'bg-slate-100 text-slate-600',
    low: 'bg-emerald-100 text-emerald-800',
    med: 'bg-amber-100 text-amber-800',
    high: 'bg-red-100 text-red-800',
  }[band] ?? 'bg-slate-100 text-slate-600'
}
</script>

<template>
  <div
    v-if="impact.length"
    class="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-3 py-2 shadow-[0_-2px_8px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden"
    role="region"
    aria-label="Live impact summary"
  >
    <ul class="flex items-center gap-3 overflow-x-auto" aria-live="polite">
      <li
        v-for="metric in impact"
        :key="metric.id"
        class="flex shrink-0 items-center gap-1.5"
      >
        <span class="text-[11px] uppercase tracking-wide text-slate-500">{{ metric.label }}</span>
        <span
          class="rounded px-1.5 py-0.5 text-xs font-medium"
          :class="bandClass(metric.band)"
        >{{ metric.value }}</span>
      </li>
    </ul>
  </div>
</template>
