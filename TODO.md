# TODO

The single list of open work, most valuable first. When an item is done, record
the outcome in [Design.md](Design.md) if it changes how the project works, then
delete the item. Finished items are not kept here. Account, revenue and security
details are kept in the local, gitignored `PRIVATE.md`, not here.

## 1. Launch & SEO

Cheap, and nothing else pays off until people can find the site and shared links look right.

- [ ] Verify the site in Google Search Console and submit `https://linux-tuners.dev/sitemap.xml`; optionally Bing Webmaster Tools.
- [ ] After the next deploy, check the link cards in an Open Graph preview tester (opengraph.xyz or metatags.io) for `/` and one tuner page. No social accounts needed.

## 2. Guided system setup

The next big feature, now that nine tuners exist: it turns separate tools into one path through a whole machine. Designed in [Design.md §5 Guided setup](Design.md#guided-setup); build in this order, each step shippable on its own.

- [ ] systemd's `DefaultTasksMax` and `TasksMax` defaults take 15% of `pidMax` alone, and the def's `kernelDefault` is 629146. But systemd takes 15% of the smaller of `pid_max` and `threads-max`, and the kernel sizes `threads-max` from RAM (an eighth of RAM in 16 KiB stacks). So on a 16 GiB machine systemd's own default is about 19660, and the file writes 32 times that, presented as systemd's default. With facts, `/setup` would show the `tasks-above-kernel-limit` warning on a default 16 GiB machine. Fix: promote the kernel tuner's RAM formula (`kernelThreads`) to core, take the minimum in `deriveDefaults`, make the def's default note say it depends on RAM, check the claim on a VM, and review the snapshots.
- [ ] `/setup`: the store option `urlSync: false`, the steps, the link envelope with its hostile-link tests, the output step with per-file download (which closes the `ConfigOutput` item in §4), the no-shared-key test, the route and the sitemap sources, the `src/setup/` import rule, and the landing page's "Start guided setup" button, which passes the picked role.

## 3. UI/UX: beginners and pros

From the UI/UX audit of November 2026 (desktop 1280 px, phone 390 px). The site serves two readers: a beginner who wants safe values and to understand them, and a pro who knows the knobs and wants the file fast. Today every card shows everything at one level, the inline "Learn more" repeats the drawer word for word, and on `/swap` the first parameter sits 1600 px down on desktop and 2560 px down on a phone. The first two items set the layering model, and the rest build on it. `/setup` renders the same cards, so those two pay off twice if they land before it. Record the model in Design.md §7 when it's built.

- [ ] **Three layers per parameter.** Card, always visible: a plain-language name (a new required `title` on every def, e.g. "Swap aggressiveness", which `impactSummary` already uses) above the sysctl name, the value, the one-line `shortDesc`, and the zones. "Learn more" on the card is the beginner layer: `longDesc` split into labelled parts ("What it does", "When to change it", "Watch out"; the typedef already orders them that way), plus the rule of thumb. The drawer becomes the pro reference and stops repeating `longDesc`: the accepted range and kernel default with its version note, the formula with live values, defaults by workload, a `sysctl -w` line to try the value, and the sources. Add the new def fields to the contract tests.
- [ ] **Essential and advanced parameters.** A `tier: 'essential' | 'advanced'` on every def. Each section shows its essential cards and a "Show N advanced" button; an advanced card that carries an issue, or a value its preset or the user changed, is always shown, so nothing changes out of sight. A "Show all parameters" switch for pros, remembered per viewer in `localStorage` (Design.md allows that for conveniences). Contract test: every section has at least one essential parameter.
- [ ] **Say where each value comes from.** On the card: a tick on the slider track at the kernel default, a line like "Kernel default 60 · for your profile 10" when the two differ, and a per-parameter "Reset" when the value differs from the profile's default. The violet "workload" badge then has no job and goes. Place the zone labels under their stretch of the track instead of as a flat list.
- [ ] **Export step for beginners.** The apply steps live only in the textarea comments. Add numbered steps above the output (save the file, apply, check one value), each command with its own copy button, and an "If something goes wrong" line that says how to undo. Only the security tuner's output says how to undo; give every tuner one through the shared output code, not per tuner. Add a short "N values differ from the kernel defaults" list, which pros use to review the diff.
- [ ] **Phone layout.** The header nav hides 8 of its 11 links off-screen with a hidden scrollbar and no hint that it scrolls: add an edge fade, or a "Tuners" menu button. `MobileImpactBar` overflows by 236 px, so only the first metric shows and a scrollbar appears: wrap the metrics into two rows or shorten the labels. The 13 RAM and swap quick picks wrap into three rows each and push the tuning step down: show fewer picks on narrow screens or put them in a select.
- [ ] **Target size and tooltip-only meaning.** WCAG 2.2 AA (2.5.8) wants 24 × 24 px targets: the preset "N changes" toggles and "Learn more" are 16 px tall, the quick-pick chips 22 px. The card badges (context, "workload", "danger at 0") explain themselves only in a `title` tooltip, which breaks the §7 rule, and they use 10 px text for meaning: give them visible text in the Learn more layer, and use `text-xs`.
- [ ] **Small fixes.** Two swap `longDesc` strings show literal Markdown asterisks (`*more*` in `vm.swappiness`, `*when a page is due*` in `vm.dirty_writeback_centisecs`); drop them, or render `longDesc` through `RichText`. The drawer's "Defaults by workload" shows capitalised ids ("K8s", "Embedded") rather than the profile's option labels.
- [ ] **Faster path to the sliders.** When a page opens from a shared link (and later from `/setup`), collapse the profile form to its summary line straight away, since the profile is already set. Unapplied profile edits only show as "Unsaved changes" at the end of the form: repeat a notice with an Apply button at the top of the tune step.
- [ ] **"Do I need this?" on each tuner page.** A short box under the hero, from data that already exists (the registry's `setup.why` and the tuner's machine roles): which roles it matters for, and when the defaults are fine. Beginners skip what they don't need, and pros lose nothing.
- [ ] **Landing page.** The ad sits between the hero and the role picker, which pushes the picker to about 600 px down on a phone: move it below the tuner grid. Replace "URL-encodable state for sharing" with three plain trust points (runs in your browser and sends nothing, every value cites its source, the output says how to apply and undo). Drop the "Available" badge, which every live card carries. The hero's main button comes with `/setup` (§2).
- [ ] **Tools for pros.** On tuners with 15 or more parameters (security, network, systemd), a filter field above the sections (name or description) and a "Changed only" switch. A compact density that hides the descriptions and shows name, value and control on one row each. No global keyboard shortcuts (§7).
- [ ] **Glossary.** Terms that recur across tuners (page cache, anonymous memory, cgroup, OOM killer, watermark, conntrack) defined once in a shared data file and marked in the copy with a `RichText` syntax, so a click or tap opens the definition inline. Not a `title` tooltip.

## 4. Quality

- [ ] Automated accessibility sweep (axe-core / Lighthouse): focus visibility on the dark hero, a live-region announcement when a preset is applied or validation fires, and a full WCAG AA contrast pass.
- [ ] Bundle: re-measure (last measured before `/systemd`), drop unused Chart.js parts (check whether `Filler` is needed), lazy-load chart components per tab.
- [ ] `ConfigOutput`: a download per file for multi-file tuners (systemd), instead of one combined `.conf`.
- [ ] Tests: `ConfigOutput` flow (textarea matches the generator, copy calls the clipboard API, blocked state).

## 5. Watch list

Act only when they happen again.

- [ ] VM suite: in a full parallel run the Ubuntu 24.04 guest sometimes drops off (SSH refused) at the first systemd drop-in case, right after the sysctl sweep; it comes back at the next reboot, and alone it always passes. Seen in two of three full runs, cause unknown (the panic switches are already reset after the kernel cases, and no other file sets them). Run with `VM_KEEP=1` and read `vm/.cache/run/lt-ubuntu2404/console-*.log` when it happens again.

## 6. Parked

- [ ] **CPU frequency & power tuner** (a new domain module following [Design.md §6](Design.md#6-adding-a-tuner); sysfs-based, so global values can use the huge pages tuner's tmpfiles.d writer): `scaling_governor`, `scaling_min_freq`/`scaling_max_freq`, `energy_performance_preference`, plus `kernel.numa_balancing`. Parked until it can be measured on real hardware: the VM guests have no cpufreq at all (no `cpu*/cpufreq`, `acpi-cpufreq` finds no device). That needs the driver (`intel_pstate`, `amd-pstate`, `acpi-cpufreq`), the governors and EPP values each offers, the min/max bounds, and whether tmpfiles.d `w` lines with a `cpu*` glob reach every CPU. `kernel.numa_balancing` could be measured in a VM with two NUMA nodes (a single-node guest starts it at 0).
- [ ] Legal: have the privacy policy reviewed by a data-protection officer or German IT lawyer if the site becomes commercial; it's templated, not legal advice.
