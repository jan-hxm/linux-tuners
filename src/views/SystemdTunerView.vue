<script setup>
import { provide } from 'vue'
import PresetSelector from '@/components/PresetSelector.vue'
import ParameterPanel from '@/components/ParameterPanel.vue'
import GraphPanel from '@/components/GraphPanel.vue'
import ConfigOutput from '@/components/ConfigOutput.vue'
import InfoDrawer from '@/components/InfoDrawer.vue'
import StepHeader from '@/components/StepHeader.vue'
import AdSlot from '@/components/AdSlot.vue'
import SystemProfileForm from '@/components/systemd/SystemProfileForm.vue'
import CpuShareChart from '@/components/systemd/CpuShareChart.vue'
import MemoryBudgetChart from '@/components/systemd/MemoryBudgetChart.vue'
import TasksChart from '@/components/systemd/TasksChart.vue'
import { useSystemdStore } from '@/stores/systemd.js'
import { systemdDomain } from '@/domains/systemd/index.js'
import { useSystemdSimulation } from '@/composables/useSystemdSimulation.js'
import { TUNER_STORE_KEY, TUNER_DOMAIN_KEY } from '@/composables/useActiveTuner.js'

// Provide the systemd store + domain to every shared child component.
const tuner = useSystemdStore()
provide(TUNER_STORE_KEY, tuner)
provide(TUNER_DOMAIN_KEY, systemdDomain)

// Pass the store explicitly: this component provides it, so it cannot inject it.
const { impact } = useSystemdSimulation(tuner)

const GRAPH_TABS = [
  { id: 'cpu', label: 'CPU shares', component: CpuShareChart, blurb: 'How CPUWeight splits a saturated CPU between this slice and its siblings.' },
  { id: 'memory', label: 'Memory budget', component: MemoryBudgetChart, blurb: 'MemoryHigh throttle band and the MemoryMax hard cap, against total RAM.' },
  { id: 'tasks', label: 'Task & FD caps', component: TasksChart, blurb: 'TasksMax and DefaultTasksMax as a share of the kernel PID space.' },
]

const STEPS = [
  { num: 1, label: 'Profile', href: '#profile' },
  { num: 2, label: 'Preset', href: '#preset' },
  { num: 3, label: 'Tune', href: '#tune' },
  { num: 4, label: 'Export', href: '#export' },
]
</script>

<template>
  <section class="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
    <!-- Page hero -->
    <header class="overflow-hidden rounded-lg bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 text-white shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
        <div class="max-w-2xl">
          <p class="text-xs uppercase tracking-widest text-slate-400">Tuner</p>
          <h1 class="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">systemd &amp; resource limits</h1>
          <p class="mt-2 text-sm leading-relaxed text-slate-200">
            Tune systemd manager defaults and per-slice
            <code class="rounded bg-white/10 px-1 font-mono text-[12px]">cgroup v2</code> resource control
            for your hardware and workload. Drag the controls, watch the CPU/memory/task budgets respond, and
            copy the resulting drop-ins into
            <code class="rounded bg-white/10 px-1 font-mono text-[12px]">/etc/systemd/</code>.
          </p>
        </div>
        <nav class="flex items-center gap-3 text-xs text-slate-300">
          <a href="#about" class="hover:text-white hover:underline">About this tuner</a>
        </nav>
      </div>

      <!-- Step preview chain -->
      <ol class="mt-5 flex flex-wrap items-center gap-x-0.5 gap-y-1 border-t border-white/10 bg-black/10 px-5 py-3 text-xs sm:px-6">
        <template v-for="(step, i) in STEPS" :key="step.label">
          <li>
            <a :href="step.href" class="inline-flex items-center gap-1.5 rounded px-2 py-1 transition hover:bg-white/10">
              <span class="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[10px] font-semibold text-white">{{ step.num }}</span>
              <span class="text-slate-200">{{ step.label }}</span>
            </a>
          </li>
          <li v-if="i < STEPS.length - 1" class="text-slate-500" aria-hidden="true">→</li>
        </template>
      </ol>
    </header>

    <section id="profile" class="space-y-3 scroll-mt-16">
      <StepHeader :num="1" title="Your system profile" subtitle="Drives every default value and slider range below." />
      <SystemProfileForm />
    </section>

    <section id="preset" class="space-y-3 scroll-mt-16">
      <StepHeader :num="2" title="Pick a starting point" subtitle="Optional: jump to a tuned baseline for your workload, then fine-tune." />
      <PresetSelector />
    </section>

    <section id="tune" class="space-y-3 scroll-mt-16">
      <StepHeader :num="3" title="Tune and preview" subtitle="Drag any control on the left and the simulation on the right updates live." />
      <div class="grid gap-4 lg:grid-cols-5 lg:items-start">
        <div class="lg:col-span-3">
          <ParameterPanel />
        </div>
        <div class="lg:sticky lg:top-14 lg:col-span-2 lg:self-start">
          <GraphPanel :tabs="GRAPH_TABS" :impact="impact" />
        </div>
      </div>
    </section>

    <section id="export" class="space-y-3 scroll-mt-16">
      <StepHeader :num="4" title="Copy your drop-ins" subtitle="Two files: a [Manager] drop-in and a [Slice] drop-in. Then sudo systemctl daemon-reload." />
      <ConfigOutput />
    </section>

    <AdSlot slot="swap" label="systemd tuner footer" />

    <!-- About / methodology (visible by default — real content, grounded in the docs) -->
    <section id="about" class="space-y-6 rounded-lg border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-800 shadow-sm sm:p-6">
      <div>
        <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">About this tuner</h2>
        <p class="mt-2">
          This tuner generates two systemd drop-in files: a <code class="font-mono">[Manager]</code> file under
          <code class="font-mono">/etc/systemd/system.conf.d/</code> for the system-wide <code class="font-mono">Default*</code>
          directives, and a <code class="font-mono">[Slice]</code> file under
          <code class="font-mono">/etc/systemd/system/&lt;slice&gt;.d/</code> for the per-slice cgroup&nbsp;v2 resource controls.
          It deliberately does <strong>not</strong> touch <code class="font-mono">/etc/security/limits.conf</code>: those PAM limits
          apply to login sessions, not to systemd services, which take their limits from the directives above.
        </p>
      </div>

      <div>
        <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Methodology</h3>
        <ul class="mt-1 list-disc space-y-1 pl-5">
          <li>Accounting toggles, <code class="font-mono">DefaultTasksMax</code> (15% of <code class="font-mono">kernel.pid_max</code>), and the <code class="font-mono">DefaultLimit*</code> defaults come from <code class="font-mono">systemd-system.conf(5)</code>.</li>
          <li><code class="font-mono">CPUWeight</code>/<code class="font-mono">IOWeight</code> (1–10000, default 100), <code class="font-mono">CPUQuota</code>, and the <code class="font-mono">Memory*</code> controls come from <code class="font-mono">systemd.resource-control(5)</code> and apply on the cgroup&nbsp;v2 unified hierarchy.</li>
          <li>The CPU-share graph models proportional <code class="font-mono">cpu.weight</code> distribution under contention; the memory graph shows the MemoryHigh throttle band and the MemoryMax hard cap as fractions of RAM. Both are teaching models, not exact predictors.</li>
          <li>Per-workload starting values (container host, database, …) are opinionated defaults, not mandated constants, so always validate against your own load.</li>
        </ul>
      </div>

      <div>
        <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Sources</h3>
        <ul class="mt-1 list-disc space-y-1 pl-5">
          <li><a class="text-sky-700 underline" href="https://www.freedesktop.org/software/systemd/man/latest/systemd-system.conf.html" target="_blank" rel="noopener">systemd-system.conf(5) ↗</a></li>
          <li><a class="text-sky-700 underline" href="https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html" target="_blank" rel="noopener">systemd.resource-control(5) ↗</a></li>
          <li><a class="text-sky-700 underline" href="https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html" target="_blank" rel="noopener">systemd.exec(5): process limits ↗</a></li>
        </ul>
      </div>

      <div>
        <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Disclaimer</h3>
        <p class="mt-1">
          Resource limits can throttle or OOM-kill services if set too tight. Apply changes on a non-production
          host first, run <code class="font-mono">systemctl daemon-reload</code> (and a re-exec or reboot for the
          manager defaults), and verify with <code class="font-mono">systemctl show</code> and
          <code class="font-mono">systemd-cgtop</code> before rolling out.
        </p>
      </div>
    </section>

    <InfoDrawer />
  </section>
</template>
