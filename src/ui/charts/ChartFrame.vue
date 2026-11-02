<script setup>
// The box every chart renders into. A <canvas> is opaque to assistive tech, so
// the frame requires the text alternative, and it sets the height Chart.js
// sizes itself to (charts use maintainAspectRatio: false). Chart.js copies its
// defaults into a chart when it builds it, so the frame rebuilds its chart when
// the colour scheme changes (Design.md §7).
import { prefersDark } from './palette.js'

defineProps({
  ariaLabel: { type: String, required: true },
  height: { type: String, default: '16rem', validator: (v) => /^\d+(\.\d+)?rem$/.test(v) },
})
</script>

<template>
  <div :key="prefersDark ? 'dark' : 'light'" role="img" :aria-label="ariaLabel" :style="{ height }">
    <slot />
  </div>
</template>
