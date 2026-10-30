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

Chart.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler,
)

// Smaller global defaults — chart titles/legends are heavy and the GraphPanel
// already has its own headers.
Chart.defaults.font.family =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
Chart.defaults.font.size = 11
Chart.defaults.plugins.legend.display = false