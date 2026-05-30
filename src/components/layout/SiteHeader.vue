<script setup>
import { RouterLink } from 'vue-router'
</script>

<template>
  <header class="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
    <div class="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
      <RouterLink to="/" class="flex items-baseline gap-0.5 text-sm font-semibold tracking-tight text-slate-900">
        <span>linux-tuners</span>
        <span class="text-slate-400">.dev</span>
      </RouterLink>
      <nav aria-label="Tuners" class="flex items-center gap-1 text-xs">
        <RouterLink
          to="/swap"
          class="rounded px-2 py-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          active-class="bg-slate-900 text-white hover:bg-slate-900 hover:text-white"
        >Swap & memory</RouterLink>
        <RouterLink
          to="/systemd"
          class="rounded px-2 py-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          active-class="bg-slate-900 text-white hover:bg-slate-900 hover:text-white"
        >systemd</RouterLink>
        <a
          href="https://github.com/jan-hxm/linux-tuners"
          target="_blank"
          rel="noopener"
          class="ml-2 rounded px-2 py-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >GitHub ↗</a>
      </nav>
    </div>
  </header>
</template>
