<script setup>
import { ref, computed } from 'vue'
import ParameterCard from './ParameterCard.vue'
import { useTunerStore } from '@/stores/tuner.js'

const tuner = useTunerStore()

const SECTIONS = [
  {
    id: 'memory-reclaim',
    title: 'Memory reclaim & swap',
    summary: 'When does the kernel reclaim pages, and how aggressively does it swap?',
    keys: ['swappiness', 'min_free_kbytes', 'watermark_scale_factor', 'vfs_cache_pressure'],
  },
  {
    id: 'dirty-writeback',
    title: 'Dirty page writeback',
    summary: 'How long modified pages can stay in RAM before being flushed to disk.',
    keys: ['dirty_ratio', 'dirty_background_ratio', 'dirty_expire_centisecs', 'dirty_writeback_centisecs'],
  },
  {
    id: 'oom-overcommit',
    title: 'OOM & overcommit',
    summary: 'Allocation policy and what happens when the system runs out of memory.',
    keys: ['overcommit_memory', 'overcommit_ratio', 'panic_on_oom'],
  },
]

const open = ref({
  'memory-reclaim': true,
  'dirty-writeback': true,
  'oom-overcommit': true,
})

// Hide overcommit_ratio unless strict overcommit (mode 2) is selected — it's
// only meaningful in that mode.
function visibleKeys(section) {
  if (section.id !== 'oom-overcommit') return section.keys
  return section.keys.filter(
    (k) => k !== 'overcommit_ratio' || tuner.params.overcommit_memory === 2,
  )
}

const issueCountsBySection = computed(() => {
  /** @type {Record<string, number>} */
  const counts = {}
  for (const section of SECTIONS) {
    counts[section.id] = section.keys.reduce(
      (sum, k) => sum + (tuner.issuesByParam[k]?.length ?? 0),
      0,
    )
  }
  return counts
})
</script>

<template>
  <section class="space-y-3">
    <article
      v-for="section in SECTIONS"
      :key="section.id"
      class="rounded-lg border border-slate-200 bg-white shadow-sm"
    >
      <header
        class="flex cursor-pointer items-center justify-between gap-3 px-4 py-3"
        @click="open[section.id] = !open[section.id]"
      >
        <div>
          <h3 class="text-sm font-semibold text-slate-900">
            {{ open[section.id] ? '▾' : '▸' }} {{ section.title }}
          </h3>
          <p class="text-xs text-slate-500">{{ section.summary }}</p>
        </div>
        <span
          v-if="issueCountsBySection[section.id]"
          class="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800"
        >
          {{ issueCountsBySection[section.id] }} issue{{ issueCountsBySection[section.id] === 1 ? '' : 's' }}
        </span>
      </header>
      <div v-if="open[section.id]" class="space-y-2 border-t border-slate-100 p-3">
        <ParameterCard
          v-for="key in visibleKeys(section)"
          :key="key"
          :param-key="key"
        />
      </div>
    </article>
  </section>
</template>