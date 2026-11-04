<script setup>
/**
 * The About / methodology block at the foot of a tuner page, rendered from the
 * tuner's about.js data. Always visible: it's real content grounded in the
 * docs, which matters to readers and to ad-network review alike. A section
 * of prose between rules, in a readable measure.
 */
import RichText from './RichText.vue'

defineProps({
  /** The tuner's ABOUT data (see src/tuners/<id>/about.js). */
  about: { type: Object, required: true },
})
</script>

<template>
  <section id="about" class="border-t border-ink pt-4">
    <h2 class="text-[26px] font-medium leading-tight tracking-[-0.02em] text-ink">{{ about.heading }}</h2>

    <div class="mt-6 max-w-[70ch] space-y-8 text-base leading-relaxed text-ink-2">
      <p v-for="(para, i) in about.intro" :key="`intro-${i}`"><RichText :text="para" /></p>

      <section v-for="section in about.sections" :key="section.title" class="border-t border-rule pt-3">
        <h3 class="text-lg font-medium text-ink">{{ section.title }}</h3>
        <template v-for="(block, i) in section.blocks" :key="i">
          <p v-if="block.p" class="mt-2"><RichText :text="block.p" /></p>
          <ul v-else class="mt-2 list-disc space-y-1.5 pl-5 marker:text-quiet">
            <li v-for="(item, j) in block.ul" :key="j"><RichText :text="item" /></li>
          </ul>
        </template>
      </section>
    </div>
  </section>
</template>
