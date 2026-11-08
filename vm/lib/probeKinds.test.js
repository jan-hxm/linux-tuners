// Unit tests for vm/lib/probeKinds.mjs (the learning pages' probe kinds) and
// vm/capture.mjs. They live here because `npm test` only collects src/ and
// scripts/ (vite.config.js); the parsers read real /proc output saved in
// vm/lib/__fixtures__/, each file saying where it came from.
import { describe, it, expect } from 'vitest'
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import {
  KINDS, GUEST, TUNERS_DIR, checkProbe, evidenceEntry, evidenceFile, loadProbes, parseZoneinfo,
  readEvidence, runProbes, sortedEvidence, staleProbes, staleReason,
} from './probeKinds.mjs'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const FIXTURES = join(ROOT, 'vm', 'lib', '__fixtures__')
/** A fixture's text after its "# source" header and the "---" line. */
const fixture = (name) => readFileSync(join(FIXTURES, name), 'utf8').replace(/\r\n/g, '\n').split('\n---\n').slice(1).join('\n---\n')
const ok = (stdout) => ({ code: 0, stdout, stderr: '' })
const entry = (probe, result) => evidenceEntry(probe, result)

describe('command templates', () => {
  it('quote the probe field into a fixed command', () => {
    expect(KINDS.sysctl.command({ kind: 'sysctl', name: 'vm.min_free_kbytes' })).toBe("sudo sysctl -n 'vm.min_free_kbytes'")
    expect(KINDS.file.command({ kind: 'file', path: '/proc/swaps', exists: true })).toBe("if sudo test -e '/proc/swaps'; then echo present; else echo missing; fi")
    expect(KINDS.sysfs.command({ kind: 'sysfs', path: '/sys/kernel/mm/transparent_hugepage/enabled' })).toBe("sudo cat '/sys/kernel/mm/transparent_hugepage/enabled'")
    expect(KINDS.thread.command({ kind: 'thread', name: 'kswapd0' })).toBe('ps -e -o comm=')
    expect(KINDS.zoneinfo.command({ kind: 'zoneinfo' })).toBe('cat /proc/zoneinfo')
    expect(KINDS.vmstatKeys.command({ kind: 'vmstatKeys', prefix: 'allocstall' })).toBe('cat /proc/vmstat')
    expect(KINDS.meminfoKeys.command({ kind: 'meminfoKeys', keys: ['MemTotal'] })).toBe('cat /proc/meminfo')
  })

  it('is the closed set from the plan, each with a compare mode', () => {
    expect(Object.keys(KINDS).sort()).toEqual(['file', 'meminfoKeys', 'sysctl', 'sysfs', 'thread', 'vmstatKeys', 'zoneinfo'])
    for (const k of Object.values(KINDS)) expect(['exact', 'present']).toContain(k.compare)
  })

  it('refuse probes whose fields could reach the shell or leave /proc and /sys', () => {
    const bad = {
      'demo.a': { kind: 'sysctl', name: "vm.x'; reboot; '" },
      'demo.b': { kind: 'sysctl', name: 'vm/min_free_kbytes' },
      'demo.c': { kind: 'file', path: '/etc/shadow', exists: true },
      'demo.d': { kind: 'file', path: '/proc/../etc/shadow', exists: true },
      'demo.e': { kind: 'file', path: '/proc/swaps' },
      'demo.f': { kind: 'sysfs', path: '/proc/sys/vm/swappiness' },
      'demo.g': { kind: 'sysfs', path: '/sys/kernel/$(reboot)' },
      'demo.h': { kind: 'thread', name: 'a name that is far too long' },
      'demo.i': { kind: 'thread', name: 'k;reboot' },
      'demo.j': { kind: 'vmstatKeys', prefix: 'alloc stall' },
      'demo.k': { kind: 'meminfoKeys', keys: [] },
      'demo.l': { kind: 'meminfoKeys', keys: ['MemTotal:'] },
      'demo.m': { kind: 'zoneinfo', path: '/proc/zoneinfo' },
      'demo.n': { kind: 'toString' },
      'demo.o': { kind: '__proto__' },
      'demo.p': null,
    }
    for (const [id, p] of Object.entries(bad)) expect(checkProbe(id, p, 'demo'), id).not.toEqual([])
    expect(checkProbe('demo', { kind: 'zoneinfo' }, 'demo')).not.toEqual([])
    expect(checkProbe('swap.x', { kind: 'zoneinfo' }, 'demo')).toEqual(['swap.x: id must start with "demo."'])
    expect(checkProbe('sysv-ipc.shmmax', { kind: 'sysctl', name: 'kernel.shmmax' }, 'sysv-ipc')).toEqual([])
  })
})

describe('sysctl', () => {
  const p = { kind: 'sysctl', name: 'vm.min_free_kbytes' }
  // Values from Design.md §9 "VM tests", as the VM images read them.
  it('reads one whole number as a number, anything else as text', () => {
    expect(entry(p, ok('67584\n'))).toEqual({ status: 'ok', value: 67584 })
    expect(entry(p, ok('32000\t1024000000\t500\t32000\n'))).toEqual({ status: 'ok', value: '32000 1024000000 500 32000' })
    expect(entry(p, ok('18446744073692774399\n'))).toEqual({ status: 'ok', value: '18446744073692774399' })
  })
  it('is absent when sysctl fails, with its message as the reason', () => {
    expect(entry(p, { code: 255, stdout: '', stderr: 'sysctl: cannot stat /proc/sys/kernel/hung_task_timeout_secs: No such file or directory\n' }))
      .toEqual({ status: 'absent', reason: 'sysctl: cannot stat /proc/sys/kernel/hung_task_timeout_secs: No such file or directory' })
    expect(entry(p, { code: 1, stdout: '', stderr: '' })).toEqual({ status: 'absent', reason: 'exit 1' })
    expect(entry(p, ok('\n'))).toEqual({ status: 'absent', reason: 'empty value' })
  })
  it('keeps a good read when sudo warns on stderr', () => {
    expect(entry(p, { code: 0, stdout: '3\n', stderr: 'sudo: unable to resolve host lt-debian13\n' })).toEqual({ status: 'ok', value: 3 })
  })
})

describe('file and sysfs', () => {
  it('file: true when it exists, absent when it does not', () => {
    const p = { kind: 'file', path: '/sys/block/zram0', exists: true }
    expect(entry(p, ok('present\n'))).toEqual({ status: 'ok', value: true })
    expect(entry(p, ok('missing\n'))).toEqual({ status: 'absent', reason: 'no /sys/block/zram0' })
    expect(entry(p, ok('yes\n')).status).toBe('absent')
  })
  it('sysfs: the bracketed choice, or the value', () => {
    // The choice format of Documentation/admin-guide/mm/transhuge.rst.
    const p = { kind: 'sysfs', path: '/sys/kernel/mm/transparent_hugepage/enabled' }
    expect(entry(p, ok('always [madvise] never\n'))).toEqual({ status: 'ok', value: 'madvise' })
    expect(entry(p, ok('128\n'))).toEqual({ status: 'ok', value: 128 })
    expect(entry(p, { code: 1, stdout: '', stderr: 'cat: /sys/kernel/mm/ksm/max_page_sharing: No such file or directory\n' }))
      .toEqual({ status: 'absent', reason: 'cat: /sys/kernel/mm/ksm/max_page_sharing: No such file or directory' })
  })
})

describe('thread', () => {
  const ps = fixture('ps-comm-format.txt')
  it('matches a whole process name, not a prefix', () => {
    expect(entry({ kind: 'thread', name: 'kswapd0' }, ok(ps))).toEqual({ status: 'ok', value: true })
    expect(entry({ kind: 'thread', name: 'kswapd1' }, ok(ps))).toEqual({ status: 'ok', value: false })
    expect(entry({ kind: 'thread', name: 'kswapd' }, ok(ps))).toEqual({ status: 'ok', value: false })
    expect(entry({ kind: 'thread', name: 'ksmd' }, ok(ps))).toEqual({ status: 'ok', value: true })
  })
})

describe('zoneinfo', () => {
  const p = { kind: 'zoneinfo' }
  it('reads the 4.15 to 5.15 layout (LKML, 2020)', () => {
    expect(parseZoneinfo(fixture('zoneinfo-lkml-2020-02.txt'))).toEqual({
      DMA: { min: 173, low: 216, high: 259 },
      DMA32: { min: 11090, low: 13862, high: 16634 },
      Normal: { min: 0, low: 0, high: 0 },
      Movable: { min: 0, low: 0, high: 0 },
      Device: { min: 0, low: 0, high: 0 },
    })
  })
  it('ignores the per-cpu "high:" lines and keys other nodes apart (LKML, 2017, two nodes)', () => {
    expect(parseZoneinfo(fixture('zoneinfo-lkml-2017-01-numa.txt'))).toEqual({
      DMA: { min: 5, low: 8, high: 11 },
      DMA32: { min: 1023, low: 1768, high: 2513 },
      Normal: { min: 10250, low: 17718, high: 25186 },
      'node1-Normal': { min: 11247, low: 19441, high: 27635 },
    })
  })
  it('reads the 6.12 to 6.17 layout, skipping boost, promo and cma (documented format)', () => {
    expect(parseZoneinfo(fixture('zoneinfo-format-v6.12.txt'))).toEqual({
      Normal: { min: 3, low: 4, high: 5 },
      Movable: { min: 0, low: 0, high: 0 },
    })
  })
  it('leaves out zones without all three watermarks, and a "per-node stats" header is no zone (LKML, 2024 excerpts)', () => {
    expect(parseZoneinfo(fixture('zoneinfo-lkml-2024-07-excerpt.txt'))).toEqual({})
    expect(entry(p, ok(fixture('zoneinfo-lkml-2024-07-excerpt.txt')))).toEqual({ status: 'absent', reason: 'no zone watermarks in /proc/zoneinfo' })
  })
  it('records numbers only', () => {
    const e = entry(p, ok(fixture('zoneinfo-lkml-2020-02.txt')))
    expect(e.status).toBe('ok')
    for (const z of Object.values(e.value)) for (const v of Object.values(z)) expect(Number.isSafeInteger(v)).toBe(true)
  })
})

describe('vmstatKeys', () => {
  const p = { kind: 'vmstatKeys', prefix: 'allocstall' }
  it('finds the per-zone allocstall_* keys of 4.8 and later (LKML, 2017)', () => {
    expect(entry(p, ok(fixture('vmstat-lkml-2017-01.txt')))).toEqual({
      status: 'ok', value: ['allocstall_dma', 'allocstall_dma32', 'allocstall_movable', 'allocstall_normal'],
    })
  })
  it('finds the single allocstall key before 4.8 (kernel.org, 2.6.2)', () => {
    expect(entry(p, ok(fixture('vmstat-kernel-org-2.6.2.txt')))).toEqual({ status: 'ok', value: ['allocstall'] })
  })
  it('does not take a longer key that only starts the same', () => {
    expect(entry({ kind: 'vmstatKeys', prefix: 'pgsteal' }, ok(fixture('vmstat-kernel-org-2.6.2.txt')))).toEqual({ status: 'ok', value: ['pgsteal'] })
    expect(entry({ kind: 'vmstatKeys', prefix: 'pgsteal_kswapd' }, ok(fixture('vmstat-kernel-org-2.6.2.txt'))))
      .toEqual({ status: 'absent', reason: 'no pgsteal_kswapd keys in /proc/vmstat' })
  })
})

describe('meminfoKeys', () => {
  const meminfo = fixture('meminfo-proc-rst-v6.12.txt')
  it('reads the requested keys as printed, kB or a count (proc.rst example)', () => {
    expect(entry({ kind: 'meminfoKeys', keys: ['MemTotal', 'SwapTotal', 'Active(anon)', 'HugePages_Total'] }, ok(meminfo))).toEqual({
      status: 'ok', value: { MemTotal: 32858820, SwapTotal: 0, 'Active(anon)': 94064, HugePages_Total: 0 },
    })
  })
  it('leaves out a key the kernel lacks; none at all is absent', () => {
    expect(entry({ kind: 'meminfoKeys', keys: ['MemTotal', 'Zcache'] }, ok(meminfo))).toEqual({ status: 'ok', value: { MemTotal: 32858820 } })
    expect(entry({ kind: 'meminfoKeys', keys: ['Zcache'] }, ok(meminfo))).toEqual({ status: 'absent', reason: 'none of the keys in /proc/meminfo' })
  })
})

describe('running probes', () => {
  it('runs each command once and records every probe, sorted', async () => {
    const calls = []
    const outputs = { 'cat /proc/meminfo': ok(fixture('meminfo-proc-rst-v6.12.txt')), 'ps -e -o comm=': ok(fixture('ps-comm-format.txt')) }
    const vm = { run: async (cmd) => { calls.push(cmd); return outputs[cmd] ?? { code: 1, stdout: '', stderr: 'nope' } } }
    const got = await runProbes(vm, {
      'demo.total': { kind: 'meminfoKeys', keys: ['MemTotal'] },
      'demo.swap': { kind: 'meminfoKeys', keys: ['SwapTotal'] },
      'demo.kswapd': { kind: 'thread', name: 'kswapd0' },
      'demo.missing': { kind: 'sysctl', name: 'vm.nothing_here' },
    })
    expect(calls.sort()).toEqual(['cat /proc/meminfo', 'ps -e -o comm=', "sudo sysctl -n 'vm.nothing_here'"])
    expect(Object.keys(got)).toEqual(['demo.kswapd', 'demo.missing', 'demo.swap', 'demo.total'])
    expect(got['demo.missing']).toEqual({ status: 'absent', reason: 'nope' })
  })
  it('refuses a malformed probe before running anything', async () => {
    const vm = { run: async () => { throw new Error('ran') } }
    await expect(runProbes(vm, { 'demo.x': { kind: 'sysctl', name: '$(reboot)' } })).rejects.toThrow(/dotted sysctl key/)
  })
})

describe('evidence files', () => {
  it('are numbers, strings and booleans in plain objects and arrays, keys sorted', () => {
    const text = evidenceFile({
      image: 'debian-13', kernel: '6.12.48+deb13-amd64', capturedAt: '2026-11-09T10:00:00Z',
      probes: { 'swap.z': { status: 'absent', reason: 'no zram' }, 'swap.a': { value: { b: 1, a: 2 }, status: 'ok' } },
    })
    expect(text.endsWith('}\n')).toBe(true)
    const doc = JSON.parse(text)
    expect(Object.keys(doc)).toEqual(['capturedAt', 'guestMemoryMiB', 'image', 'kernel', 'probes'])
    expect(doc.guestMemoryMiB).toBe(3072)
    expect(Object.keys(doc.probes)).toEqual(['swap.a', 'swap.z'])
    expect(Object.keys(doc.probes['swap.a'].value)).toEqual(['a', 'b'])
    expect(text.indexOf('"status": "ok"')).toBeGreaterThan(text.indexOf('"swap.a"'))
  })
  it('refuse anything else', () => {
    for (const v of [NaN, Infinity, () => 1, new Date(0), null, undefined, Symbol('x'), 1n]) {
      expect(() => sortedEvidence({ x: v }), String(v)).toThrow(/\$\.x/)
    }
  })
  it('clean the kernel string to printable text', () => {
    expect(JSON.parse(evidenceFile({ image: 'x', kernel: '6.8.0\n<b>\u0007', capturedAt: 't', probes: {} })).kernel).toBe('6.8.0 <b>')
  })
  it('read back as null when the image has none', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lt-evidence-'))
    try {
      expect(readEvidence('debian-13', dir)).toBeNull()
      writeFileSync(join(dir, 'debian-13.json'), evidenceFile({ image: 'debian-13', kernel: 'k', capturedAt: 't', probes: {} }))
      expect(readEvidence('debian-13', dir).image).toBe('debian-13')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('freshness', () => {
  const zones = { kind: 'zoneinfo' }
  const thread = { kind: 'thread', name: 'kswapd0' }
  it("'exact' kinds want the same value", () => {
    expect(staleReason(thread, { status: 'ok', value: true }, { status: 'ok', value: true })).toBeNull()
    expect(staleReason(thread, { status: 'ok', value: true }, { status: 'ok', value: false })).toBe('was true, now false')
  })
  it("'present' kinds want the same status and shape, not the same numbers", () => {
    const a = { status: 'ok', value: { Normal: { min: 1, low: 2, high: 3 } } }
    expect(staleReason(zones, a, { status: 'ok', value: { Normal: { min: 9, low: 9, high: 9 } } })).toBeNull()
    expect(staleReason(zones, a, { status: 'ok', value: { DMA32: { min: 1, low: 2, high: 3 } } })).toBe('was ["Normal"], now ["DMA32"]')
    expect(staleReason({ kind: 'sysctl', name: 'vm.swappiness' }, { status: 'ok', value: 60 }, { status: 'ok', value: 10 })).toBeNull()
  })
  it('a status change or a missing entry is stale', () => {
    expect(staleReason(zones, { status: 'absent', reason: 'r' }, { status: 'ok', value: {} })).toBe('was absent (r), now ok')
    expect(staleReason(zones, { status: 'absent', reason: 'r' }, { status: 'absent', reason: 'other' })).toBeNull()
    expect(staleReason(zones, undefined, { status: 'ok', value: {} })).toBe('missing from the evidence')
  })
  it('names each stale probe by id', () => {
    const probes = { 'swap.kswapd': thread, 'swap.zones': zones }
    const recorded = { 'swap.kswapd': { status: 'ok', value: true } }
    const fresh = { 'swap.kswapd': { status: 'ok', value: true }, 'swap.zones': { status: 'ok', value: {} } }
    expect(staleProbes(probes, recorded, fresh)).toEqual(['swap.zones: missing from the evidence'])
    expect(staleProbes(probes, undefined, fresh)).toHaveLength(2)
  })
})

describe('loading probes', () => {
  it('finds every probes.js under a tuners folder', async () => {
    const probes = await loadProbes(join(FIXTURES, 'tuners'))
    expect(Object.keys(probes).sort()).toEqual(['demo.allocstall', 'demo.kswapd', 'demo.meminfo', 'demo.minFree', 'demo.swaps', 'demo.thp', 'demo.zoneWatermarks'])
    expect(new Set(Object.values(probes).map((p) => p.kind))).toEqual(new Set(Object.keys(KINDS)))
  })
  it('refuses a folder with any bad probe, naming each', async () => {
    const err = await loadProbes(join(FIXTURES, 'tuners-bad')).catch((e) => e)
    for (const id of ['other.minFree', 'demo.shell', 'demo.shadow', 'demo.escape', 'demo.cmd', 'demo.extra']) expect(err.message).toContain(id)
  })
  it("every tuner's probes.js passes", async () => {
    await expect(loadProbes(TUNERS_DIR)).resolves.toBeTypeOf('object')
  })
})

describe('wiring', () => {
  const suite = readFileSync(join(ROOT, 'vm', 'suite.mjs'), 'utf8')
  it('captures on the guest the suite boots', () => {
    expect(suite).toContain(`vm.start({ memory: ${GUEST.memory}, disks: EXTRA_DISKS })`)
    const disks = suite.match(/const EXTRA_DISKS = (\[[^\]]*\])/)[1]
    expect(JSON.parse(disks.replace(/'/g, '"'))).toEqual(GUEST.disks)
  })
  it('has the capture script and the freshness block', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
    expect(pkg.scripts['vm:capture']).toBe('node vm/capture.mjs')
    expect(suite).toContain("describe('learn evidence is fresh'")
  })
})
