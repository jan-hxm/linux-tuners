<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { LIVE_TUNERS } from '@/tuners/registry.js'
import TickLogo from './TickLogo.vue'

// On a phone the tuner links don't fit, so the nav scrolls sideways on its
// own instead of widening the page. Keep the current tuner's link in view, and
// fade an edge while there are more links past it, since the scrollbar is
// hidden (Design.md §7).
const nav = ref(null)
const route = useRoute()
const linkClass = 'inline-flex min-h-9 shrink-0 items-center whitespace-nowrap border-b-2 border-transparent px-2 text-ink-2 hover:text-ink'
const more = ref({ before: false, after: false })

function updateFades() {
  const el = nav.value
  if (!el) return
  const max = el.scrollWidth - el.clientWidth
  more.value = { before: el.scrollLeft > 1, after: el.scrollLeft < max - 1 }
}

function revealActive() {
  nextTick(() => {
    nav.value?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    updateFades()
  })
}

onMounted(() => {
  revealActive()
  window.addEventListener('resize', updateFades)
})
onBeforeUnmount(() => window.removeEventListener('resize', updateFades))
watch(() => route.path, revealActive)
</script>

<template>
  <!-- Static on a phone, where the logo row and the tuner nav stack into two
       rows; sticky from lg up, where it is the single row that
       --site-header-h (main.css) measures. -->
  <header class="z-30 border-b border-rule bg-paper lg:sticky lg:top-0">
    <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 sm:px-6 lg:flex-nowrap">
      <RouterLink to="/" class="order-1 flex shrink-0 items-center gap-2.5 whitespace-nowrap text-base font-semibold tracking-tight text-ink">
        <TickLogo />
        <span>linux-tuners.dev</span>
      </RouterLink>
      <RouterLink
        to="/setup"
        class="order-2 ml-auto inline-flex min-h-11 shrink-0 items-center whitespace-nowrap bg-ink px-4 text-[15px] font-medium text-paper hover:bg-ink-2 lg:order-3 lg:ml-0"
      >Start setup</RouterLink>
      <div class="relative order-3 min-w-0 basis-full lg:order-2 lg:flex-1 lg:basis-auto">
        <nav ref="nav" aria-label="Tuners" class="flex min-w-0 items-center gap-1 overflow-x-auto px-1 py-1 text-[15px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:justify-end" @scroll.passive="updateFades">
          <!-- The landing page's own entry, so the nav shows where you are there too.
               Exact match only: every page sits under "/". -->
          <RouterLink
            to="/"
            :class="linkClass"
            active-class=""
            exact-active-class="!border-ink !text-ink font-medium"
          >All tuners</RouterLink>
          <RouterLink
            v-for="tuner in LIVE_TUNERS"
            :key="tuner.id"
            :to="tuner.path"
            :class="linkClass"
            active-class="!border-ink !text-ink font-medium"
          >{{ tuner.navLabel }}</RouterLink>
        </nav>
        <span v-if="more.before" data-fade="before" aria-hidden="true" class="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-paper to-transparent" />
        <span v-if="more.after" data-fade="after" aria-hidden="true" class="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-paper to-transparent" />
      </div>
    </div>
  </header>
</template>
