<script setup>
/**
 * Numbered steps for installing generated files: save, apply, check, and how
 * to undo, set apart. Shared by the tuner output and the guided setup; the
 * commands come from core/output/installSteps.js and the text around them
 * from ui/installGuide.js, which the static page text shares (Design.md §7
 * "Export steps"). Laid out as the margin's numbered notes beside the file
 * (REDESIGN §3); `next` marks the first step once the file is copied.
 */
import { computed, ref } from 'vue'
import { installGuide } from '@/ui/installGuide.js'
import { copyText } from '@/ui/fileActions.js'

const props = defineProps({
  files: { type: Array, required: true },
  /** The files are shown as one text, each part after its banner. */
  combined: { type: Boolean, default: false },
  /** The file was copied: mark the first step as the next thing to do. */
  next: { type: Boolean, default: false },
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
  copied.value.command === command ? (copied.value.ok ? 'Copied' : 'Copy failed') : 'Copy'

const NOTE = 'grid grid-cols-[30px_minmax(0,1fr)] pt-2.5'
const CODE = 'min-w-0 flex-1 break-all bg-paper-hover px-2 py-1.5 font-mono text-[13px] leading-snug text-ink'
const COPY = 'min-h-9 shrink-0 border border-rule-strong px-2.5 text-[13px] font-medium text-ink hover:bg-paper-hover'
</script>

<template>
  <div class="text-[15px] leading-[1.55] text-ink-2">
    <ol class="space-y-5">
      <li
        v-for="(group, i) in guide.groups"
        :key="group.id"
        :class="[NOTE, i === 0 ? (next ? 'border-t-2 border-fit' : 'border-t border-ink') : 'border-t border-rule']"
        :aria-current="i === 0 && next ? 'step' : undefined"
      >
        <span aria-hidden="true" class="font-mono text-[13px] text-quiet">[{{ i + 1 }}]</span>
        <div class="min-w-0 space-y-2">
          <p>
            <span v-if="i === 0 && next" class="font-medium text-fit-text">Next. </span>
            <span class="font-medium text-ink">{{ group.title }}.</span> {{ group.text }}
          </p>
          <ul class="space-y-1.5">
            <li v-for="command in group.commands" :key="command" class="flex items-start gap-2">
              <code :class="CODE">{{ command }}</code>
              <button
                type="button"
                :class="COPY"
                :aria-label="`Copy command: ${command}`"
                @click="copy(command)"
              >{{ copyLabel(command) }}</button>
            </li>
          </ul>
        </div>
      </li>
    </ol>

    <!-- Undo, set apart from the steps. -->
    <div class="mt-8 border-t border-rule-strong" :class="NOTE">
      <span aria-hidden="true" />
      <div class="min-w-0 space-y-2">
        <p>
          <span class="font-medium text-ink">{{ guide.undoTitle }}</span>
          {{ guide.undoText }}
        </p>
        <ul class="space-y-1.5">
          <li v-for="command in guide.undo" :key="command" class="flex items-start gap-2">
            <code :class="CODE">{{ command }}</code>
            <button
              type="button"
              :class="COPY"
              :aria-label="`Copy command: ${command}`"
              @click="copy(command)"
            >{{ copyLabel(command) }}</button>
          </li>
        </ul>
      </div>
    </div>

    <p class="sr-only" aria-live="polite">
      {{ copied.command ? (copied.ok ? 'Command copied.' : 'Clipboard write failed.') : '' }}
    </p>
  </div>
</template>
