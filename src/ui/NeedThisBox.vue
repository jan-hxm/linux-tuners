<script setup>
/**
 * "Do I need this?": the short box under a tuner's hero. It says which machine
 * roles the tuner matters for and when the defaults are fine, from the
 * registry's `setup` block (roles, why, defaultsFine) through ui/needThis.js,
 * which the static page text shares, so no text lives here. Collapsible with
 * a real button; open by default.
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
  <section v-if="setup" :aria-label="NEED_THIS_HEADING" class="rounded-lg border border-slate-200 bg-white shadow-sm">
    <h2 class="m-0 text-sm font-semibold">
      <button
        type="button"
        class="flex min-h-6 w-full items-center justify-between gap-2 px-4 py-2 text-left text-slate-800"
        :aria-expanded="open"
        :aria-controls="BODY_ID"
        @click="open = !open"
      >
        <span>{{ NEED_THIS_HEADING }}</span>
        <span class="text-xs font-normal text-slate-500" aria-hidden="true">{{ open ? 'Hide' : 'Show' }}</span>
      </button>
    </h2>
    <dl v-show="open" :id="BODY_ID" class="space-y-2 border-t border-slate-200 px-4 py-3 text-sm leading-relaxed text-slate-700">
      <div v-for="row in rows" :key="row.id">
        <dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">{{ row.label }}</dt>
        <dd>{{ row.text }}</dd>
      </div>
    </dl>
  </section>
</template>
