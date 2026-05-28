<script setup>
import HardwareForm from '@/components/HardwareForm.vue'
import PresetSelector from '@/components/PresetSelector.vue'
import ParameterPanel from '@/components/ParameterPanel.vue'
import InfoDrawer from '@/components/InfoDrawer.vue'
</script>

<template>
  <main class="mx-auto max-w-5xl space-y-4 p-6">
    <header>
      <h1 class="text-2xl font-semibold tracking-tight">sysctl swap tuner</h1>
      <p class="text-sm text-slate-600">
        Hardware-aware vm.* tuning, live graphs, copy-pasteable config.
      </p>
    </header>

    <HardwareForm />
    <PresetSelector />
    <ParameterPanel />
    <InfoDrawer />
  </main>
</template>