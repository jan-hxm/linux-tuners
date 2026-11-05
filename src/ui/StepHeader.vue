<script setup>
// A tuner step's heading row: an ink rule above it, the step number in mono
// and the section headline (Design.md §7: 34px, 26px on a phone).
defineProps({
  num: { type: Number, required: true },
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
})
</script>

<template>
  <header class="flex items-baseline gap-4 border-t border-ink pt-3">
    <span class="shrink-0 font-mono text-[13px] text-quiet" aria-hidden="true">{{ String(num).padStart(2, '0') }}</span>
    <div class="min-w-0">
      <h2 class="text-[26px] font-medium leading-tight tracking-[-0.02em] text-ink sm:text-[34px]">
        <span class="sr-only">Step {{ num }}: </span>{{ title }}
      </h2>
      <p v-if="subtitle" class="mt-1 text-[15px] leading-relaxed text-ink-2">{{ subtitle }}</p>
    </div>
  </header>
</template>
