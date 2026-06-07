<script setup>
import { computed, ref } from 'vue'
import { useActiveTuner, useTunerDomain } from '@/composables/useActiveTuner.js'

const tuner = useActiveTuner()
const domain = useTunerDomain()

const presetLabel = computed(() =>
  tuner.activePreset ? domain.presetsById[tuner.activePreset]?.label ?? null : null,
)

const customised = computed(() => {
  if (!tuner.activePreset) return false
  const preset = domain.presetsById[tuner.activePreset]
  if (!preset) return false
  return Object.entries(preset.values).some(([k, v]) => tuner.params[k] !== v)
})

const blockingIssues = computed(() => tuner.issues.filter((i) => i.blocking))
const blocked = computed(() => blockingIssues.value.length > 0)

const output = computed(() =>
  domain.generateConfig({
    hardware: tuner.hardware,
    params: tuner.params,
    presetLabel: presetLabel.value,
    customised: customised.value,
  }),
)

const copyStatus = ref('idle') // 'idle' | 'ok' | 'fail'
const shareStatus = ref('idle')

async function copy() {
  if (blocked.value) return
  try {
    await navigator.clipboard.writeText(output.value)
    copyStatus.value = 'ok'
  } catch {
    copyStatus.value = 'fail'
  }
  setTimeout(() => (copyStatus.value = 'idle'), 1800)
}

function download() {
  if (blocked.value) return
  const blob = new Blob([output.value + '\n'], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = domain.outputFilename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Defer revoke to next tick so the browser has a chance to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 0)
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

    <!-- Normal state: textarea + actions -->
    <div v-else class="space-y-3 p-4">
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
          :class="copyStatus === 'ok' ? 'bg-emerald-600' : 'bg-slate-800 hover:bg-slate-700'"
          @click="copy"
        >{{ copyStatus === 'ok' ? 'Copied ✓' : 'Copy to clipboard' }}</button>
        <button
          type="button"
          class="rounded border border-slate-300 px-4 py-1.5 text-sm hover:bg-slate-50"
          @click="download"
        >Download .conf</button>
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