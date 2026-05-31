<script setup>
import { computed, onMounted, onBeforeUnmount, watch, nextTick, ref } from 'vue'
import { useTunerStore } from '@/stores/tuner.js'
import { PARAMETER_DEFS_BY_KEY, K8S_BLOG } from '@/data/parameterDefs.js'
import { deriveDefaults, watermarkLevelsMiB } from '@/model/calculations.js'
import { formatValue } from '@/utils/formatting.js'

const tuner = useTunerStore()
const closeBtn = ref(null)

const def = computed(() =>
  tuner.drawerParamKey ? PARAMETER_DEFS_BY_KEY[tuner.drawerParamKey] : null,
)
const isOpen = computed(() => def.value !== null)

const WORKLOADS = ['k8s', 'database', 'general', 'desktop', 'embedded']

const workloadComparison = computed(() => {
  if (!def.value) return []
  return WORKLOADS.map((workload) => {
    const hw = { ...tuner.hardware, workload }
    const value = deriveDefaults(hw)[def.value.key]
    return {
      workload,
      value,
      formatted: formatValue(value, def.value.unit, hw.ramGiB),
    }
  })
})

// Per-parameter formulas. Only spell one out when there's something useful to
// show the user — otherwise we'd be padding the drawer with restatements of
// the longDesc.
const formula = computed(() => {
  if (!def.value) return null
  if (def.value.key === 'watermark_scale_factor') {
    const lv = watermarkLevelsMiB(
      tuner.hardware.ramGiB,
      tuner.params.min_free_kbytes,
      tuner.params.watermark_scale_factor,
    )
    return {
      title: 'Watermark formula (whole-system view)',
      lines: [
        'window_pages = total_managed_pages × watermark_scale_factor / 10000',
        'low  = min + window',
        'high = low + window',
      ],
      values: [
        { label: 'min',  v: `${lv.minMiB} MiB` },
        { label: 'low',  v: `${lv.lowMiB} MiB` },
        { label: 'high', v: `${lv.highMiB} MiB` },
        { label: 'usable above high', v: `${lv.usableMiB} MiB` },
      ],
    }
  }
  if (def.value.key === 'overcommit_ratio') {
    const ramKb = tuner.hardware.ramGiB * 1024 * 1024
    const swapKb = tuner.hardware.swapGiB * 1024 * 1024
    const commitLimit = swapKb + (ramKb * tuner.params.overcommit_ratio) / 100
    return {
      title: 'CommitLimit formula (when overcommit_memory = 2)',
      lines: ['CommitLimit = swap + RAM × overcommit_ratio / 100'],
      values: [
        { label: 'CommitLimit', v: `${Math.round(commitLimit / 1024).toLocaleString()} MiB` },
      ],
    }
  }
  return null
})

function close() {
  tuner.closeDrawer()
}

function onKey(e) {
  if (e.key === 'Escape' && isOpen.value) close()
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

watch(isOpen, async (open) => {
  if (open) {
    await nextTick()
    closeBtn.value?.focus()
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
      class="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-xl"
      role="dialog"
      aria-modal="true"
      :aria-label="`Reference for ${def.sysctlName}`"
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
              kernel.org source ↗
            </a>
          </p>
        </section>

        <section v-if="def.k8sNote">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Kubernetes context</h3>
          <p class="mt-1 rounded bg-sky-50 p-2 text-xs leading-relaxed text-sky-900">
            {{ def.k8sNote }}
          </p>
          <p class="mt-2 text-xs">
            <a :href="K8S_BLOG" target="_blank" rel="noopener" class="text-sky-700 underline">
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
            Defaults by workload <span class="text-slate-400">(for current hardware)</span>
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