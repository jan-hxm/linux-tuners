<script setup>
import HardwareForm from '@/components/HardwareForm.vue'
import PresetSelector from '@/components/PresetSelector.vue'
import ParameterPanel from '@/components/ParameterPanel.vue'
import GraphPanel from '@/components/GraphPanel.vue'
import ConfigOutput from '@/components/ConfigOutput.vue'
import InfoDrawer from '@/components/InfoDrawer.vue'
import AboutSection from '@/components/AboutSection.vue'
import StepHeader from '@/components/StepHeader.vue'

const STEPS = [
  { num: 1, label: 'Hardware', href: '#hardware' },
  { num: 2, label: 'Preset', href: '#preset' },
  { num: 3, label: 'Tune', href: '#tune' },
  { num: 4, label: 'Export', href: '#export' },
]
</script>

<template>
  <a
    href="#main"
    class="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-slate-900 focus:px-3 focus:py-1.5 focus:text-sm focus:text-white"
  >
    Skip to main content
  </a>

  <main id="main" class="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
    <!-- Hero: explains the tool and previews the journey -->
    <header class="overflow-hidden rounded-lg bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 text-white shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
        <div class="max-w-2xl">
          <h1 class="text-xl font-semibold tracking-tight sm:text-2xl">sysctl swap tuner</h1>
          <p class="mt-2 text-sm leading-relaxed text-slate-200">
            Tune Linux <code class="rounded bg-white/10 px-1 font-mono text-[12px]">vm.*</code> sysctl parameters
            for your specific hardware. Drag the sliders, watch the graphs respond, copy the resulting
            config into
            <code class="rounded bg-white/10 px-1 font-mono text-[12px]">/etc/sysctl.d/</code>.
          </p>
        </div>
        <nav class="flex items-center gap-3 text-xs text-slate-300">
          <a href="#about" class="hover:text-white hover:underline">About</a>
          <a
            href="https://github.com/jan-hxm/swap-sysctl-generator"
            target="_blank"
            rel="noopener"
            class="hover:text-white hover:underline"
          >GitHub ↗</a>
        </nav>
      </div>

      <!-- Step preview chain: tells the visitor the whole journey before they touch anything -->
      <ol class="mt-5 flex flex-wrap items-center gap-x-0.5 gap-y-1 border-t border-white/10 bg-black/10 px-5 py-3 text-xs sm:px-6">
        <template v-for="(step, i) in STEPS" :key="step.label">
          <li>
            <a
              :href="step.href"
              class="inline-flex items-center gap-1.5 rounded px-2 py-1 transition hover:bg-white/10"
            >
              <span class="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[10px] font-semibold text-white">
                {{ step.num }}
              </span>
              <span class="text-slate-200">{{ step.label }}</span>
            </a>
          </li>
          <li v-if="i < STEPS.length - 1" class="text-slate-500" aria-hidden="true">→</li>
        </template>
      </ol>
    </header>

    <!-- Step 1 -->
    <section id="hardware" class="space-y-3 scroll-mt-4">
      <StepHeader
        :num="1"
        title="Your hardware"
        subtitle="Drives every default value and slider range below."
      />
      <HardwareForm />
    </section>

    <!-- Step 2 -->
    <section id="preset" class="space-y-3 scroll-mt-4">
      <StepHeader
        :num="2"
        title="Pick a starting point"
        subtitle="Optional — jump to a tuned baseline for your workload, then fine-tune."
      />
      <PresetSelector />
    </section>

    <!-- Step 3: parameters + sticky graph companion -->
    <section id="tune" class="space-y-3 scroll-mt-4">
      <StepHeader
        :num="3"
        title="Tune and preview"
        subtitle="Drag any slider on the left — the simulation on the right updates live."
      />
      <div class="grid gap-4 lg:grid-cols-5 lg:items-start">
        <div class="lg:col-span-3">
          <ParameterPanel />
        </div>
        <div class="lg:sticky lg:top-4 lg:col-span-2 lg:self-start">
          <GraphPanel />
        </div>
      </div>
    </section>

    <!-- Step 4 -->
    <section id="export" class="space-y-3 scroll-mt-4">
      <StepHeader
        :num="4"
        title="Copy your config"
        subtitle="Drop this into /etc/sysctl.d/99-swap-tuning.conf, then sudo sysctl --system."
      />
      <ConfigOutput />
    </section>

    <AboutSection />
    <InfoDrawer />
  </main>
</template>