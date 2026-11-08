<script setup>
/**
 * The last setup step: every included step's files, from that tuner's own
 * generateConfig, unchanged. Each file has its own copy and download; one
 * combined copy puts the machine profile on top. A blocked step's files are
 * left out, and the step is named in their place. No install script and no
 * archive (Design.md §5 "Guided setup", "Output").
 */
import { computed, ref, watch } from 'vue'
import { combineFiles } from '@/core/output/files.js'
import { copyText, downloadText, downloadNames } from '@/ui/fileActions.js'
import InstallSteps from '@/ui/InstallSteps.vue'
import PlusMinus from '@/ui/PlusMinus.vue'
import { settingsSummary } from '@/ui/settingsSummary.js'
import { machineHeader } from './machineProfile.js'
import { SETUP_STEPS } from './steps.js'
import { useSetupStore, useStepStore } from './useSetupStore.js'

const emit = defineEmits({ goto: (id) => typeof id === 'string' })

const setup = useSetupStore()

const included = computed(() =>
  SETUP_STEPS.filter(({ id }) => !setup.skipped.includes(id)).map((step) => {
    const store = useStepStore(step.id)
    return {
      ...step,
      blocked: store.blocked,
      blocking: store.issues.filter((i) => i.blocking),
      files: store.blocked ? [] : store.configFiles,
    }
  }),
)
const allFiles = computed(() => included.value.flatMap((s) => s.files))
/** Download names, unique across every file of the setup. */
const names = computed(() => {
  const paths = allFiles.value.map((f) => f.path)
  const unique = downloadNames(paths)
  return Object.fromEntries(paths.map((p, i) => [p, unique[i]]))
})
const blockedSteps = computed(() => included.value.filter((s) => s.blocked))

/** Which file's text is shown, by path. */
const open = ref({})
/** 'ok' | 'fail' per copy target (a path, 'all' or 'link'). */
const status = ref({})

async function copy(key, text) {
  status.value = { ...status.value, [key]: (await copyText(text)) ? 'ok' : 'fail' }
  setTimeout(() => (status.value = { ...status.value, [key]: undefined }), 1800)
}

const combined = computed(() => `${machineHeader(setup.machine)}\n\n${combineFiles(allFiles.value)}`)

// After "Copy all" the first install step is marked as next, until the files
// change and what was copied is no longer what is shown.
const copied = ref(false)
watch(combined, () => (copied.value = false))

async function copyAll() {
  await copy('all', combined.value)
  copied.value = status.value.all === 'ok'
}
const copyLink = () => copy('link', `${window.location.origin}${window.location.pathname}#${setup.linkHash()}`)

const copyLabel = (key, idle) => ({ ok: 'Copied', fail: 'Copy failed' })[status.value[key]] ?? idle

// One count across the included, unblocked steps; keys are prefixed with the
// step so two tuners' settings never collide.
const summary = computed(() => {
  const keys = []
  const changed = []
  for (const s of included.value.filter((x) => !x.blocked)) {
    const store = useStepStore(s.id)
    for (const key of new Set(s.domain.sections.flatMap((sec) => s.domain.visibleKeys(sec, store.params, store.hardware)))) {
      keys.push(`${s.id}:${key}`)
      if (store.changedKeys.includes(key)) changed.push(`${s.id}:${key}`)
    }
  }
  return settingsSummary(keys, changed)
})

const SECONDARY = 'min-h-11 border border-rule-strong px-3.5 text-sm font-medium text-ink hover:bg-paper-hover'
const SMALL = 'inline-flex min-h-11 items-center border border-rule-strong px-3 text-[13px] font-medium text-ink hover:bg-paper-hover'
</script>

<template>
  <div class="space-y-6">
    <p class="max-w-3xl text-[15px] leading-relaxed text-ink-2">
      Each file comes from its tuner unchanged, and no two tuners write the same setting.
      <template v-if="allFiles.length"> {{ summary }}</template>
    </p>

    <p v-if="!included.length" class="border border-dashed border-rule-strong p-4 text-[15px] text-ink-2">
      Every step is skipped, so there are no files.
    </p>

    <div v-if="blockedSteps.length" class="border border-error px-4 py-3.5 text-[15px] leading-[1.55] text-ink">
      <p class="font-medium text-error">Left out, because the step has a blocking issue:</p>
      <ul class="mt-1 list-disc pl-5">
        <li v-for="s in blockedSteps" :key="s.id">
          <button type="button" class="min-h-6 underline underline-offset-[3px]" @click="emit('goto', s.id)">{{ s.entry.title }}</button>
          <ul class="mt-1 space-y-1">
            <li v-for="issue in s.blocking" :key="issue.id">
              {{ issue.message }}
              <span v-if="issue.fix" class="block">{{ issue.fix }}</span>
            </li>
          </ul>
        </li>
      </ul>
    </div>

    <div v-if="allFiles.length" class="grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,24rem)]">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-2.5">
          <button
            type="button"
            class="min-h-[52px] bg-ink px-7 text-[17px] font-medium text-paper hover:bg-ink-2"
            @click="copyAll"
          >{{ copyLabel('all', `Copy all ${allFiles.length} files`) }}</button>
          <button type="button" :class="SECONDARY" @click="copyLink">{{ copyLabel('link', 'Share link') }}</button>
        </div>

        <div aria-live="polite" class="mt-2 min-h-6 text-sm">
          <p v-if="status.all === 'ok'" class="text-fit-text">Copied to clipboard. Next: save the files, then apply them.</p>
          <p v-else-if="status.all === 'fail'" class="text-error">Clipboard write failed. Open a file below and copy it by hand.</p>
          <p v-if="status.link === 'ok'" class="text-fit-text">Link to this setup copied.</p>
          <p v-else-if="status.link === 'fail'" class="text-error">Clipboard write failed, but the URL bar already holds the current setup.</p>
        </div>

        <section v-for="s in included.filter((x) => !x.blocked)" :key="s.id" class="mt-6">
          <h3 class="border-t border-ink pt-3 text-[17px] font-medium text-ink">{{ s.entry.title }}</h3>
          <ul class="mt-2">
            <li v-for="file in s.files" :key="file.path" class="border-t border-rule first:border-t-0">
              <div class="flex flex-wrap items-center gap-x-3 gap-y-2 py-2">
                <button
                  type="button"
                  class="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-4 text-left hover:bg-paper-hover"
                  :aria-expanded="Boolean(open[file.path])"
                  :aria-controls="`setup-file-${file.path}`"
                  @click="open = { ...open, [file.path]: !open[file.path] }"
                >
                  <span class="min-w-0 break-all font-mono text-sm text-ink">{{ file.path }}</span>
                  <PlusMinus :open="Boolean(open[file.path])" />
                </button>
                <button type="button" :class="SMALL" @click="copy(file.path, file.content)">{{ copyLabel(file.path, 'Copy') }}</button>
                <button type="button" :class="SMALL" @click="downloadText(names[file.path], file.content)">Download <span class="ml-1 font-mono">{{ names[file.path] }}</span></button>
              </div>
              <pre
                v-if="open[file.path]"
                :id="`setup-file-${file.path}`"
                class="max-h-[28rem] overflow-auto whitespace-pre-wrap pb-5 font-mono text-sm leading-[1.8] text-ink [overflow-wrap:anywhere]"
                tabindex="0"
                :aria-label="`Contents of ${file.path}`"
              >{{ file.content }}</pre>
            </li>
          </ul>
        </section>
      </div>

      <aside class="min-w-0" aria-label="How to apply them">
        <InstallSteps :files="allFiles" combined :next="copied" />
      </aside>
    </div>
  </div>
</template>
