/**
 * systemd tuner page copy and About content, rendered by TunerPage and
 * AboutSection. Inline markup: `code`, **bold**, [label](https://url).
 */

const NBSP = String.fromCharCode(0xa0)

export const PAGE = {
  title: 'systemd & resource limits',
  intro:
    'Tune systemd manager defaults and per-slice `cgroup v2` resource control for your hardware and workload. Drag the controls, watch the CPU/memory/task budgets respond, and copy the resulting drop-ins into `/etc/systemd/`.',
  profileStep: {
    id: 'profile',
    label: 'Profile',
    title: 'Your system profile',
    subtitle: 'Drives every default value and slider range below.',
  },
  tuneSubtitle: 'Drag any control on the left and the simulation on the right updates live.',
  exportStep: {
    title: 'Copy your drop-ins',
    subtitle: 'Two files: a [Manager] drop-in and a [Slice] drop-in. Then sudo systemctl daemon-reload.',
  },
  adSlot: 'swap',
}

export const ABOUT = {
  heading: 'About this tuner',
  intro: [
    `This tuner generates two systemd drop-in files: a \`[Manager]\` file under \`/etc/systemd/system.conf.d/\` for the system-wide \`Default*\` directives, and a \`[Slice]\` file under \`/etc/systemd/system/<slice>.d/\` for the per-slice cgroup${NBSP}v2 resource controls. It deliberately does **not** touch \`/etc/security/limits.conf\`: those PAM limits apply to login sessions, not to systemd services, which take their limits from the directives above.`,
  ],
  sections: [
    {
      title: 'Methodology',
      blocks: [
        {
          ul: [
            'Accounting toggles, `DefaultTasksMax` (15% of `kernel.pid_max`), and the `DefaultLimit*` defaults come from `systemd-system.conf(5)`.',
            `\`CPUWeight\`/\`IOWeight\` (1–10000, default 100), \`CPUQuota\`, and the \`Memory*\` controls come from \`systemd.resource-control(5)\` and apply on the cgroup${NBSP}v2 unified hierarchy.`,
            'The CPU-share graph models proportional `cpu.weight` distribution under contention; the memory graph shows the MemoryHigh throttle band and the MemoryMax hard cap as fractions of RAM. Both are teaching models, not exact predictors.',
            'Per-workload starting values (container host, database, …) are opinionated defaults, not mandated constants, so always validate against your own load.',
          ],
        },
      ],
    },
    {
      title: 'Sources',
      blocks: [
        {
          ul: [
            '[systemd-system.conf(5)](https://www.freedesktop.org/software/systemd/man/latest/systemd-system.conf.html)',
            '[systemd.resource-control(5)](https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html)',
            '[systemd.exec(5): process limits](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html)',
          ],
        },
      ],
    },
    {
      title: 'Disclaimer',
      blocks: [
        { p: 'Resource limits can throttle or OOM-kill services if set too tight. Apply changes on a non-production host first, run `systemctl daemon-reload` (and a re-exec or reboot for the manager defaults), and verify with `systemctl show` and `systemd-cgtop` before rolling out.' },
      ],
    },
  ],
}
