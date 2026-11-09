# VM tests

The unit tests check that the tuners generate what we intend. These tests check
that what they generate does what we claim, on real distribution kernels:
each test file boots a throwaway QEMU VM from an official cloud image, applies
the generated files, and reads the result back from the kernel and systemd.

```bash
npm run test:vm                          # every image, in parallel
npx vitest run --config vitest.vm.config.js vm/debian-13.vm.test.js   # one image
```

The first run downloads about 2.3 GB of images into `vm/.cache/` (gitignored).
A run takes 10 to 20 minutes and needs about 3 GB of RAM per image;
`VM_PARALLEL=2` runs fewer at once.

## Requirements

- QEMU (`winget install SoftwareFreedomConservancy.QEMU` on Windows, the
  `qemu-system-x86` package on Linux), `ssh` and `ssh-keygen`, and `curl`.
- Hardware acceleration: WHPX on Windows (needs the Windows Hypervisor Platform
  feature), KVM on Linux, HVF on macOS. `VM_ACCEL=tcg` works without it, but
  slowly.
- `QEMU_DIR` points at the QEMU binaries if they aren't in
  `C:\Program Files\qemu` or on the PATH.

## What runs

| Image | Why it is in the matrix |
|---|---|
| Debian 13 | kernel 6.12 with Debian's perf patch, procps 4, systemd 257 |
| Ubuntu 24.04 | kernel 6.8 with Ubuntu's perf patch, systemd 255 |
| Fedora 43 | close-to-upstream kernel 6.17, no perf patch, systemd 258 |
| Debian 11 | kernel 5.10 (before 5.13), procps 3.3 without globs, systemd 247 |
| Ubuntu 18.04 | kernel 4.15 (before 4.19), procps 3.3, systemd 237 |

Per image ([suite.mjs](suite.mjs)):

1. **Security claims on a fresh boot.** Every value the tuner offers is
   accepted; perf_event_paranoid blocks unprivileged perf where the comments say;
   `kallsyms-exposed` and `kptr-raw` fire exactly when the kernel exposes
   addresses; the BPF defaults stop unprivileged `bpf()`; blocked user
   namespaces stop root and `PrivateUsers=` units too, and the distro switches
   the description names exist where it says; 1 and ptrace 3 lock.
2. **Filesystem claims.** `fs.file-max` and `fs.nr_open` start where the notes
   say, the watch default follows RAM as the drawer says, every bound offered
   is accepted, and a unit asking for more than `fs.nr_open` is cut down, or
   fails where `fs.nr_open` was lowered below what systemd runs with.
3. **Huge pages claims.** THP and `vm.max_map_count` start where the notes
   say, every THP option and KSM bound is set by its tmpfiles.d line, a line
   for a missing `/sys` file is skipped, and a pool is reserved as asked.
4. **System V IPC claims.** Every key starts at the kernel default and
   `shmmax`/`shmall` at no limit, every bound offered (each `kernel.sem`
   field's) is accepted, a new IPC namespace starts at the kernel defaults,
   `shm_rmid_forced` removes an orphaned segment, and SEMMSL is enforced.
5. **Kernel claims.** `kernel.pid_max`, `threads-max`, the key quotas,
   SysRq and the console loglevel start where the defs say, every bound and
   option offered is accepted, systemd's `DefaultTasksMax` follows
   `threads-max`, a non-root user is held to `kernel.keys.maxkeys`, the
   console loglevel filters the console but not `dmesg`, root reaches SysRq
   at 0, and a panic reboots after `kernel.panic` seconds or stays down at 0.
6. **Swap claims.** `vm.page-cluster` starts at 3 and takes 0 to 31, and
   a process reading back swapped-out memory gets readahead from a swap
   file at 3 and none at 0. From zram it gets none for pages it maps alone
   and some for pages shared after a fork, and none at 0; the Ubuntu cloud
   kernels have no zram, which is asserted rather than skipped.
7. **Block I/O claims.** Each kind of disk (an NVMe drive, a SATA SSD and
   hard disk on AHCI, virtio) starts with the read-ahead the drawer says,
   every scheduler and bound the profile offers is accepted and one past
   `nr_requests`' top is refused, and every rules file for each kind,
   workload and preset applies through `udevadm trigger` with no failed
   write and reads back on every disk of that kind. Skipped on Ubuntu 18.04
   (kernel 4.15, before the multi-queue-only block layer).
8. **Every sysctl and tmpfiles.d file** (swap, network, security,
   filesystem, huge pages, System V IPC, kernel; each workload's defaults and each preset) applies
   with `sysctl -p` or `systemd-tmpfiles --create` without errors, and every
   key and `/sys` file reads back as written. One-way values are ordered last, with a reboot when a later
   file would need to lower them.
9. **systemd drop-ins** for each workload and preset load after
   `daemon-reexec` with no PID 1 warning about our files, and `systemctl show`
   reports each directive. On cgroup v2 a partial swap cap reaches
   `memory.swap.max` as the bytes written, and `MemorySwapMax=10%` is a tenth
   of RAM (not of swap, as the man page says).
10. **After a reboot**, systemd-sysctl applies the swap, network, security,
   filesystem, huge pages, Db2 IPC and kernel defaults together, systemd-tmpfiles sets the
   THP and KSM files and a small pool is reserved, udev applies a block I/O
   rules file for each kind of disk without a failed write, and the glob lines the
   security file suggests reach the boot interface.

## Capturing the learning pages' evidence

Every number in a learning page's figure comes from a capture on these
images, committed as `src/learn/evidence/<image>.json`:

```bash
npm run vm:capture -- --dry-run          # list each probe and its command, boot nothing
npm run vm:capture                       # every image, VM_PARALLEL at once (default 5)
npm run vm:capture debian-13 fedora-43   # some images
```

Each image boots fresh on the suite's guest (3072 MB, the same extra disks,
conntrack loaded), runs every probe from every `src/tuners/<id>/probes.js`
and writes the file with its keys sorted, so a recapture diffs by value. A
probe whose file, key or thread is missing, or whose command fails, is
recorded as `{ "status": "absent", "reason": ... }`. An image that fails to
boot keeps its old file and the command exits 1. Review the diff and commit
it with the guide change that needed it.

Probes are plain data in a closed set of kinds (`vm/lib/probeKinds.mjs`):
`sysctl`, `file`, `sysfs`, `diskQueue`, `thread`, `zoneinfo`, `vmstatKeys` and
`meminfoKeys`. Each kind runs a fixed command with the probe's one field
quoted into it, so a probe can't run anything else; a new kind of
measurement is a new kind there, with a parser test against real output in
`vm/lib/__fixtures__/`.

The suite's last block, **learn evidence is fresh**, reruns every probe at
the end of `npm run test:vm` and fails, naming the probe and image, when the
kernel or a probe's result no longer matches the file. Kinds whose value the
suite's own writes change (sysctl and sysfs values, zone watermarks,
meminfo sizes) are held only to the same status and shape; the rest
(`file`, `thread`, `vmstatKeys`) to the same value. A failure there means:
recapture.

## Notes for changing it

- `images.mjs` `expect` holds facts about each distribution (where perf is
  patched, whether procps and systemd take globs, what resets a value after
  boot). They were measured by booting each image and probing it;
  `node vm/explore.mjs <image>` prints the starting state and the security
  probes for one image. Re-measure rather than guess when adding an image.
- procps 3.3 `sysctl` exits 0 when a write fails, so the tests treat any
  stderr as a failure.
- On older kernels `fs.protected_*` are readable by root only, so sysctls are
  always read with sudo.
- Under WHPX, `-cpu max` and named models crash init on the 5.10 and 4.15
  guests; `qemu64` works everywhere.
- `VM_KEEP=1` keeps each VM's overlay and serial console log in
  `vm/.cache/run/` for debugging.
