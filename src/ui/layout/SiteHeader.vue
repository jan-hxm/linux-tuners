<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { LIVE_TUNERS } from '@/tuners/registry.js'
import TickLogo from './TickLogo.vue'
import { PAGE_WIDTH } from './pageWidth.js'

// One row: logo, a "Tuners" disclosure button, the current tuner's name, the
// Learn and Glossary links (each only once its route exists) and Start setup. The button opens
// a full-width panel listing every live tuner with its question. It is a
// disclosure, not a modal: no focus trap, Escape and a click outside close it
// (Design.md §7).
const route = useRoute()
const router = useRouter()
const root = ref(null)
const button = ref(null)
const open = ref(false)
const hasGlossary = computed(() => router.hasRoute('glossary'))
// The study guides' index exists only while a guide is live (src/router.js).
const hasLearn = computed(() => router.hasRoute('learn'))
const inLearn = computed(() => route.path === '/learn' || route.path.startsWith('/learn/'))
const current = computed(() => LIVE_TUNERS.find((t) => t.path === route.path) ?? null)
const label = (t) => t.navLabel ?? t.title

function close({ refocus = false } = {}) {
  open.value = false
  if (refocus) nextTick(() => button.value?.focus())
}

function onKeydown(event) {
  if (open.value && event.key === 'Escape') close({ refocus: true })
}
function onPointerDown(event) {
  if (open.value && root.value && !root.value.contains(event.target)) close()
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  document.addEventListener('pointerdown', onPointerDown)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('pointerdown', onPointerDown)
})
watch(() => route.fullPath, () => close())
</script>

<template>
  <!-- Sticky from lg up; --site-header-h (main.css) measures this one row. The
       panel is absolutely placed under it, so it never changes that height. -->
  <header ref="root" class="relative z-30 border-b border-rule bg-paper lg:sticky lg:top-0">
    <div class="flex items-center gap-x-3 py-2 sm:gap-x-6" :class="PAGE_WIDTH">
      <RouterLink to="/" aria-current-value="false" class="flex shrink-0 items-center gap-2.5 whitespace-nowrap text-base font-semibold tracking-tight text-ink">
        <TickLogo />
        <span class="max-[420px]:sr-only">linux-tuners.dev</span>
      </RouterLink>
      <button
        ref="button"
        type="button"
        class="inline-flex min-h-11 shrink-0 items-center gap-2.5 border border-rule px-3.5 text-[15px] font-medium text-ink hover:bg-paper-hover sm:px-3.5"
        :class="open ? 'bg-paper-hover' : ''"
        :aria-expanded="open ? 'true' : 'false'"
        aria-controls="tuners-menu"
        @click="open = !open"
      >Tuners<span aria-hidden="true" class="font-mono text-[15px] text-ink-2">{{ open ? '−' : '+' }}</span></button>
      <p v-if="current" class="m-0 hidden min-w-0 items-center gap-2.5 text-[15px] text-ink-2 sm:flex">
        <span aria-hidden="true" class="text-quiet">/</span>
        <span aria-current="page" class="truncate border-b-2 border-ink py-2 text-ink">{{ label(current) }}</span>
      </p>
      <div class="ml-auto flex shrink-0 items-center gap-1">
        <RouterLink
          v-if="hasLearn"
          :to="{ name: 'learn' }"
          class="hidden min-h-11 items-center px-3 text-[15px] hover:text-ink sm:inline-flex"
          :class="inLearn ? 'text-ink underline underline-offset-4' : 'text-ink-2'"
          :aria-current="inLearn ? 'page' : undefined"
        >Learn</RouterLink>
        <RouterLink v-if="hasGlossary" :to="{ name: 'glossary' }" class="hidden min-h-11 items-center px-3 text-[15px] text-ink-2 hover:text-ink sm:inline-flex">Glossary</RouterLink>
        <RouterLink
          to="/setup"
          class="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap bg-ink px-4 text-[15px] font-medium text-paper hover:bg-ink-2"
        >Start setup</RouterLink>
      </div>
    </div>
    <div
      v-show="open"
      id="tuners-menu"
      class="absolute inset-x-0 top-full max-h-[calc(100vh-4rem)] overflow-y-auto border-b border-ink bg-paper"
    >
      <nav aria-label="Tuners" :class="PAGE_WIDTH" class="py-4">
        <ul class="m-0 grid list-none grid-cols-1 gap-x-8 p-0 sm:grid-cols-2 lg:grid-cols-3">
          <li v-for="tuner in LIVE_TUNERS" :key="tuner.id">
            <RouterLink
              :to="tuner.path"
              class="block px-3 py-3.5 hover:bg-paper-hover"
              :class="current?.id === tuner.id ? 'border-t-[3px] border-fit' : 'border-t border-rule'"
              :aria-current="current?.id === tuner.id ? 'page' : undefined"
              @click="close()"
            >
              <span class="block text-base font-medium text-ink">{{ label(tuner) }}</span>
              <span v-if="tuner.question" class="mt-1 block text-sm leading-snug text-ink-2">{{ tuner.question }}</span>
            </RouterLink>
          </li>
        </ul>
        <RouterLink
          to="/"
          class="mt-2 inline-flex min-h-11 items-center px-3 text-[15px] font-medium text-ink underline underline-offset-4"
          :aria-current="route.path === '/' ? 'page' : undefined"
          @click="close()"
        >All tuners</RouterLink>
      </nav>
    </div>
  </header>
</template>
