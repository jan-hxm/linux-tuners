<script setup>
import { computed, onMounted, onBeforeUnmount, watch, nextTick, ref } from 'vue'
import { useActiveTuner, useTunerDomain } from '@/ui/useActiveTuner.js'
import { valueTypeOf } from '@/core/valueTypes.js'
import { optionLabel } from '@/core/profile.js'
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
  const field = domain.workloadField
  return domain.workloads.map((workload) => {
    const hw = { ...tuner.hardware, [field]: workload }
    const value = domain.deriveDefaults(hw)[def.value.key]
    return {
      workload,
      label: optionLabel(domain.profile.fields, field, workload),
      current: workload === tuner.hardware[field],
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
    <!-- The backdrop dims the page in either scheme. -->
    <div
      v-if="isOpen"
      class="fixed inset-0 z-40 bg-black/40"
      aria-hidden="true"
      @click="close"
    />
    <div
      v-if="isOpen && def"
      ref="panel"
      class="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-y-auto border-l border-ink bg-paper text-ink"
      role="dialog"
      aria-modal="true"
      :aria-label="`Reference for ${def.sysctlName}`"
      @keydown="onTrapKeydown"
    >
      <div class="sticky top-0 flex items-start justify-between gap-3 border-b border-ink bg-paper px-5 pb-4 pt-5">
        <div class="min-w-0">
          <p class="text-[13px] text-quiet">Reference</p>
          <h2 class="mt-1 text-xl font-medium leading-snug text-ink">{{ def.title }}</h2>
          <p class="mt-0.5 break-all font-mono text-sm text-ink-2">{{ def.sysctlName }}</p>
          <p class="mt-2 text-[15px] leading-[1.55] text-ink-2">{{ def.shortDesc }}</p>
        </div>
        <button
          ref="closeBtn"
          type="button"
          class="inline-flex min-h-11 shrink-0 items-center gap-2 border border-rule-strong px-3 text-sm font-medium hover:bg-paper-hover"
          @click="close"
        >Close <svg aria-hidden="true" width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 2l10 10M12 2 2 12" /></svg></button>
      </div>

      <div class="space-y-6 px-5 py-5 text-[15px] leading-[1.55] text-ink-2">
        <section class="border-t border-rule pt-2.5">
          <h3 class="text-[13px] font-medium text-quiet">Range</h3>
          <p class="mt-1">
            {{ rangeText.accepts }}
            {{ domain.defaultLabel }}: <span class="font-mono text-ink">{{ rangeText.kernelDefault }}</span>.
            <template v-if="def.kernelDefaultNote">{{ def.kernelDefaultNote }}</template>
          </p>
        </section>

        <section v-if="tryCommand" class="border-t border-rule pt-2.5">
          <h3 class="text-[13px] font-medium text-quiet">Try it now</h3>
          <p class="mt-1">Sets the current value until the next reboot. The generated file makes it permanent.</p>
          <div class="mt-2 flex items-start gap-2">
            <code class="min-w-0 flex-1 break-all bg-paper-hover px-2 py-1.5 font-mono text-[13px] leading-snug text-ink">{{ tryCommand }}</code>
            <button
              type="button"
              class="min-h-9 shrink-0 border border-rule-strong px-2.5 text-[13px] font-medium text-ink hover:bg-paper-hover"
              @click="copyCommand"
            >{{ copyStatus === 'ok' ? 'Copied' : copyStatus === 'fail' ? 'Copy failed' : 'Copy' }}</button>
          </div>
          <p class="sr-only" aria-live="polite">{{ copyStatus === 'ok' ? 'Copied to clipboard.' : copyStatus === 'fail' ? 'Clipboard write failed.' : '' }}</p>
        </section>

        <section v-if="contextNote" class="border-t border-rule pt-2.5">
          <h3 class="text-[13px] font-medium text-quiet">{{ domain.context.label }} context</h3>
          <p class="mt-1">{{ contextNote }}</p>
        </section>

        <section v-if="formula" class="border-t border-rule pt-2.5">
          <h3 class="text-[13px] font-medium text-quiet">{{ formula.title }}</h3>
          <pre class="mt-2 overflow-x-auto bg-paper-hover p-2.5 font-mono text-[13px] leading-snug text-ink" tabindex="0" aria-label="Formula"><code>{{ formula.lines.join('\n') }}</code></pre>
          <dl class="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <template v-for="row in formula.values" :key="row.label">
              <dt class="text-quiet">{{ row.label }}</dt>
              <dd class="font-mono text-ink">{{ row.v }}</dd>
            </template>
          </dl>
        </section>

        <section class="border-t border-rule pt-2.5">
          <h3 class="text-[13px] font-medium text-quiet">
            Defaults by workload (for current hardware)
          </h3>
          <table class="mt-2 w-full text-sm">
            <thead>
              <tr class="text-left text-quiet">
                <th class="pb-1 font-medium">Workload</th>
                <th class="pb-1 font-medium">Default</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in workloadComparison"
                :key="row.workload"
                class="border-t border-rule"
                :class="{ 'bg-fit-tint text-ink': row.current }"
              >
                <td class="py-1.5 pr-3">
                  {{ row.label }}
                  <span v-if="row.current" class="text-quiet">(current)</span>
                </td>
                <td class="py-1.5 font-mono">{{ row.formatted }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="border-t border-rule pt-2.5">
          <h3 class="text-[13px] font-medium text-quiet">Sources</h3>
          <ul class="mt-1">
            <li><a :href="def.kernelDocsUrl" target="_blank" rel="noopener" class="inline-flex min-h-6 items-center text-ink underline underline-offset-[3px]">{{ domain.docsLabel }} ↗</a></li>
            <li v-if="contextNote"><a :href="domain.context.url" target="_blank" rel="noopener" class="inline-flex min-h-6 items-center text-ink underline underline-offset-[3px]">{{ domain.context.label }} guidance ↗</a></li>
          </ul>
        </section>
      </div>
    </div>
  </Teleport>
</template>
