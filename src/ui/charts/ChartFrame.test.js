// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { Chart } from 'chart.js'
import ChartFrame from './ChartFrame.vue'

/** A Chart.js double with three x stops on a 1:1 pixel scale. */
function fakeChart() {
  return {
    width: 400,
    height: 200,
    $probe: null,
    draw: vi.fn(),
    canvas: { getBoundingClientRect: () => ({ left: 0, top: 0 }) },
    chartArea: { top: 0, bottom: 200, left: 0, right: 400 },
    data: { datasets: [{ probeDot: true, data: [{ x: 0, y: 10 }, { x: 200, y: 50 }, { x: 400, y: 90 }] }] },
    isDatasetVisible: () => true,
    scales: { x: { getPixelForValue: (v) => v }, y: { getPixelForValue: (v) => 200 - v } },
    config: {
      options: {
        plugins: {
          probe: {
            stops: [
              { x: 0, title: 'At 0%', lines: ['10% in use', 'Below the band.'] },
              { x: 200, title: 'At 50%', lines: ['50% in use', 'In the band.'] },
              { x: 400, title: 'At 100%', lines: ['90% in use', 'Past min.'] },
            ],
          },
        },
      },
    },
  }
}

function mountFrame(chart) {
  vi.spyOn(Chart, 'getChart').mockReturnValue(chart)
  return mount(ChartFrame, {
    props: { ariaLabel: 'Swap chart: flat', height: '8rem' },
    slots: { default: '<canvas />' },
    attachTo: document.body,
  })
}

const live = (w) => w.get('[data-chart-live]').text()
const tipText = (w) => (w.find('[data-chart-tip]').exists() ? w.get('[data-chart-tip]').text() : null)

describe('ChartFrame', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('exposes the chart as a labelled, focusable image of the given height', () => {
    const w = mountFrame(fakeChart())
    const frame = w.get('[role="img"]')
    expect(frame.attributes('aria-label')).toBe('Swap chart: flat')
    expect(frame.attributes('tabindex')).toBe('0')
    expect(frame.attributes('style')).toContain('height: 8rem')
    // The hint names the keys; the live region sits outside the image, whose
    // children are presentational.
    expect(w.get(`[id="${frame.attributes('aria-describedby')}"]`).text()).toMatch(/arrow keys/)
    expect(frame.find('[aria-live]').exists()).toBe(false)
    expect(w.get('[data-chart-live]').attributes('aria-live')).toBe('polite')
    // The canvas sits in a hidden wrapper, so it isn't a second, unlabelled image.
    expect(frame.get('canvas').element.parentElement.getAttribute('aria-hidden')).toBe('true')
  })

  it('moves the crosshair with the arrow keys and announces it, debounced', async () => {
    vi.useFakeTimers()
    const chart = fakeChart()
    const w = mountFrame(chart)
    const frame = w.get('[role="img"]')

    await frame.trigger('keydown', { key: 'ArrowRight' })
    expect(chart.$probe.index).toBe(0)
    expect(chart.draw).toHaveBeenCalled()
    expect(tipText(w)).toContain('10% in use')

    await frame.trigger('keydown', { key: 'ArrowRight' })
    expect(chart.$probe.index).toBe(1)
    expect(tipText(w)).toContain('In the band.')
    // Nothing is announced while the keys are still moving.
    expect(live(w)).toBe('')
    vi.advanceTimersByTime(300)
    await nextTick()
    expect(live(w)).toBe('At 50%. 50% in use. In the band.')

    await frame.trigger('keydown', { key: 'End' })
    expect(chart.$probe.index).toBe(2)
    await frame.trigger('keydown', { key: 'Escape' })
    expect(chart.$probe).toBeNull()
    expect(tipText(w)).toBeNull()
  })

  it('leaves keys it does not use alone and hides on blur', async () => {
    const chart = fakeChart()
    const w = mountFrame(chart)
    const frame = w.get('[role="img"]')
    const tab = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true, bubbles: true })
    frame.element.dispatchEvent(tab)
    expect(tab.defaultPrevented).toBe(false)
    await frame.trigger('keydown', { key: 'ArrowLeft' })
    expect(chart.$probe.index).toBe(2)
    await frame.trigger('blur')
    expect(chart.$probe).toBeNull()
  })

  it('shows the nearest stop on hover and on tap', async () => {
    const chart = fakeChart()
    const w = mountFrame(chart)
    const el = w.get('[role="img"]').element
    el.dispatchEvent(new PointerEvent('pointermove', { clientX: 190, clientY: 100, pointerType: 'mouse', bubbles: true }))
    await nextTick()
    expect(chart.$probe.index).toBe(1)
    el.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }))
    await nextTick()
    expect(chart.$probe).toBeNull()
    el.dispatchEvent(new PointerEvent('pointerdown', { clientX: 390, clientY: 100, pointerType: 'touch', bubbles: true }))
    await nextTick()
    expect(chart.$probe.index).toBe(2)
    expect(tipText(w)).toContain('Past min.')
  })
})
