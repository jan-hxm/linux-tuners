<script setup>
/**
 * Numbered steps for installing generated files: save, apply, check, and how
 * to undo. Shared by the tuner output and the guided setup; the commands
 * come from core/output/installSteps.js and the text around them from
 * ui/installGuide.js, which the static page text shares (Design.md §7
 * "Export steps").
 */
import { computed, ref } from 'vue'
import { installGuide } from '@/ui/installGuide.js'
import { copyText } from '@/ui/fileActions.js'

const props = defineProps({
  files: { type: Array, required: true },
  /** The files are shown as one text, each part after its banner. */
  combined: { type: Boolean, default: false },
})

const guide = computed(() => installGuide(props.files, { combined: props.combined }))

/** Which command was copied last, and whether the copy worked. */
const copied = ref({ command: null, ok: false })
let timer = null

async function copy(command) {
  copied.value = { command, ok: await copyText(command) }
  clearTimeout(timer)
  timer = setTimeout(() => (copied.value = { command: null, ok: false }), 1800)
}

const copyLabel = (command) =>
  copied.value.command === command ? (copied.value.ok ? 'Copied ✓' : 'Copy failed') : 'Copy'
</script>

<template>
  <div class="space-y-3 text-sm text-slate-700">
    <ol class="space-y-3">
      <li v-for="(group, i) in guide.groups" :key="group.id" class="flex gap-3">
        <span
          aria-hidden="true"
          class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white"
        >{{ i + 1 }}</span>
        <div class="min-w-0 flex-1 space-y-1.5">
          <p><span class="font-semibold text-slate-900">{{ group.title }}.</span> {{ group.text }}</p>
          <ul class="space-y-1">
            <li v-for="command in group.commands" :key="command" class="flex items-center gap-2">
              <code class="min-w-0 flex-1 break-all rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-900">{{ command }}</code>
              <button
                type="button"
                class="min-h-6 shrink-0 rounded border border-slate-300 px-2 text-xs hover:bg-slate-50"
                :aria-label="`Copy command: ${command}`"
                @click="copy(command)"
              >{{ copyLabel(command) }}</button>
            </li>
          </ul>
        </div>
      </li>
    </ol>

    <div class="rounded border border-slate-200 bg-slate-50 p-3">
      <p>
        <span class="font-semibold text-slate-900">{{ guide.undoTitle }}</span>
        {{ guide.undoText }}
      </p>
      <ul class="mt-1.5 space-y-1">
        <li v-for="command in guide.undo" :key="command" class="flex items-center gap-2">
          <code class="min-w-0 flex-1 break-all rounded bg-white px-2 py-1 font-mono text-xs text-slate-900">{{ command }}</code>
          <button
            type="button"
            class="min-h-6 shrink-0 rounded border border-slate-300 bg-white px-2 text-xs hover:bg-slate-50"
            :aria-label="`Copy command: ${command}`"
            @click="copy(command)"
          >{{ copyLabel(command) }}</button>
        </li>
      </ul>
    </div>

    <p class="sr-only" aria-live="polite">
      {{ copied.command ? (copied.ok ? 'Command copied.' : 'Clipboard write failed.') : '' }}
    </p>
  </div>
</template>
