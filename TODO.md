# TODO

The single list of open work. When an item is done, record the outcome in
[Design.md](Design.md) if it changes how the project works, then delete the item.
Finished items are not kept here. Account, revenue and security details are kept
in the local, gitignored `PRIVATE.md`, not here.

## 1. Tuners, in build order

Each one is a new domain module following [Design.md §6](Design.md#6-adding-a-tuner).

sysctl-based (output: `/etc/sysctl.d/`):

1. [ ] **Security hardening** (cross-cutting, CIS-style): `kernel.kptr_restrict`, `dmesg_restrict`, `yama.ptrace_scope`, `randomize_va_space`, `unprivileged_bpf_disabled`, `perf_event_paranoid`; `net.ipv4.conf.*.rp_filter`, `tcp_syncookies`, `accept_redirects`; `fs.protected_*`, `suid_dumpable`.
2. [ ] **Network stack** (`net.*`): socket buffers (`rmem_max`/`wmem_max`/`tcp_rmem`/`tcp_wmem`), listen backlog (`somaxconn`, `tcp_max_syn_backlog`), `tcp_congestion_control`, TIME_WAIT reuse, conntrack (`nf_conntrack_max`, buckets, timeouts).
3. [ ] **Filesystem & file descriptors** (`fs.*`): `file-max`, `nr_open`, `inotify.max_user_watches`/`max_user_instances`, `aio-max-nr`.
4. [ ] **Huge pages & memory layout** (the rest of `vm.*` + THP/KSM sysfs): `nr_hugepages`, `nr_overcommit_hugepages`, `max_map_count`, `mmap_min_addr`, `zone_reclaim_mode`, `page-cluster`; THP and KSM via `/sys/kernel/mm/`. Mixed output (sysctl.d + sysfs/tuned).
5. [ ] **System V IPC & shared memory**: `kernel.shmmax`, `shmall`, `shmmni`, `sem`, `msgmni`/`msgmnb`/`msgmax`.
6. [ ] **Kernel & scheduler** (`kernel.*`, `user.*`): exposed `sched_*` tunables, `pid_max`, `threads-max`, panic/printk behaviour, `user.max_*_namespaces`.

sysfs-based (these need a non-sysctl apply model: udev rules or a `tuned` profile):

7. [ ] **Block I/O & storage** (`/sys/block/<dev>/queue/*`): `scheduler`, `nr_requests`, `read_ahead_kb`, `rotational`, `nomerges`. Per device.
8. [ ] **CPU frequency & power**: `scaling_governor`, `scaling_min_freq`/`scaling_max_freq`, `energy_performance_preference`, plus `kernel.numa_balancing`.

## 2. Correctness

- [ ] Swap: make `dirty_writeback_centisecs > dirty_expire_centisecs` a warning instead of a blocking error (per [Design.md §3](Design.md#3-product-principles) principle 4). `src/tuners/swap/validation.js`
- [ ] Swap: gate the `watermark_scale_factor` max by kernel version, like swappiness. Older kernels cap it at 1000, so the Kubernetes default of 2000 fails there. Verify the exact version that raised the cap to 3000 first.
- [ ] Swap: the config comments say `dirty_ratio` is a percentage "of RAM"; the kernel actually uses dirtyable (free + reclaimable) memory. Reword in `src/tuners/swap/config.js`.
- [ ] `AdSlot` labels ads "Werbung"; use "Advertisement" to match the English site. `src/ui/AdSlot.vue`
- [ ] Remove the stale comments in `.github/workflows/ci.yml` (the removed consent banner, and a "skip deploy when the secret is missing" condition that doesn't exist).

## 3. UX

- [ ] Show the preset "what would change" diff somewhere other than a native `title` tooltip, which is invisible on touch and unreachable by keyboard. `src/ui/PresetSelector.vue`
- [ ] Add an "Undo" toast after a reset or a preset snap, so an accidental one is recoverable.
- [ ] Make the "Jump to" step chain highlight the active section (scroll-spy).
- [ ] Add a way to jump from the mobile impact bar to the full `GraphPanel`.
- [ ] Dark mode. The range-slider colours are hardcoded hex in `ParameterCard.vue` scoped styles and need theming first.
- [ ] Use one restrained accent colour (sky-500, already used for links and charts) for primary CTAs and active states.
- [ ] Use one grid for the landing page's available and coming-soon cards (currently 2 vs 3 columns).
- [ ] Give the top nav an active state on the landing page.

## 4. Engineering

Maintainability migration toward [Design.md §9](Design.md#9-code-organization-and-reuse).
Each step is a refactor with no behaviour change: the config snapshots
(`src/tuners/configSnapshots.test.js`) must stay unchanged.
Steps 5 and 6 come alongside the Security tuner, and 7 before Network.

5. [ ] Generic `useTunerSimulation`, `ChartFrame` and a chart palette.
6. [ ] `core/output` writers, multi-file `{ path, content }[]` output, generic `sysctlConfig`.
7. [ ] Value types (`int`/`bool`/`enum`/`tuple`) + controls registry; split `ParameterCard`; `select` control.

- [ ] Tests: `ConfigOutput` flow (textarea matches the generator, copy calls the clipboard API, blocked state).
- [ ] Automated accessibility sweep (axe-core / Lighthouse): focus visibility on the dark hero, a live-region announcement when a preset is applied or validation fires, and a full WCAG AA contrast pass.
- [ ] Bundle: re-measure (last measured before `/systemd`), drop unused Chart.js parts (check whether `Filler` is needed), lazy-load chart components per tab.

## 5. Launch & SEO

- [ ] Replace the SVG OG image with a real 1200×630 PNG (or per-route images); update `OG_IMAGE_PATH` in `src/routes-meta.js`.
- [ ] Check link previews on X/Twitter, Discord, Slack and LinkedIn.
- [ ] Per-route `<lastmod>` in the sitemap from `git log -1 --format=%cI -- <view file>` instead of the build date. `scripts/generate-static-routes.mjs`
- [ ] Verify the site in Google Search Console and submit `https://linux-tuners.dev/sitemap.xml`; optionally Bing Webmaster Tools.

## 6. Legal

- [ ] Have the privacy policy reviewed by a data-protection officer or German IT lawyer if the site becomes commercial; it's templated, not legal advice.
