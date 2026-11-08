// Fixture for loadProbes() in scripts/vm-probe-kinds.test.js: every probe here is refused.
export const PROBES = {
  'other.minFree': { kind: 'sysctl', name: 'vm.min_free_kbytes' },
  'demo.shell': { kind: 'sysctl', name: 'vm.x; reboot' },
  'demo.shadow': { kind: 'file', path: '/etc/shadow', exists: true },
  'demo.escape': { kind: 'sysfs', path: '/sys/../etc/shadow' },
  'demo.cmd': { kind: 'shell', command: 'reboot' },
  'demo.extra': { kind: 'zoneinfo', command: 'reboot' },
}
