<script setup>
import { computed, onMounted, onBeforeUnmount, watch, nextTick, ref } from 'vue'
import { useActiveTuner, useTunerDomain } from '@/ui/useActiveTuner.js'
import { valueTypeOf } from '@/core/valueTypes.js'
import { copyText } from '@/ui/fileActions.js'

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
  if (!domain.contextApplies(tuner.hardware)) return null
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

// The accepted values and the kernel default, worded for the def's type: an
// enum lists the options the profile allows, a tuple holds each element to
// the range, or to its own one in def.elementLimits.
const rangeText = computed(() => {
  const d = def.value
  if (!d) return null
  const accepts = d.type === 'enum'
    ? `Offered: ${(domain.rangeFor(d.key, tuner.hardware).options ?? d.options.map((o) => o.value)).join(', ')}.`
    : d.elementLimits
    ? `Kernel accepts ${d.elementLimits.map((r, i) => `${d.tupleLabels[i]} ${r.min.toLocaleString()} – ${r.max.toLocaleString()}`).join(', ')}.`
    : `Kernel accepts ${d.kernelMin.toLocaleString()} – ${d.kernelMax.toLocaleString()}${d.type === 'tuple' ? ' for each value' : ''}.`
  const kernelDefault = typeof d.kernelDefault === 'number' ? d.kernelDefault.toLocaleString() : valueTypeOf(d).format(d.kernelDefault, d)
  return { accepts, kernelDefault }
})

// Per-parameter formulas come from the active domain (it knows which parameters
// have a genuinely useful derived formula). Null when there's nothing to show.
const formula = computed(() => {
  if (!def.value) return null
  return domain.formula(def.value, { hardware: tuner.hardware, params: tuner.params })
})

// A command that sets the current value until the next reboot, from the
// domain (sysctl -w, or a sysfs write); null when the setting has none.
const tryCommand = computed(() => {
  if (!def.value) return null
  return domain.tryCommand(def.value, valueTypeOf(def.value).format(tuner.params[def.value.key], def.value))
})
/** 'ok' | 'fail' after a copy, cleared after a moment. */
const copyStatus = ref(null)
async function copyCommand() {
  copyStatus.value = (await copyText(tryCommand.value)) ? 'ok' : 'fail'
  setTimeout(() => (copyStatus.value = null), 1800)
}

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
      class="light-palette fixed inset-0 z-40 bg-slate-900/30"
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
          <h2 class="text-base font-semibold text-slate-900">{{ def.title }}</h2>
          <p class="break-all font-mono text-sm text-slate-700">{{ def.sysctlName }}</p>
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
          <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Range</h3>
          <p class="mt-1 text-xs text-slate-700">
            {{ rangeText.accepts }}
            {{ domain.defaultLabel }}: <span class="font-mono">{{ rangeText.kernelDefault }}</span>.
            <template v-if="def.kernelDefaultNote">{{ def.kernelDefaultNote }}</template>
          </p>
        </section>

        <section v-if="tryCommand">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Try it now</h3>
          <p class="mt-1 text-xs text-slate-700">Sets the current value until the next reboot. The generated file makes it permanent.</p>
          <div class="mt-1 flex items-start gap-2">
            <code class="min-w-0 flex-1 break-all rounded bg-slate-50 p-2 font-mono text-[11px] leading-snug text-slate-800">{{ tryCommand }}</code>
            <button
              type="button"
              class="shrink-0 rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
              @click="copyCommand"
            >{{ copyStatus === 'ok' ? 'Copied ✓' : copyStatus === 'fail' ? 'Copy failed' : 'Copy' }}</button>
          </div>
          <p class="sr-only" aria-live="polite">{{ copyStatus === 'ok' ? 'Copied to clipboard.' : copyStatus === 'fail' ? 'Clipboard write failed.' : '' }}</p>
        </section>

        <section v-if="contextNote">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">{{ domain.context.label }} context</h3>
          <p class="mt-1 rounded bg-sky-50 p-2 text-xs leading-relaxed text-sky-900">
            {{ contextNote }}
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
          <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Sources</h3>
          <ul class="mt-1 space-y-1 text-xs">
            <li><a :href="def.kernelDocsUrl" target="_blank" rel="noopener" class="text-sky-700 underline">{{ domain.docsLabel }} ↗</a></li>
            <li v-if="contextNote"><a :href="domain.context.url" target="_blank" rel="noopener" class="text-sky-700 underline">{{ domain.context.label }} guidance ↗</a></li>
          </ul>
        </section>
      </div>
    </aside>
  </Teleport>
</template>