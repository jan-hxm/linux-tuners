<script setup>
import { nextTick, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { LIVE_TUNERS } from '@/tuners/registry.js'

// On a phone the tuner links don't fit, so the nav scrolls sideways on its
// own instead of widening the page. Keep the current tuner's link in view.
const nav = ref(null)
const route = useRoute()

function revealActive() {
  nextTick(() => nav.value?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }))
}

onMounted(revealActive)
watch(() => route.path, revealActive)
</script>

<template>
  <header class="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
    <div class="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
      <RouterLink to="/" class="flex shrink-0 items-baseline gap-0.5 whitespace-nowrap text-sm font-semibold tracking-tight text-slate-900">
        <span>linux-tuners</span>
        <span class="text-slate-400">.dev</span>
      </RouterLink>
      <nav ref="nav" aria-label="Tuners" class="flex min-w-0 items-center gap-1 overflow-x-auto text-xs [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <!-- The landing page's own entry, so the nav shows where you are there too.
             Exact match only: every page sits under "/". -->
        <RouterLink
          to="/"
          class="shrink-0 whitespace-nowrap rounded px-2 py-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          active-class=""
          exact-active-class="bg-sky-700 text-white hover:bg-sky-700 hover:text-white"
        >All tuners</RouterLink>
        <RouterLink
          v-for="tuner in LIVE_TUNERS"
          :key="tuner.id"
          :to="tuner.path"
          class="shrink-0 whitespace-nowrap rounded px-2 py-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          active-class="bg-sky-700 text-white hover:bg-sky-700 hover:text-white"
        >{{ tuner.navLabel }}</RouterLink>
        <a
          href="https://github.com/jan-hxm/linux-tuners"
          target="_blank"
          rel="noopener"
          class="ml-2 shrink-0 whitespace-nowrap rounded px-2 py-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >GitHub ↗</a>
      </nav>
    </div>
  </header>
</template>
