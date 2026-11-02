<script setup>
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AdSlot from '@/ui/AdSlot.vue'
import { LIVE_TUNERS, PLANNED_TUNERS } from '@/tuners/registry.js'
import { MACHINE_ROLES, isMachineRole, tunersForRole } from '@/core/machineRoles.js'

const route = useRoute()
const router = useRouter()

// The picked role lives in the query (/?role=database), so Back and a shared
// link keep it. Anything that isn't a known role reads as no role, which shows
// every card in setup order, as the prerendered page does.
const role = computed(() => (isMachineRole(route.query.role) ? route.query.role : null))
const roleLabel = computed(() => MACHINE_ROLES.find((r) => r.value === role.value)?.label)
const roleOptions = [{ value: null, label: 'Any machine' }, ...MACHINE_ROLES]

function pickRole(value) {
  router.replace({ query: value ? { role: value } : {} })
}

const groups = computed(() =>
  role.value ? tunersForRole(LIVE_TUNERS, role.value) : { recommended: LIVE_TUNERS, optional: [] },
)
const summary = computed(() => {
  if (!role.value) return ''
  const { recommended, optional } = groups.value
  return `${roleLabel.value}: ${recommended.length} tuners in setup order, ${optional.length} optional.`
})

// The tuner sections: the recommended ones (numbered steps once a role is
// picked), then the optional ones, which stay on the page rather than hidden.
const sections = computed(() => [
  { id: 'recommended', tuners: groups.value.recommended, steps: Boolean(role.value) },
  {
    id: 'optional',
    tuners: groups.value.optional,
    heading: 'Optional for this machine',
    note: 'These rarely matter for this role, and their defaults are usually fine. Open one if you know you need it.',
  },
].filter((sec) => sec.tuners.length))
</script>

<template>
  <section class="mx-auto max-w-6xl space-y-10 p-4 sm:p-6">
    <!-- Hero -->
    <header class="light-palette overflow-hidden rounded-lg bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 px-6 py-10 text-white shadow-sm sm:px-10 sm:py-14">
      <div class="max-w-3xl">
        <p class="text-xs uppercase tracking-widest text-slate-400">linux-tuners.dev</p>
        <h1 class="mt-2 text-2xl font-semibold leading-tight tracking-tight sm:text-4xl">
          Interactive Linux config tuners, grounded in the docs.
        </h1>
        <p class="mt-4 text-sm leading-relaxed text-slate-200 sm:text-base">
          Drag sliders. Watch the impact. Copy the config. Each tuner explains every option in plain language, derives sensible defaults from your hardware, and shows the kernel-level effect live, so you understand what you're changing, not just what to type.
        </p>
        <p class="mt-4 text-xs text-slate-400">
          URL-encodable state for sharing.
        </p>
      </div>
    </header>

    <AdSlot slot="landing" label="landing top" />

    <!-- Live tuners: every card in setup order, or split by the picked role -->
    <section
      v-for="(sec, n) in sections"
      :key="sec.id"
      class="space-y-4"
    >
      <div v-if="n === 0">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Tuners</h2>
        <p id="role-picker-label" class="mt-1 text-xs text-slate-500">
          What is this machine? Pick a role to see which tuners matter for it, in the order to set them.
        </p>
        <div
          role="radiogroup"
          aria-labelledby="role-picker-label"
          class="mt-2 flex w-fit max-w-full flex-wrap gap-px overflow-hidden rounded border border-slate-300 bg-slate-300"
        >
          <button
            v-for="r in roleOptions"
            :key="r.value ?? 'any'"
            type="button"
            role="radio"
            :aria-checked="role === r.value"
            class="flex-auto px-3 py-1 text-xs"
            :class="role === r.value ? 'bg-sky-700 text-white' : 'bg-white hover:bg-slate-50'"
            @click="pickRole(r.value)"
          >
            {{ r.label }}
          </button>
        </div>
        <p class="mt-2 text-xs text-slate-500" aria-live="polite">{{ summary }}</p>
      </div>
      <div v-else>
        <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">{{ sec.heading }}</h2>
        <p class="mt-1 text-xs text-slate-500">{{ sec.note }}</p>
      </div>
      <component :is="sec.steps ? 'ol' : 'ul'" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <li v-for="(tuner, i) in sec.tuners" :key="tuner.id">
          <RouterLink
            :to="tuner.path"
            class="flex h-full flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-400 hover:shadow"
          >
            <header class="flex items-baseline justify-between gap-2">
              <h3 class="text-lg font-semibold text-slate-900">{{ tuner.title }}</h3>
              <span v-if="sec.steps" class="shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800">
                Step {{ i + 1 }}
              </span>
              <span v-else-if="sec.id === 'optional'" class="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                Optional
              </span>
              <span v-else class="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                Available
              </span>
            </header>
            <p v-if="sec.steps" class="mt-2 border-l-2 border-sky-600 pl-2 text-sm text-slate-800">{{ tuner.setup.why }}</p>
            <p class="mt-2 flex-1 text-sm text-slate-600">{{ tuner.blurb }}</p>
            <ul class="mt-3 flex flex-wrap gap-1">
              <li
                v-for="key in tuner.keys"
                :key="key"
                class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600"
              >{{ key }}</li>
            </ul>
            <p class="mt-4 text-xs font-medium text-slate-700">Open tuner →</p>
          </RouterLink>
        </li>
      </component>
    </section>

    <!-- Roadmap -->
    <section class="space-y-4">
      <div>
        <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">On the roadmap</h2>
        <p class="mt-1 text-xs text-slate-500">
          Coverage is expanding toward the whole sysctl tree plus the key sysfs runtime tunables. Each card below is a planned tuner built on the same hardware-aware, doc-grounded model.
        </p>
      </div>
      <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <li v-for="tuner in PLANNED_TUNERS" :key="tuner.id">
          <div class="flex h-full flex-col rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5">
            <header class="flex items-baseline justify-between gap-2">
              <h3 class="text-base font-semibold text-slate-700">{{ tuner.title }}</h3>
              <span class="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                Coming soon
              </span>
            </header>
            <p class="mt-2 flex-1 text-sm text-slate-600">{{ tuner.blurb }}</p>
            <ul class="mt-3 flex flex-wrap gap-1">
              <li
                v-for="key in tuner.keys"
                :key="key"
                class="rounded bg-slate-200/60 px-1.5 py-0.5 font-mono text-[11px] text-slate-600"
              >{{ key }}</li>
            </ul>
          </div>
        </li>
      </ul>
    </section>

    <!-- Why this exists -->
    <section class="space-y-3">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Why this exists</h2>
      <div class="rounded-lg border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-700 shadow-sm sm:p-6">
        <p>
          Linux system-tuning advice lives in scattered blog posts, kernel.org pages, and tribal ops knowledge. The values you should pick depend strongly on your hardware (RAM, swap device, disk type, NIC) and your workload (Kubernetes node, database server, desktop), yet most tuning guides are static, generic, and silent about the tradeoffs.
        </p>
        <p class="mt-3">
          Each tuner here asks about your system first, derives sensible starting values from the documentation, lets you customise via sliders, and shows the kernel-level impact through live graphs grounded in the same formulas the kernel uses internally. The output is a ready-to-paste config file with citations to the source documentation.
        </p>
      </div>
    </section>
  </section>
</template>
