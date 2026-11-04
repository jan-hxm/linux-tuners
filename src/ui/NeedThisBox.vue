<script setup>
/**
 * "Do I need this?": the short block under a tuner's title. It says which
 * machine roles the tuner matters for and when the defaults are fine, from
 * the registry's `setup` block (roles, why, defaultsFine) through
 * ui/needThis.js, which the static page text shares, so no text lives here.
 * Collapsible with a real button, a full-width hairline row; open by default.
 */
import { computed, ref } from 'vue'
import { LIVE_TUNERS } from '@/tuners/registry.js'
import { NEED_THIS_HEADING, needThisRows } from '@/ui/needThis.js'

const props = defineProps({
  /** The tuner's id, as in the registry. */
  tunerId: { type: String, required: true },
})

const setup = computed(() => LIVE_TUNERS.find((t) => t.id === props.tunerId)?.setup ?? null)
const rows = computed(() => (setup.value ? needThisRows(setup.value) : []))

const open = ref(true)
const BODY_ID = `need-this-${props.tunerId}`
</script>

<template>
  <section v-if="setup" :aria-label="NEED_THIS_HEADING" class="border-y border-rule">
    <h2 class="m-0 text-base font-medium">
      <button
        type="button"
        class="flex min-h-11 w-full items-center justify-between gap-4 py-2 text-left text-ink hover:bg-paper-hover"
        :aria-expanded="open"
        :aria-controls="BODY_ID"
        @click="open = !open"
      >
        <span>{{ NEED_THIS_HEADING }}</span>
        <span class="font-mono text-lg text-ink-2" aria-hidden="true">{{ open ? '−' : '+' }}</span>
      </button>
    </h2>
    <dl v-show="open" :id="BODY_ID" class="grid gap-x-10 gap-y-4 border-t border-rule pb-5 pt-4 text-[15px] leading-[1.55] text-ink-2 md:grid-cols-3">
      <div v-for="row in rows" :key="row.id" class="min-w-0">
        <dt class="text-[13px] font-medium text-quiet">{{ row.label }}</dt>
        <dd class="mt-1">{{ row.text }}</dd>
      </div>
    </dl>
  </section>
</template>
