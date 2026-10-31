// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { generateConfig } from './config.js'
import { deriveDefaults, rangeFor, bdpBytes, tcpBufferMax, kernelConntrackDefault, windowLimitBps } from './calculations.js'
import { validate } from './validation.js'
import { DEFAULT_NETWORK_SPEC } from './profile.js'
import { PARAMETER_DEFS_BY_KEY } from './defs.js'
import { formatValue } from './formatting.js'
import { combineFiles } from '@/core/output/files.js'
import TupleControl from '@/ui/controls/TupleControl.vue'

const NOW = new Date('2026-01-01T00:00:00Z')
const MiB = 1024 * 1024

function config(hardware, overrides = {}) {
  const params = { ...deriveDefaults(hardware), ...overrides }
  return combineFiles(generateConfig({ hardware, params, presetLabel: null, customised: false, now: NOW }))
}

const issues = (hw, overrides = {}) => validate(hw, { ...deriveDefaults(hw), ...overrides })
const ids = (hw, overrides) => issues(hw, overrides).map((i) => i.id)

describe('network buffers', () => {
  it('sizes the BDP from the link and the path', () => {
    // 10 Gbit/s × 20 ms = 25 MB in flight.
    expect(bdpBytes(DEFAULT_NETWORK_SPEC)).toBe(25_000_000)
  })

  it('sets the autotune max to twice the BDP, rounded up to a power of two', () => {
    expect(tcpBufferMax(DEFAULT_NETWORK_SPEC)).toBe(64 * MiB)
    expect(deriveDefaults(DEFAULT_NETWORK_SPEC).tcp_rmem).toEqual([4096, 131072, 64 * MiB])
  })

  it('keeps the kernel default on a LAN and caps the max at a 16th of RAM', () => {
    expect(tcpBufferMax({ ...DEFAULT_NETWORK_SPEC, link: '1g', rtt: 'lan' })).toBe(6 * MiB)
    expect(tcpBufferMax({ ...DEFAULT_NETWORK_SPEC, link: '100g', rtt: 'global', ramGiB: 2 })).toBe(128 * MiB)
  })

  it('grows the buffer slider range with the path, within 64 MiB and 1 GiB', () => {
    expect(rangeFor('tcp_rmem', { ...DEFAULT_NETWORK_SPEC, rtt: 'lan' }).max).toBe(64 * MiB)
    expect(rangeFor('tcp_rmem', { ...DEFAULT_NETWORK_SPEC, link: '100g', rtt: 'global' }).max).toBe(1024 * MiB)
  })

  it('models one connection as half the buffer per round trip, capped at the link', () => {
    expect(windowLimitBps(6 * MiB, 0.1, 1e10)).toBeCloseTo((3 * MiB * 8) / 0.1)
    expect(windowLimitBps(1024 * MiB, 0.001, 1e10)).toBe(1e10)
  })

  it('warns when the max cannot fill the link at the chosen RTT', () => {
    expect(ids(DEFAULT_NETWORK_SPEC)).not.toContain('rmem-below-bdp')
    expect(ids(DEFAULT_NETWORK_SPEC, { tcp_rmem: [4096, 131072, 6 * MiB] })).toContain('rmem-below-bdp')
  })

  it('blocks buffer bounds out of order', () => {
    const bad = issues(DEFAULT_NETWORK_SPEC, { tcp_wmem: [4096, 8 * MiB, 4 * MiB] }).find((i) => i.id === 'tcp_wmem-order')
    expect(bad.blocking).toBe(true)
  })
})

describe('network ports and queues', () => {
  it('blocks a port range the kernel rejects, and notes equal parity', () => {
    expect(issues(DEFAULT_NETWORK_SPEC, { ip_local_port_range: [40000, 30000] }).find((i) => i.blocking).id).toBe('port-range-order')
    expect(ids(DEFAULT_NETWORK_SPEC, { ip_local_port_range: [32768, 60000] })).toContain('port-range-parity')
    expect(ids(DEFAULT_NETWORK_SPEC)).not.toContain('port-range-parity')
  })

  it('keeps container hosts clear of the NodePort range', () => {
    const k8s = { ...DEFAULT_NETWORK_SPEC, workload: 'container' }
    expect(ids(k8s)).not.toContain('port-range-nodeport')
    expect(ids(k8s, { ip_local_port_range: [16384, 65535] })).toContain('port-range-nodeport')
  })

  it('writes tuples space-separated and enums as their option', () => {
    const out = config(DEFAULT_NETWORK_SPEC, { tcp_congestion_control: 'bbr', default_qdisc: 'fq' })
    expect(out).toMatch(/^net\.ipv4\.ip_local_port_range = 16384 65535$/m)
    expect(out).toMatch(/^net\.ipv4\.tcp_congestion_control = bbr$/m)
    expect(out).toContain('sudo modprobe tcp_bbr')
    expect(out).toContain('tc qdisc replace dev eth0 root fq')
  })

  it('prints the port count without locale separators', () => {
    expect(config(DEFAULT_NETWORK_SPEC)).toContain('# ip_local_port_range: 16384 65535 - 49152 local ports')
  })
})

describe('network conntrack', () => {
  it('follows the kernel RAM sizing', () => {
    expect(kernelConntrackDefault({ ramGiB: 16 })).toBe(262144)
    expect(kernelConntrackDefault({ ramGiB: 2 })).toBe(65536)
    expect(kernelConntrackDefault({ ramGiB: 0.5 })).toBe(4096)
  })

  it('gives NAT and container hosts 16384 entries per GiB, with a shorter timeout', () => {
    const k8s = deriveDefaults({ ...DEFAULT_NETWORK_SPEC, workload: 'container', ramGiB: 64 })
    expect(k8s.nf_conntrack_max).toBe(1048576)
    expect(k8s.nf_conntrack_buckets).toBe(1048576)
    expect(k8s.nf_conntrack_tcp_timeout_established).toBe(86400)
  })

  it('leaves the netfilter keys and their notes out without conntrack', () => {
    const out = config({ ...DEFAULT_NETWORK_SPEC, conntrack: 'off' })
    expect(out).not.toMatch(/^net\.netfilter\./m)
    expect(out).not.toContain('modules-load.d')
    expect(out).not.toContain('Connection tracking')
  })

  it('tells how to load nf_conntrack before the file applies', () => {
    expect(config(DEFAULT_NETWORK_SPEC)).toContain('/etc/modules-load.d/nf_conntrack.conf')
  })

  it('warns about a table that would take a tenth of RAM', () => {
    expect(ids({ ...DEFAULT_NETWORK_SPEC, ramGiB: 1 }, { nf_conntrack_max: 1048576, nf_conntrack_buckets: 1048576 })).toContain('conntrack-memory')
  })
})

describe('network formatting', () => {
  it('formats tuples, ports and timeouts for the card', () => {
    expect(formatValue([4096, 131072, 6 * MiB], PARAMETER_DEFS_BY_KEY.tcp_rmem)).toBe('4 KiB / 128 KiB / 6 MiB')
    expect(formatValue(86400, PARAMETER_DEFS_BY_KEY.nf_conntrack_tcp_timeout_established)).toMatch(/\(1 day\)$/)
  })
})

describe('TupleControl', () => {
  const def = PARAMETER_DEFS_BY_KEY.tcp_rmem
  const mountIt = () => mount(TupleControl, { props: { def, value: [4096, 131072, 6 * MiB], range: { min: 4096, max: 64 * MiB }, labelId: 'x' } })

  it('labels one input per element and emits the whole tuple on change', async () => {
    const wrapper = mountIt()
    expect(wrapper.findAll('label').map((l) => l.text())).toEqual(['min', 'default', 'max'])
    const inputs = wrapper.findAll('input')
    await inputs[2].setValue('8388608')
    expect(wrapper.emitted('update')).toEqual([[[4096, 131072, 8388608]]])
  })

  it('ignores a cleared or non-numeric field', async () => {
    const wrapper = mountIt()
    await wrapper.findAll('input')[0].setValue('')
    expect(wrapper.emitted('update')).toBeUndefined()
  })
})
