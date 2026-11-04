<script setup>
/**
 * The export, the page's finish line (Design.md §7): a summary
 * from state, Copy as the one large primary button, Download and Share link
 * beside it, the file below, and the install steps in the margin, the first
 * marked as next once the file is copied. Copy and download take exactly
 * what the output writers produce.
 */
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { useActiveTuner, useTunerDomain } from '@/ui/useActiveTuner.js'
import { combineFiles } from '@/core/output/files.js'
import { copyText, downloadText, downloadNames } from '@/ui/fileActions.js'
import { differingKeys } from '@/core/valueTypes.js'
import InstallSteps from '@/ui/InstallSteps.vue'
import PlusMinus from '@/ui/PlusMinus.vue'
import { installGuide } from '@/ui/installGuide.js'
import { settingsSummary } from '@/ui/settingsSummary.js'

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

// The settings counted are the ones the page shows for this profile.
const shownKeys = computed(() => [
  ...new Set(domain.sections.flatMap((s) => domain.visibleKeys(s, tuner.params, tuner.hardware))),
])
const summary = computed(() => settingsSummary(shownKeys.value, tuner.changedKeys))

// The preview marks the line a changed setting writes in the "changed by
// you" colour. A line is matched by the setting's name standing as a whole
// token (a sysctl key, a directive, a /sys path's tail, a udev attribute),
// and only when exactly one line matches, so a name several lines share
// marks none rather than the wrong one. The text is the output unchanged:
// copy and download take `output`, never these lines.
const escapeRe = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const isComment = (line) => /^\s*([#;]|$)/.test(line)
const lines = computed(() => {
  const all = output.value.split('\n')
  const marked = new Set()
  for (const key of tuner.changedKeys) {
    const name = domain.defsByKey[key]?.sysctlName
    if (!name) continue
    const re = new RegExp(`(^|[\\s{/"])${escapeRe(name)}(?=$|[\\s=}"])`)
    const hits = all.flatMap((line, i) => (!isComment(line) && re.test(line) ? [i] : []))
    if (hits.length === 1) marked.add(hits[0])
  }
  return all.map((text, i) => ({ text, kind: marked.has(i) ? 'mine' : isComment(text) ? 'comment' : 'plain' }))
})
const LINE_CLASS = { mine: 'text-mine-text', comment: 'text-quiet', plain: 'text-ink' }

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
// After a copy the first install step is marked as next, until the output
// changes and what was copied is no longer what is shown.
const copied = ref(false)
watch(output, () => (copied.value = false))
const copyLabel = computed(() => (files.value.length > 1 ? 'Copy all files' : 'Copy the file'))
const nextStep = computed(() => {
  const title = installGuide(files.value, { combined: files.value.length > 1 }).groups[0]?.title
  return title ? ` Next: ${title.charAt(0).toLowerCase()}${title.slice(1)}.` : ''
})

// The confirmations reset after a moment; the timers are cleared on unmount.
const timers = {}
function resetLater(status, name) {
  clearTimeout(timers[name])
  timers[name] = setTimeout(() => (status.value = 'idle'), 1800)
}
onBeforeUnmount(() => Object.values(timers).forEach(clearTimeout))

async function copy() {
  if (blocked.value) return
  copyStatus.value = (await copyText(output.value)) ? 'ok' : 'fail'
  if (copyStatus.value === 'ok') copied.value = true
  resetLater(copyStatus, 'copy')
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
  resetLater(shareStatus, 'share')
}

function reset() {
  tuner.resetToHardwareDefaults()
}

const SECONDARY = 'min-h-11 border border-rule-strong px-3.5 text-sm font-medium text-ink hover:bg-paper-hover'
</script>

<template>
  <section>
    <!-- Blocked state: validation error replaces the output -->
    <div v-if="blocked" class="border border-error px-4 py-3.5 text-[15px] leading-[1.55] text-ink">
      <p class="font-medium text-error">Config output is suppressed.</p>
      <p class="mt-1">
        The following blocking validation issue{{ blockingIssues.length === 1 ? '' : 's' }} must be resolved before the file can be copied:
      </p>
      <ul class="mt-2 list-disc space-y-1 pl-5">
        <li v-for="issue in blockingIssues" :key="issue.id">{{ issue.message }}</li>
      </ul>
    </div>

    <!-- Normal state: the file in the column, how to apply it in the margin. -->
    <template v-else>
      <p class="text-[15px] text-ink-2">{{ summary }}</p>

      <div class="mt-4 grid grid-cols-1 gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,24rem)]">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-x-3 gap-y-2.5">
            <button
              type="button"
              class="min-h-[52px] bg-ink px-7 text-[17px] font-medium text-paper hover:bg-ink-2"
              @click="copy"
            >{{ copyStatus === 'ok' ? 'Copied' : copyLabel }}</button>
            <button
              v-for="(file, i) in files"
              :key="file.path"
              type="button"
              :class="SECONDARY"
              @click="download(i)"
            >Download <span class="font-mono text-[13px]">{{ names[i] }}</span></button>
            <button type="button" :class="SECONDARY" @click="shareUrl">Share link</button>
          </div>

          <div aria-live="polite" class="mt-2 min-h-6 text-sm">
            <p v-if="copyStatus === 'ok'" class="text-fit-text">Copied to clipboard.{{ nextStep }}</p>
            <p v-else-if="copyStatus === 'fail'" class="text-error">
              Clipboard write failed. Select the text below and copy it by hand.
            </p>
            <p v-if="shareStatus === 'ok'" class="text-fit-text">Share link copied.</p>
            <p v-else-if="shareStatus === 'fail'" class="text-error">
              Clipboard write failed, but the URL bar already holds the current state.
            </p>
          </div>

          <ul class="mt-2 border-b border-rule">
            <li v-for="file in files" :key="file.path" class="break-all py-1.5 font-mono text-sm text-quiet">{{ file.path }}</li>
          </ul>
          <!-- The output as it is copied, one span per line. It scrolls on its
               own when long, so keyboards can reach it (Design.md §7). -->
          <pre
            class="max-h-[28rem] overflow-auto whitespace-pre-wrap py-3 font-mono text-sm leading-[1.8] [overflow-wrap:anywhere]"
            tabindex="0"
            aria-label="Generated configuration"
          ><template v-for="(line, i) in lines" :key="i"><span :class="LINE_CLASS[line.kind]">{{ line.text }}</span>{{ i < lines.length - 1 ? '\n' : '' }}</template></pre>

          <div class="border-t border-rule text-[15px]">
            <p v-if="!differing.length" class="py-3 text-ink-2">Every value is at the {{ domain.defaultLabel.toLowerCase() }}.</p>
            <template v-else>
              <button
                type="button"
                class="flex min-h-11 w-full items-center justify-between gap-4 py-2 text-left text-ink hover:bg-paper-hover"
                :aria-expanded="showDiffering"
                aria-controls="output-differing"
                @click="showDiffering = !showDiffering"
              >{{ differing.length }} {{ differing.length === 1 ? 'value differs' : 'values differ' }} from the {{ defaultsLabel }}<PlusMinus :open="showDiffering" /></button>
              <ul v-if="showDiffering" id="output-differing" class="pb-3 text-sm">
                <li v-for="d in differing" :key="d.key" class="flex flex-wrap items-baseline gap-x-3 border-t border-rule py-2">
                  <span class="font-medium text-ink">{{ d.def.title }}</span>
                  <code class="break-all font-mono text-quiet">{{ d.def.sysctlName }}</code>
                  <span class="font-mono text-ink-2">{{ d.stock }} → {{ d.value }}</span>
                </li>
              </ul>
            </template>
          </div>

          <div class="mt-4 border-t border-rule pt-1">
            <button
              type="button"
              class="inline-flex min-h-11 items-center text-sm text-ink-2 underline underline-offset-[3px] hover:text-ink"
              @click="reset"
            >Reset to hardware defaults</button>
          </div>
        </div>

        <aside class="min-w-0" aria-label="How to apply it">
          <InstallSteps :files="files" :combined="files.length > 1" :next="copied" />
        </aside>
      </div>
    </template>
  </section>
</template>
