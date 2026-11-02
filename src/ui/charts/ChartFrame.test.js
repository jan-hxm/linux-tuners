// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ChartFrame from './ChartFrame.vue'

describe('ChartFrame', () => {
  it('exposes the chart as a labelled image of the given height', () => {
    const w = mount(ChartFrame, { props: { ariaLabel: 'Swap chart: flat', height: '8rem' }, slots: { default: '<canvas />' } })
    const frame = w.get('[role="img"]')
    expect(frame.attributes('aria-label')).toBe('Swap chart: flat')
    expect(frame.attributes('style')).toContain('height: 8rem')
    expect(frame.find('canvas').exists()).toBe(true)
  })
})
