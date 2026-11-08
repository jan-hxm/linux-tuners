/**
 * The VM test suite, run once per image by the vm/*.vm.test.js files. It
 * boots the image, applies what the tuners generate, and checks the result on
 * the real kernel, instead of trusting docs or a simulation:
 *
 *  1. Every sysctl tuner's file, for each workload and preset, applies with
 *     no error and every key reads back as written.
 *  2. The security tuner's claims about kernel behaviour hold: what each
 *     value blocks, what locks, which warnings fire. So do the filesystem
 *     tuner's: what systemd sets at boot, and what a low fs.nr_open does;
 *     and the huge pages tuner's: what each distro starts THP and the map
 *     count at, and that its tmpfiles.d lines set /sys; the System V
 *     IPC tuner's: the defaults, and that containers don't see the values;
 *     and the kernel tuner's: what systemd derives from threads-max, the
 *     key quota, what the console shows, and what a panic does.
 *  3. The files survive a reboot, applied by systemd-sysctl as on a real
 *     machine, including the interface caveats the security file explains.
 *
 * Run with `npm run test:vm` (vm/README.md).
 */

import { readFileSync } from 'node:fs'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { VM } from './lib/vm.mjs'
import { IMAGES } from './lib/images.mjs'
import { PERF_OPEN, BPF_MAP, py } from './lib/probes.mjs'
import { loadProbes, readEvidence, runProbes, staleProbes } from './lib/probeKinds.mjs'
import { TUNER_DOMAINS } from '@/tuners/domains.js'
import { isEmitted } from '@/tuners/security/calculations.js'
import { kernelFileMax, kernelWatches } from '@/tuners/filesystem/calculations.js'
import { presetParams } from '@/core/createTunerStore.js'
import { valueTypeOf } from '@/core/valueTypes.js'
import { defaultTasksMax, kernelThreads } from '@/tuners/kernel/calculations.js'

const NOW = new Date('2026-01-01T00:00:00Z')
// Tuners whose output is sysctl.d files, and tmpfiles.d files for /sys.
const SYSCTL_TUNERS = TUNER_DOMAINS.filter((d) => ['swap', 'network', 'security', 'filesystem', 'hugepages', 'sysv-ipc', 'kernel'].includes(d.id))
const security = TUNER_DOMAINS.find((d) => d.id === 'security')
const filesystem = TUNER_DOMAINS.find((d) => d.id === 'filesystem')
const hugepages = TUNER_DOMAINS.find((d) => d.id === 'hugepages')
const ipc = TUNER_DOMAINS.find((d) => d.id === 'sysv-ipc')
const kernel = TUNER_DOMAINS.find((d) => d.id === 'kernel')
const blockIo = TUNER_DOMAINS.find((d) => d.id === 'block-io')
const swap = TUNER_DOMAINS.find((d) => d.id === 'swap')

// Fills 256 MiB, then reads it back in order: held to 64 MiB, most of it is
// swapped in. With FORK set a child keeps the pages mapped too, so they are shared.
const SWAP_HOG_PAGES = 65536
const SWAP_HOG = `import os, time
b = bytearray(256 * 1024 * 1024)
for i in range(0, len(b), 4096): b[i] = 1
if os.environ.get('FORK') and os.fork() == 0:
    time.sleep(120); os._exit(0)
print(sum(b[i] for i in range(0, len(b), 4096)))`

// Disks besides the virtio root disk, so each block I/O device class exists:
// an NVMe drive, and a SATA SSD and hard disk on the q35 AHCI controller.
const EXTRA_DISKS = ['nvme,serial=lt0001', 'ide-hd,bus=ide.1,rotation_rate=1', 'ide-hd,bus=ide.2,rotation_rate=7200']

/** `key = value` lines of a sysctl.d file, comments skipped. */
export function sysctlLines(content) {
  return content.split('\n')
    .map((l) => l.match(/^\s*([a-z0-9_.*-]+)\s*=\s*(.*?)\s*$/i))
    .filter(Boolean)
    .map((m) => ({ key: m[1], value: m[2].replace(/\s+/g, ' ') }))
}

/** `w <path> - - - - <value>` lines of a tmpfiles.d file. */
export function tmpfilesWrites(content) {
  return content.split('\n')
    .map((l) => l.match(/^w (\/sys\/\S+) - - - - (\S+)$/))
    .filter(Boolean)
    .map((m) => ({ path: m[1], value: m[2] }))
}

/**
 * Every workload's defaults and every preset, generated for this image.
 * `extra` sets more profile fields (the block I/O device class).
 */
function cases(domain, image, extra = {}) {
  const base = { ...domain.defaultHardware, ...image.profile[domain.id], ...extra }
  const out = []
  for (const workload of domain.workloads) {
    const hardware = { ...base, [domain.workloadField]: workload }
    const variants = [{ id: 'defaults', label: null, values: {} }, ...domain.presets]
    for (const v of variants) {
      // What the page gives after picking the preset on this profile.
      const params = presetParams(domain, hardware, v.values)
      const files = domain.generateConfig({ hardware, params, presetLabel: v.label, customised: false, now: NOW })
      out.push({ name: [domain.id, ...Object.values(extra), workload, v.id].join(' '), domain, hardware, params, files })
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

/**
 * Apply one file the way its apply instructions say: a sysctl.d file with
 * sysctl -p (errors are on stderr: procps 3.3 exits 0 anyway), a tmpfiles.d
 * file with systemd-tmpfiles --create.
 */
async function applyFile(vm, file) {
  await vm.writeFile(file.path, file.content)
  const cmd = file.path.startsWith('/etc/tmpfiles.d/') ? 'systemd-tmpfiles --create' : 'sysctl -p'
  const r = await vm.sudo(`${cmd} ${file.path}`, { check: false })
  return { code: r.code, errors: (r.stderr.trim() || (r.code ? `exit ${r.code}` : '')) }
}

/** Whole disks by block I/O device class, the way the tuner's rules match them. */
async function blockDevices(vm) {
  const { stdout } = await vm.run('for d in /sys/block/*; do echo "${d##*/} $(cat $d/queue/rotational)"; done')
  const devs = { nvme: [], ssd: [], hdd: [], virtio: [] }
  for (const [name, rot] of stdout.trim().split('\n').map((l) => l.split(' '))) {
    if (/^nvme\d+n\d+$/.test(name)) devs.nvme.push(name)
    else if (/^sd[a-z]+$/.test(name)) devs[rot === '0' ? 'ssd' : 'hdd'].push(name)
    else if (/^vd[a-z]+$/.test(name)) devs.virtio.push(name)
  }
  return devs
}

/**
 * Install a udev rules file and apply it the way the file says: reload,
 * trigger a change event, settle. Returns the "Failed to write" lines udev
 * logged for it.
 */
async function udevApply(vm, file) {
  const name = file.path.split('/').pop()
  const failures = async () => (await vm.sudo(`journalctl -b -u systemd-udevd -o cat --no-pager | grep "${name}.*Failed to write" || true`)).stdout.trim().split('\n').filter(Boolean)
  const before = await failures()
  await vm.writeFile(file.path, file.content)
  await vm.sudo('udevadm control --reload && udevadm trigger --action=change --subsystem-match=block && udevadm settle && sleep 1')
  return (await failures()).slice(before.length)
}

/** The rules' attribute writes that don't read back on every disk of the class. */
async function udevDiff(vm, file, device) {
  const writes = file.content.split('\n')
    .map((l) => l.match(/ATTR\{(queue\/\w+)\}="([^"]+)"$/))
    .filter(Boolean)
  const devs = (await blockDevices(vm))[device]
  const paths = devs.flatMap((d) => writes.map(([, attr]) => `/sys/block/${d}/${attr}`))
  const got = await vm.sysfs(paths)
  return devs.flatMap((d) => writes
    .filter(([, attr, value]) => got[`/sys/block/${d}/${attr}`] !== value)
    .map(([, attr, value]) => `${d} ${attr}: wrote ${value}, reads ${got[`/sys/block/${d}/${attr}`]}`))
}

/** The tmpfiles.d writes whose /sys file doesn't read back as written. */
async function sysfsDiff(vm, writes) {
  if (!writes.length) return []
  const got = await vm.sysfs(writes.map((w) => w.path))
  return writes.filter((w) => got[w.path] !== w.value).map((w) => `${w.path}: wrote ${w.value}, reads ${got[w.path]}`)
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
      await vm.start({ memory: 3072, disks: EXTRA_DISKS })
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
          if (def.type === 'enum') continue // user namespaces: below
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
        // The legacy profile spans 4.9 to 4.18 and only the part before 4.15
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

      it('blocked user namespaces stop everyone, root and PrivateUsers= services included', async () => {
        const def = security.defsByKey.user_namespaces
        const threads = Number(await vm.sysctl('kernel.threads-max'))
        expect(Number(await vm.sysctl(def.sysctlName))).toBe(Math.floor(threads / 2))
        for (const w of security.workloads) {
          expect(security.deriveDefaults({ ...hw, workload: w }).user_namespaces, w).toBe(w === 'server' || w === 'router' ? 'blocked' : 'allowed')
        }
        // Distro switches the description names.
        expect(await vm.sysctl('kernel.unprivileged_userns_clone') !== null).toBe(image.expect.usernsClone)
        expect(await vm.sysctl('kernel.apparmor_restrict_unprivileged_userns')).toBe(image.expect.apparmorUserns ? '1' : null)
        const asUser = (await vm.asUser('unshare -Ur id -u', { check: false })).code
        expect(asUser === 0, 'unprivileged unshare -Ur at the kernel limit').toBe(!image.expect.apparmorUserns)
        const unit = image.expect.privateUsersUnit
        if (unit) expect((await vm.sudo(`systemctl cat ${unit}`)).stdout).toMatch(/^PrivateUsers=yes$/m)

        const blocked = def.options.find((o) => o.value === 'blocked').sysctlValue
        expect(await vm.sysctlWrite(def.sysctlName, blocked)).toBe('')
        try {
          expect((await vm.asUser('unshare -U true', { check: false })).stderr).toMatch(/No space left on device/)
          expect((await vm.sudo('unshare -U true', { check: false })).stderr).toMatch(/No space left on device/)
          expect((await vm.sudo('systemd-run --wait -q -p PrivateUsers=yes /bin/true', { check: false })).code).not.toBe(0)
          if (unit) {
            const state = (await vm.sudo(`systemctl restart ${unit}; sleep 2; systemctl is-active ${unit}`, { check: false })).stdout.trim()
            expect(state, unit).toBe('failed')
          }
        } finally {
          await vm.sysctlWrite(def.sysctlName, threads >> 1)
          if (unit) await vm.sudo(`systemctl stop ${unit}; systemctl reset-failed ${unit}`, { check: false })
        }
        if (image.expect.usernsClone) {
          // 0 stops only unprivileged users; root and PrivateUsers= still work.
          expect(await vm.sysctlWrite('kernel.unprivileged_userns_clone', 0)).toBe('')
          try {
            expect((await vm.asUser('unshare -U true', { check: false })).stderr).toMatch(/Operation not permitted/)
            expect((await vm.sudo('unshare -U true', { check: false })).code).toBe(0)
            expect((await vm.sudo('systemd-run --wait -q -p PrivateUsers=yes /bin/true', { check: false })).code).toBe(0)
          } finally {
            await vm.sysctlWrite('kernel.unprivileged_userns_clone', 1)
          }
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

    describe('swap claims on a fresh boot', () => {
      const pageCluster = swap.defsByKey.page_cluster
      const vmstat = async () => Object.fromEntries((await vm.run("grep -E '^(swap_ra|pswpin) ' /proc/vmstat")).stdout.trim().split('\n').map((l) => l.split(' ')).map(([k, v]) => [k, Number(v)]))
      /** Swap-ins and how many of them came through readahead, for one run of the hog. */
      async function swapIn(order, { shared = false } = {}) {
        await vm.sysctlWrite('vm.page-cluster', order)
        const before = await vmstat()
        // MemoryHigh reclaims without the OOM kill a hard limit sometimes gave on
        // 5.10; systemd 237 (cgroup v1) only has MemoryLimit.
        const limit = image.profile.systemd?.cgroupVersion === 'v1' ? 'MemoryLimit' : 'MemoryHigh'
        const r = await vm.sudo(`systemd-run --quiet --wait -p ${limit}=64M ${shared ? '-E FORK=1 ' : ''}python3 /tmp/swap-hog.py`, { check: false })
        if (r.code) throw new Error(`the hog exited ${r.code}: ${(await vm.sudo('dmesg | tail -5')).stdout}`)
        const after = await vmstat()
        return { swapIns: after.pswpin - before.pswpin, readahead: after.swap_ra - before.swap_ra }
      }
      let active

      beforeAll(async () => {
        await vm.writeFile('/tmp/swap-hog.py', SWAP_HOG)
        active = (await vm.sudo('swapon --show=NAME --noheadings')).stdout.trim().split('\n').filter(Boolean)
        expect(active.some((d) => d.includes('zram'))).toBe(Boolean(image.expect.zramSwap))
      })
      afterAll(async () => {
        await vm.sudo('swapoff /swapfile-lt; rm -f /swapfile-lt', { check: false })
        expect((await vm.sudo('swapon --show=NAME --noheadings')).stdout.trim().split('\n').filter(Boolean)).toEqual(active)
        await vm.sysctlWrite('vm.page-cluster', pageCluster.kernelDefault)
      })

      it('vm.page-cluster starts at the kernel default, and every bound is accepted', async () => {
        expect(await vm.sysctl('vm.page-cluster')).toBe(String(pageCluster.kernelDefault))
        for (const v of [pageCluster.kernelMax, pageCluster.kernelMin]) expect(await vm.sysctlWrite('vm.page-cluster', v)).toBe('')
      })

      // The image's own swap stays on (systemd swaps a zram unit back on after a
      // swapoff); the test device takes the top priority, so it is used first.
      it('on a swap file it reads ahead at the default and not at 0', async () => {
        // btrfs refuses a fallocated swap file; mkswapfile makes it no-copy-on-write.
        await vm.sudo('if [ "$(stat -f -c %T /)" = btrfs ]; then btrfs filesystem mkswapfile --size 1g /swapfile-lt >/dev/null; else fallocate -l 1G /swapfile-lt && chmod 600 /swapfile-lt && mkswap /swapfile-lt >/dev/null; fi && swapon -p 32767 /swapfile-lt')
        try {
          const on = await swapIn(pageCluster.kernelDefault)
          expect(on.swapIns).toBeGreaterThan(10000)
          // Kernels before 6.x count pswpin and swap_ra about twice per page.
          expect(on.readahead).toBeGreaterThan(SWAP_HOG_PAGES / 4)
          expect((await swapIn(0)).readahead).toBe(0)
        } finally {
          await vm.sudo('swapoff /swapfile-lt')
        }
      })

      it.runIf(image.expect.zram)('on zram it reads ahead only for shared pages, and not at all at 0', async () => {
        // Use the image's zram swap where it has one, else set one up.
        const own = !active.includes('/dev/zram0')
        if (own) await vm.sudo('modprobe zram && echo 1G > /sys/block/zram0/disksize && mkswap /dev/zram0 >/dev/null && swapon -p 32767 /dev/zram0')
        try {
          const single = await swapIn(pageCluster.kernelDefault)
          expect(single.swapIns).toBeGreaterThan(10000)
          expect(single.readahead).toBe(0)
          const shared = await swapIn(pageCluster.kernelDefault, { shared: true })
          expect(shared.readahead).toBeGreaterThan(SWAP_HOG_PAGES / 4)
          expect((await swapIn(0, { shared: true })).readahead).toBe(0)
        } finally {
          if (own) await vm.sudo('swapoff /dev/zram0')
        }
      })

      it.runIf(!image.expect.zram)('the cloud kernel has no zram module, so the zram check is skipped for a reason', async () => {
        expect((await vm.sudo('modprobe zram', { check: false })).code).not.toBe(0)
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

    describe('huge pages claims on a fresh boot', () => {
      const hw = { ...hugepages.defaultHardware, ...image.profile.hugepages }
      const THP = '/sys/kernel/mm/transparent_hugepage'
      const filesFor = (values = {}) => hugepages.generateConfig({ hardware: hw, params: { ...hugepages.deriveDefaults(hw), ...values }, presetLabel: null, now: NOW })
      const def = (k) => hugepages.defsByKey[k]

      it('THP and the map count start where the drawer and notes say', async () => {
        const got = await vm.sysfs([`${THP}/enabled`, `${THP}/defrag`])
        expect(got[`${THP}/enabled`]).toBe(image.expect.thp)
        expect(got[`${THP}/defrag`]).toBe(def('thp_defrag').kernelDefault)
        expect(await vm.sysctl('vm.max_map_count')).toBe(String(image.expect.mapCount))
        const notes = filesFor({ max_map_count: 65530 })[0].content
        expect(notes).toContain(image.expect.thp === 'always' ? 'Debian kernels start transparent_hugepage/enabled at always' : 'Ubuntu and')
        if (image.expect.mapCount > 65530) expect(def('max_map_count').kernelDefaultNote).toContain(String(image.expect.mapCount))
      })

      it('every THP option and KSM bound the tuner offers is set by its tmpfiles.d line', async () => {
        const path = '/etc/tmpfiles.d/99-hugepages-tuning.conf'
        const before = await vm.sysfs([`${THP}/enabled`, `${THP}/defrag`])
        const failed = []
        const sets = [
          ...def('thp_enabled').options.map((o) => ({ thp_enabled: o.value })),
          ...def('thp_defrag').options.map((o) => ({ thp_defrag: o.value })),
          ...['kernelMin', 'kernelMax'].map((b) => ({ ksm_run: 1, ksm_pages_to_scan: def('ksm_pages_to_scan')[b], ksm_sleep_millisecs: def('ksm_sleep_millisecs')[b] })),
        ]
        for (const values of sets) {
          const file = filesFor(values)[1]
          expect(file.path).toBe(path)
          const { errors } = await applyFile(vm, file)
          if (errors) failed.push(`${JSON.stringify(values)}: ${errors}`)
          failed.push(...await sysfsDiff(vm, tmpfilesWrites(file.content)))
        }
        await vm.sudo(`rm -f ${path} && echo ${before[`${THP}/enabled`]} > ${THP}/enabled && echo ${before[`${THP}/defrag`]} > ${THP}/defrag && echo 0 > /sys/kernel/mm/ksm/run`)
        expect(failed).toEqual([])
      })

      it('a tmpfiles.d line for a /sys file the kernel lacks is skipped, as the file says', async () => {
        expect(filesFor()[1].content).toContain('A path the kernel lacks is skipped')
        await vm.writeFile('/etc/tmpfiles.d/98-vmtest-missing.conf', 'w /sys/kernel/mm/vmtest_missing - - - - 1')
        const r = await vm.sudo('systemd-tmpfiles --create /etc/tmpfiles.d/98-vmtest-missing.conf', { check: false })
        await vm.sudo('rm -f /etc/tmpfiles.d/98-vmtest-missing.conf')
        expect(r.code).toBe(0)
      })

      it('the map count bounds are accepted, and a pool is reserved as asked', async () => {
        const rejected = []
        for (const v of [def('max_map_count').kernelMax, def('max_map_count').kernelMin]) {
          const err = await vm.sysctlWrite('vm.max_map_count', v)
          if (err) rejected.push(`vm.max_map_count=${v}: ${err}`)
        }
        await vm.sysctlWrite('vm.max_map_count', image.expect.mapCount)
        // 128 MiB on a fresh VM: the kernel finds every page.
        for (const k of ['vm.nr_hugepages', 'vm.nr_overcommit_hugepages']) {
          const err = await vm.sysctlWrite(k, 64)
          if (err) rejected.push(`${k}=64: ${err}`)
        }
        const total = (await vm.run("awk '/HugePages_Total/ {print $2}' /proc/meminfo")).stdout.trim()
        for (const k of ['vm.nr_hugepages', 'vm.nr_overcommit_hugepages']) await vm.sysctlWrite(k, 0)
        expect(rejected).toEqual([])
        expect(total).toBe('64')
      })
    })

    describe('System V IPC claims on a fresh boot', () => {
      const defs = ipc.parameterKeys.map((k) => ipc.defsByKey[k])
      const text = (v) => [v].flat().join(' ')
      const keys = defs.map((d) => d.sysctlName)

      it('every key starts at the kernel default, and shmmax and shmall at no limit', async () => {
        const got = await vm.sysctls([...keys, 'kernel.shmmax', 'kernel.shmall'])
        expect(got['kernel.shmmax']).toBe('18446744073692774399')
        expect(got['kernel.shmall']).toBe('18446744073692774399')
        for (const d of defs) expect(got[d.sysctlName], d.sysctlName).toBe(text(d.kernelDefault))
        const notes = ipc.generateConfig({ hardware: ipc.defaultHardware, params: ipc.deriveDefaults(ipc.defaultHardware), presetLabel: null, now: NOW })[0].content
        expect(notes).toContain('default to 18446744073692774399, no limit')
      })

      it('every bound the tuner offers is accepted', async () => {
        const rejected = []
        for (const d of defs) {
          const ends = d.elementLimits
            ? [d.elementLimits.map((r) => r.max), d.elementLimits.map((r) => r.min)]
            : [d.kernelMax, d.kernelMin]
          for (const v of ends) {
            const err = await vm.sysctlWrite(d.sysctlName, text(v))
            if (err) rejected.push(`${d.sysctlName}=${text(v)}: ${err}`)
          }
          await vm.sysctlWrite(d.sysctlName, text(d.kernelDefault))
        }
        expect(rejected).toEqual([])
      })

      it('a new IPC namespace starts at the kernel defaults, not the host values, as the notes say', async () => {
        const raised = ipc.presetsById['most-ids'].values
        await vm.sysctlWrite('kernel.shmmni', raised.shmmni)
        await vm.sysctlWrite('kernel.msgmnb', 65536)
        const r = await vm.sudo(`unshare -i sysctl -n ${keys.join(' ')}`)
        for (const d of defs) {
          await vm.sysctlWrite(d.sysctlName, text(d.kernelDefault))
        }
        expect(r.stdout.trim().split('\n').map((l) => l.trim().replace(/\s+/g, ' '))).toEqual(defs.map((d) => text(d.kernelDefault)))
        expect(ipc.validate({ ...ipc.defaultHardware, workload: 'container' }, ipc.deriveDefaults(ipc.defaultHardware)).map((i) => i.id)).toContain('ipc-namespace')
      })

      it('shm_rmid_forced removes a segment its creator left behind, and a semaphore array above SEMMSL fails', async () => {
        expect(Object.values(ipc.defsByKey.shm_rmid_forced.longDesc).flat().join(' ')).toContain('the process that created it has exited')
        const count = async () => Number((await vm.sudo('ipcs -m | grep -c "^0x" || true')).stdout.trim())
        await vm.sudo('ipcrm -a')
        await vm.sudo('ipcmk -M 4096')
        const kept = await count()
        await vm.sysctlWrite('kernel.shm_rmid_forced', 1)
        const r = await vm.sudo('ipcmk -M 4096 >/dev/null; ipcs -m | grep -c "^0x" || true')
        await vm.sysctlWrite('kernel.shm_rmid_forced', 0)
        await vm.sudo('ipcrm -a')
        expect(kept).toBe(1)
        expect(Number(r.stdout.trim())).toBe(0)
        await vm.sysctlWrite('kernel.sem', '10 1024000000 500 32000')
        const over = await vm.sudo('ipcmk -S 11', { check: false })
        await vm.sysctlWrite('kernel.sem', text(ipc.defsByKey.sem.kernelDefault))
        expect(over.code).not.toBe(0)
      })
    })

    describe('kernel claims on a fresh boot', () => {
      const hw = { ...kernel.defaultHardware, ...image.profile.kernel, ramGiB: 3 }
      const defs = kernel.parameterKeys.map((k) => kernel.defsByKey[k])
      const consoleLog = () => readFileSync(vm.console.replace(/\.log$/, `-${vm.boots}.log`), 'utf8')

      it('pid_max, threads-max, the key quotas, SysRq and the console start where the defs say', async () => {
        const got = await vm.sysctls(defs.map((d) => d.sysctlName))
        expect(got['kernel.pid_max'] === '4194304').toBe(hw.systemd === 'modern')
        // The kernel counts RAM before freeing its boot memory: a little under the estimate.
        const threads = Number(got['kernel.threads-max'])
        expect(threads).toBeLessThanOrEqual(kernelThreads(hw))
        expect(threads).toBeGreaterThan(kernelThreads(hw) * 0.9)
        for (const k of ['maxkeys', 'maxbytes', 'panic', 'panic_on_oops', 'softlockup_panic']) {
          expect(got[kernel.defsByKey[k].sysctlName], k).toBe(String(kernel.defsByKey[k].kernelDefault))
        }
        expect(got['kernel.sysrq']).toBe(image.expect.sysrq)
        expect(got['kernel.printk']).toBe(`${image.expect.console} 4 1 7`)
        // The drawer names this distribution's starting value.
        const note = kernel.defsByKey.sysrq.kernelDefaultNote
        expect(note).toContain(image.expect.sysrq)
      })

      it('every bound and option the tuner offers is accepted', async () => {
        const before = await vm.sysctls(defs.map((d) => d.sysctlName))
        const rejected = []
        const write = async (name, v) => {
          const err = await vm.sysctlWrite(name, v)
          if (err) rejected.push(`${name}=${v}: ${err}`)
        }
        for (const d of defs) {
          const range = kernel.rangeFor(d.key, hw)
          if (d.type === 'enum') for (const o of d.options) await write(d.sysctlName, valueTypeOf(d).format(o.value, d))
          else if (d.type === 'tuple') for (const end of ['max', 'min']) await write(d.sysctlName, range.elements.map((r) => r[end]).join(' '))
          // threads-max only upwards: below the running threads nothing forks.
          else for (const v of [range.max, range.min]) await write(d.sysctlName, v)
          await vm.sysctlWrite(d.sysctlName, before[d.sysctlName])
        }
        expect(rejected).toEqual([])
      })

      it('systemd derives DefaultTasksMax from threads-max, as the note says', async () => {
        const before = await vm.sysctl('kernel.threads-max')
        const params = { ...kernel.deriveDefaults(hw), pid_max: Number(await vm.sysctl('kernel.pid_max')), threads_max: 200704 }
        await vm.sysctlWrite('kernel.threads-max', params.threads_max)
        await vm.sudo('systemctl daemon-reexec')
        const got = (await vm.run('systemctl show -p DefaultTasksMax --value')).stdout.trim()
        await vm.sysctlWrite('kernel.threads-max', before)
        await vm.sudo('systemctl daemon-reexec')
        expect(got).toBe(String(defaultTasksMax({ ...hw, systemd: 'older' }, params)))
      })

      it("the systemd tuner's task caps start at systemd's own DefaultTasksMax", async () => {
        const systemd = TUNER_DOMAINS.find((d) => d.id === 'systemd')
        const sdHw = { ...systemd.defaultHardware, ...image.profile.systemd, ramGiB: hw.ramGiB, pidMax: Number(await vm.sysctl('kernel.pid_max')) }
        const want = systemd.deriveDefaults(sdHw).default_tasks_max
        const got = Number((await vm.run('systemctl show -p DefaultTasksMax --value')).stdout.trim())
        // threads-max is a little under the RAM estimate, as above.
        expect(got).toBeLessThanOrEqual(want)
        expect(got).toBeGreaterThan(want * 0.9)
      })

      it('a non-root user is held to kernel.keys.maxkeys', async () => {
        const KEYS = String.raw`
import ctypes, errno
libc = ctypes.CDLL(None, use_errno=True)
libc.syscall(250, 7, -4)
n = 0
while n < 10000:
    if libc.syscall(248, b"user", ("k%d" % n).encode(), b"x", 1, -4) < 0:
        print(n, errno.errorcode[ctypes.get_errno()]); break
    n += 1
libc.syscall(250, 7, -4)
`
        const at = async () => (await vm.asUser(py(KEYS))).stdout.trim().split(' ')
        const [low, err] = await at()
        await vm.sysctlWrite('kernel.keys.maxkeys', 2000)
        await vm.sysctlWrite('kernel.keys.maxbytes', 2000000)
        const [high] = await at()
        await vm.sysctlWrite('kernel.keys.maxkeys', 200)
        await vm.sysctlWrite('kernel.keys.maxbytes', 20000)
        expect(err).toBe('EDQUOT')
        expect(Number(low)).toBeGreaterThan(190)
        expect(Number(low)).toBeLessThan(200)
        expect(Number(high)).toBeGreaterThan(1990)
      })

      it('the console loglevel filters the console only, and root reaches SysRq at 0', async () => {
        const before = await vm.sysctls(['kernel.printk', 'kernel.sysrq'])
        const tag = `vmtest-${Date.now()}`
        await vm.sysctlWrite('kernel.printk', '4 4 1 7')
        await vm.sudo(`echo "<6>${tag}-info" > /dev/kmsg; echo "<3>${tag}-err" > /dev/kmsg`)
        await vm.sysctlWrite('kernel.sysrq', 0)
        await vm.sudo('echo h > /proc/sysrq-trigger')
        const dmesg = (await vm.sudo('dmesg')).stdout
        await vm.sysctlWrite('kernel.printk', before['kernel.printk'])
        await vm.sysctlWrite('kernel.sysrq', before['kernel.sysrq'])
        await vm.sudo('sync; sleep 1')
        const shown = consoleLog()
        expect(shown).toContain(`${tag}-err`)
        expect(shown).not.toContain(`${tag}-info`)
        expect(dmesg).toContain(`${tag}-info`)
        expect(dmesg).toMatch(/sysrq: HELP/)
        expect(kernel.generateConfig({ hardware: hw, params: kernel.deriveDefaults(hw), now: NOW })[0].content).toContain('root can\n# trigger every function through /proc/sysrq-trigger')
      })

      it('a panic reboots after kernel.panic seconds, and stays down at 0', async () => {
        const crash = async (seconds) => {
          await vm.sysctlWrite('kernel.panic', seconds)
          vm.run('sudo sh -c "sleep 1; echo c > /proc/sysrq-trigger"', { check: false, timeoutMs: 15_000 })
          const t0 = Date.now()
          const r = await Promise.race([vm.exited.then(() => 'rebooted'), new Promise((res) => setTimeout(() => res('down'), 30_000))])
          if (r === 'down') {
            vm.proc.kill()
            await vm.exited
          }
          const log = consoleLog()
          await vm.launch()
          return { r, s: (Date.now() - t0) / 1000, log }
        }
        const reboot = await crash(3)
        expect(reboot.r).toBe('rebooted')
        expect(reboot.log).toContain('Rebooting in 3 seconds')
        const stay = await crash(0)
        expect(stay.r).toBe('down')
        expect(stay.log).toContain('Kernel panic')
        expect(stay.log).not.toContain('Rebooting in')
      })
    })

    describe.runIf(image.profile['block-io'])('block I/O claims and rules', () => {
      const hw = { ...blockIo.defaultHardware, ...image.profile['block-io'] }
      const sys = (dev, attr) => `/sys/block/${dev}/queue/${attr}`

      it('each kind of disk starts with the read-ahead the drawer says, and the lsblk check works', async () => {
        const devs = await blockDevices(vm)
        expect(Object.keys(devs).filter((k) => devs[k].length).sort()).toEqual([...image.expect.disks].sort())
        for (const device of image.expect.disks) {
          const ra = (await vm.sysfs([sys(devs[device][0], 'read_ahead_kb')]))[sys(devs[device][0], 'read_ahead_kb')]
          expect(ra, device).toBe(image.expect.readAhead[device] ?? '128')
        }
        const r = await vm.run('lsblk -d -o NAME,ROTA,SCHED,RQ-SIZE,RA', { check: false })
        expect(r.code, r.stderr).toBe(0)
      })

      it('every scheduler and bound the tuner offers is accepted on every kind of disk', async () => {
        const devs = await blockDevices(vm)
        const rejected = []
        const write = async (dev, attr, v) => {
          const r = await vm.sudo(`echo ${v} > ${sys(dev, attr)}`, { check: false })
          if (r.code) rejected.push(`${dev} ${attr}=${v}: ${r.stderr.trim()}`)
        }
        for (const device of image.expect.disks) {
          const dev = devs[device][0]
          const before = (await vm.sysfs([sys(dev, 'scheduler')]))[sys(dev, 'scheduler')]
          for (const s of blockIo.rangeFor('scheduler', hw).options) await write(dev, 'scheduler', s)
          await write(dev, 'scheduler', 'mq-deadline')
          const { max } = blockIo.rangeFor('nr_requests', hw)
          for (const v of [4, max]) await write(dev, 'nr_requests', v)
          // One past the top is refused: the range ends where the kernel does.
          expect((await vm.sudo(`echo ${max + 4} > ${sys(dev, 'nr_requests')}`, { check: false })).code, dev).not.toBe(0)
          for (const v of [0, blockIo.rangeFor('read_ahead_kb', hw).max, 128]) await write(dev, 'read_ahead_kb', v)
          for (const v of [1, 2, 0]) await write(dev, 'nomerges', v)
          await write(dev, 'scheduler', before)
        }
        // The kernel lacks the schedulers the profile leaves out.
        if (hw.schedulers === 'basic') {
          expect((await vm.sudo(`echo bfq > ${sys(devs.nvme[0], 'scheduler')}`, { check: false })).code).not.toBe(0)
        }
        expect(rejected).toEqual([])
      })

      it('rotational set at runtime leaves the writeback throttling target as it was, as the card says', async () => {
        const dev = (await blockDevices(vm)).virtio.at(-1)
        const read = async () => vm.sysfs([sys(dev, 'rotational'), sys(dev, 'wbt_lat_usec')])
        const before = await read()
        await vm.sudo(`echo 0 > ${sys(dev, 'rotational')}`)
        const after = await read()
        await vm.sudo(`echo 1 > ${sys(dev, 'rotational')}`)
        expect(after[sys(dev, 'rotational')]).toBe('0')
        expect(before[sys(dev, 'wbt_lat_usec')]).toBe('75000')
        expect(after[sys(dev, 'wbt_lat_usec')]).toBe('75000')
      })

      const all = image.profile['block-io'] ? image.expect.disks.flatMap((device) => cases(blockIo, image, { device })) : []
      for (const c of all) {
        it(c.name, async () => {
          const [file] = c.files
          expect(await udevApply(vm, file)).toEqual([])
          expect(await udevDiff(vm, file, c.hardware.device)).toEqual([])
          await vm.sudo(`rm -f ${file.path}`)
        })
      }
    })

    describe('every generated sysctl file applies and reads back', () => {
      const all = SYSCTL_TUNERS.flatMap((d) => cases(d, image))
        .map((c) => ({ ...c, lines: c.files.flatMap((f) => sysctlLines(f.content)), writes: c.files.flatMap((f) => tmpfilesWrites(f.content)) }))
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
            expect(f.path).toMatch(/^\/etc\/(sysctl|tmpfiles)\.d\/[a-z0-9-]+\.conf$/)
            const { errors } = await applyFile(vm, f)
            expect(errors, f.path).toBe('')
            await vm.sudo(`rm -f ${f.path}`)
          }
          const l = locks(c.lines)
          state = { ptrace3: state.ptrace3 || l.ptrace3, bpf1: state.bpf1 || l.bpf1 }
          const got = await vm.sysctls(c.lines.map((x) => x.key))
          const diff = c.lines.filter((x) => got[x.key] !== x.value).map((x) => `${x.key}: wrote ${x.value}, reads ${got[x.key]}`)
          // Don't run the rest of the suite with the panic switches on: under
          // load (five VMs on one host) a guest can report a soft lockup, and
          // softlockup_panic then reboots it mid-test.
          if (c.domain.id === 'kernel') {
            for (const k of ['kernel.softlockup_panic', 'kernel.panic_on_oops', 'kernel.panic']) await vm.sysctlWrite(k, 0)
          }
          expect([...diff, ...await sysfsDiff(vm, c.writes)]).toEqual([])
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
        // A VM host with a small pool, so the pool and KSM lines are in it.
        (() => {
          const hardware = { ...hugepages.defaultHardware, ...image.profile.hugepages, workload: 'vm-host' }
          const params = { ...hugepages.deriveDefaults(hardware), nr_hugepages: 64 }
          return { hardware, params, files: hugepages.generateConfig({ hardware, params, presetLabel: null, now: NOW }) }
        })(),
        pick(ipc, 'db2'),
        pick(kernel, 'server'),
      ]
      const lines = installed.flatMap((c) => c.files.flatMap((f) => sysctlLines(f.content)))
      const writes = installed.flatMap((c) => c.files.flatMap((f) => tmpfilesWrites(f.content)))
      const securityFile = installed[2].files[0]
      // One rules file per kind of disk: SATA on a desktop (BFQ, loaded at
      // boot where it is a module), NVMe and virtio streaming (read-ahead).
      const blockFiles = (image.profile['block-io'] ? image.expect.disks : []).map((device) => {
        const workload = device === 'ssd' || device === 'hdd' ? 'desktop' : 'streaming'
        return { device, file: cases(blockIo, image, { device }).find((c) => c.hardware.workload === workload && c.name.endsWith(' defaults')).files[0] }
      })

      it('every key of the swap, network, security, filesystem, huge pages, IPC and kernel defaults is set at boot', async () => {
        await vm.reboot()
        for (const c of installed) for (const f of c.files) await vm.writeFile(f.path, f.content)
        for (const { file } of blockFiles) await vm.writeFile(file.path, file.content)
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
        // THP at madvise: khugepaged raises min_free_kbytes to its floor
        // after the sysctl files, as the huge pages file says. Only upwards.
        const minFree = lines.find((x) => x.key === 'vm.min_free_kbytes')
        if (minFree && Number(got['vm.min_free_kbytes']) > Number(minFree.value)) {
          expect(installed[4].files[0].content).toContain('makes khugepaged raise vm.min_free_kbytes')
          allowed['vm.min_free_kbytes'] = got['vm.min_free_kbytes']
        }
        const diff = lines
          .filter((x) => got[x.key] !== x.value && got[x.key] !== allowed[x.key])
          .map((x) => `${x.key}: wrote ${x.value}, reads ${got[x.key]}`)
        expect(diff).toEqual([])
        const log = (await vm.sudo('journalctl -b -u systemd-sysctl --no-pager -o cat', { check: false })).stdout
        expect(log).not.toMatch(/Couldn't write|Failed to write|Invalid argument|not found|Permission denied/i)
        // systemd-tmpfiles wrote the /sys values at boot, and without an error.
        expect(await sysfsDiff(vm, writes)).toEqual([])
        expect((await vm.sudo('systemctl is-failed systemd-tmpfiles-setup.service', { check: false })).stdout.trim()).toBe('active')
        expect((await vm.run('awk \'/HugePages_Total/ {print $2}\' /proc/meminfo')).stdout.trim()).toBe('64')
      })

      it.runIf(image.profile['block-io'])('every block I/O rule applies at boot, without a failed write', async () => {
        for (const { device, file } of blockFiles) expect(await udevDiff(vm, file, device), device).toEqual([])
        const log = (await vm.sudo('journalctl -b -u systemd-udevd -o cat --no-pager', { check: false })).stdout
        expect(log.split('\n').filter((l) => l.includes('99-block-tuning') && l.includes('Failed to write'))).toEqual([])
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

    // Last, so the probes run on the same VM: the learning pages' evidence
    // (npm run vm:capture) still holds on this kernel. Values the suite's
    // writes change compare by shape only (probeKinds.mjs `compare`).
    describe('learn evidence is fresh', () => {
      it('every guide probe reads as captured, on the same kernel', async () => {
        const probes = await loadProbes()
        if (!Object.keys(probes).length) return
        const evidence = readEvidence(id)
        expect(evidence, `${id}: no src/learn/evidence/${id}.json; run npm run vm:capture ${id}`).not.toBeNull()
        const kernel = (await vm.run('uname -r')).stdout.trim()
        expect(kernel, `${id}: evidence is from ${evidence.kernel}; run npm run vm:capture ${id}`).toBe(evidence.kernel)
        const stale = staleProbes(probes, evidence.probes, await runProbes(vm, probes))
        expect(stale.map((s) => `${s} on ${id}`)).toEqual([])
      })
    })
  })
}
