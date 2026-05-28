<script setup>
defineProps({
  num: { type: Number, required: true },
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
})
</script>

<template>
  <header class="flex items-baseline gap-3 px-1">
    <span
      class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white"
      aria-hidden="true"
    >
      {{ num }}
    </span>
    <div class="min-w-0">
      <h2 class="text-base font-semibold tracking-tight text-slate-900">
        <span class="sr-only">Step {{ num }}: </span>{{ title }}
      </h2>
      <p v-if="subtitle" class="text-xs text-slate-500">{{ subtitle }}</p>
    </div>
  </header>
</template>