/**
 * The distro images the VM tests boot. Each one is there for a kernel or
 * userspace behaviour the tuners depend on.
 *
 * `profile` maps the image onto each tuner's profile fields, the way a user of
 * that machine would fill in the form. `expect` holds what the image was
 * observed to do, for the assertions that are about the distribution rather
 * than the tuner (vm/README.md says how these were found).
 */

export const IMAGES = {
  'debian-13': {
    file: 'debian-13.qcow2',
    url: 'https://cloud.debian.org/images/cloud/trixie/latest/debian-13-genericcloud-amd64.qcow2',
    why: 'Debian kernel 6.12 (Debian perf patch), procps 4, systemd 257',
    profile: { security: { kernel: 'current' }, swap: { kernelVersion: '6.12' }, filesystem: { systemd: 'modern' } },
    // perfBlocksAt: lowest perf_event_paranoid at which a user can't open
    // perf events on their own process; null when no value blocks it.
    // procpsGlobs / systemdGlobs: whether sysctl -p and systemd-sysctl
    // (245+) expand conf.* globs. networkManager: it resets each interface's
    // rp_filter to 2. apport: it resets fs.suid_dumpable to 2 at start.
    // conntrackIpv4: the TCP conntrack keys need nf_conntrack_ipv4 (< 4.19).
    // stricter: keys a distro file sets to a stricter value after ours.
    // nrOpen: fs.nr_open at boot. watchesScale: the inotify watch default
    // follows RAM (5.11, backported to 5.10).
    // thp: transparent_hugepage/enabled at boot, chosen when the kernel is
    // built. mapCount: vm.max_map_count at boot.
    expect: { perfBlocksAt: 3, procpsGlobs: true, systemdGlobs: true, nrOpen: 1073741816, watchesScale: true, thp: 'always', mapCount: 1048576 },
  },
  'ubuntu-24.04': {
    file: 'ubuntu-24.04.img',
    url: 'https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-amd64.img',
    why: 'Ubuntu kernel 6.8 (Ubuntu perf patch), procps 4, systemd 255',
    profile: { security: { kernel: 'current' }, swap: { kernelVersion: '6.8' }, filesystem: { systemd: 'modern' } },
    expect: {
      perfBlocksAt: 4, procpsGlobs: true, systemdGlobs: true, apport: true, nrOpen: 1048576, watchesScale: true, thp: 'madvise', mapCount: 1048576,
      // /usr/lib/sysctl.d/99-protect-links.conf; seen once at boot, stricter.
      stricter: { 'fs.protected_regular': '2' },
    },
  },
  'fedora-43': {
    file: 'fedora-43.qcow2',
    url: 'https://dl.fedoraproject.org/pub/fedora/linux/releases/43/Cloud/x86_64/images/Fedora-Cloud-Base-Generic-43-1.6.x86_64.qcow2',
    why: 'close-to-upstream kernel 6.17 (no perf patch), procps 4, systemd 258',
    profile: { security: { kernel: 'current' }, swap: { kernelVersion: '6.17' }, filesystem: { systemd: 'modern' } },
    expect: { perfBlocksAt: null, procpsGlobs: true, systemdGlobs: true, networkManager: true, nrOpen: 2147483584, watchesScale: true, thp: 'madvise', mapCount: 1048576 },
  },
  'debian-11': {
    file: 'debian-11.qcow2',
    url: 'https://cloud.debian.org/images/cloud/bullseye/latest/debian-11-genericcloud-amd64.qcow2',
    why: 'Debian kernel 5.10 (before 5.13), procps 3.3 without glob support, systemd 247',
    profile: { security: { kernel: 'lts' }, swap: { kernelVersion: '5.10' }, filesystem: { systemd: 'modern' } },
    expect: {
      perfBlocksAt: 3, procpsGlobs: false, systemdGlobs: true, nrOpen: 1048576, watchesScale: true, thp: 'always', mapCount: 65530,
      // /usr/lib/sysctl.d/protect-links.conf sorts after 99-*.conf.
      stricter: { 'fs.protected_regular': '2' },
    },
  },
  'ubuntu-18.04': {
    file: 'ubuntu-18.04.img',
    url: 'https://cloud-images.ubuntu.com/releases/bionic/release/ubuntu-18.04-server-cloudimg-amd64.img',
    why: 'Ubuntu kernel 4.15 (before 4.19), procps 3.3, systemd 237',
    profile: { security: { kernel: 'legacy' }, swap: { kernelVersion: '4.15' }, systemd: { cgroupVersion: 'v1' }, filesystem: { systemd: 'older' } },
    expect: { perfBlocksAt: 3, procpsGlobs: false, systemdGlobs: false, apport: true, conntrackIpv4: true, nrOpen: 1048576, watchesScale: false, thp: 'madvise', mapCount: 65530 },
  },
}
