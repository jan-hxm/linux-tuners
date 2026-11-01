/**
 * Kernel tuner page copy and About content, rendered by TunerPage and
 * AboutSection. Inline markup: `code`, **bold**, [label](https://url).
 */

export const PAGE = {
  title: 'Kernel limits & panics',
  intro:
    'Set the kernel-wide process and thread ceilings, the key quotas containers run into, what the kernel does after a crash, and which kernel messages reach the console. Starting values follow from what the machine does; copy the result into `/etc/sysctl.d/`.',
  profileStep: {
    id: 'system',
    label: 'System',
    title: 'Your system',
    subtitle: 'RAM sets the thread ceiling; the systemd version decides whether pid_max needs setting.',
  },
  tuneSubtitle: 'Each card says what fails at the limit, or what happens after a crash.',
  exportStep: {
    title: 'Copy your config',
    subtitle: 'Drop this into /etc/sysctl.d/99-kernel-tuning.conf, then sudo sysctl --system.',
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
        { p: 'Each key was read at boot, written at the ends of its range and checked for effect on Debian 11 and 13, Ubuntu 18.04 and 24.04 and Fedora 43. The panic and SysRq starting values are opinions: unattended machines reboot after a crash, desktops keep the message on screen.' },
        {
          ul: [
            '`kernel.threads-max` below the number of running threads is accepted, and from then on nothing can fork, so its range starts at the kernel\'s own value. Raising it raises the default `TasksMax` systemd gives every service, 15% of the smaller of it and `kernel.pid_max`.',
            'A test panic with `kernel.panic = 3` rebooted every image about 3 seconds later. Root triggered it through `/proc/sysrq-trigger` on Fedora, whose `kernel.sysrq = 16` allows only sync from the keyboard.',
            'A non-root user hit `EDQUOT` after 196 keys at the default quota of 200 (the user\'s keyrings take the rest), and after 1996 at LXD\'s 2000.',
            'With the console loglevel at 4, an error reached the serial console and an info message didn\'t; at 8 debug messages did too.',
          ],
        },
      ],
    },
    {
      title: 'What is not here',
      blocks: [
        {
          ul: [
            'The scheduler sysctls older guides set (`kernel.sched_min_granularity_ns`, `sched_latency_ns`, `sched_wakeup_granularity_ns`, `sched_migration_cost_ns`, `sched_nr_migrate`) exist only before kernel 5.13; on Debian 11 and Ubuntu 18.04 they are there, on the 6.x images writing them fails. Kernel 6.6 replaced most of them with the EEVDF scheduler.',
            '`kernel.sched_autogroup_enabled` groups CPU time by session, but only for tasks in the root CPU cgroup. Where systemd enables the cpu controller (Debian 13, Ubuntu 24.04, Fedora 43), one task in one session got 20% of a CPU against four in another with autogroup on or off; only Debian 11, without the controller, split it 50/50.',
            'User namespace limits (`user.max_user_namespaces`) start at half of `kernel.threads-max`, which is enough for rootless containers, and setting them to 0 is a hardening choice that belongs with the security tuner.',
          ],
        },
      ],
    },
    {
      title: 'Sources',
      blocks: [
        {
          ul: [
            '[Kernel sysctl documentation: kernel](https://docs.kernel.org/admin-guide/sysctl/kernel.html)',
            '[Kernel key retention service](https://docs.kernel.org/security/keys/core.html)',
            '[Linux Magic System Request Key Hacks](https://docs.kernel.org/admin-guide/sysrq.html)',
            '[LXD: server settings for a production setup](https://canonical.com/lxd/docs/en/latest/reference/server_settings/)',
          ],
        },
      ],
    },
    {
      title: 'Disclaimer',
      blocks: [
        { p: 'These are starting points, not guarantees. A panic that reboots hides the problem that caused it unless something collects the log; set up kdump or a remote syslog on machines that reboot themselves, and apply the file on one machine first.' },
      ],
    },
  ],
}
