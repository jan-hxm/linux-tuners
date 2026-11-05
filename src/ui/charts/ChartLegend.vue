<script setup>
/**
 * The key under a chart, drawn like the canvas (chartStyle.js): a line, a
 * dashed line, a shaded band, a solid fill or a hatch, in the item's tone
 * from the palette, so it matches the chart in both schemes. The words carry
 * the meaning, so it never rests on colour alone.
 */
import { PALETTE, tint } from './palette.js'
import { BAND_ALPHA } from './chartStyle.js'

defineProps({
  /**
   * `kind` is 'line' (default), 'dash', 'band', 'fill' or 'hatch'; `dash: true`
   * is short for kind 'dash'.
   * @type {import('vue').PropType<{ label: string, tone: string, kind?: string, dash?: boolean }[]>}
   */
  items: { type: Array, required: true },
})

function swatch(item) {
  const kind = item.kind ?? (item.dash ? 'dash' : 'line')
  const color = PALETTE[item.tone]
  if (kind === 'line') return { class: 'h-0 w-4 border-t-[3px]', style: { borderColor: color } }
  if (kind === 'dash') return { class: 'h-0 w-4 border-t-2 border-dashed', style: { borderColor: color } }
  if (kind === 'band') return { class: 'h-3 w-3', style: { background: tint(item.tone, BAND_ALPHA * 2) } }
  if (kind === 'fill') return { class: 'h-3 w-3', style: { background: color } }
  return {
    class: 'h-3 w-3 border',
    style: { borderColor: color, background: `repeating-linear-gradient(-45deg, ${color} 0 1px, transparent 1px 4px)` },
  }
}
</script>

<template>
  <ul class="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
    <li v-for="item in items" :key="item.label" class="inline-flex items-center gap-1.5">
      <span aria-hidden="true" class="inline-block shrink-0" :class="swatch(item).class" :style="swatch(item).style"></span>
      {{ item.label }}
    </li>
  </ul>
</template>
