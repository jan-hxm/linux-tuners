<script setup>
/**
 * The About / methodology block at the foot of a tuner page, rendered from the
 * tuner's about.js data. Always visible: it's real content grounded in the
 * docs, which matters to readers and to ad-network review alike.
 */
import RichText from './RichText.vue'

defineProps({
  /** The tuner's ABOUT data (see src/tuners/<id>/about.js). */
  about: { type: Object, required: true },
})
</script>

<template>
  <section id="about" class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">{{ about.heading }}</h2>

    <div class="mt-2 space-y-6 text-sm leading-relaxed text-slate-800">
      <p v-for="(para, i) in about.intro" :key="`intro-${i}`"><RichText :text="para" /></p>

      <section v-for="section in about.sections" :key="section.title">
        <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">{{ section.title }}</h3>
        <template v-for="(block, i) in section.blocks" :key="i">
          <p v-if="block.p" :class="i === 0 ? 'mt-1' : 'mt-2'"><RichText :text="block.p" /></p>
          <ul v-else class="mt-1 list-disc space-y-1 pl-5">
            <li v-for="(item, j) in block.ul" :key="j"><RichText :text="item" /></li>
          </ul>
        </template>
      </section>
    </div>
  </section>
</template>
