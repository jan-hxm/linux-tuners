<script setup>
/**
 * The /learn index (Design.md §5 "Learning pages > Routes and pages"): every
 * live guide with its title, lead and facts line, and the tuner it explains.
 * Drafts are not listed, and while no guide is live this route doesn't exist.
 * The router loads each guide's data first (src/router.js learnIndexView).
 */
import { inject } from 'vue'
import { RouterLink, routerKey } from 'vue-router'
import RichText from '@/ui/RichText.vue'
import { PAGE_WIDTH } from '@/ui/layout/pageWidth.js'
import { IMAGES_ORDER } from '@/learn/evidence.js'
import { guideFacts, LEARN_INDEX_ROUTE } from '@/learn/guides.js'

defineProps({
  /** [{ entry: LiveGuide, learn: Guide }], in registry order. */
  guides: { type: Array, required: true },
})

const hasRouter = inject(routerKey, null) !== null
const LINK = 'underline underline-offset-[3px] hover:decoration-2'
</script>

<template>
  <section class="pb-16" :class="PAGE_WIDTH">
    <header class="max-w-3xl pt-8 sm:pt-10">
      <h1 class="text-[32px] font-medium leading-[1.1] tracking-[-0.03em] text-ink sm:text-[44px] sm:leading-[1.08]">{{ LEARN_INDEX_ROUTE.ogTitle }}</h1>
      <p class="mt-3 max-w-[36em] text-[17px] leading-relaxed text-ink-2 sm:text-lg">{{ LEARN_INDEX_ROUTE.description }}</p>
    </header>
    <ul class="m-0 mt-10 grid list-none grid-cols-1 gap-x-8 p-0 md:grid-cols-2" data-guides>
      <li v-for="{ entry, learn } in guides" :key="entry.slug" class="border-t border-ink py-5">
        <h2 class="m-0 text-[22px] font-medium leading-tight text-ink">
          <RouterLink v-if="hasRouter" :to="entry.path" :class="LINK">{{ learn.title }}</RouterLink>
          <a v-else :href="entry.path" :class="LINK">{{ learn.title }}</a>
        </h2>
        <p class="m-0 mt-2 text-[17px] leading-[1.55] text-ink-2"><RichText :text="learn.lead" /></p>
        <ul class="m-0 mt-3 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-sm text-quiet" :aria-label="`About ${learn.title}`">
          <li v-for="fact in guideFacts(learn, IMAGES_ORDER.length)" :key="fact">{{ fact }}</li>
        </ul>
        <p class="m-0 mt-3 text-[15px] text-ink-2">
          For the
          <RouterLink v-if="hasRouter" :to="entry.tunerPath" class="text-ink" :class="LINK">{{ entry.tunerTitle }} tuner</RouterLink>
          <a v-else :href="entry.tunerPath" class="text-ink" :class="LINK">{{ entry.tunerTitle }} tuner</a>
        </p>
      </li>
    </ul>
  </section>
</template>
