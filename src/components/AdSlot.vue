<script setup>
import { computed, onMounted, watch } from 'vue'
import { ADSENSE_CLIENT, AD_SLOTS, adsEnabled } from '@/config/ads.js'

const props = defineProps({
  /** Key into AD_SLOTS — picks which slot ID to render. */
  slot: { type: String, required: true },
  /** Human-readable label, used only in the dev placeholder. */
  label: { type: String, default: 'ad' },
  /** AdSense format: 'auto' = responsive, or specific sizes like 'rectangle'. */
  format: { type: String, default: 'auto' },
})

const slotId = computed(() => AD_SLOTS[props.slot] ?? '')
const adsConfigured = computed(() => adsEnabled() && Boolean(slotId.value))

// Show the labelled placeholder only during local dev, so layout planning is
// obvious in the editor / browser. In production we render nothing until both
// publisher and slot IDs are configured — a half-finished "ad placeholder"
// box visible to real visitors looks unprofessional.
const showDevPlaceholder = computed(() => !adsConfigured.value && import.meta.env.DEV)

// Consent is no longer gated by our own banner — Google's IAB TCF-certified
// CMP (configured in the AdSense dashboard under Privacy & messaging) collects
// consent at the ad-serving layer. The AdSense script we load below will show
// the CMP overlay to EEA/UK/CH visitors before any ad request fires.
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
  if (adsConfigured.value) {
    ensureScript()
    pushSlot()
  }
})

watch(adsConfigured, (now) => {
  if (now) {
    ensureScript()
    pushSlot()
  }
})
</script>

<template>
  <!--
    Three render states:
      a) prod + not configured → render nothing (clean layout for visitors)
      b) dev + not configured → labelled placeholder for layout planning
      c) configured (any env) → real AdSense <ins>; Google's CMP gates serving
  -->
  <aside
    v-if="showDevPlaceholder"
    class="rounded border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-xs text-slate-500"
    aria-hidden="true"
  >
    <p class="font-semibold uppercase tracking-wide">Ad placeholder · {{ label }}</p>
    <p class="mt-1">Becomes a live ad once VITE_ADSENSE_CLIENT and the slot ID are configured.</p>
  </aside>

  <aside
    v-else-if="adsConfigured"
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
