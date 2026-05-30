<script setup>
import { RouterLink } from 'vue-router'

const year = new Date().getFullYear()
</script>

<template>
  <footer class="mt-12 border-t border-slate-200 bg-white">
    <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-xs text-slate-500 sm:px-6">
      <p>© {{ year }} linux-tuners.dev — interactive Linux config tuners.</p>
      <nav aria-label="Legal" class="flex flex-wrap items-center gap-4">
        <RouterLink to="/imprint" class="hover:text-slate-900 hover:underline">Imprint</RouterLink>
        <RouterLink to="/privacy" class="hover:text-slate-900 hover:underline">Privacy</RouterLink>
        <!--
          Re-consent UI is provided by Google's CMP (a small "Privacy options"
          link injected near the bottom-left once consent has been collected).
          No custom button needed here.
        -->

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
