/**
 * Register only the Chart.js pieces we actually use, so the build doesn't pull
 * in the whole library by default. Imported once from `main.js`.
 */
import {
  Chart,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { watch } from 'vue'
import { PALETTE } from './palette.js'
import { FONT_SANS, FONT_MONO } from '../theme.js'
import { zonesPlugin, endLabelsPlugin, probePlugin } from './plugins.js'

Chart.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler,
  zonesPlugin,
  endLabelsPlugin,
  probePlugin,
)

// The page's type (Design.md §7): words in the sans stack, and the numbers on
// the axes in mono, like the numbers on a slider's scale. 13px is the floor
// for meaningful text. No chart titles or legends: GraphPanel and each chart
// carry their own.
Chart.defaults.font.family = FONT_SANS.join(', ')
Chart.defaults.font.size = 13
Chart.defaults.scale.ticks.font = { family: FONT_MONO.join(', '), size: 13 }
// Category labels are words (TasksChart's limits), so they stay in sans.
Chart.defaults.scales.category.ticks.font = { family: FONT_SANS.join(', '), size: 13 }
Chart.defaults.plugins.legend.display = false
// The probe replaces Chart.js's tooltip and hover (ChartFrame handles the
// pointer, the keys and touch), so the chart takes no events of its own.
// Nothing animates, so prefers-reduced-motion has nothing to stop.
Chart.defaults.plugins.tooltip.enabled = false
Chart.defaults.events = []
Chart.defaults.animation = false

// Tick, title and grid colours follow the scheme. Synchronous, so the defaults
// change before ChartFrame rebuilds its chart.
watch(
  () => [PALETTE.text, PALETTE.grid],
  ([text, grid]) => {
    Chart.defaults.color = text
    Chart.defaults.borderColor = grid
  },
  { immediate: true, flush: 'sync' },
)
