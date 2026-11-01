// One-off: print the ground truth each image starts from. node vm/explore.mjs <image>
import { VM } from './lib/vm.mjs'
import { PERF_OPEN, BPF_MAP, py } from './lib/probes.mjs'

const vm = new VM(process.argv[2])
const out = []
const log = (k, v) => out.push(`${k.padEnd(44)} ${v}`)
const s = async (cmd) => { const r = await vm.sudo(cmd, { check: false }); return `[${r.code}] ${(r.stdout + r.stderr).trim().replace(/\s+/g, ' ')}` }
try {
  await vm.start()
  log('uname', (await vm.run('uname -r')).stdout.trim())
  const nic = (await vm.run("ip -o route show default | awk '{print $5}'")).stdout.trim()
  log('nic', nic)
  for (const k of [
    'kernel.kptr_restrict', 'kernel.dmesg_restrict', 'kernel.perf_event_paranoid', 'kernel.yama.ptrace_scope',
    'kernel.randomize_va_space', 'kernel.unprivileged_bpf_disabled', 'net.core.bpf_jit_harden',
    'net.ipv4.conf.all.rp_filter', 'net.ipv4.conf.default.rp_filter', `net.ipv4.conf.${nic}.rp_filter`, 'net.ipv4.conf.lo.rp_filter',
    'net.ipv4.conf.all.accept_redirects', 'net.ipv4.conf.default.accept_redirects', `net.ipv4.conf.${nic}.accept_redirects`,
    'net.ipv4.conf.all.send_redirects', `net.ipv4.conf.${nic}.send_redirects`,
    'net.ipv4.conf.all.accept_source_route', `net.ipv4.conf.${nic}.accept_source_route`,
    'net.ipv6.conf.all.accept_redirects', 'net.ipv6.conf.default.accept_redirects', `net.ipv6.conf.${nic}.accept_redirects`,
    'net.ipv4.tcp_syncookies', 'fs.protected_symlinks', 'fs.protected_hardlinks', 'fs.protected_fifos', 'fs.protected_regular',
    'fs.suid_dumpable', 'kernel.core_pattern', 'net.ipv4.tcp_congestion_control', 'net.core.default_qdisc',
  ]) log(k, await vm.sysctl(k))
  log('sysctl.d files', (await vm.run('ls /usr/lib/sysctl.d /etc/sysctl.d /run/sysctl.d 2>/dev/null | tr "\\n" " "', { check: false })).stdout)
  log('rp_filter set by', (await vm.run('grep -rn "rp_filter\\|protected_\\|accept_redirects\\|ptrace\\|kptr\\|perf_event\\|bpf" /usr/lib/sysctl.d /etc/sysctl.d /etc/sysctl.conf 2>/dev/null | grep -v ":\\s*#" | tr "\\n" "|"', { check: false })).stdout)
  log('alice perf user-only', (await vm.asUser(py(PERF_OPEN, 1), { check: false })).stdout.trim())
  log('alice perf with kernel', (await vm.asUser(py(PERF_OPEN, 0), { check: false })).stdout.trim())
  log('alice bpf map', (await vm.asUser(py(BPF_MAP), { check: false })).stdout.trim())
  for (const v of [2, 3, 4, 5, -1, 1000]) {
    log(`write perf ${v}`, await s(`sysctl -w kernel.perf_event_paranoid=${v}`))
    log(`  alice perf user-only @${v}`, (await vm.asUser(py(PERF_OPEN, 1), { check: false })).stdout.trim())
  }
  await vm.sudo('sysctl -w kernel.perf_event_paranoid=2')
  log('glob via sysctl -p', await s("printf 'net.ipv4.conf.*.rp_filter = 1\\n' > /tmp/g.conf; sysctl -p /tmp/g.conf"))
  log('  after: iface rp_filter', await vm.sysctl(`net.ipv4.conf.${nic}.rp_filter`))
  log('kptr0: netlink as alice', await s('sysctl -w kernel.kptr_restrict=0 >/dev/null; sudo -u alice head -2 /proc/net/netlink | tail -1'))
  log('kptr0 perf2: kallsyms', await s('sysctl -w kernel.perf_event_paranoid=2 >/dev/null; sudo -u alice grep -m1 " T _text\\| T startup_64" /proc/kallsyms'))
  log('kptr0 perf1: kallsyms', await s('sysctl -w kernel.perf_event_paranoid=1 >/dev/null; sudo -u alice grep -m1 " T _text\\| T startup_64" /proc/kallsyms'))
  log('bpf write 2', await s('sysctl -w kernel.unprivileged_bpf_disabled=2'))
  log('bpf write 0', await s('sysctl -w kernel.unprivileged_bpf_disabled=0'))
  log('  alice bpf map @now', `${await vm.sysctl('kernel.unprivileged_bpf_disabled')} ${(await vm.asUser(py(BPF_MAP), { check: false })).stdout.trim()}`)
  log('bpf write 1', await s('sysctl -w kernel.unprivileged_bpf_disabled=1'))
  log('bpf write 0 after 1', await s('sysctl -w kernel.unprivileged_bpf_disabled=0'))
  log('bpf write 2 after 1', await s('sysctl -w kernel.unprivileged_bpf_disabled=2'))
  log('ptrace write 3', await s('sysctl -w kernel.yama.ptrace_scope=3'))
  log('ptrace write 1 after 3', await s('sysctl -w kernel.yama.ptrace_scope=1'))
  log('fifos write 2', await s('sysctl -w fs.protected_fifos=2'))
} catch (e) {
  out.push(`ERROR ${e.message}`)
} finally {
  await vm.stop()
  console.log(`##### ${process.argv[2]}\n${out.join('\n')}`)
}
