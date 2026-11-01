/**
 * System V IPC tuner page copy and About content, rendered by TunerPage and
 * AboutSection. Inline markup: `code`, **bold**, [label](https://url).
 */

export const PAGE = {
  title: 'System V IPC & shared memory',
  intro:
    'Set the System V shared memory, semaphore and message queue limits that databases and older middleware check at install time. Since kernel 3.19 the defaults are higher than most installation guides ask for, so this tuner raises only what your workload needs past them, and keeps an old guide\'s values from lowering them. Copy the result into `/etc/sysctl.d/`.',
  profileStep: {
    id: 'system',
    label: 'System',
    title: 'Your system',
    subtitle: 'Db2 sizes its minimums from RAM; everything else starts at the kernel defaults.',
  },
  tuneSubtitle: 'Each card says what runs out at the limit and which guides ask for more.',
  exportStep: {
    title: 'Copy your config',
    subtitle: 'Drop this into /etc/sysctl.d/99-sysv-ipc-tuning.conf, then sudo sysctl --system.',
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
        { p: 'These keys are ceilings on objects programs create with `shmget()`, `semget()` and `msgget()`. Kernel 3.16 removed the shared memory size limits and 3.19 raised the semaphore and queue counts, so on current kernels most installation guides ask for less than the defaults already give. Every range starts at the kernel default, and the starting values raise only what Db2 asks for with your RAM.' },
        {
          ul: [
            'Defaults and accepted values were measured on Debian 11 and 13, Ubuntu 18.04 and 24.04 and Fedora 43: all five start at the same values, and none sets these keys in a distribution file.',
            '`kernel.shmmax` and `kernel.shmall` default to 18446744073692774399, no limit, so they are not offered. Oracle\'s "half of physical memory" and similar values only lower them.',
            'The file writes every key, at the kernel default too. It loads last, so it undoes a lower `kernel.sem` such as Oracle\'s minimum `250 32000 100 128`, which would cut the number of semaphore arrays from 32000 to 128.',
            'Containers get their own IPC namespace, which starts at the kernel defaults rather than the host\'s values. Set the keys per container with `docker run --sysctl` or a pod\'s `securityContext.sysctls`.',
            'POSIX shared memory (`/dev/shm`, used by PostgreSQL and most newer software) is a tmpfs sized by its mount, not by these keys.',
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
            '[proc_sys_kernel(5) man page](https://man7.org/linux/man-pages/man5/proc_sys_kernel.5.html)',
            '[IBM Db2: kernel parameter requirements (Linux)](https://www.ibm.com/docs/en/db2/11.5.x?topic=unix-kernel-parameter-requirements-linux)',
            '[Oracle Database 23ai: minimum parameter settings](https://docs.oracle.com/en/database/oracle/oracle-database/23/cwlin/minimum-parameter-settings-for-installation.html)',
          ],
        },
      ],
    },
    {
      title: 'Disclaimer',
      blocks: [
        { p: 'These are starting points, not guarantees. Check what your software asks for in its own installation guide, compare it with `ipcs -l`, and apply the file on one machine first.' },
      ],
    },
  ],
}
