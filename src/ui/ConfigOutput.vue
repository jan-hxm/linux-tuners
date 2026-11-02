<script setup>
import { computed, ref } from 'vue'
import { useActiveTuner, useTunerDomain } from '@/ui/useActiveTuner.js'
import { combineFiles } from '@/core/output/files.js'
import { copyText, downloadText, downloadNames } from '@/ui/fileActions.js'
import { differingKeys } from '@/core/valueTypes.js'
import InstallSteps from '@/ui/InstallSteps.vue'

const tuner = useActiveTuner()
const domain = useTunerDomain()

const blockingIssues = computed(() => tuner.issues.filter((i) => i.blocking))
const blocked = computed(() => blockingIssues.value.length > 0)

// Multi-file tuners show every file in one text, each under a banner naming
// its path; copy takes that same text, and each file downloads on its own
// under its own name.
const files = computed(() => tuner.configFiles)
const output = computed(() => combineFiles(files.value))
const names = computed(() => downloadNames(files.value.map((f) => f.path)))

// What the output changes: every value off its stock default, for review
// before the file goes on a machine.
const stockDefaults = Object.fromEntries(domain.parameterKeys.map((k) => [k, domain.defsByKey[k].kernelDefault]))
const differing = computed(() =>
  differingKeys(domain.defsByKey, stockDefaults, tuner.params).map((key) => {
    const def = domain.defsByKey[key]
    return {
      key,
      def,
      stock: domain.formatValue(def.kernelDefault, def, tuner.hardware),
      value: domain.formatValue(tuner.params[key], def, tuner.hardware),
    }
  }),
)
const showDiffering = ref(false)
const defaultsLabel = `${domain.defaultLabel.toLowerCase()}s`

const copyStatus = ref('idle') // 'idle' | 'ok' | 'fail'
const shareStatus = ref('idle')

async function copy() {
  if (blocked.value) return
  copyStatus.value = (await copyText(output.value)) ? 'ok' : 'fail'
  setTimeout(() => (copyStatus.value = 'idle'), 1800)
}

function download(i) {
  if (blocked.value) return
  downloadText(names.value[i], files.value[i].content)
}

async function shareUrl() {
  // The store debounces URL writes by 200 ms; on share we want the latest state
  // in the clipboard immediately, so we re-encode ourselves rather than reading
  // location.href (which might still hold the previous hash).
  const hash = domain.encodeState({
    hardware: tuner.hardware,
    params: tuner.params,
    activePreset: tuner.activePreset,
    activeTab: tuner.activeTab,
  })
  const url = `${window.location.origin}${window.location.pathname}#${hash}`
  try {
    await navigator.clipboard.writeText(url)
    shareStatus.value = 'ok'
  } catch {
    shareStatus.value = 'fail'
  }
  setTimeout(() => (shareStatus.value = 'idle'), 1800)
}

function reset() {
  tuner.resetToHardwareDefaults()
}
</script>

<template>
  <section class="rounded-lg border border-slate-200 bg-white shadow-sm">
    <header class="flex flex-wrap items-baseline justify-between gap-3 border-b border-slate-100 px-4 py-2">
      <p class="text-xs text-slate-500">
        Generated live from your current parameter values.
      </p>
    </header>

    <!-- Blocked state: validation error replaces the output -->
    <div v-if="blocked" class="space-y-3 p-4">
      <div class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
        <p class="font-semibold">Config output is suppressed.</p>
        <p class="mt-1 text-xs">
          The following blocking validation issue{{ blockingIssues.length === 1 ? '' : 's' }} must be resolved before the file can be copied:
        </p>
        <ul class="mt-2 list-disc space-y-1 pl-5 text-xs">
          <li v-for="issue in blockingIssues" :key="issue.id">{{ issue.message }}</li>
        </ul>
      </div>
    </div>

    <!-- Normal state: steps, the diff, textarea + actions -->
    <div v-else class="space-y-3 p-4">
      <InstallSteps :files="files" :combined="files.length > 1" />

      <div class="border-t border-slate-100 pt-3 text-sm">
        <p v-if="!differing.length" class="text-slate-600">Every value is at the {{ domain.defaultLabel.toLowerCase() }}.</p>
        <template v-else>
          <button
            type="button"
            class="min-h-6 text-left text-slate-700 hover:text-slate-900"
            :aria-expanded="showDiffering"
            aria-controls="output-differing"
            @click="showDiffering = !showDiffering"
          >{{ showDiffering ? '▾' : '▸' }} {{ differing.length }} {{ differing.length === 1 ? 'value differs' : 'values differ' }} from the {{ defaultsLabel }}</button>
          <ul v-if="showDiffering" id="output-differing" class="mt-2 space-y-1 text-xs">
            <li v-for="d in differing" :key="d.key" class="flex flex-wrap items-baseline gap-x-2">
              <span class="font-medium text-slate-900">{{ d.def.title }}</span>
              <code class="break-all font-mono text-slate-600">{{ d.def.sysctlName }}</code>
              <span class="font-mono text-slate-700">{{ d.stock }} → {{ d.value }}</span>
            </li>
          </ul>
        </template>
      </div>

      <textarea
        :value="output"
        readonly
        class="h-72 w-full resize-y rounded border border-slate-300 bg-slate-50 p-3 font-mono text-[12px] leading-snug text-slate-900"
        aria-label="Generated sysctl configuration"
        @focus="$event.target.select()"
      ></textarea>

      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="rounded px-4 py-1.5 text-sm font-medium text-white transition"
          :class="copyStatus === 'ok' ? 'bg-emerald-600' : 'bg-sky-700 hover:bg-sky-800'"
          @click="copy"
        >{{ copyStatus === 'ok' ? 'Copied ✓' : 'Copy to clipboard' }}</button>
        <button
          v-for="(file, i) in files"
          :key="file.path"
          type="button"
          class="rounded border border-slate-300 px-4 py-1.5 text-sm hover:bg-slate-50"
          @click="download(i)"
        >Download <span class="font-mono text-xs">{{ names[i] }}</span></button>
        <button
          type="button"
          class="rounded border border-slate-300 px-4 py-1.5 text-sm hover:bg-slate-50"
          @click="shareUrl"
        >Share URL</button>
        <button
          type="button"
          class="ml-auto rounded border border-slate-300 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          @click="reset"
        >Reset to hardware defaults</button>
      </div>

      <div aria-live="polite">
        <p v-if="copyStatus === 'ok'" class="text-xs text-emerald-700">Copied to clipboard.</p>
        <p v-else-if="copyStatus === 'fail'" class="text-xs text-red-700">
          Clipboard write failed. Select the textarea and copy manually.
        </p>
        <p v-if="shareStatus === 'ok'" class="text-xs text-emerald-700">Share URL copied.</p>
        <p v-else-if="shareStatus === 'fail'" class="text-xs text-red-700">
          Clipboard write failed, but the URL bar already holds the current state.
        </p>
      </div>
    </div>
  </section>
</template>