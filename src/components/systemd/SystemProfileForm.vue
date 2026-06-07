<script setup>
import { ref, watch, computed } from 'vue'
import { useActiveTuner } from '@/composables/useActiveTuner.js'
import NumberPickField from '@/components/hardware/NumberPickField.vue'
import {
  RAM_PICKS,
  CORE_PICKS,
  PID_PICKS,
  RAM_MAX_GIB,
  CORE_MAX,
  PID_MAX_CEIL,
  clampInt,
} from '@/components/hardware/fieldOptions.js'

const tuner = useActiveTuner()

// Local draft — edit several fields, apply atomically (mirrors HardwareForm).
const ramGiB = ref(tuner.hardware.ramGiB)
const cpuCores = ref(tuner.hardware.cpuCores)
const workload = ref(tuner.hardware.workload)
const targetSlice = ref(tuner.hardware.targetSlice)
const pidMax = ref(tuner.hardware.pidMax)
const cgroupVersion = ref(tuner.hardware.cgroupVersion)
const collapsed = ref(false)
// See HardwareForm: collapse to the summary only on the first apply, then stay
// open on subsequent applies so re-tuning doesn't force a re-expand each time.
const hasApplied = ref(false)

const WORKLOADS = [
  { value: 'container-host', label: 'Container host (Docker / Podman)' },
  { value: 'kubernetes', label: 'Kubernetes node' },
  { value: 'database', label: 'Database server' },
  { value: 'general', label: 'General purpose Linux server' },
  { value: 'desktop', label: 'Desktop workstation' },
]

const SLICES = [
  { value: 'system.slice', label: 'system.slice', note: 'system services (the usual target)' },
  { value: 'user.slice', label: 'user.slice', note: 'logged-in user sessions' },
  { value: 'machine.slice', label: 'machine.slice', note: 'VMs & containers (machined)' },
]

function workloadLabel(v) {
  return WORKLOADS.find((o) => o.value === v)?.label ?? v
}

const dirty = computed(() => {
  const hw = tuner.hardware
  return (
    Number(ramGiB.value) !== hw.ramGiB ||
    Number(cpuCores.value) !== hw.cpuCores ||
    workload.value !== hw.workload ||
    targetSlice.value !== hw.targetSlice ||
    Number(pidMax.value) !== hw.pidMax ||
    cgroupVersion.value !== hw.cgroupVersion
  )
})

const cgroupNote = computed(() =>
  cgroupVersion.value === 'v1'
    ? 'cgroup v1: the unified CPU/memory/I/O controls here map to legacy controllers with different semantics. Prefer v2.'
    : 'cgroup v2 (unified hierarchy): full support for CPUWeight, MemoryMax, IOWeight and MemorySwapMax.',
)

function apply() {
  const ram = clampInt(ramGiB.value, 1, RAM_MAX_GIB)
  const cores = clampInt(cpuCores.value, 1, CORE_MAX)
  const pid = clampInt(pidMax.value, 1024, PID_MAX_CEIL)
  ramGiB.value = ram
  cpuCores.value = cores
  pidMax.value = pid
  tuner.setHardware({
    ramGiB: ram,
    cpuCores: cores,
    workload: workload.value,
    targetSlice: targetSlice.value,
    pidMax: pid,
    cgroupVersion: cgroupVersion.value,
  })
  if (!hasApplied.value) collapsed.value = true
  hasApplied.value = true
}

function expand() {
  collapsed.value = false
}

// Mirror external mutations (preset / URL restore) back into the draft.
watch(
  () => tuner.hardware,
  (hw) => {
    if (!dirty.value) {
      ramGiB.value = hw.ramGiB
      cpuCores.value = hw.cpuCores
      workload.value = hw.workload
      targetSlice.value = hw.targetSlice
      pidMax.value = hw.pidMax
      cgroupVersion.value = hw.cgroupVersion
    }
  },
  { deep: true },
)
</script>

<template>
  <section class="rounded-lg border border-slate-200 bg-white shadow-sm">
    <header class="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
      <div>
        <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">System profile</h2>
        <p v-if="collapsed" class="mt-1 text-sm text-slate-700">
          <span class="font-mono">{{ tuner.hardware.ramGiB }} GiB</span> RAM ·
          <span class="font-mono">{{ tuner.hardware.cpuCores }}</span> cores ·
          {{ workloadLabel(tuner.hardware.workload) }} ·
          <span class="font-mono">{{ tuner.hardware.targetSlice }}</span>
        </p>
      </div>
      <button
        v-if="collapsed"
        type="button"
        class="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50"
        @click="expand"
      >
        Edit
      </button>
    </header>

    <form v-if="!collapsed" class="space-y-5 p-4" @submit.prevent="apply">
      <!-- RAM -->
      <NumberPickField
        v-model="ramGiB"
        label="Total RAM (GiB)"
        :min="1"
        :max="RAM_MAX_GIB"
        :picks="RAM_PICKS"
      />

      <!-- CPU cores -->
      <NumberPickField
        v-model="cpuCores"
        label="Logical CPUs (cores)"
        :min="1"
        :max="CORE_MAX"
        :picks="CORE_PICKS"
        help="Sets the CPUQuota range (100% = one core) and the CPU-share simulation."
      />

      <!-- Workload -->
      <div>
        <label class="block text-sm font-medium text-slate-700" for="sysd-workload">Primary workload</label>
        <select
          id="sysd-workload"
          v-model="workload"
          class="mt-2 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option v-for="w in WORKLOADS" :key="w.value" :value="w.value">{{ w.label }}</option>
        </select>
      </div>

      <!-- Target slice -->
      <fieldset>
        <legend class="text-sm font-medium text-slate-700">Target slice (for the slice-level controls)</legend>
        <div class="mt-2 grid gap-2 sm:grid-cols-3">
          <label
            v-for="s in SLICES"
            :key="s.value"
            class="flex cursor-pointer items-start gap-2 rounded border border-slate-200 p-2 text-sm hover:bg-slate-50"
          >
            <input v-model="targetSlice" type="radio" :value="s.value" class="mt-1" />
            <span>
              <span class="font-mono text-xs">{{ s.label }}</span>
              <span class="block text-xs text-slate-500">{{ s.note }}</span>
            </span>
          </label>
        </div>
      </fieldset>

      <!-- pid_max + cgroup -->
      <div class="grid gap-4 sm:grid-cols-2">
        <NumberPickField
          v-model="pidMax"
          id="pidmax"
          label="kernel.pid_max"
          :min="1024"
          :max="PID_MAX_CEIL"
          :step="1024"
          :picks="PID_PICKS"
        >
          <template #help>
            Drives DefaultTasksMax (15% of pid_max) and the TasksMax range.
            <br>Run <code class="font-mono bg-slate-100 px-1 py-0.5">sysctl kernel.pid_max</code> to find yours.
          </template>
        </NumberPickField>
        <div>
          <span id="sysd-cgroup-version-label" class="block text-sm font-medium text-slate-700">cgroup version</span>
          <div
            role="radiogroup"
            aria-labelledby="sysd-cgroup-version-label"
            class="mt-2 inline-flex overflow-hidden rounded border border-slate-300"
          >
            <button
              v-for="v in ['v1', 'v2']"
              :key="v"
              type="button"
              role="radio"
              :aria-checked="cgroupVersion === v"
              class="px-3 py-1 text-sm"
              :class="cgroupVersion === v ? 'bg-slate-800 text-white' : 'bg-white hover:bg-slate-50'"
              @click="cgroupVersion = v"
            >
              {{ v }}
            </button>
          </div>
          <p class="mt-1 text-xs text-slate-500">{{ cgroupNote }}</p>
        </div>
      </div>

      <div class="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
        <span v-if="dirty" class="text-xs text-amber-600">Unsaved changes</span>
        <button
          type="submit"
          class="rounded bg-slate-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          Apply system profile
        </button>
      </div>
    </form>
  </section>
</template>
