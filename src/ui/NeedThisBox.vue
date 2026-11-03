<script setup>
/**
 * "Do I need this?": the short box under a tuner's hero. It says which machine
 * roles the tuner matters for and when the defaults are fine, from the
 * registry's `setup` block (roles, why, defaultsFine) and MACHINE_ROLES, so no
 * text lives here. Collapsible with a real button; open by default.
 */
import { computed, ref } from 'vue'
import { LIVE_TUNERS } from '@/tuners/registry.js'
import { MACHINE_ROLES } from '@/core/machineRoles.js'

const props = defineProps({
  /** The tuner's id, as in the registry. */
  tunerId: { type: String, required: true },
})

const setup = computed(() => LIVE_TUNERS.find((t) => t.id === props.tunerId)?.setup ?? null)

const rolesText = computed(() => {
  const roles = setup.value?.roles
  if (roles === 'all') return 'Every kind of machine.'
  const labels = MACHINE_ROLES.filter((r) => roles?.includes(r.value)).map((r) => r.label)
  return labels.length ? `${labels.join(', ')}.` : ''
})

const open = ref(true)
const BODY_ID = `need-this-${props.tunerId}`
</script>

<template>
  <section v-if="setup" aria-label="Do I need this?" class="rounded-lg border border-slate-200 bg-white shadow-sm">
    <h2 class="m-0 text-sm font-semibold">
      <button
        type="button"
        class="flex min-h-6 w-full items-center justify-between gap-2 px-4 py-2 text-left text-slate-800"
        :aria-expanded="open"
        :aria-controls="BODY_ID"
        @click="open = !open"
      >
        <span>Do I need this?</span>
        <span class="text-xs font-normal text-slate-500" aria-hidden="true">{{ open ? 'Hide' : 'Show' }}</span>
      </button>
    </h2>
    <dl v-show="open" :id="BODY_ID" class="space-y-2 border-t border-slate-200 px-4 py-3 text-sm leading-relaxed text-slate-700">
      <div>
        <dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">What it does</dt>
        <dd>{{ setup.why }}</dd>
      </div>
      <div>
        <dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">Matters for</dt>
        <dd>{{ rolesText }}</dd>
      </div>
      <div>
        <dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">The defaults are fine for</dt>
        <dd>{{ setup.defaultsFine }}</dd>
      </div>
    </dl>
  </section>
</template>
