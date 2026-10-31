// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { generateConfig } from './config.js'
import { deriveDefaults, rangeFor } from './calculations.js'
import { validate } from './validation.js'
import { DEFAULT_SECURITY_SPEC } from './profile.js'
import { PARAMETER_DEFS_BY_KEY } from './defs.js'
import { combineFiles } from '@/core/output/files.js'
import SegmentedControl from '@/ui/controls/SegmentedControl.vue'

const NOW = new Date('2026-01-01T00:00:00Z')

function config(hardware, overrides = {}) {
  const params = { ...deriveDefaults(hardware), ...overrides }
  return combineFiles(generateConfig({ hardware, params, presetLabel: null, customised: false, now: NOW }))
}

const ids = (hw, overrides = {}) => validate(hw, { ...deriveDefaults(hw), ...overrides }).map((i) => i.id)

describe('security config: keys the system has', () => {
  it('writes every key, conf.default twins included, on a current kernel with IPv6', () => {
    const out = config(DEFAULT_SECURITY_SPEC)
    expect(out).toMatch(/^kernel\.unprivileged_bpf_disabled = 2$/m)
    expect(out).toMatch(/^net\.ipv4\.conf\.default\.rp_filter = 1$/m)
    expect(out).toMatch(/^net\.ipv6\.conf\.all\.accept_redirects = 0$/m)
    expect(out).toMatch(/^fs\.protected_fifos = 1$/m)
  })

  it('leaves out the IPv6 keys when IPv6 is off', () => {
    expect(config({ ...DEFAULT_SECURITY_SPEC, ipv6: 'off' })).not.toMatch(/^net\.ipv6\./m)
  })

  it('leaves out protected_fifos and protected_regular before 4.19', () => {
    const out = config({ ...DEFAULT_SECURITY_SPEC, kernel: 'legacy' })
    expect(out).not.toMatch(/^fs\.protected_(fifos|regular)/m)
    expect(out).toMatch(/^fs\.protected_symlinks = 1$/m)
  })

  it('offers only 0 and 1 for unprivileged BPF before 5.13, and leaves 0 out of the file', () => {
    const lts = { ...DEFAULT_SECURITY_SPEC, kernel: 'lts' }
    expect(rangeFor('unprivileged_bpf_disabled', lts)).toEqual({ min: 0, max: 1 })
    expect(deriveDefaults(lts).unprivileged_bpf_disabled).toBe(1)
    expect(config(lts, { unprivileged_bpf_disabled: 0 })).not.toMatch(/^kernel\.unprivileged_bpf_disabled/m)
    expect(ids(lts, { unprivileged_bpf_disabled: 0 })).toContain('bpf-left-out')
  })

  it('lists one-way values in a warning block', () => {
    const out = config(DEFAULT_SECURITY_SPEC, { ptrace_scope: 3, unprivileged_bpf_disabled: 1 })
    expect(out).toContain('# ONE-WAY SETTINGS')
    expect(out).toContain('#   kernel.yama.ptrace_scope = 3')
    expect(config(DEFAULT_SECURITY_SPEC)).not.toContain('ONE-WAY')
  })

  it('explains strict rp_filter only when it is chosen', () => {
    expect(config(DEFAULT_SECURITY_SPEC)).toContain('net.ipv4.conf.*.rp_filter = 1')
    expect(config({ ...DEFAULT_SECURITY_SPEC, workload: 'router' })).not.toContain('Strict rp_filter')
  })

  it('gives the IPv6 redirect glob, since IPv6 reads only the interface value', () => {
    const out = config({ ...DEFAULT_SECURITY_SPEC, workload: 'router' })
    expect(out).toContain('#   net.ipv6.conf.*.accept_redirects = 0')
    expect(out).not.toContain('net.ipv4.conf.*.rp_filter')
    expect(config(DEFAULT_SECURITY_SPEC)).toMatch(/add these lines[\s\S]*rp_filter = 1\n#   net\.ipv6\.conf\.\*\.accept_redirects = 0/)
    expect(config({ ...DEFAULT_SECURITY_SPEC, ipv6: 'off' })).not.toContain('net.ipv6.conf.*')
    expect(config(DEFAULT_SECURITY_SPEC, { accept_redirects_v6: 1 })).not.toContain('IPv6 redirects:')
  })

  it('never writes unprivileged BPF back on, and blocks perf on Ubuntu too, by default', () => {
    for (const workload of ['server', 'container', 'router', 'desktop']) {
      const out = config({ ...DEFAULT_SECURITY_SPEC, workload })
      expect(out, workload).not.toMatch(/^kernel\.unprivileged_bpf_disabled = 0$/m)
      expect(out, workload).not.toMatch(/^kernel\.perf_event_paranoid = 3$/m)
    }
    expect(config(DEFAULT_SECURITY_SPEC)).toMatch(/^# perf_event_paranoid: 4 - no unprivileged perf on Debian, Ubuntu and Android.*\nkernel\.perf_event_paranoid = 4$/m)
  })

  it('says kptr_restrict 0 only hashes from 5.2', () => {
    expect(config(DEFAULT_SECURITY_SPEC, { kptr_restrict: 0 })).toMatch(/^# kptr_restrict: 0 - kernel pointers hashed$/m)
    expect(config({ ...DEFAULT_SECURITY_SPEC, kernel: 'lts' }, { kptr_restrict: 0 })).toContain('shown in full before')
  })
})

describe('security validation', () => {
  it('has no notes for the server defaults beyond the interface caveats and perf 4', () => {
    expect(ids(DEFAULT_SECURITY_SPEC).sort()).toEqual(['perf-4-patched', 'redirects-v6-interfaces', 'rp-strict-interfaces'])
  })

  it('warns that perf 3 loosens Ubuntu kernels', () => {
    expect(ids(DEFAULT_SECURITY_SPEC, { perf_event_paranoid: 3 })).toContain('perf-3-ubuntu')
  })

  it('warns that kptr_restrict 0 prints raw addresses before 5.2', () => {
    expect(ids({ ...DEFAULT_SECURITY_SPEC, kernel: 'legacy' }, { kptr_restrict: 0 })).toContain('kptr-raw')
    expect(ids(DEFAULT_SECURITY_SPEC, { kptr_restrict: 0 })).not.toContain('kptr-raw')
  })

  it('warns when kallsyms would expose kernel addresses to every user', () => {
    expect(ids(DEFAULT_SECURITY_SPEC, { kptr_restrict: 0, perf_event_paranoid: 1 })).toContain('kallsyms-exposed')
    expect(ids(DEFAULT_SECURITY_SPEC, { kptr_restrict: 0, perf_event_paranoid: 2 })).not.toContain('kallsyms-exposed')
  })

  it('warns about strict filtering on routers and container hosts only', () => {
    expect(ids({ ...DEFAULT_SECURITY_SPEC, workload: 'router' }, { rp_filter: 1 })).toContain('rp-strict-router')
    expect(ids({ ...DEFAULT_SECURITY_SPEC, workload: 'container' }, { rp_filter: 1 })).toContain('rp-strict-container')
  })

  it('ignores the IPv6 redirect key when IPv6 is off', () => {
    expect(ids({ ...DEFAULT_SECURITY_SPEC, ipv6: 'off' }, { accept_redirects_v6: 1 })).not.toContain('redirects-accepted')
  })
})

describe('SegmentedControl', () => {
  it('offers only the segments inside the range', () => {
    const def = PARAMETER_DEFS_BY_KEY.unprivileged_bpf_disabled
    const wrapper = mount(SegmentedControl, { props: { def, value: 1, labelId: 'x', range: { min: 0, max: 1 } } })
    expect(wrapper.findAll('[role="radio"]').map((b) => b.text())).toEqual(['0: allowed', '1: off, locked'])
    wrapper.findAll('[role="radio"]')[0].trigger('click')
    expect(wrapper.emitted('update')).toEqual([[0]])
  })
})
