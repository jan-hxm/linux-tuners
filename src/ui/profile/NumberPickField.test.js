// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import NumberPickField from './NumberPickField.vue'

const picks = [{ value: 0.5, label: '512 MiB' }, 1, 2]
const field = (modelValue) => mount(NumberPickField, { props: { label: 'Total RAM (GiB)', modelValue, picks } })

describe('NumberPickField', () => {
  it('offers the same picks as chips and, for phones, as a select', () => {
    const wrapper = field(2)
    expect(wrapper.findAll('button').map((b) => b.text())).toEqual(['512 MiB', '1', '2'])
    expect(wrapper.findAll('select option:not([disabled])').map((o) => o.text())).toEqual(['512 MiB', '1', '2'])
    expect(wrapper.get('select').attributes('aria-label')).toBe('Total RAM (GiB): common values')
  })

  it('shows the matching pick in the select, or the placeholder for any other value', () => {
    expect(field(1).get('select').element.value).toBe('1')
    expect(field(3).get('select').element.value).toBe('')
    expect(field('').get('select').element.value).toBe('')
  })

  it('emits a number when a pick is chosen in the select', async () => {
    const wrapper = field(2)
    await wrapper.get('select').setValue('0.5')
    expect(wrapper.emitted('update:modelValue')).toEqual([[0.5]])
  })
})
