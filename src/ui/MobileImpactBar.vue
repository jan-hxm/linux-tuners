<script setup>
/**
 * Mobile-only sticky impact summary. On large screens the GraphPanel sits in a
 * sticky sidebar next to the parameter list, so dragging a slider shows the
 * effect live. Below `lg` that two-column layout collapses and the graphs sit
 * above the parameter list, out of view while a phone user tunes. This bar pins the same `impact` metrics to the bottom of
 * the viewport on small screens, restoring live feedback. Hidden at `lg` where
 * the real graph panel is visible. A link at its end jumps up to the full
 * graphs. Each metric gets a column, its label over its value, so all of
 * them fit at 320px. See Design.md §7.
 */
defineProps({
  /** @type {{id:string,label:string,value:string,band:string}[]} */
  impact: { type: Array, default: () => [] },
  /** Id of the graph panel the "Graphs" link jumps to. */
  graphsId: { type: String, required: true },
})

// The band as the value's colour; the value's words carry the meaning.
function bandClass(band) {
  return { low: 'text-fit-text', med: 'text-mine-text', high: 'text-error' }[band] ?? 'text-ink-2'
}
</script>

<template>
  <div
    v-if="impact.length"
    class="fixed inset-x-0 bottom-0 z-30 border-t border-ink bg-paper px-3 py-2 lg:hidden"
    role="region"
    aria-label="Live impact summary"
  >
    <div class="flex items-center gap-3">
      <ul class="grid min-w-0 flex-1 auto-cols-fr grid-flow-col gap-3" aria-live="polite">
        <li
          v-for="metric in impact"
          :key="metric.id"
          class="flex min-w-0 flex-col items-start gap-0.5"
        >
          <span class="text-[13px] leading-tight text-quiet">{{ metric.label }}</span>
          <span
            class="max-w-full break-words font-mono text-[13px] leading-tight"
            :class="bandClass(metric.band)"
          >{{ metric.value }}</span>
        </li>
      </ul>
      <!-- Outside the live list, so it isn't re-announced on every change. -->
      <a
        :href="`#${graphsId}`"
        class="inline-flex min-h-11 shrink-0 items-center border border-rule-strong px-3 text-[13px] font-medium text-ink hover:bg-paper-hover"
      >Graphs <span aria-hidden="true">&nbsp;↑</span></a>
    </div>
  </div>
</template>
