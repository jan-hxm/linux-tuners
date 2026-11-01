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
   addresses; the BPF defaults stop unprivileged `bpf()`; 1 and ptrace 3 lock.
2. **Filesystem claims.** `fs.file-max` and `fs.nr_open` start where the notes
   say, the watch default follows RAM as the drawer says, every bound offered
   is accepted, and a unit asking for more than `fs.nr_open` is cut down, or
   fails where `fs.nr_open` was lowered below what systemd runs with.
3. **Every sysctl file** (swap, network, security, filesystem; each
   workload's defaults and each preset) applies with `sysctl -p` without
   errors, and every key reads back as written. One-way values are ordered last, with a reboot when a later
   file would need to lower them.
4. **systemd drop-ins** for each workload and preset load after
   `daemon-reexec` with no PID 1 warning about our files, and `systemctl show`
   reports each directive.
5. **After a reboot**, systemd-sysctl applies the swap, network, security and
   filesystem defaults together, and the glob lines the security file
   suggests reach the boot interface.

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
