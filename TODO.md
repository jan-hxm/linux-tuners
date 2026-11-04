# TODO

The single list of open work, most valuable first. When an item is done, record
the outcome in [Design.md](Design.md) if it changes how the project works, then
delete the item. Finished items are not kept here. Account, revenue and security
details are kept in the local, gitignored `PRIVATE.md`, not here.

## 1. Next

- [ ] **Reactive margin notes.** The margin notes are built from today's data and don't change with the value ([Design.md §7](Design.md#7-uiux-and-accessibility-conventions) "Three layers per parameter"). Let them answer back: give zones an optional plain-text `note` (`{ label, min, max, note }`) so the note for the current zone changes as the value moves (data first, no tuner-specific code in the card); optionally let a domain explain a derived default in one line built from the profile's option labels ("database, 64 GiB, swap on NVMe, so 10"). Contract tests: every note is plain text with no em dash, and every zone with a note has bounds. Notes update in an `aria-live="polite"` region, debounced like `IssueAnnouncer` so a drag doesn't chatter. Today's notes are long paragraphs cut to their first sentence, so shorter notes written for the margin belong here too.

## 2. Open questions for the maintainer

Left as built until decided.

- [ ] Dark `rule-strong` (`#4E4E4A`) is 2.2:1 on paper, so it is used only for hairlines beside a label. Raise it to about `#686864` for 3:1, so it could carry meaning on its own?
- [ ] Fonts: one variable Host Grotesk file (19.6 KB) instead of the three static weights (40.9 KB)?
- [ ] The site header is no longer sticky below `lg` (it used to be sticky at every width). Keep it static on phones, or make it sticky again?
- [ ] The footer shows a Glossary link only when a route named `glossary` exists, and none does today. Fine as is, or add a glossary page?
- [ ] The logo and OG PNGs (`npm run gen:icons`) render their text in an Arial fallback, since sharp has no Host Grotesk. Accept, or render them with the webfont?
- [ ] The slider's draggability test is still to do: does one person who has never seen the site try to drag the thumb without being told?
- [ ] Validation issues have no "fix" field, so a blocking error shows only its message plus "Back to X". Add a fix line to the issue data?
- [ ] The landing table loads every domain (about 93 kB gzip) when it scrolls into view, for its setting counts and file paths. Keep, or store the counts in the registry, guarded by a test?
- [ ] The forum value in the landing's "Why" (`vm.swappiness=1`) is hand-typed illustration copy, not read from data. Fine?
- [ ] The mockup's role hints (a line under each role on the landing page) were left out. Add them to `core/machineRoles.js`?
- [ ] On `/setup`, the "Copied" message's "Next" is generic, not the actual first install step as on a tuner page. Make it name the step?

## 3. Watch list

Act only when they happen again.

- [ ] VM suite: in a full parallel run the Ubuntu 24.04 guest sometimes drops off (SSH refused) at the first systemd drop-in case, right after the sysctl sweep; it comes back at the next reboot, and alone it always passes. Seen in two of three full runs, cause unknown (the panic switches are already reset after the kernel cases, and no other file sets them). Run with `VM_KEEP=1` and read `vm/.cache/run/lt-ubuntu2404/console-*.log` when it happens again.

## 4. Parked

- [ ] **CPU frequency & power tuner** (a new domain module following [Design.md §6](Design.md#6-adding-a-tuner); sysfs-based, so global values can use the huge pages tuner's tmpfiles.d writer): `scaling_governor`, `scaling_min_freq`/`scaling_max_freq`, `energy_performance_preference`, plus `kernel.numa_balancing`. Parked until it can be measured on real hardware: the VM guests have no cpufreq at all (no `cpu*/cpufreq`, `acpi-cpufreq` finds no device). That needs the driver (`intel_pstate`, `amd-pstate`, `acpi-cpufreq`), the governors and EPP values each offers, the min/max bounds, and whether tmpfiles.d `w` lines with a `cpu*` glob reach every CPU. `kernel.numa_balancing` could be measured in a VM with two NUMA nodes (a single-node guest starts it at 0).
- [ ] Legal: have the privacy policy reviewed by a data-protection officer or German IT lawyer if the site becomes commercial; it's templated, not legal advice.
