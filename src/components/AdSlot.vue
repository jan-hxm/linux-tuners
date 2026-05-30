<script setup>
import { computed, onMounted, watch } from 'vue'
import { ADSENSE_CLIENT, AD_SLOTS, adsEnabled } from '@/config/ads.js'
import { useConsent } from '@/composables/useConsent.js'

const props = defineProps({
  /** Key into AD_SLOTS — picks which slot ID to render. */
  slot: { type: String, required: true },
  /** Human-readable label, used only in the dev placeholder. */
  label: { type: String, default: 'ad' },
  /** AdSense format: 'auto' = responsive, or specific sizes like 'rectangle'. */
  format: { type: String, default: 'auto' },
})

const { accepted } = useConsent()
const slotId = computed(() => AD_SLOTS[props.slot] ?? '')
const adsConfigured = computed(() => adsEnabled() && Boolean(slotId.value))
const shouldRender = computed(() => adsConfigured.value && accepted.value)

// Load the AdSense library lazily — only after consent. Doing it from the
// shell would load a tracker before the user agreed.
let scriptInjected = false
function ensureScript() {
  if (scriptInjected) return
  if (typeof window === 'undefined') return
  if (window.adsbygoogle) {
    scriptInjected = true
    return
  }
  const s = document.createElement('script')
  s.async = true
  s.crossOrigin = 'anonymous'
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`
  document.head.appendChild(s)
  scriptInjected = true
}

function pushSlot() {
  if (typeof window === 'undefined') return
  try {
    ;(window.adsbygoogle = window.adsbygoogle || []).push({})
  } catch (err) {
    // AdSense throws if the slot is already pushed or DOM isn't ready; not fatal.
    console.warn('[AdSlot] push failed:', err)
  }
}

onMounted(() => {
  if (shouldRender.value) {
    ensureScript()
    pushSlot()
  }
})

watch(shouldRender, (now) => {
  if (now) {
    ensureScript()
    pushSlot()
  }
})
</script>

<template>
  <!--
    Three render states:
      a) ads aren't configured (dev / no publisher ID) → show a labelled
         placeholder so layout planning is obvious during development
      b) ads configured but no consent → render nothing (don't reserve space
         until the user accepts; one-time layout shift on accept is fine)
      c) configured + accepted → render the AdSense <ins> block
  -->
  <aside
    v-if="!adsConfigured"
    class="rounded border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-xs text-slate-500"
    aria-hidden="true"
  >
    <p class="font-semibold uppercase tracking-wide">Ad placeholder · {{ label }}</p>
    <p class="mt-1">Becomes a live ad once VITE_ADSENSE_CLIENT and the slot ID are configured.</p>
  </aside>

  <aside
    v-else-if="shouldRender"
    aria-label="Advertisement"
    class="overflow-hidden"
  >
    <p class="mb-1 text-center text-[10px] uppercase tracking-widest text-slate-400">Werbung</p>
    <ins
      class="adsbygoogle"
      style="display:block"
      :data-ad-client="ADSENSE_CLIENT"
      :data-ad-slot="slotId"
      :data-ad-format="format"
      data-full-width-responsive="true"
    ></ins>
  </aside>
</template>
