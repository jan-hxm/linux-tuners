<script setup>
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { testedOnText } from './testedOn.js'
import { PAGE_WIDTH } from './pageWidth.js'

// The author's note is approved text (REDESIGN.md §4 decision 3): do not
// reword it. The signature is the GitHub handle, linking to the profile.
const AUTHOR_NOTE =
  'I built this after one too many forum threads that said "set it to X" and never said why, or what happens when you set it to Y. I also wanted to see what a change does, so tuners like swap draw it as a live graph. Every value here comes with its reason, so you can disagree with it.'
const AUTHOR = { handle: 'jan-hxm', url: 'https://github.com/jan-hxm' }
const SOURCE_URL = 'https://github.com/jan-hxm/linux-tuners'
const SPONSOR_URL = 'https://github.com/sponsors/jan-hxm'

// There is no glossary page yet; the link appears once a route named
// "glossary" is registered, so it never points at the landing-page redirect.
const router = useRouter()
const hasGlossary = computed(() => router.hasRoute('glossary'))
const linkClass = 'inline-flex min-h-6 items-center text-ink-2 underline underline-offset-[3px] hover:text-ink'
const year = new Date().getFullYear()
</script>

<template>
  <!-- No consent banner or privacy-options link here: Google's CMP injects its
       own (CLAUDE.md, Design.md §5 "Ads and consent"). -->
  <footer class="mt-24 border-t border-ink bg-paper">
    <div class="grid gap-x-16 gap-y-8 pb-14 pt-10 md:grid-cols-2" :class="PAGE_WIDTH">
      <div>
        <p class="max-w-[30em] text-[17px] leading-relaxed text-ink">{{ AUTHOR_NOTE }}</p>
        <p class="mt-3.5 text-[15px] text-quiet">
          <a :href="AUTHOR.url" target="_blank" rel="noopener" :class="linkClass">{{ AUTHOR.handle }}</a>
        </p>
      </div>
      <div class="text-sm leading-relaxed text-quiet">
        <p>
          <span class="font-medium text-ink">Colophon.</span>
          Set in Host Grotesk and Fragment Mono. Defaults are quoted from kernel.org and the systemd manuals. The output is applied and read back on {{ testedOnText() }}.
        </p>
        <nav aria-label="Footer" class="mt-3.5 flex flex-wrap gap-x-5 gap-y-1">
          <RouterLink v-if="hasGlossary" :to="{ name: 'glossary' }" :class="linkClass">Glossary</RouterLink>
          <RouterLink to="/privacy" :class="linkClass">Privacy</RouterLink>
          <RouterLink to="/imprint" :class="linkClass">Imprint</RouterLink>
          <a :href="SOURCE_URL" target="_blank" rel="noopener" :class="linkClass">Source on GitHub ↗</a>
          <a :href="SPONSOR_URL" target="_blank" rel="noopener" :class="linkClass">Sponsor ↗</a>
        </nav>
        <p class="mt-3.5">© {{ year }} linux-tuners.dev</p>
      </div>
    </div>
  </footer>
</template>
