<script setup>
/**
 * The key under a line chart: a short stroke in the series' tone (dashed
 * where the series is dashed) and its name. The stroke takes its colour from
 * the palette, so it matches the canvas in both schemes; the words carry the
 * meaning, so it never rests on colour alone.
 */
import { PALETTE } from './palette.js'

defineProps({
  /** @type {import('vue').PropType<{ label: string, tone: string, dash?: boolean }[]>} */
  items: { type: Array, required: true },
})
</script>

<template>
  <ul class="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
    <li v-for="item in items" :key="item.label" class="inline-flex items-center gap-1.5">
      <span
        aria-hidden="true"
        class="inline-block w-4 border-t-2"
        :class="{ 'border-dashed': item.dash }"
        :style="{ borderColor: PALETTE[item.tone] }"
      ></span>
      {{ item.label }}
    </li>
  </ul>
</template>
