/**
 * Security tuner page copy and About content, rendered by TunerPage and
 * AboutSection. Inline markup: `code`, **bold**, [label](https://url).
 */

export const PAGE = {
  title: 'Security hardening',
  intro:
    'Harden the kernel, network stack and filesystem with the security-relevant sysctls from `kernel.*`, `net.*` and `fs.*`. Pick what the machine does, see what each value protects against and what it can break, and copy the result into `/etc/sysctl.d/`.',
  profileStep: {
    id: 'system',
    label: 'System',
    title: 'Your system',
    subtitle: 'Picks the starting values and leaves out keys your kernel doesn\'t have.',
  },
  tuneSubtitle: 'Each card says what the value protects against and what it can break.',
  exportStep: {
    title: 'Copy your config',
    subtitle: 'Drop this into /etc/sysctl.d/99-security-hardening.conf, then sudo sysctl --system.',
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
        { p: 'Starting values follow the [Kernel Self Protection Project](https://kspp.github.io/Recommended_Settings) and the CIS Linux benchmarks wherever they fit the workload, and relax only what the workload needs: ptrace and perf for machines where people debug, loose reverse-path filtering where routes can be asymmetric, and ICMP redirects on a router. These are opinionated starting points, not mandated values.' },
        {
          ul: [
            'Kernel defaults and accepted values come from the kernel\'s sysctl documentation. Only values the kernel accepts are offered, and keys your kernel or network setup lacks are left out of the file.',
            'Two values can\'t be undone without a reboot: `kernel.yama.ptrace_scope = 3` and `kernel.unprivileged_bpf_disabled = 1`. The file lists them in a warning block when they are set.',
            'The `conf.all` and `conf.default` network keys don\'t reach every interface that already exists when the file is applied, and IPv6 redirects only follow each interface\'s own value. The generated file shows how to check the interfaces and cover them with a glob line.',
            'Some defaults depend on the kernel version and the distribution build: unprivileged BPF is off from 5.16, and Debian and Ubuntu start perf at 3 and 4. Each card\'s drawer says so, and there is no "kernel defaults" preset because one fixed set would loosen a modern system.',
            'Some hardening needs more than sysctls: a firewall, kernel boot parameters, and keeping the kernel updated. This tuner covers the sysctl part only.',
          ],
        },
      ],
    },
    {
      title: 'Sources',
      blocks: [
        {
          ul: [
            '[Kernel sysctl documentation: kernel, fs](https://docs.kernel.org/admin-guide/sysctl/)',
            '[IP sysctls](https://docs.kernel.org/networking/ip-sysctl.html)',
            '[Yama LSM: ptrace_scope](https://docs.kernel.org/admin-guide/LSM/Yama.html)',
            '[KSPP recommended settings](https://kspp.github.io/Recommended_Settings)',
            '[CIS benchmarks](https://www.cisecurity.org/cis-benchmarks)',
          ],
        },
      ],
    },
    {
      title: 'Disclaimer',
      blocks: [
        { p: 'Hardening can break debuggers, profilers, crash reporters, VPNs and container networking. Apply the file on one machine first, check the services you rely on, and keep a way back in (console access) before rolling it out. CIS is a trademark of the Center for Internet Security; this tuner is not affiliated with or endorsed by it.' },
      ],
    },
  ],
}
