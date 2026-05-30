<script setup>
import { RouterLink } from 'vue-router'
import { useConsent } from '@/composables/useConsent.js'
import { adsEnabled } from '@/config/ads.js'

const { decided, revoke } = useConsent()

const year = new Date().getFullYear()
</script>

<template>
  <footer class="mt-12 border-t border-slate-200 bg-white">
    <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-xs text-slate-500 sm:px-6">
      <p>© {{ year }} linux-tuners.dev — interactive Linux config tuners.</p>
      <nav aria-label="Legal" class="flex flex-wrap items-center gap-4">
        <RouterLink to="/impressum" class="hover:text-slate-900 hover:underline">Impressum</RouterLink>
        <RouterLink to="/datenschutz" class="hover:text-slate-900 hover:underline">Datenschutz</RouterLink>
        <!--
          Revoke link only shows when ads are configured *and* the user has
          already made a decision. Before deciding, the banner itself is the
          control; revoking before there's anything to revoke is meaningless.
        -->
        <button
          v-if="adsEnabled() && decided"
          type="button"
          class="hover:text-slate-900 hover:underline"
          @click="revoke"
        >Cookie-Einstellungen</button>
        <!--
          Sponsor link points at GitHub Sponsors by default. Swap the URL or
          replace with Ko-fi / Buy Me a Coffee / Liberapay if you prefer a
          different platform. Setting up GitHub Sponsors needs a verified
          GitHub account + payout configuration.
        -->
        <a
          href="https://github.com/sponsors/jan-hxm"
          target="_blank"
          rel="noopener"
          class="hover:text-slate-900 hover:underline"
        >Sponsor ↗</a>
        <a
          href="https://github.com/jan-hxm/linux-tuners"
          target="_blank"
          rel="noopener"
          class="hover:text-slate-900 hover:underline"
        >GitHub ↗</a>
      </nav>
    </div>
  </footer>
</template>
