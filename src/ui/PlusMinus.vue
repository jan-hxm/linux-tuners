<script setup>
// The mono-weight + / − at the end of a disclosure row (Design.md §7),
// drawn rather than typed so it stays out of the button's text and name: the
// button's aria-expanded says the state.
defineProps({
  open: { type: Boolean, required: true },
})
</script>

<template>
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" class="shrink-0 text-ink-2">
    <path d="M1 7h12" />
    <path v-if="!open" d="M7 1v12" />
  </svg>
</template>
