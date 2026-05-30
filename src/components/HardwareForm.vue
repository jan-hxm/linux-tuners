<script setup>
import { ref, watch, computed } from 'vue'
import { useTunerStore } from '@/stores/tuner.js'

const tuner = useTunerStore()

// Local draft — lets the user edit several fields and apply atomically.
const ramGiB = ref(tuner.hardware.ramGiB)
const swapGiB = ref(tuner.hardware.swapGiB)
const swapDevice = ref(tuner.hardware.swapDevice)
const workload = ref(tuner.hardware.workload)
const cgroupVersion = ref(tuner.hardware.cgroupVersion)
const kernelVersion = ref(tuner.hardware.kernelVersion ?? '')
const collapsed = ref(false)

const RAM_PICKS = [2, 4, 8, 16, 32, 64, 128, 192, 256]
const SWAP_PICKS = [0, 2, 4, 8, 16, 32, 64, 128, 192, 256, 384, 512]

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
  tuner.setHardware({
    ramGiB: Math.max(1, Math.floor(Number(ramGiB.value) || 1)),
    swapGiB: Math.max(0, Math.floor(Number(swapGiB.value) || 0)),
    swapDevice: swapDevice.value,
    workload: workload.value,
    cgroupVersion: cgroupVersion.value,
    kernelVersion: kernelVersion.value.trim() || null,
  })
  collapsed.value = true
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
      <div>
        <label class="block text-sm font-medium text-slate-700">Total RAM (GiB)</label>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <input
            v-model.number="ramGiB"
            type="number"
            min="1"
            step="1"
            class="w-24 rounded border border-slate-300 px-2 py-1 text-sm font-mono"
          />
          <button
            v-for="g in RAM_PICKS"
            :key="`ram-${g}`"
            type="button"
            class="rounded-full border px-3 py-0.5 text-xs"
            :class="Number(ramGiB) === g ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-300 hover:bg-slate-50'"
            @click="ramGiB = g"
          >
            {{ g }}
          </button>
        </div>
      </div>

      <!-- Swap size -->
      <div>
        <label class="block text-sm font-medium text-slate-700">Swap size (GiB)</label>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <input
            v-model.number="swapGiB"
            type="number"
            min="0"
            step="1"
            class="w-24 rounded border border-slate-300 px-2 py-1 text-sm font-mono"
          />
          <button
            v-for="g in SWAP_PICKS"
            :key="`swap-${g}`"
            type="button"
            class="rounded-full border px-3 py-0.5 text-xs"
            :class="Number(swapGiB) === g ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-300 hover:bg-slate-50'"
            @click="swapGiB = g"
          >
            {{ g === 0 ? 'No swap' : g }}
          </button>
        </div>
      </div>

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
          <label class="block text-sm font-medium text-slate-700">cgroup version</label>
          <div class="mt-2 inline-flex overflow-hidden rounded border border-slate-300">
            <button
              v-for="v in ['v1', 'v2']"
              :key="v"
              type="button"
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
            Used to surface notes about kernel-version-specific behaviour (e.g. swappiness 0–200 in 5.8+).
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