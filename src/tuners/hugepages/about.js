/**
 * Huge pages tuner page copy and About content, rendered by TunerPage and
 * AboutSection. Inline markup: `code`, **bold**, [label](https://url).
 */

export const PAGE = {
  title: 'Huge pages & memory layout',
  intro:
    'Set up the huge page pool for databases and virtual machines, choose how the kernel hands out transparent huge pages, turn on page merging for VM hosts, and raise the per-process mapping limit. The output is a `sysctl.d` file and a `tmpfiles.d` file that sets the `/sys/kernel/mm` values at every boot.',
  profileStep: {
    id: 'system',
    label: 'System',
    title: 'Your system',
    subtitle: 'Picks the starting values and the keys that apply.',
  },
  tuneSubtitle: 'Each card says what the setting costs in memory or latency.',
  exportStep: {
    title: 'Copy your config',
    subtitle: 'Two files: the sysctl.d part and the tmpfiles.d part, each under its banner.',
  },
  adSlot: 'swap',
}

export const ABOUT = {
  heading: 'About this tuner',
  intro: [],
  sections: [
    {
      title: 'Methodology',
      blocks: [
        { p: 'The huge page pool takes RAM whether a program uses it or not, so the tuner never picks a pool size: it starts at 0 and leaves the key out, and the card shows what a pool costs. Transparent huge pages start at madvise for every workload, which gives them to programs that ask (the JVM, QEMU) and keeps them away from databases that advise against them.' },
        {
          ul: [
            'Kernel defaults and accepted values come from the kernel\'s `vm` sysctl, hugetlbpage, transhuge and KSM documentation. What distributions change was measured on Debian 11 and 13, Ubuntu 18.04 and 24.04 and Fedora 43.',
            'THP and KSM live in `/sys/kernel/mm`, which sysctl can\'t set. A `tmpfiles.d` `w` line writes a value to a file at boot without running a program, and `systemd-tmpfiles` skips the line where the kernel lacks the file.',
            'Keys at the kernel default that a distribution, the boot options or a service may already set are left out: the pools at 0, KSM off, and `vm.max_map_count` at 65530.',
            'The pool is counted in 2 MiB pages, the default huge page size on x86-64. Check `Hugepagesize` in `/proc/meminfo` on other architectures.',
            'There is no kernel defaults preset: the THP default is chosen when the kernel is built, always on Debian and madvise on Ubuntu and Fedora.',
          ],
        },
      ],
    },
    {
      title: 'Sources',
      blocks: [
        {
          ul: [
            '[Kernel sysctl documentation: vm](https://docs.kernel.org/admin-guide/sysctl/vm.html)',
            '[HugeTLB pages](https://docs.kernel.org/admin-guide/mm/hugetlbpage.html)',
            '[Transparent huge pages](https://docs.kernel.org/admin-guide/mm/transhuge.html)',
            '[Kernel samepage merging](https://docs.kernel.org/admin-guide/mm/ksm.html)',
            '[tmpfiles.d(5)](https://www.freedesktop.org/software/systemd/man/latest/tmpfiles.d.html)',
            '[PostgreSQL: Linux huge pages](https://www.postgresql.org/docs/current/kernel-resources.html#LINUX-HUGE-PAGES)',
          ],
        },
      ],
    },
    {
      title: 'Disclaimer',
      blocks: [
        { p: 'These are starting points, not guarantees. Measure the program you tune for before and after (`HugePages_*` and `AnonHugePages` in `/proc/meminfo`, `/sys/kernel/mm/ksm/pages_sharing`), and apply the files on one machine first.' },
      ],
    },
  ],
}
