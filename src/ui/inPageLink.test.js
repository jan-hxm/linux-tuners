// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { followInPageLink } from './inPageLink.js'
import StepChain from './StepChain.vue'
import MobileImpactBar from './MobileImpactBar.vue'

// A tuner's state is the hash (Design.md §5), so in-page links must not replace it.
const STATE = '#v1.swappiness=10'

beforeEach(() => {
  history.replaceState(null, '', `/swap${STATE}`)
  document.body.innerHTML = '<section id="tune"></section><section id="graphs"></section>'
})

const click = (el, init = {}) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...init }))

describe('in-page links keep the state hash', () => {
  it('scrolls to and focuses the target without touching the hash', () => {
    const a = document.createElement('a')
    a.href = '#tune'
    a.addEventListener('click', (e) => followInPageLink(e, 'tune'))
    document.body.append(a)
    click(a)
    expect(window.location.hash).toBe(STATE)
    expect(document.activeElement?.id).toBe('tune')
    expect(document.getElementById('tune').getAttribute('tabindex')).toBe('-1')
  })

  it('leaves modified clicks (new tab) to the browser', () => {
    const event = new MouseEvent('click', { cancelable: true, ctrlKey: true })
    followInPageLink(event, 'tune')
    expect(event.defaultPrevented).toBe(false)
  })

  it('the step chain and the impact bar use it', async () => {
    const chain = mount(StepChain, {
      attachTo: document.body,
      props: { steps: [{ id: 'tune', label: 'Tune', mark: '02', href: '#tune' }], current: 0 },
    })
    click(chain.get('a').element)
    expect(window.location.hash).toBe(STATE)

    const bar = mount(MobileImpactBar, { attachTo: document.body, props: { impact: [{ id: 'swap', label: 'Swap starts', value: '70%', band: 'ok' }], graphsId: 'graphs' } })
    click(bar.get('a').element)
    expect(window.location.hash).toBe(STATE)
    expect(document.activeElement?.id).toBe('graphs')
  })
})
