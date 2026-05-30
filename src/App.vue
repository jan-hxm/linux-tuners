<script setup>
import { RouterView } from 'vue-router'
import SiteHeader from '@/components/layout/SiteHeader.vue'
import SiteFooter from '@/components/layout/SiteFooter.vue'
</script>

<template>
  <a
    href="#main"
    class="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-slate-900 focus:px-3 focus:py-1.5 focus:text-sm focus:text-white"
  >
    Skip to main content
  </a>

  <div class="flex min-h-screen flex-col">
    <SiteHeader />
    <main id="main" class="flex-1">
      <RouterView />
    </main>
    <SiteFooter />
  </div>
  <!--
    Consent banner is provided by Google's IAB TCF-certified CMP, injected by
    the AdSense script (loaded on demand by <AdSlot>). The CMP also injects
    its own "Privacy options" link for re-consent.
  -->
</template>
