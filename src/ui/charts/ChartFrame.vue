<script setup>
// The box every chart renders into. A <canvas> is opaque to assistive tech, so
// the frame requires the text alternative, and it sets the height Chart.js
// sizes itself to (charts use maintainAspectRatio: false).
defineProps({
  ariaLabel: { type: String, required: true },
  height: { type: String, default: '16rem', validator: (v) => /^\d+(\.\d+)?rem$/.test(v) },
})
</script>

<template>
  <div role="img" :aria-label="ariaLabel" :style="{ height }">
    <slot />
  </div>
</template>
