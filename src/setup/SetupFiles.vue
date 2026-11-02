<script setup>
/**
 * The last setup step: every included step's files, from that tuner's own
 * generateConfig, unchanged. Each file has its own copy and download; one
 * combined copy puts the machine profile on top. A blocked step's files are
 * left out, and the step is named in their place. No install script and no
 * archive (Design.md §5 "Guided setup", "Output").
 */
import { computed, ref } from 'vue'
import { combineFiles } from '@/core/output/files.js'
import { copyText, downloadText, downloadNames } from '@/ui/fileActions.js'
import { machineHeader } from './machineProfile.js'
import { SETUP_STEPS } from './steps.js'
import { useSetupStore, useStepStore } from './useSetupStore.js'

const emit = defineEmits({ goto: (id) => typeof id === 'string' })

const setup = useSetupStore()

const included = computed(() =>
  SETUP_STEPS.filter(({ id }) => !setup.skipped.includes(id)).map((step) => {
    const store = useStepStore(step.id)
    return { ...step, blocked: store.blocked, files: store.blocked ? [] : store.configFiles }
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

const copyAll = () => copy('all', `${machineHeader(setup.machine)}\n\n${combineFiles(allFiles.value)}`)
const copyLink = () => copy('link', `${window.location.origin}${window.location.pathname}#${setup.linkHash()}`)

const copyLabel = (key, idle) => ({ ok: 'Copied ✓', fail: 'Copy failed' })[status.value[key]] ?? idle
</script>

<template>
  <div class="space-y-4">
    <p class="text-sm text-slate-700">
      Save each file at the path it names, then apply it as its comments say. Each file comes from its tuner unchanged, and no two tuners write the same setting.
    </p>

    <div class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        class="rounded bg-sky-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-50"
        :disabled="!allFiles.length"
        @click="copyAll"
      >{{ copyLabel('all', `Copy all ${allFiles.length} files`) }}</button>
      <button
        type="button"
        class="rounded border border-slate-300 px-4 py-1.5 text-sm hover:bg-slate-50"
        @click="copyLink"
      >{{ copyLabel('link', 'Copy link to this setup') }}</button>
    </div>

    <div v-if="blockedSteps.length" class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
      <p class="font-semibold">Left out, because the step has a blocking issue:</p>
      <ul class="mt-1 list-disc pl-5">
        <li v-for="s in blockedSteps" :key="s.id">
          <button type="button" class="underline underline-offset-2" @click="emit('goto', s.id)">{{ s.entry.title }}</button>
        </li>
      </ul>
    </div>

    <p v-if="!included.length" class="rounded border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-700">
      Every step is skipped, so there are no files.
    </p>

    <section v-for="s in included.filter((x) => !x.blocked)" :key="s.id" class="space-y-2">
      <h3 class="text-sm font-semibold text-slate-900">{{ s.entry.title }}</h3>
      <article
        v-for="file in s.files"
        :key="file.path"
        class="rounded-lg border border-slate-200 bg-white shadow-sm"
      >
        <header class="flex flex-wrap items-center gap-2 px-4 py-2">
          <code class="min-w-0 flex-1 break-all font-mono text-xs text-slate-900">{{ file.path }}</code>
          <button
            type="button"
            class="rounded border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50"
            :aria-expanded="Boolean(open[file.path])"
            :aria-controls="`setup-file-${file.path}`"
            @click="open = { ...open, [file.path]: !open[file.path] }"
          >{{ open[file.path] ? 'Hide' : 'Show' }}</button>
          <button
            type="button"
            class="rounded border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50"
            @click="copy(file.path, file.content)"
          >{{ copyLabel(file.path, 'Copy') }}</button>
          <button
            type="button"
            class="rounded border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50"
            @click="downloadText(names[file.path], file.content)"
          >Download <span class="font-mono">{{ names[file.path] }}</span></button>
        </header>
        <textarea
          v-if="open[file.path]"
          :id="`setup-file-${file.path}`"
          :value="file.content"
          readonly
          class="block h-72 w-full resize-y border-t border-slate-200 bg-slate-50 p-3 font-mono text-[12px] leading-snug text-slate-900"
          :aria-label="`Contents of ${file.path}`"
        ></textarea>
      </article>
    </section>

    <p class="sr-only" aria-live="polite">
      {{ Object.values(status).includes('ok') ? 'Copied to clipboard.' : Object.values(status).includes('fail') ? 'Clipboard write failed.' : '' }}
    </p>
  </div>
</template>
