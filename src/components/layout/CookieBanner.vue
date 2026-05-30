<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useConsent } from '@/composables/useConsent.js'
import { adsEnabled } from '@/config/ads.js'

const { decided, accept, reject } = useConsent()

// Only show the banner when there is actually something to consent to.
// In development (no VITE_ADSENSE_CLIENT) adsEnabled() returns false and we
// keep the banner hidden — there are no third-party scripts to gate.
const show = computed(() => adsEnabled() && !decided.value)
</script>

<template>
  <div
    v-if="show"
    role="dialog"
    aria-modal="false"
    aria-labelledby="consent-title"
    aria-describedby="consent-body"
    class="fixed inset-x-0 bottom-0 z-40 border-t border-slate-700 bg-slate-900 text-white shadow-2xl"
  >
    <div class="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div class="flex-1">
        <p id="consent-title" class="text-sm font-semibold">
          Help fund this site with ads?
        </p>
        <p id="consent-body" class="mt-1 text-xs leading-relaxed text-slate-300">
          We'd like to load Google AdSense to display a small number of ads. AdSense sets cookies and processes your IP address.
          You can change your mind any time via the
          <em>Cookie-Einstellungen</em>
          link in the footer. See the
          <RouterLink to="/datenschutz" class="underline hover:no-underline">Datenschutzerklärung</RouterLink>
          for details.
        </p>
      </div>
      <!--
        Both buttons share identical styling so neither nudges the user.
        Per § 25 TTDSG and DSGVO Art. 7, "reject" must be as easy as "accept".
      -->
      <div class="flex shrink-0 gap-2">
        <button
          type="button"
          class="rounded border border-slate-400 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          @click="reject"
        >Reject</button>
        <button
          type="button"
          class="rounded border border-slate-400 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          @click="accept"
        >Accept</button>
      </div>
    </div>
  </div>
</template>
