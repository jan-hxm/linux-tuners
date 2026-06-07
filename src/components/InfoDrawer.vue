<script setup>
import { computed, onMounted, onBeforeUnmount, watch, nextTick, ref } from 'vue'
import { useActiveTuner, useTunerDomain } from '@/composables/useActiveTuner.js'

const tuner = useActiveTuner()
const domain = useTunerDomain()
const closeBtn = ref(null)
const panel = ref(null)
// Element to restore focus to when the drawer closes (the param button that
// opened it). Captured at open time from document.activeElement.
let lastFocused = null

const def = computed(() =>
  tuner.drawerParamKey ? domain.defsByKey[tuner.drawerParamKey] : null,
)
const isOpen = computed(() => def.value !== null)

const contextNote = computed(() => {
  if (!def.value) return null
  return def.value[domain.noteKey] ?? def.value.contextNote ?? null
})

const workloadComparison = computed(() => {
  if (!def.value) return []
  return domain.workloads.map((workload) => {
    const hw = { ...tuner.hardware, [domain.workloadField]: workload }
    const value = domain.deriveDefaults(hw)[def.value.key]
    return {
      workload,
      value,
      formatted: domain.formatValue(value, def.value, hw),
    }
  })
})

// Per-parameter formulas come from the active domain (it knows which parameters
// have a genuinely useful derived formula). Null when there's nothing to show.
const formula = computed(() => {
  if (!def.value || !domain.formula) return null
  return domain.formula(def.value, { hardware: tuner.hardware, params: tuner.params })
})

function close() {
  tuner.closeDrawer()
}

function onKey(e) {
  if (e.key === 'Escape' && isOpen.value) close()
}

// Trap Tab within the dialog while it's open (aria-modal alone does not stop
// focus escaping to the page behind the overlay).
function onTrapKeydown(e) {
  if (e.key !== 'Tab') return
  const root = panel.value
  if (!root) return
  const focusables = root.querySelectorAll(
    'a[href], button:not([disabled]), textarea, input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )
  if (!focusables.length) return
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

watch(isOpen, async (open) => {
  if (open) {
    lastFocused = document.activeElement
    await nextTick()
    closeBtn.value?.focus()
  } else if (lastFocused && typeof lastFocused.focus === 'function') {
    lastFocused.focus()
    lastFocused = null
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-40 bg-slate-900/30"
      aria-hidden="true"
      @click="close"
    />
    <aside
      v-if="isOpen && def"
      ref="panel"
      class="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-xl"
      role="dialog"
      aria-modal="true"
      :aria-label="`Reference for ${def.sysctlName}`"
      @keydown="onTrapKeydown"
    >
      <header class="sticky top-0 flex items-start justify-between gap-3 border-b border-slate-200 bg-white p-4">
        <div class="min-w-0">
          <p class="text-xs uppercase tracking-wide text-slate-500">Reference</p>
          <h2 class="font-mono text-base font-semibold text-slate-900 break-all">{{ def.sysctlName }}</h2>
          <p class="mt-1 text-xs text-slate-600">{{ def.shortDesc }}</p>
        </div>
        <button
          ref="closeBtn"
          type="button"
          class="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
          @click="close"
        >Close ✕</button>
      </header>

      <div class="space-y-5 p-4 text-sm text-slate-800">
        <section>
          <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Documentation</h3>
          <div class="mt-1 space-y-2 leading-relaxed">
            <p v-for="(para, i) in def.longDesc" :key="i">{{ para }}</p>
          </div>
          <p v-if="def.tuningTip" class="mt-2 rounded border border-slate-200 bg-slate-50 p-2 text-xs font-medium text-slate-800">
            <span class="font-semibold">Rule of thumb:</span> {{ def.tuningTip }}
          </p>
          <p class="mt-2 text-xs">
            <a :href="def.kernelDocsUrl" target="_blank" rel="noopener" class="text-sky-700 underline">
              {{ domain.docsLabel }} ↗
            </a>
          </p>
        </section>

        <section v-if="contextNote">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">{{ domain.context.label }} context</h3>
          <p class="mt-1 rounded bg-sky-50 p-2 text-xs leading-relaxed text-sky-900">
            {{ contextNote }}
          </p>
          <p class="mt-2 text-xs">
            <a :href="domain.context.url" target="_blank" rel="noopener" class="text-sky-700 underline">
              Source ↗
            </a>
          </p>
        </section>

        <section v-if="formula">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">{{ formula.title }}</h3>
          <pre class="mt-1 rounded bg-slate-50 p-2 text-[11px] leading-snug text-slate-800 overflow-x-auto"><code>{{ formula.lines.join('\n') }}</code></pre>
          <dl class="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <template v-for="row in formula.values" :key="row.label">
              <dt class="text-slate-600">{{ row.label }}</dt>
              <dd class="font-mono text-slate-900">{{ row.v }}</dd>
            </template>
          </dl>
        </section>

        <section>
          <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Defaults by workload <span class="text-slate-500">(for current hardware)</span>
          </h3>
          <table class="mt-1 w-full text-xs">
            <thead>
              <tr class="text-left text-slate-500">
                <th class="font-medium">Workload</th>
                <th class="font-medium">Default</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in workloadComparison"
                :key="row.workload"
                class="border-t border-slate-100"
                :class="{ 'bg-slate-50': row.workload === tuner.hardware.workload }"
              >
                <td class="py-1 capitalize">
                  {{ row.workload }}
                  <span v-if="row.workload === tuner.hardware.workload" class="text-[10px] text-slate-500">(current)</span>
                </td>
                <td class="py-1 font-mono">{{ row.formatted }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Range</h3>
          <p class="mt-1 text-xs text-slate-700">
            Kernel accepts {{ def.kernelMin.toLocaleString() }} – {{ def.kernelMax.toLocaleString() }}.
            Kernel default: <span class="font-mono">{{ def.kernelDefault.toLocaleString() }}</span>.
          </p>
        </section>
      </div>
    </aside>
  </Teleport>
</template>