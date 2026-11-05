<script setup>
/**
 * The landing hero's live specimen (Design.md §5 "Guided setup"): one real
 * setting in column-and-margin form, for an example machine. The def, the
 * range, the kernel default and the value that fits all come from the
 * domain; the slider is the real SliderControl. The value lives here only:
 * nothing is written to a tuner's store or the URL.
 */
import { computed, ref } from 'vue'
import SliderControl from '@/ui/controls/SliderControl.vue'
import MarkGlyph from '@/ui/controls/MarkGlyph.vue'
import { valueTypeOf } from '@/core/valueTypes.js'
import { LANDING_COPY } from '@/ui/landing.js'

const props = defineProps({
  // { domain, key, hardware, summary }: see ./landingExample.js.
  example: { type: Object, required: true },
})

const domain = computed(() => props.example.domain)
const hardware = computed(() => props.example.hardware)
const def = computed(() => domain.value.defsByKey[props.example.key])
const range = computed(() => domain.value.rangeFor(props.example.key, hardware.value))
const fit = computed(() => domain.value.deriveDefaults(hardware.value)[props.example.key])
const format = (v) => domain.value.formatValue(v, def.value, hardware.value)

const value = ref(fit.value)
const changed = computed(() => !valueTypeOf(def.value).equals(value.value, fit.value))
const formatted = computed(() => format(value.value))

function setValue(v) {
  // The same parse and clamp as the store's setParam, so the value never
  // leaves what the kernel accepts.
  const type = valueTypeOf(def.value)
  const parsed = type.restore(v, def.value)
  if (parsed === undefined) return
  value.value = type.clamp(parsed, def.value, range.value)
}

// The origin note, worded as the parameter card words it.
const originNote = computed(() => {
  const stock = `${domain.value.defaultLabel} ${format(def.value.kernelDefault)}.`
  if (changed.value) return `You moved this from ${format(fit.value)} to ${formatted.value}. ${stock}`
  return `${stock} Fits this machine: ${format(fit.value)}.`
})

const titleId = 'specimen-title'
const nameId = 'specimen-name'
</script>

<template>
  <figure class="specimen m-0 min-w-0 border-t border-ink" aria-labelledby="specimen-caption">
    <figcaption id="specimen-caption" class="flex flex-wrap justify-between gap-x-3 gap-y-1 py-2.5 text-sm text-quiet">
      <span>{{ LANDING_COPY.specimen.caption }}</span>
      <span class="font-mono">{{ example.summary }}</span>
    </figcaption>
    <div class="specimen-body border-t border-rule pt-6">
      <div class="min-w-0">
        <p :id="titleId" class="text-[19px] font-medium leading-snug text-ink sm:text-xl">{{ def.title }}</p>
        <p class="mt-3.5 break-words font-mono specimen-value text-2xl leading-tight tracking-[-0.02em] text-ink">
          <span :id="nameId">{{ def.sysctlName }}</span> =
          <span
            class="border-b-[3px]"
            :class="changed ? 'border-mine text-mine-text' : 'border-fit text-fit-text'"
          >{{ formatted }}</span>
        </p>
        <SliderControl
          :def="def"
          :value="value"
          :range="range"
          :label-id="`${titleId} ${nameId}`"
          :value-text="formatted"
          :fit-value="fit"
          :changed="changed"
          @update="setValue"
        />
        <ul class="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
          <li class="flex items-center gap-2 text-ink-2"><MarkGlyph kind="default" />{{ domain.defaultLabel }} {{ format(def.kernelDefault) }}</li>
          <li class="flex items-center gap-2 text-fit-text"><MarkGlyph kind="fit" />Fits your machine {{ format(fit) }}</li>
          <li class="flex items-center gap-2 text-mine-text" :class="{ invisible: !changed }" :aria-hidden="!changed"><MarkGlyph kind="mine" />Changed by you</li>
        </ul>
        <p class="mt-4 text-base leading-relaxed text-ink-2">{{ def.shortDesc }}</p>
      </div>

      <aside class="min-w-0 text-[15px] leading-[1.55]" :aria-label="`Notes on ${def.title}`">
        <ol>
          <li v-if="def.tuningTip" class="grid grid-cols-[30px_minmax(0,1fr)] border-t border-ink pt-2.5">
            <span class="font-mono text-[13px] text-quiet">[1]</span>
            <div class="min-w-0">
              <!-- A label, not a heading: the hero has no section headings under its h1. -->
              <p class="mb-1 text-[13px] font-medium text-quiet">Rule of thumb</p>
              <p class="text-ink-2">{{ def.tuningTip }}</p>
            </div>
          </li>
          <li
            class="mt-5 grid grid-cols-[30px_minmax(0,1fr)] border-t pt-2.5"
            :class="changed ? 'border-mine' : 'border-fit'"
          >
            <span class="font-mono text-[13px] text-quiet">[{{ def.tuningTip ? 2 : 1 }}]</span>
            <p class="min-w-0" :class="changed ? 'text-mine-text' : 'text-ink-2'">{{ originNote }}</p>
          </li>
        </ol>
        <p class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <a
            :href="def.kernelDocsUrl"
            target="_blank"
            rel="noopener"
            class="inline-flex min-h-6 items-center text-ink underline underline-offset-[3px]"
          >{{ domain.docsLabel }}<span aria-hidden="true">&nbsp;↗</span><span class="sr-only">, opens in a new tab</span></a>
          <button
            type="button"
            class="inline-flex min-h-11 items-center text-ink underline underline-offset-[3px]"
            :class="{ invisible: !changed }"
            :tabindex="changed ? undefined : -1"
            :aria-hidden="!changed"
            @click="setValue(fit)"
          >Back to {{ format(fit) }}</button>
        </p>
      </aside>
    </div>
  </figure>
</template>

<style scoped>
.specimen {
  container: specimen / inline-size;
}
.specimen-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  row-gap: 1.5rem;
}
/* The value: 24px, and 32px once the figure is wide. */
@container specimen (min-width: 34rem) {
  .specimen-value {
    font-size: 2rem;
    line-height: 1.1;
  }
}
/* Column and margin side by side once the figure holds both. */
@container specimen (min-width: 34rem) {
  .specimen-body {
    grid-template-columns: minmax(0, 1fr) minmax(12.5rem, 15rem);
    column-gap: 2rem;
    align-items: start;
  }
}
</style>
