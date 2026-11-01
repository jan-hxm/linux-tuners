/**
 * Filesystem tuner page copy and About content, rendered by TunerPage and
 * AboutSection. Inline markup: `code`, **bold**, [label](https://url).
 */

export const PAGE = {
  title: 'Filesystem & file descriptors',
  intro:
    'Raise the `fs.*` limits that file-heavy and event-driven workloads run into: the open-file ceilings, the inotify limits behind "too many open files" and "no space left on device" from file watchers, and native AIO for databases. Pick what the machine does, see what each limit costs, and copy the result into `/etc/sysctl.d/`.',
  profileStep: {
    id: 'system',
    label: 'System',
    title: 'Your system',
    subtitle: 'Picks the starting values and leaves out keys your system already sets higher.',
  },
  tuneSubtitle: 'Each card says what runs out at the limit and what raising it costs.',
  exportStep: {
    title: 'Copy your config',
    subtitle: 'Drop this into /etc/sysctl.d/99-filesystem-tuning.conf, then sudo sysctl --system.',
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
        { p: 'These keys are ceilings: raising one costs nothing until programs use it, and lowering one below what they need makes them fail. So every range starts at the kernel default, and the starting values raise only what the workload runs into: file watching on desktops and container hosts, AIO request slots on database servers.' },
        {
          ul: [
            'Kernel defaults and accepted values come from the kernel\'s `fs` sysctl documentation and `inotify(7)`. What distributions change at boot was measured on Debian 11 and 13, Ubuntu 18.04 and 24.04 and Fedora 43.',
            'systemd 240 and newer raise `fs.file-max` to its maximum at boot, so the file leaves it out there. `fs.nr_open` is left out at the kernel default, because Debian 13 and Fedora start it higher, and lowering it there makes units that ask for more with `LimitNOFILE=` fail to start.',
            'The watch limit\'s worst case is shown in memory: each watch in use pins about 1.3 KiB of kernel memory with its inode. The starting value keeps the worst case under a tenth of RAM.',
            'The per-process open-file limit that services actually get is set by systemd (`DefaultLimitNOFILE=`, `LimitNOFILE=`), not by these keys. The systemd tuner covers it.',
          ],
        },
      ],
    },
    {
      title: 'Sources',
      blocks: [
        {
          ul: [
            '[Kernel sysctl documentation: fs](https://docs.kernel.org/admin-guide/sysctl/fs.html)',
            '[inotify(7) man page](https://man7.org/linux/man-pages/man7/inotify.7.html)',
            '[io_setup(2) man page](https://man7.org/linux/man-pages/man2/io_setup.2.html)',
            '[kind known issues: too many open files](https://kind.sigs.k8s.io/docs/user/known-issues/#pod-errors-due-to-too-many-open-files)',
          ],
        },
      ],
    },
    {
      title: 'Disclaimer',
      blocks: [
        { p: 'These are starting points, not guarantees. Check what your programs actually use (`fs.file-nr`, `fs.aio-nr`, and the watches each user holds) before and after applying the file, and apply it on one machine first.' },
      ],
    },
  ],
}
