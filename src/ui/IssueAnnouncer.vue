<script setup>
/**
 * Says validation changes out loud (Design.md §7). A polite live region that,
 * once the values have settled (so a slider drag across a threshold doesn't
 * chatter), reads each issue that wasn't there before with its fix, and how many are left
 * when some clear. Issues already there when it mounts aren't read: they're
 * on the page, next to their cards.
 */
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useActiveTuner } from '@/ui/useActiveTuner.js'

const SETTLE_MS = 600
/** How many new issues are read in full before "and N more". */
const MAX_READ = 2
const LEVEL = { error: 'Error', warn: 'Warning', info: 'Note' }

const tuner = useActiveTuner()
const message = ref('')
let seen = new Set(tuner.issues.map((issue) => issue.id))
let timer = null

/** What to say about going from the `seen` ids to `issues`, or '' for nothing. */
function announcement(issues) {
  const added = issues.filter((issue) => !seen.has(issue.id))
  if (added.length) {
    const read = added.slice(0, added.length > MAX_READ + 1 ? MAX_READ : added.length)
    const rest = added.length - read.length
    const text = read.map((issue) => [`${LEVEL[issue.level] ?? 'Note'}: ${issue.message}`, issue.fix].filter(Boolean).join(' ')).join(' ')
    return rest ? `${text} And ${rest} more issues.` : text
  }
  if (issues.length < seen.size) {
    return issues.length ? `${issues.length} ${issues.length === 1 ? 'issue' : 'issues'} left.` : 'No issues left.'
  }
  return ''
}

async function announce() {
  const issues = tuner.issues
  const text = announcement(issues)
  seen = new Set(issues.map((issue) => issue.id))
  if (!text) return
  // Empty first, so the same words as last time are read again.
  message.value = ''
  await nextTick()
  message.value = text
}

watch(() => tuner.issues, () => {
  clearTimeout(timer)
  timer = setTimeout(announce, SETTLE_MS)
})

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <p class="sr-only" aria-live="polite">{{ message }}</p>
</template>
