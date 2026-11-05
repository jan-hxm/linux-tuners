// @vitest-environment happy-dom
// The seven live charts, each built from the shared chart look
// (ui/charts/chartStyle.js): the canvas is stubbed, and the test reads the
// data and options each chart hands Chart.js.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useTunerStoreFor } from '@/core/createTunerStore.js'
import { TUNER_STORE_KEY, TUNER_DOMAIN_KEY } from '@/ui/useActiveTuner.js'
import { PALETTE } from '@/ui/charts/palette.js'
import { MAIN_WIDTH } from '@/ui/charts/chartStyle.js'
import { swapDomain } from './swap/index.js'
import { systemdDomain } from './systemd/index.js'
import { networkDomain } from './network/index.js'
import PressureChart from './swap/components/PressureChart.vue'
import DirtyChart from './swap/components/DirtyChart.vue'
import WatermarkChart from './swap/components/WatermarkChart.vue'
import CpuShareChart from './systemd/components/CpuShareChart.vue'
import MemoryBudgetChart from './systemd/components/MemoryBudgetChart.vue'
import TasksChart from './systemd/components/TasksChart.vue'
import ThroughputChart from './network/components/ThroughputChart.vue'

// Stand-ins for vue-chartjs's Line and Bar that keep their props.
const ChartStub = vi.hoisted(() => ({ name: 'ChartStub', props: ['data', 'options'], template: '<canvas />' }))
vi.mock('vue-chartjs', () => ({ Line: ChartStub, Bar: ChartStub }))

const CHARTS = [
  ['PressureChart', PressureChart, swapDomain, 'line'],
  ['DirtyChart', DirtyChart, swapDomain, 'line'],
  ['WatermarkChart', WatermarkChart, swapDomain, 'bar'],
  ['CpuShareChart', CpuShareChart, systemdDomain, 'bar'],
  ['MemoryBudgetChart', MemoryBudgetChart, systemdDomain, 'bar'],
  ['TasksChart', TasksChart, systemdDomain, 'bar'],
  ['ThroughputChart', ThroughputChart, networkDomain, 'line'],
]

function mountChart(component, domain) {
  const store = useTunerStoreFor(domain)
  const wrapper = mount(component, {
    global: {
      provide: { [TUNER_STORE_KEY]: store, [TUNER_DOMAIN_KEY]: domain },
    },
  })
  const chart = () => wrapper.findComponent(ChartStub).props()
  return { store, wrapper, chart }
}

describe('live charts', () => {
  beforeEach(() => setActivePinia(createPinia()))

  describe.each(CHARTS)('%s', (_name, component, domain, kind) => {
    it('keeps its summary label and hands the shared plugins their stops', () => {
      const { wrapper, chart } = mountChart(component, domain)
      expect(wrapper.get('[role="img"]').attributes('aria-label').length).toBeGreaterThan(20)
      const { options } = chart()
      expect(options.plugins.probe.stops.length).toBeGreaterThan(0)
      expect(options.plugins.zones.items).toBeInstanceOf(Array)
      // No vertical grid: the bottom axis never draws one.
      expect(options.scales.x.grid.display).toBe(false)
      if (kind === 'line') {
        expect(options.scales.y.grid.color).toBe(PALETTE.rule)
        expect(chart().data.datasets[0].borderWidth).toBe(MAIN_WIDTH)
      }
    })

    it('words every tooltip plainly, with no em dash', () => {
      const { chart } = mountChart(component, domain)
      for (const stop of chart().options.plugins.probe.stops) {
        expect(stop.title.length).toBeGreaterThan(0)
        expect(stop.lines.length).toBeGreaterThan(0)
        for (const text of [stop.title, ...stop.lines]) expect(text).not.toMatch(/—/)
      }
      for (const ds of chart().data.datasets) if (ds.endLabel) expect(ds.endLabel.text).not.toMatch(/—/)
    })
  })

  it('colours the swap curve fit, then mine once changed, with the kernel default beside it', async () => {
    const { store, chart } = mountChart(PressureChart, swapDomain)
    store.setParam('swappiness', swapDomain.defsByKey.swappiness.kernelDefault)
    await nextTick()
    const before = chart().data.datasets
    const changed = store.changedKeys.includes('swappiness')
    expect(before[0].borderColor).toBe(changed ? PALETTE.mine : PALETTE.fit)

    store.setParam('swappiness', 150)
    store.setParam('watermark_scale_factor', 500)
    await nextTick()
    const [main, stock] = chart().data.datasets
    expect(main.borderColor).toBe(PALETTE.mine)
    expect(main.endLabel.text).toBe('yours: 150')
    expect(stock.borderColor).toBe(PALETTE.quiet)
    expect(stock.borderDash).toBeTruthy()
    expect(stock.endLabel.text).toMatch(/^kernel default/)
  })

  it('draws the swap bands as a stripe and a hatched danger zone', () => {
    const { chart } = mountChart(PressureChart, swapDomain)
    expect(chart().options.plugins.zones.items.map((z) => [z.kind, z.tone])).toEqual([
      ['band', 'quiet'],
      ['hatch', 'error'],
    ])
  })

  it('hatches the memory above MemoryMax', async () => {
    const { store, chart } = mountChart(MemoryBudgetChart, systemdDomain)
    store.setParam('memory_max', 80)
    await nextTick()
    const oom = chart().data.datasets.at(-1)
    expect(oom.label).toMatch(/MemoryMax/)
    expect(oom.backgroundColor.hatchTone).toBe('error')
  })
})
