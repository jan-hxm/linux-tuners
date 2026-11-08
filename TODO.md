# TODO

The single list of open work, most valuable first. When an item is done, record
the outcome in [Design.md](Design.md) if it changes how the project works, then
delete the item. Finished items are not kept here. Account, revenue and security
details are kept in the local, gitignored `PRIVATE.md`, not here.

## 1. Next

- [ ] **Reactive margin notes.** The margin notes are built from today's data and don't change with the value ([Design.md §7](Design.md#7-uiux-and-accessibility-conventions) "Three layers per parameter"). Let them answer back: give zones an optional plain-text `note` (`{ label, min, max, note }`) so the note for the current zone changes as the value moves (data first, no tuner-specific code in the card); optionally let a domain explain a derived default in one line built from the profile's option labels ("database, 64 GiB, swap on NVMe, so 10"). Contract tests: every note is plain text with no em dash, and every zone with a note has bounds. Notes update in an `aria-live="polite"` region, debounced like `IssueAnnouncer` so a drag doesn't chatter. Today's notes are long paragraphs cut to their first sentence, so shorter notes written for the margin belong here too.
- [ ] **Finer swap pressure samples near full memory.** `pressureCurve` samples memory fill in 1% steps, but on a typical machine the kswapd band and the min watermark sit within the last 1% (99.3 to 99.6% on 16 GiB). The chart now zooms the axis to that range (`focusRange`), so the curve shows only three samples there and starts rising at 99%, before the band. Sample more densely near the watermarks (simulation change, keep the tests).

## 2. Watch list

Act only when they happen again.

- [ ] VM suite: in a full parallel run the Ubuntu 24.04 guest sometimes drops off (SSH refused) at the first systemd drop-in case, right after the sysctl sweep; it comes back at the next reboot, and alone it always passes. Seen in two of three full runs, cause unknown (the panic switches are already reset after the kernel cases, and no other file sets them). Run with `VM_KEEP=1` and read `vm/.cache/run/lt-ubuntu2404/console-*.log` when it happens again.

## 3. Parked

- [ ] **CPU frequency & power tuner** (a new domain module following [Design.md §6](Design.md#6-adding-a-tuner); sysfs-based, so global values can use the huge pages tuner's tmpfiles.d writer): `scaling_governor`, `scaling_min_freq`/`scaling_max_freq`, `energy_performance_preference`, plus `kernel.numa_balancing`. Parked until it can be measured on real hardware: the VM guests have no cpufreq at all (no `cpu*/cpufreq`, `acpi-cpufreq` finds no device). That needs the driver (`intel_pstate`, `amd-pstate`, `acpi-cpufreq`), the governors and EPP values each offers, the min/max bounds, and whether tmpfiles.d `w` lines with a `cpu*` glob reach every CPU. `kernel.numa_balancing` could be measured in a VM with two NUMA nodes (a single-node guest starts it at 0).
- [ ] **Glossary page.** The terms already live in `src/ui/glossary.js`, and the header and footer show a Glossary link once a route named `glossary` exists. A `/glossary` route listing every term with its definition would make that link appear.
- [ ] Legal: have the privacy policy reviewed by a data-protection officer or German IT lawyer if the site becomes commercial; it's templated, not legal advice.
