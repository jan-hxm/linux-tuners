<script setup>
/**
 * One study guide's page at /learn/<slug> (Design.md §5 "Learning pages >
 * Routes and pages"): the header block (breadcrumb, title, lead, the facts
 * line and the link to the tuner), "Start here" with the parts map, the map
 * of chapters with the settings each one pins, a chapter rail (sticky from lg,
 * a disclosure on phones), every chapter in the template order, the previous
 * and next chapter after each, and one ad slot after the last chapter.
 *
 * The router loads everything first (src/router.js guideView): the guide, its
 * probes and captures, and the tuner's domain for the settings' names and the
 * "Tune it" links. The parts map and every chapter follow the one kernel
 * choice (ui/learn/kernelPref.js). Nothing here knows a tuner.
 */
import { computed, inject, ref, useId } from 'vue'
import { RouterLink, routerKey } from 'vue-router'
import RichText from '@/ui/RichText.vue'
import AdSlot from '@/ui/AdSlot.vue'
import PartsMap from '@/ui/learn/PartsMap.vue'
import ChapterView from '@/ui/learn/ChapterView.vue'
import { imageIn } from '@/ui/learn/kernelPref.js'
import { defName } from '@/ui/learn/figureText.js'
import { followInPageLink } from '@/ui/inPageLink.js'
import { useScrollSpy } from '@/ui/useScrollSpy.js'
import { settingHref } from '@/ui/focusSetting.js'
import { PAGE_WIDTH } from '@/ui/layout/pageWidth.js'
import { IMAGES_ORDER, valueFor } from '@/learn/evidence.js'
import { guideFacts, LEARN_INDEX_ROUTE } from '@/learn/guides.js'

const props = defineProps({
  /** The LIVE_GUIDES entry: slug, path, tunerPath, tunerTitle. */
  entry: { type: Object, required: true },
  /** The guide (LEARN). */
  learn: { type: Object, required: true },
  /** The guide's PROBES (kept for the figures that name them). */
  probes: { type: Object, default: () => ({}) },
  /** The captures by image id (loadEvidence()). */
  evidence: { type: Object, required: true },
  /** The tuner's domain: defsByKey for names, titles and docs links. */
  domain: { type: Object, required: true },
})

const hasRouter = inject(routerKey, null) !== null
const uid = useId()

const chapters = computed(() => props.learn.chapters)
const defsByKey = computed(() => props.domain.defsByKey ?? {})
const facts = computed(() => guideFacts(props.learn, IMAGES_ORDER.length))
const read = (vref, imageId) => valueFor(vref, imageId, props.evidence)
const imageId = computed(() => imageIn(IMAGES_ORDER))
const partsEvidence = computed(() => {
  const id = imageId.value
  return (vref) => read(vref, id)
})
const tuneHref = (key) => settingHref(props.entry.tunerPath, key)

const START_ID = 'start-here'
const MAP_ID = 'chapters'
const active = useScrollSpy(() => chapters.value.map((c) => c.id))
const railOpen = ref(false)
const railId = `${uid}-rail`

function go(event, id) {
  followInPageLink(event, id)
  if (event.defaultPrevented) railOpen.value = false
}

const neighbours = (i) => ({ prev: chapters.value[i - 1] ?? null, next: chapters.value[i + 1] ?? null })

const CRUMB_LINK = 'inline-flex min-h-6 items-center underline underline-offset-[3px] hover:text-ink'
const LINK = 'underline underline-offset-[3px] hover:decoration-2'
const H2 = 'm-0 text-[28px] font-medium leading-tight text-ink'
</script>

<template>
  <article class="pb-16" :class="PAGE_WIDTH">
    <header class="max-w-3xl pt-8 sm:pt-10">
      <nav aria-label="Breadcrumb" class="text-sm text-quiet">
        <ol class="flex flex-wrap items-center gap-x-1.5">
          <li>
            <RouterLink v-if="hasRouter" :to="LEARN_INDEX_ROUTE.path" :class="CRUMB_LINK">Learn</RouterLink>
            <a v-else :href="LEARN_INDEX_ROUTE.path" :class="CRUMB_LINK">Learn</a>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page">{{ learn.title }}</li>
        </ol>
      </nav>
      <h1 class="mt-2 text-[32px] font-medium leading-[1.1] tracking-[-0.03em] text-ink sm:text-[44px] sm:leading-[1.08]">{{ learn.title }}</h1>
      <p class="mt-3 max-w-[36em] text-[17px] leading-relaxed text-ink-2 sm:text-lg"><RichText :text="learn.lead" /></p>
      <ul class="m-0 mt-4 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-sm text-quiet" aria-label="About this guide" data-facts>
        <li v-for="fact in facts" :key="fact">{{ fact }}</li>
      </ul>
      <p class="mt-4">
        <RouterLink
          v-if="hasRouter"
          :to="entry.tunerPath"
          class="inline-flex min-h-11 items-center bg-ink px-4 text-[15px] font-medium text-paper hover:bg-ink-2"
          data-tune-link
        >Tune these settings<span class="sr-only">: {{ entry.tunerTitle }}</span></RouterLink>
        <a
          v-else
          :href="entry.tunerPath"
          class="inline-flex min-h-11 items-center bg-ink px-4 text-[15px] font-medium text-paper hover:bg-ink-2"
          data-tune-link
        >Tune these settings<span class="sr-only">: {{ entry.tunerTitle }}</span></a>
      </p>
    </header>

    <div class="mt-10 grid grid-cols-1 gap-y-8 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-x-12">
      <!-- The chapter rail: sticky beside the guide from lg up, a disclosure
           above it on a phone. The chapter in view is aria-current. -->
      <nav aria-label="Chapters" class="min-w-0 lg:col-start-1 lg:row-start-1">
        <div class="lg:sticky lg:top-[calc(var(--site-header-h)+1.5rem)]">
          <button
            type="button"
            class="inline-flex min-h-11 w-full items-center justify-between border-y border-rule px-1 text-[15px] font-medium text-ink hover:bg-paper-hover lg:hidden"
            :aria-expanded="railOpen ? 'true' : 'false'"
            :aria-controls="railId"
            @click="railOpen = !railOpen"
          >Chapters<span aria-hidden="true" class="font-mono text-ink-2">{{ railOpen ? '−' : '+' }}</span></button>
          <p class="m-0 hidden border-b border-ink pb-2 text-sm font-medium text-ink lg:block">Chapters</p>
          <ol :id="railId" class="m-0 list-none p-0 pt-2 text-sm leading-snug lg:block" :class="railOpen ? 'block' : 'hidden'" data-rail>
            <li v-for="(ch, i) in chapters" :key="ch.id">
              <a
                :href="`#${ch.id}`"
                class="flex min-h-6 items-center gap-2 py-0.5 pr-1 hover:bg-paper-hover"
                :class="active === ch.id ? 'border-l-4 border-fit pl-2.5 font-medium text-ink' : 'border-l-2 border-rule pl-3 text-ink-2 hover:text-ink'"
                :aria-current="active === ch.id ? 'location' : undefined"
                @click="go($event, ch.id)"
              >
                <span aria-hidden="true" class="font-mono text-[13px] text-quiet">{{ String(i + 1).padStart(2, '0') }}</span>
                <span class="min-w-0">{{ ch.title }}</span>
              </a>
            </li>
          </ol>
        </div>
      </nav>

      <div class="min-w-0 lg:col-start-2 lg:row-start-1">
        <section :id="START_ID" :aria-labelledby="`${uid}-start`" class="scroll-mt-4 lg:scroll-mt-[calc(var(--site-header-h)+1rem)]">
          <h2 :id="`${uid}-start`" :class="H2">Start here</h2>
          <div class="mt-6">
            <PartsMap :parts="learn.parts" :evidence="partsEvidence" :image-id="imageId" />
          </div>
        </section>

        <section :id="MAP_ID" :aria-labelledby="`${uid}-map`" class="mt-16 scroll-mt-4 lg:scroll-mt-[calc(var(--site-header-h)+1rem)]">
          <h2 :id="`${uid}-map`" :class="H2">The chapters</h2>
          <ol class="m-0 mt-4 list-none p-0" data-chapter-map>
            <li v-for="(ch, i) in chapters" :key="ch.id" class="grid grid-cols-1 gap-x-6 border-b border-rule py-4 md:grid-cols-[minmax(0,1fr)_16rem]">
              <div class="min-w-0">
                <p class="m-0 text-[17px] font-medium text-ink">
                  <span aria-hidden="true" class="font-mono text-[13px] text-quiet">{{ String(i + 1).padStart(2, '0') }} </span>
                  <a :href="`#${ch.id}`" :class="LINK" @click="followInPageLink($event, ch.id)">{{ ch.title }}</a>
                </p>
                <p class="m-0 mt-1 text-[15px] leading-[1.55] text-ink-2"><RichText :text="ch.oneLine" /></p>
              </div>
              <ul class="m-0 mt-2 list-none p-0 font-mono text-[13px] text-ink md:mt-0" :aria-label="`Settings in ${ch.title}`">
                <li v-for="pin in ch.pins" :key="pin.key" class="break-words">{{ defName(pin.key, defsByKey) }}</li>
              </ul>
            </li>
          </ol>
        </section>

        <template v-for="(ch, i) in chapters" :key="ch.id">
          <div class="mt-16">
            <ChapterView
              :chapter="ch"
              :images="IMAGES_ORDER"
              :value-for="read"
              :defs-by-key="defsByKey"
              :tune-href="tuneHref"
              :heading-level="2"
            />
          </div>
          <p class="m-0 mt-10 flex flex-wrap justify-between gap-x-6 gap-y-2 border-t border-rule pt-3 text-[15px]" data-prev-next>
            <a v-if="neighbours(i).prev" :href="`#${neighbours(i).prev.id}`" class="inline-flex min-h-6 items-center text-ink" :class="LINK" @click="followInPageLink($event, neighbours(i).prev.id)">
              Previous: {{ neighbours(i).prev.title }}
            </a>
            <a v-else :href="`#${MAP_ID}`" class="inline-flex min-h-6 items-center text-ink" :class="LINK" @click="followInPageLink($event, MAP_ID)">All chapters</a>
            <a v-if="neighbours(i).next" :href="`#${neighbours(i).next.id}`" class="inline-flex min-h-6 items-center text-ink" :class="LINK" @click="followInPageLink($event, neighbours(i).next.id)">
              Next: {{ neighbours(i).next.title }}
            </a>
            <RouterLink v-else-if="hasRouter" :to="entry.tunerPath" class="inline-flex min-h-6 items-center text-ink" :class="LINK">Tune these settings</RouterLink>
            <a v-else :href="entry.tunerPath" class="inline-flex min-h-6 items-center text-ink" :class="LINK">Tune these settings</a>
          </p>
        </template>

        <!-- One ad, after the last chapter only (Design.md §5 "Ads and consent"). -->
        <div class="mt-12 empty:hidden">
          <AdSlot slot="learn" :label="`${entry.slug} guide footer`" />
        </div>
      </div>
    </div>
  </article>
</template>
