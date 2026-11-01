/**
 * The VM test suite, run once per image by the vm/*.vm.test.js files. It
 * boots the image, applies what the tuners generate, and checks the result on
 * the real kernel, instead of trusting docs or a simulation:
 *
 *  1. Every sysctl tuner's file, for each workload and preset, applies with
 *     no error and every key reads back as written.
 *  2. The security tuner's claims about kernel behaviour hold: what each
 *     value blocks, what locks, which warnings fire. So do the filesystem
 *     tuner's: what systemd sets at boot, and what a low fs.nr_open does.
 *  3. The files survive a reboot, applied by systemd-sysctl as on a real
 *     machine, including the interface caveats the security file explains.
 *
 * Run with `npm run test:vm` (vm/README.md).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { VM } from './lib/vm.mjs'
import { IMAGES } from './lib/images.mjs'
import { PERF_OPEN, BPF_MAP, py } from './lib/probes.mjs'
import { TUNER_DOMAINS } from '@/tuners/domains.js'
import { isEmitted } from '@/tuners/security/calculations.js'
import { kernelFileMax, kernelWatches } from '@/tuners/filesystem/calculations.js'
import { presetParams } from '@/core/createTunerStore.js'

const NOW = new Date('2026-01-01T00:00:00Z')
const SYSCTL_TUNERS = TUNER_DOMAINS.filter((d) => ['swap', 'network', 'security', 'filesystem'].includes(d.id))
const security = TUNER_DOMAINS.find((d) => d.id === 'security')
const filesystem = TUNER_DOMAINS.find((d) => d.id === 'filesystem')

/** `key = value` lines of a sysctl.d file, comments skipped. */
export function sysctlLines(content) {
  return content.split('\n')
    .map((l) => l.match(/^\s*([a-z0-9_.*-]+)\s*=\s*(.*?)\s*$/i))
    .filter(Boolean)
    .map((m) => ({ key: m[1], value: m[2].replace(/\s+/g, ' ') }))
}

/** Every workload's defaults and every preset, generated for this image. */
function cases(domain, image) {
  const base = { ...domain.defaultHardware, ...image.profile[domain.id] }
  const out = []
  for (const workload of domain.workloads) {
    const hardware = { ...base, [domain.workloadField]: workload }
    const variants = [{ id: 'defaults', label: null, values: {} }, ...domain.presets]
    for (const v of variants) {
      // What the page gives after picking the preset on this profile.
      const params = presetParams(domain, hardware, v.values)
      const files = domain.generateConfig({ hardware, params, presetLabel: v.label, customised: false, now: NOW })
      out.push({ name: `${domain.id} ${workload} ${v.id}`, domain, hardware, params, files })
    }
  }
  return out
}

/** Values that can't be lowered again until reboot, as the file sets them. */
function locks(lines) {
  const get = (k) => lines.find((l) => l.key === k)?.value
  return { ptrace3: get('kernel.yama.ptrace_scope') === '3', bpf1: get('kernel.unprivileged_bpf_disabled') === '1' }
}

function conflicts(state, lines) {
  const get = (k) => lines.find((l) => l.key === k)?.value
  const bpf = get('kernel.unprivileged_bpf_disabled')
  const ptrace = get('kernel.yama.ptrace_scope')
  return (state.bpf1 && bpf !== undefined && bpf !== '1') || (state.ptrace3 && ptrace !== undefined && ptrace !== '3')
}

/** Apply one sysctl.d file with sysctl -p. Errors are on stderr: procps 3.3 exits 0 anyway. */
async function applyFile(vm, file) {
  await vm.writeFile(file.path, file.content)
  const r = await vm.sudo(`sysctl -p ${file.path}`, { check: false })
  return { code: r.code, errors: r.stderr.trim() }
}

const UNITS = { K: 1024, M: 1024 ** 2, G: 1024 ** 3, T: 1024 ** 4 }
const bytes = (v) => {
  const m = String(v).match(/^(\d+)([KMGT])?$/)
  return m ? String(Number(m[1]) * (UNITS[m[2]] ?? 1)) : v
}
const isSet = (v) => v !== undefined && v !== '' && v !== 'infinity'

/**
 * The `systemctl show` properties a directive should produce, as
 * [property, expected value or predicate] pairs. Percentages resolve against
 * the VM's RAM or pid_max, so for those only "is set" is checked.
 */
function systemdProps(directive, value) {
  if (/^Default\w+Accounting$/.test(directive)) return [[directive, value]]
  const limit = directive.match(/^DefaultLimit(\w+)$/)
  if (limit) {
    const [soft, hard = soft] = value.split(':')
    return [[`${directive}Soft`, bytes(soft)], [directive, bytes(hard)]]
  }
  if (value.endsWith('%')) {
    if (directive === 'CPUQuota') return [['CPUQuotaPerSecUSec', isSet]]
    return [[directive, isSet]]
  }
  return [[directive, bytes(value)]]
}

export function imageSuite(id) {
  const image = IMAGES[id]
  const vm = new VM(id)
  let nic

  describe(`${id}: ${image.why}`, () => {
    beforeAll(async () => {
      // The network tuner's conntrack keys exist only with the module loaded,
      // which the profile's "conntrack in use" means. Again after each reboot.
      vm.afterBoot = (v) => v.sudo(image.expect.conntrackIpv4 ? 'modprobe nf_conntrack && modprobe nf_conntrack_ipv4' : 'modprobe nf_conntrack')
      await vm.start({ memory: 3072 })
      nic = await vm.nic()
    })
    afterAll(() => vm.stop())

    // Fresh-boot behaviour first, before any file changes a value.
    describe('security claims on a fresh boot', () => {
      const hw = { ...security.defaultHardware, ...image.profile.security }

      it('every value the tuner offers is accepted, and 0..4 for perf_event_paranoid', async () => {
        const rejected = []
        for (const def of security.parameterKeys.map((k) => security.defsByKey[k])) {
          if (def.key === 'unprivileged_bpf_disabled' || def.key === 'ptrace_scope') continue // locking: below
          const { min, max } = security.rangeFor(def.key, hw)
          const before = await vm.sysctl(def.sysctlName)
          if (before === null) continue // key not on this kernel: covered by the file sweep
          for (let v = min; v <= max; v++) {
            const err = await vm.sysctlWrite(def.sysctlName, v)
            if (err) rejected.push(`${def.sysctlName}=${v}: ${err}`)
          }
          await vm.sysctlWrite(def.sysctlName, before)
        }
        expect(rejected).toEqual([])
      })

      it('perf_event_paranoid blocks unprivileged perf exactly where the comments say', async () => {
        const blocked = {}
        for (const v of [-1, 0, 1, 2, 3, 4]) {
          expect(await vm.sysctlWrite('kernel.perf_event_paranoid', v)).toBe('')
          blocked[v] = (await vm.asUser(py(PERF_OPEN, 1))).stdout.trim() !== 'ok'
        }
        const at = image.expect.perfBlocksAt
        for (const v of [-1, 0, 1, 2, 3, 4]) expect(blocked[v], `paranoid ${v}`).toBe(at !== null && v >= at)
        // The tuner's non-debugging default blocks perf wherever a patch exists.
        const serverPerf = security.deriveDefaults({ ...hw, workload: 'server' }).perf_event_paranoid
        if (at !== null) expect(serverPerf).toBeGreaterThanOrEqual(at)
        // perf-3-ubuntu warns that 3 doesn't block everywhere: true wherever 3 doesn't block here.
        if (at === 4) expect(blocked[3]).toBe(false)
        await vm.sysctlWrite('kernel.perf_event_paranoid', 2)
      })

      it('kallsyms shows real addresses exactly when kallsyms-exposed warns', async () => {
        const base = security.deriveDefaults(hw)
        const mismatches = []
        for (const kptr of [0, 1, 2]) {
          for (const perf of [-1, 0, 1, 2]) {
            await vm.sysctlWrite('kernel.kptr_restrict', kptr)
            await vm.sysctlWrite('kernel.perf_event_paranoid', perf)
            const line = (await vm.asUser("grep -m1 -E ' [Tt] (_text|startup_64)$' /proc/kallsyms")).stdout
            const exposed = !/^0+ /.test(line)
            const warned = security.validate(hw, { ...base, kptr_restrict: kptr, perf_event_paranoid: perf }).some((i) => i.id === 'kallsyms-exposed')
            if (exposed !== warned) mismatches.push(`kptr ${kptr} perf ${perf}: exposed ${exposed}, warned ${warned}`)
          }
        }
        expect(mismatches).toEqual([])
      })

      it('kptr_restrict 0 prints raw %pK pointers only where kptr-raw warns', async () => {
        await vm.sysctlWrite('kernel.kptr_restrict', 0)
        // /proc/net/netlink prints each socket's address with %pK.
        const ptr = (await vm.asUser("awk 'NR==2 {print $1}' /proc/net/netlink")).stdout.trim()
        const raw = /^ffff/.test(ptr)
        const warned = security.validate(hw, { ...security.deriveDefaults(hw), kptr_restrict: 0 }).some((i) => i.id === 'kptr-raw')
        // The legacy profile spans 4.4 to 4.18 and only the part before 4.15
        // prints raw pointers, so it warns even where this kernel hashes.
        if (raw) expect(warned, ptr).toBe(true)
        if (hw.kernel !== 'legacy') expect(warned).toBe(false)
        await vm.sysctlWrite('kernel.kptr_restrict', 1)
      })

      it('the default for each workload stops unprivileged bpf(), and the offered values are accepted', async () => {
        const { min, max } = security.rangeFor('unprivileged_bpf_disabled', hw)
        const offered = []
        for (let v = min; v <= max; v++) offered.push(v)
        // Write the reversible values first; 1 locks.
        const order = [...offered.filter((v) => v !== 1), ...offered.filter((v) => v === 1)]
        const rejected = []
        for (const v of order) {
          // 0 is offered but left out of the file before 5.13, so not written.
          if (!isEmitted('unprivileged_bpf_disabled', hw, { unprivileged_bpf_disabled: v })) continue
          const err = await vm.sysctlWrite('kernel.unprivileged_bpf_disabled', v)
          if (err) rejected.push(`${v}: ${err}`)
          const user = (await vm.asUser(py(BPF_MAP))).stdout.trim()
          expect(user, `bpf map as user at ${v}`).toBe(v === 0 ? 'ok' : 'EPERM')
        }
        expect(rejected).toEqual([])
        for (const w of security.workloads) {
          expect(security.deriveDefaults({ ...hw, workload: w }).unprivileged_bpf_disabled, w).toBeGreaterThan(0)
        }
      })

      it('1 and ptrace_scope 3 lock until reboot, as the one-way block says', async () => {
        expect(await vm.sysctlWrite('kernel.unprivileged_bpf_disabled', 1)).toBe('')
        expect(await vm.sysctlWrite('kernel.unprivileged_bpf_disabled', 0)).not.toBe('')
        expect(await vm.sysctlWrite('kernel.yama.ptrace_scope', 3)).toBe('')
        expect(await vm.sysctlWrite('kernel.yama.ptrace_scope', 1)).not.toBe('')
        await vm.reboot()
      })
    })

    describe('filesystem claims on a fresh boot', () => {
      const hw = { ...filesystem.defaultHardware, ...image.profile.filesystem }
      const fileFor = (h, values = {}) => filesystem.generateConfig({ hardware: h, params: { ...filesystem.deriveDefaults(h), ...values }, presetLabel: null, now: NOW })[0].content
      const memGiB = async () => Number((await vm.run("awk '/MemTotal/ {print $2}' /proc/meminfo")).stdout) / 1024 / 1024

      it('fs.file-max is left out exactly where systemd already set the maximum', async () => {
        const got = await vm.sysctl('fs.file-max')
        const lines = sysctlLines(fileFor(hw)).map((l) => l.key)
        if (hw.systemd === 'modern') {
          expect(got).toBe('9223372036854775807')
          expect(lines).not.toContain('fs.file-max')
        } else {
          const want = kernelFileMax({ ...hw, ramGiB: await memGiB() })
          expect(Math.abs(Number(got) - want) / want).toBeLessThan(0.05)
          expect(lines).toContain('fs.file-max')
        }
      })

      it('fs.nr_open starts where the notes say, and is left out at the kernel default', async () => {
        expect(await vm.sysctl('fs.nr_open')).toBe(String(image.expect.nrOpen))
        expect(sysctlLines(fileFor(hw)).map((l) => l.key)).not.toContain('fs.nr_open')
      })

      it('the inotify watch default follows RAM where the drawer says', async () => {
        const got = Number(await vm.sysctl('fs.inotify.max_user_watches'))
        if (!image.expect.watchesScale) return expect(got).toBe(8192)
        const want = kernelWatches({ ...hw, ramGiB: await memGiB() })
        expect(Math.abs(got - want) / want).toBeLessThan(0.05)
      })

      it('every bound the tuner offers is accepted', async () => {
        const rejected = []
        for (const def of filesystem.parameterKeys.map((k) => filesystem.defsByKey[k])) {
          const before = await vm.sysctl(def.sysctlName)
          // The top first: a low fs.nr_open makes sudo warn on the next call.
          for (const v of [def.kernelMax, def.kernelMin]) {
            const err = await vm.sysctlWrite(def.sysctlName, v)
            if (err) rejected.push(`${def.sysctlName}=${v}: ${err}`)
          }
          await vm.sysctlWrite(def.sysctlName, before)
        }
        expect(rejected).toEqual([])
      })

      it('a unit asking for more than fs.nr_open is cut down, or fails where it was lowered, as the note says', async () => {
        const note = fileFor(hw, { nr_open: 2097152 })
        expect(note).toContain('gets less')
        expect(note).toContain('fails to start instead (status 205)')
        await vm.sysctlWrite('fs.nr_open', 1048576)
        const r = await vm.sudo("systemd-run --wait --pipe -q -p LimitNOFILE=2000000 sh -c 'ulimit -Hn'", { check: false })
        await vm.sysctlWrite('fs.nr_open', image.expect.nrOpen)
        // Lowered below what systemd runs with (raised at boot): it fails.
        if (image.expect.nrOpen > 1048576) expect(r.code).not.toBe(0)
        else expect(r.stdout.trim()).toBe('1048576')
      })
    })

    describe('every generated sysctl file applies and reads back', () => {
      const all = SYSCTL_TUNERS.flatMap((d) => cases(d, image))
        .map((c) => ({ ...c, lines: c.files.flatMap((f) => sysctlLines(f.content)) }))
      // Lock-free cases first, so a lock only costs a reboot when it conflicts.
      all.sort((a, b) => Number(locks(a.lines).bpf1 || locks(a.lines).ptrace3) - Number(locks(b.lines).bpf1 || locks(b.lines).ptrace3))
      let state = { ptrace3: false, bpf1: false }

      for (const c of all) {
        it(c.name, async () => {
          if (conflicts(state, c.lines)) {
            await vm.reboot()
            state = { ptrace3: false, bpf1: false }
          }
          for (const f of c.files) {
            expect(f.path).toMatch(/^\/etc\/sysctl\.d\/[a-z0-9-]+\.conf$/)
            const { errors } = await applyFile(vm, f)
            expect(errors, f.path).toBe('')
            await vm.sudo(`rm -f ${f.path}`)
          }
          const l = locks(c.lines)
          state = { ptrace3: state.ptrace3 || l.ptrace3, bpf1: state.bpf1 || l.bpf1 }
          const got = await vm.sysctls(c.lines.map((x) => x.key))
          const diff = c.lines.filter((x) => got[x.key] !== x.value).map((x) => `${x.key}: wrote ${x.value}, reads ${got[x.key]}`)
          expect(diff).toEqual([])
        })
      }
    })

    describe('systemd drop-ins load without warnings and take effect', () => {
      const systemd = TUNER_DOMAINS.find((d) => d.id === 'systemd')
      let n = 0
      for (const c of cases(systemd, image)) {
        it(c.name, async () => {
          const marker = `VMTEST-${++n}-${Date.now()}`
          await vm.sudo('rm -f /etc/systemd/system.conf.d/99-resource-tuning.conf /etc/systemd/system/*.slice.d/50-resources.conf')
          for (const f of c.files) await vm.writeFile(f.path, f.content)
          await vm.sudo(`logger ${marker} && systemctl daemon-reexec`)
          // PID 1 logs "<file>:<line>: Unknown key name ..." and similar for
          // anything it ignores.
          const log = (await vm.sudo(`journalctl -b -o cat --no-pager | sed -n '/${marker}/,$p'`)).stdout
          const warnings = log.split('\n').filter((l) => /99-resource-tuning\.conf|50-resources\.conf/.test(l))
          expect(warnings).toEqual([])

          const mismatches = []
          for (const f of c.files) {
            const unit = f.path.match(/\/([a-z]+\.slice)\.d\//)?.[1] ?? null
            const checks = f.content.split('\n').map((l) => l.match(/^([A-Za-z]+)=(.*)$/)).filter(Boolean).flatMap((m) => systemdProps(m[1], m[2]))
            if (!checks.length) continue
            const out = (await vm.run(`systemctl show ${unit ?? ''} ${checks.map(([p]) => `-p ${p}`).join(' ')}`)).stdout
            const got = Object.fromEntries(out.split('\n').filter(Boolean).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]))
            for (const [prop, want] of checks) {
              // Older systemd (247, 237) accepts some keys without exporting
              // them as properties; the journal check above covers those.
              if (!(prop in got)) continue
              const ok = typeof want === 'function' ? want(got[prop]) : got[prop] === want
              if (!ok) mismatches.push(`${unit ?? 'manager'} ${prop}: want ${typeof want === 'function' ? 'set' : want}, got ${got[prop]}`)
            }
          }
          expect(mismatches).toEqual([])
        })
      }
      afterAll(async () => {
        await vm.sudo('rm -f /etc/systemd/system.conf.d/99-resource-tuning.conf /etc/systemd/system/*.slice.d/50-resources.conf && systemctl daemon-reexec')
      })
    })

    describe('after a reboot, as systemd-sysctl applies them', () => {
      const pick = (d, workload) => cases(d, image).find((c) => c.name === `${d.id} ${workload} defaults`)
      const installed = [
        pick(SYSCTL_TUNERS.find((d) => d.id === 'swap'), 'general'),
        pick(SYSCTL_TUNERS.find((d) => d.id === 'network'), 'web'),
        pick(security, 'server'),
        pick(filesystem, 'server'),
      ]
      const lines = installed.flatMap((c) => c.files.flatMap((f) => sysctlLines(f.content)))
      const securityFile = installed[2].files[0]

      it('every key of the swap, network, security and filesystem defaults is set at boot', async () => {
        await vm.reboot()
        for (const c of installed) for (const f of c.files) await vm.writeFile(f.path, f.content)
        // As the network file says, so the conntrack keys exist when the files load.
        const network = installed[1].files[0].content
        expect(network).toContain('nf_conntrack_ipv4')
        await vm.writeFile('/etc/modules-load.d/nf_conntrack.conf', image.expect.conntrackIpv4 ? 'nf_conntrack\nnf_conntrack_ipv4' : 'nf_conntrack')
        await vm.reboot()
        const got = await vm.sysctls(lines.map((x) => x.key))
        // What the distro changes after us, each of which the tuner must
        // either explain (apport) or be harmless (a stricter value).
        const allowed = { ...image.expect.stricter }
        if (image.expect.apport) {
          expect(securityFile.content).toContain('sudo systemctl disable --now apport')
          allowed['fs.suid_dumpable'] = '2'
        }
        const diff = lines
          .filter((x) => got[x.key] !== x.value && got[x.key] !== allowed[x.key])
          .map((x) => `${x.key}: wrote ${x.value}, reads ${got[x.key]}`)
        expect(diff).toEqual([])
        const log = (await vm.sudo('journalctl -b -u systemd-sysctl --no-pager -o cat', { check: false })).stdout
        expect(log).not.toMatch(/Couldn't write|Failed to write|Invalid argument|not found|Permission denied/i)
      })

      it('the interface caveats: what the boot interface ends up with', async () => {
        const got = await vm.sysctls([`net.ipv4.conf.${nic}.rp_filter`, `net.ipv6.conf.${nic}.accept_redirects`, `net.ipv4.conf.${nic}.accept_redirects`, `net.ipv4.conf.${nic}.send_redirects`])
        // Record it in the report; the globs below must fix whatever this is.
        console.log(`[${id}] boot interface without globs:`, JSON.stringify(got))
        // IPv4 redirects follow conf.all OR the interface on a host, so the
        // interface must not still accept them.
        expect(got[`net.ipv4.conf.${nic}.accept_redirects`]).toBe('0')
      })

      it('the glob lines the file suggests cover the boot interface', async () => {
        const globs = securityFile.content.split('\n').filter((l) => /^#   net\.ipv[46]\.conf\.\*\./.test(l)).map((l) => l.slice(4))
        expect(globs.length).toBeGreaterThan(0)
        await vm.writeFile(securityFile.path, `${securityFile.content}\n${globs.join('\n')}`)
        // procps before 4.0 rejects globs, as the file says.
        const p = await vm.sudo(`sysctl -p ${securityFile.path}`, { check: false })
        if (!image.expect.procpsGlobs) expect(p.stderr).toMatch(/cannot stat/)
        else expect(p.stderr.trim()).toBe('')
        const want = Object.fromEntries(globs.map((g) => { const [k, v] = g.split(' = '); return [k.replace('*', nic), v] }))
        if (!image.expect.systemdGlobs) {
          // systemd before 245 skips them, as the file says.
          expect(securityFile.content).toContain('Older systemd skips')
          // Check the effect, not the journal, which may not be flushed yet:
          // the interface keeps the value it had.
          const v6 = `net.ipv6.conf.${nic}.accept_redirects`
          const before = await vm.sysctl(v6)
          await vm.sudo('systemctl restart systemd-sysctl')
          expect(v6 in want).toBe(true)
          expect(await vm.sysctl(v6)).toBe(before)
          expect(before).not.toBe(want[v6])
          return
        }
        // NetworkManager puts rp_filter back to 2 when it brings the interface
        // up, as the file says, so strict mode can't hold there.
        const rp = `net.ipv4.conf.${nic}.rp_filter`
        if (image.expect.networkManager && rp in want) {
          expect(securityFile.content).toContain('NetworkManager also sets')
          want[rp] = '2'
        }
        await vm.sudo('systemctl restart systemd-sysctl')
        if (!image.expect.networkManager) expect(await vm.sysctls(Object.keys(want))).toEqual(want)
        // And at boot.
        await vm.reboot()
        expect(await vm.sysctls(Object.keys(want))).toEqual(want)
      })
    })
  })
}
