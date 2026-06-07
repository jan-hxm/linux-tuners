<script setup>
import { ref, watch, computed } from 'vue'
import { useTunerStore } from '@/stores/tuner.js'
import NumberPickField from '@/components/hardware/NumberPickField.vue'
import { RAM_PICKS, SWAP_PICKS, RAM_MAX_GIB, SWAP_MAX_GIB, clampInt } from '@/components/hardware/fieldOptions.js'

const tuner = useTunerStore()

// Local draft — lets the user edit several fields and apply atomically.
const ramGiB = ref(tuner.hardware.ramGiB)
const swapGiB = ref(tuner.hardware.swapGiB)
const swapDevice = ref(tuner.hardware.swapDevice)
const workload = ref(tuner.hardware.workload)
const cgroupVersion = ref(tuner.hardware.cgroupVersion)
const kernelVersion = ref(tuner.hardware.kernelVersion ?? '')
const collapsed = ref(false)
// Auto-collapse to the one-line summary only on the very first apply (the
// initial guided flow). After the user has explicitly re-opened with "Edit",
// keep the form open on apply so they can keep tweaking without re-expanding.
const hasApplied = ref(false)

const DEVICE_OPTIONS = [
  { value: 'hdd', label: 'HDD (rotational)', note: 'caps swappiness at 60' },
  { value: 'sata-ssd', label: 'SATA SSD', note: null },
  { value: 'nvme-ssd', label: 'NVMe SSD', note: null },
  { value: 'zram', label: 'zram (in-memory compressed)', note: 'unlocks swappiness up to 200' },
  { value: 'zswap', label: 'zswap (compressed cache)', note: 'unlocks swappiness up to 200' },
  { value: 'network', label: 'Network swap (NFS, …)', note: 'flagged with a warning' },
]

const WORKLOADS = [
  { value: 'k8s', label: 'Kubernetes node' },
  { value: 'database', label: 'Database server' },
  { value: 'general', label: 'General purpose Linux server' },
  { value: 'desktop', label: 'Desktop workstation' },
  { value: 'embedded', label: 'Embedded / constrained memory' },
  { value: 'custom', label: 'Custom (drive everything manually)' },
]

function workloadLabel(v) {
  const found = WORKLOADS.find((o) => o.value === v)
  return found ? found.label : v
}

const dirty = computed(() => {
  const hw = tuner.hardware
  return (
    Number(ramGiB.value) !== hw.ramGiB ||
    Number(swapGiB.value) !== hw.swapGiB ||
    swapDevice.value !== hw.swapDevice ||
    workload.value !== hw.workload ||
    cgroupVersion.value !== hw.cgroupVersion ||
    (kernelVersion.value || null) !== hw.kernelVersion
  )
})

const cgroupNote = computed(() =>
  cgroupVersion.value === 'v1'
    ? 'cgroup v1: per-cgroup swappiness is supported but deprecated. The system-wide value remains primary.'
    : 'cgroup v2: per-cgroup swappiness is not available. System-wide value applies to all cgroups.',
)

const swapDisabled = computed(() => Number(swapGiB.value) === 0)

function apply() {
  // Normalise + clamp first, and write the result back into the draft so the
  // field reflects what was actually applied (otherwise an out-of-range entry
  // would keep showing "Unsaved changes" against the clamped store value).
  const ram = clampInt(ramGiB.value, 1, RAM_MAX_GIB)
  const swap = clampInt(swapGiB.value, 0, SWAP_MAX_GIB)
  ramGiB.value = ram
  swapGiB.value = swap
  tuner.setHardware({
    ramGiB: ram,
    swapGiB: swap,
    swapDevice: swapDevice.value,
    workload: workload.value,
    cgroupVersion: cgroupVersion.value,
    kernelVersion: kernelVersion.value.trim() || null,
  })
  if (!hasApplied.value) collapsed.value = true
  hasApplied.value = true
}

function expand() {
  collapsed.value = false
}

// If something else (preset, URL hash) mutates store.hardware, mirror it into
// the draft so the edit panel reopens with the current truth.
watch(
  () => tuner.hardware,
  (hw) => {
    if (!dirty.value) {
      ramGiB.value = hw.ramGiB
      swapGiB.value = hw.swapGiB
      swapDevice.value = hw.swapDevice
      workload.value = hw.workload
      cgroupVersion.value = hw.cgroupVersion
      kernelVersion.value = hw.kernelVersion ?? ''
    }
  },
  { deep: true },
)
</script>

<template>
  <section class="rounded-lg border border-slate-200 bg-white shadow-sm">
    <header class="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
      <div>
        <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Hardware spec</h2>
        <p v-if="collapsed" class="mt-1 text-sm text-slate-700">
          <span class="font-mono">{{ tuner.hardware.ramGiB }} GiB</span> RAM ·
          <span class="font-mono">{{ tuner.hardware.swapGiB }} GiB</span>
          {{ tuner.hardware.swapDevice }} swap · {{ workloadLabel(tuner.hardware.workload) }}
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

      <!-- Swap size -->
      <NumberPickField
        v-model="swapGiB"
        label="Swap size (GiB)"
        :min="0"
        :max="SWAP_MAX_GIB"
        :picks="SWAP_PICKS"
      />

      <!-- Swap device -->
      <fieldset :disabled="swapDisabled">
        <legend class="text-sm font-medium text-slate-700">Swap backing device</legend>
        <div class="mt-2 grid gap-2 sm:grid-cols-2">
          <label
            v-for="opt in DEVICE_OPTIONS"
            :key="opt.value"
            class="flex cursor-pointer items-start gap-2 rounded border border-slate-200 p-2 text-sm hover:bg-slate-50"
            :class="{ 'opacity-50': swapDisabled }"
          >
            <input
              v-model="swapDevice"
              type="radio"
              :value="opt.value"
              :disabled="swapDisabled"
              class="mt-1"
            />
            <span>
              <span class="font-medium">{{ opt.label }}</span>
              <span v-if="opt.note" class="block text-xs text-slate-500">{{ opt.note }}</span>
            </span>
          </label>
        </div>
        <p v-if="swapDisabled" class="mt-2 text-xs text-slate-500">
          Swap is disabled; device selection has no effect.
        </p>
      </fieldset>

      <!-- Workload -->
      <div>
        <label class="block text-sm font-medium text-slate-700" for="workload">Primary workload</label>
        <select
          id="workload"
          v-model="workload"
          class="mt-2 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option v-for="w in WORKLOADS" :key="w.value" :value="w.value">{{ w.label }}</option>
        </select>
      </div>

      <!-- cgroup + kernel -->
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <span id="cgroup-version-label" class="block text-sm font-medium text-slate-700">cgroup version</span>
          <div
            role="radiogroup"
            aria-labelledby="cgroup-version-label"
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
        <div>
          <label class="block text-sm font-medium text-slate-700" for="kernel">Kernel version (optional)</label>
          <input
            id="kernel"
            v-model="kernelVersion"
            type="text"
            placeholder="e.g. 6.6"
            class="mt-2 w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-mono"
          />
          <p class="mt-1 text-xs text-slate-500">
            Sets the swappiness slider range: 0–200 on kernel 5.8+, 0–100 before. Left blank, we assume a modern (≥5.8) kernel.
            <br>Run <code class="font-mono bg-slate-100 px-1 py-0.5">uname -r</code> to find out your kernel-version.
          </p>
        </div>
      </div>

      <div class="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
        <span v-if="dirty" class="text-xs text-amber-600">Unsaved changes</span>
        <button
          type="submit"
          class="rounded bg-slate-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          Apply hardware specs
        </button>
      </div>
    </form>
  </section>
</template>