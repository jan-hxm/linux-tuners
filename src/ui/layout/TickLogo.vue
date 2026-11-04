<script setup>
// The tick mark: a short ruler with one tall verdigris tick (Design.md §7,
// "The motif is the ruler tick"). Decorative; the wordmark next to it names
// the site. Colours follow the scheme through the ink and fit tokens.
defineProps({ size: { type: Number, default: 22 } })
</script>

<template>
  <svg aria-hidden="true" :width="size" :height="size" viewBox="0 0 22 22" fill="none" class="shrink-0">
    <path d="M1 17H21" class="stroke-ink" stroke-width="1.5" />
    <path d="M4 17V12M8 17V14M12 17V5M16 17V14M20 17V12" class="stroke-ink" stroke-width="1.5" />
    <path d="M12 5V2" class="stroke-fit" stroke-width="3" />
  </svg>
</template>
