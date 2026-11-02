<script setup>
/**
 * The first setup step: the machine profile, in the shared ProfileForm. The
 * setup store stands in for a tuner store here (it has `hardware`,
 * `setHardware` and an undo), so the form and the undo toast work unchanged.
 */
import { provide } from 'vue'
import ProfileForm from '@/ui/profile/ProfileForm.vue'
import UndoToast from '@/ui/UndoToast.vue'
import { TUNER_STORE_KEY, TUNER_DOMAIN_KEY } from '@/ui/useActiveTuner.js'
import { MACHINE_PROFILE } from './machineProfile.js'
import { useSetupStore } from './useSetupStore.js'

provide(TUNER_STORE_KEY, useSetupStore())
provide(TUNER_DOMAIN_KEY, { id: 'machine', profile: MACHINE_PROFILE, presetsById: {} })
</script>

<template>
  <div class="space-y-3">
    <p class="text-sm text-slate-700">
      Enter the machine once. Every step starts from it: the role picks each tuner's workload, and RAM, the kernel, systemd and the cgroup version size the defaults. A step can still change a value for itself.
    </p>
    <ProfileForm />
    <UndoToast />
  </div>
</template>
