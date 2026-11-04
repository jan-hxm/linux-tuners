<script setup>
/**
 * The key to the three marks (Design.md §7), one row: "Kernel default",
 * "Fits your machine", "Changed by you". For a group's header row and the
 * landing page. `defaultLabel` is the domain's (`domain.defaultLabel`), so
 * systemd says "systemd default". Each label sits in its mark's text colour.
 */
import MarkGlyph from './MarkGlyph.vue'

defineProps({
  defaultLabel: { type: String, default: 'Kernel default' },
})
</script>

<template>
  <ul class="flex flex-wrap gap-x-[18px] gap-y-1 text-[13px]">
    <li class="flex items-center gap-1.5 text-ink-2"><MarkGlyph kind="default" />{{ defaultLabel }}</li>
    <li class="flex items-center gap-1.5 text-fit-text"><MarkGlyph kind="fit" />Fits your machine</li>
    <li class="flex items-center gap-1.5 text-mine-text"><MarkGlyph kind="mine" />Changed by you</li>
  </ul>
</template>
