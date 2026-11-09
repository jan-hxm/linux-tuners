/**
 * The systemd resources study guide at /learn/systemd-resources: six
 * chapters from the tree of slices down to the limits on one process,
 * covering the systemd tuner's sixteen settings. Data in the frozen Guide
 * shape (src/learn/schema.js), checked by src/learn/contract.test.js. Probe
 * ids name entries in ./probes.js; `[^id]` marks point into each chapter's
 * `sources`; `[[term]]` names an entry in ui/glossary.js.
 *
 * Sources: systemd's man pages on man7.org (man7 links anchor to sections,
 * not options, so each label names the option), systemd.io, and the
 * kernel's cgroup v2 and sysctl docs for what the kernel side does.
 */

const MAN = 'https://man7.org/linux/man-pages'
const RC = `${MAN}/man5/systemd.resource-control.5.html`
const SC = `${MAN}/man5/systemd-system.conf.5.html`
const CG = 'https://docs.kernel.org/admin-guide/cgroup-v2.html'
const rc = (anchor, name) => ({ url: `${RC}#${anchor}`, label: `systemd.resource-control(5): ${name}` })
const sc = (anchor, name) => ({ url: `${SC}#${anchor}`, label: `systemd-system.conf(5): ${name}` })
const cg = (anchor, name) => ({ url: `${CG}#${anchor}`, label: `Control Group v2: ${name}` })

export const LEARN = {
  slug: 'systemd-resources',
  title: 'How systemd shares out resources',
  lead: 'See how systemd sorts every service into a tree of groups, and how the kernel shares CPU, memory, disk and tasks along that tree.',
  minutes: 20,
  parts: {
    picture:
      'Think of a company. systemd is the office manager: it puts every program into a team, and every team into a department. The kernel is the bookkeeper. It counts what each team and department uses, and holds each one to the budget set for it.',
    cards: [
      { id: 'systemd', title: 'systemd', does: 'The first program to start; it starts every service and sorts it into the tree.', col: 1, row: 1, probe: 'systemd.pid1' },
      { id: 'kernel', title: "The kernel's cgroups", does: 'Groups of processes the kernel counts and limits together, as systemd asks.', col: 2, row: 1, probe: 'systemd.controllers' },
      { id: 'root', title: '-.slice', does: 'The root of the tree, with everything on the machine under it.', col: 1, row: 2 },
      { id: 'limits', title: 'Weights and limits', does: 'Settings on a slice or a service that the kernel enforces, which the root and any branch can carry.', col: 2, row: 2, tone: 'fit' },
      { id: 'system-slice', title: 'system.slice', does: 'Where system services go.', col: 1, row: 3, probe: 'systemd.systemSlice' },
      { id: 'user-slice', title: 'user.slice', does: 'Where logged-in users and their programs go.', col: 2, row: 3, probe: 'systemd.userSlice' },
      { id: 'service', title: 'A service', does: 'One program, such as a web server, in a group of its own.', col: 1, row: 4 },
      { id: 'session', title: 'A user session', does: 'The programs one user runs after logging in.', col: 2, row: 4 },
    ],
    bands: [
      { label: 'Who runs it', rows: [1, 1] },
      { label: 'The tree', rows: [2, 4] },
    ],
    edges: [
      { from: 'systemd', to: 'kernel', label: 'asks for groups' },
      { from: 'systemd', to: 'root', label: 'builds the tree' },
      { from: 'kernel', to: 'limits', label: 'enforces' },
      { from: 'root', to: 'limits', label: 'can carry' },
      { from: 'root', to: 'system-slice', label: 'holds' },
      { from: 'system-slice', to: 'user-slice', label: 'share resources with' },
      { from: 'system-slice', to: 'service', label: 'holds' },
      { from: 'user-slice', to: 'session', label: 'holds' },
    ],
  },
  chapters: [
    {
      id: 'the-tree-and-its-counters',
      title: 'The tree and its counters',
      oneLine: 'systemd gives every service its own [[cgroup]], a group the kernel counts and limits together. Five settings choose what is counted for every service by default.',
      picture: {
        text: 'Think of a company with departments and teams. The bookkeeper keeps a ledger for each team, with a column for each thing that is counted, such as hours or printer paper. One switch starts a column for every team at once. Setting a budget for a team starts that column too.',
        limit: 'A bookkeeper can count one team on its own. The kernel switches a counter on for a whole branch at once, so siblings and parents are counted as well.',
      },
      figure: {
        kind: 'tree',
        title: 'How systemd sorts the machine into a tree',
        root: {
          id: 'root-slice',
          label: '-.slice',
          does: 'The root, the folder `/sys/fs/cgroup` itself, which systemd (process 1) fills with groups.',
          children: [
            {
              id: 'system-slice',
              label: 'system.slice',
              value: { probe: 'systemd.memoryCurrent', unit: 'bytes', label: 'Memory used now' },
              does: 'Holds system services, and counts their CPU time, memory and tasks, plus disk and network use once switched on.',
            },
            { id: 'user-slice', label: 'user.slice', does: 'Holds logged-in users and their programs.' },
            { id: 'init-scope', label: 'init.scope', does: 'The group systemd itself runs in.' },
          ],
        },
        pins: [
          { key: 'default_memory_accounting', node: 'root-slice' },
          { key: 'default_tasks_accounting', node: 'root-slice' },
          { key: 'default_io_accounting', node: 'root-slice' },
          { key: 'default_ip_accounting', node: 'root-slice' },
          { key: 'default_cpu_accounting', node: 'root-slice' },
        ],
      },
      body: [
        'A [[cgroup]] is a group of processes. The kernel keeps these groups in a tree and shares resources out along it[^cgroup]. Every process belongs to exactly one, and a new process starts in its parent\'s group[^cgroup]. systemd gives every service a group of its own, inside a [[slice]], a group that holds other groups[^units].',
        'By default, system services go in system.slice and logged-in users in user.slice[^special]. Both sit under the root, -.slice, which is the folder `/sys/fs/cgroup` itself[^units]. What the kernel tracks is split into [[controllers|cgroup-controller]], such as cpu, memory, io and pids[^units-ctl].',
        'systemd turns a controller on for a unit that has a setting for it, and the accounting defaults turn one on for every unit[^enable]. Memory and task counting are on by default; disk and network counting are off[^defaults]. CPU time is counted on cgroup v2 whatever the setting, so systemd 258 deprecated DefaultCPUAccounting[^history]. On the older cgroup v1 layout, each controller has a tree of its own[^units-ctl].',
      ],
      pins: [
        { key: 'default_memory_accounting', layer: 'root-slice', here: 'Counts the memory each service uses. It is on by default. A memory limit on a unit turns the count on for it anyway. Most machines don\'t need to change this.' },
        { key: 'default_tasks_accounting', layer: 'root-slice', here: 'Counts the processes and threads in each service. It is on by default. Most machines don\'t need to change this.' },
        { key: 'default_io_accounting', layer: 'root-slice', here: 'Counts what each service reads and writes on disk. It is off by default. Turn it on to find out which service keeps the disk busy.' },
        { key: 'default_ip_accounting', layer: 'root-slice', here: 'Counts the network bytes and packets of each system service. It is off by default, and does not cover services a user runs.' },
        { key: 'default_cpu_accounting', layer: 'root-slice', here: 'Only matters on the older cgroup v1 layout. On cgroup v2, CPU time is always counted, and systemd 258 deprecated the setting.' },
      ],
      choose: [
        {
          q: 'Do you want to know which service keeps the disk busy?',
          check: 'systemctl show -p DefaultIOAccounting',
          hint: '`no` means disk use is not counted for services unless one of them asks.',
          yes: { key: 'default_io_accounting', dir: 'raise' },
        },
        {
          q: 'Is memory counting turned off for services on this machine?',
          check: 'systemctl show -p DefaultMemoryAccounting',
          hint: '`no` means a distribution file or an admin turned off the default.',
          yes: { key: 'default_memory_accounting', dir: 'raise' },
        },
        {
          q: 'Do you need network traffic for each system service?',
          check: 'systemctl show -p DefaultIPAccounting',
          hint: '`no` is the default. One service can also turn it on for itself with `IPAccounting=yes`.',
          yes: { key: 'default_ip_accounting', dir: 'raise' },
          no: { leave: true, why: 'Memory and task counting are on by default, and that suits most machines.' },
        },
      ],
      symptoms: {
        low: 'You cannot tell which service uses the disk or the network, since nothing counts it.',
        high: 'More counters run for every service, for numbers nobody may read.',
      },
      look: {
        cmd: 'cat /sys/fs/cgroup/cgroup.subtree_control',
        for: 'The controllers turned on for the groups under the root. A controller missing here is not counted for any slice.',
      },
      sources: {
        cgroup: cg('what-is-cgroup', 'What is cgroup?'),
        units: { url: 'https://systemd.io/CGROUP_DELEGATION/#systemds-unit-types', label: "systemd.io: systemd's unit types" },
        special: { url: `${MAN}/man7/systemd.special.7.html#UNITS_MANAGED_BY_THE_SYSTEM_SERVICE_MANAGER`, label: 'systemd.special(7): special slice units' },
        'units-ctl': { url: 'https://systemd.io/CGROUP_DELEGATION/#hierarchy-and-controller-support', label: 'systemd.io: hierarchy and controller support' },
        enable: rc('DESCRIPTION', 'enabling and disabling controllers'),
        defaults: sc('RESOURCE_MANAGEMENT', 'DefaultMemoryAccounting= and the others'),
        history: sc('HISTORY', 'systemd 258'),
      },
    },
    {
      id: 'sharing-the-cpu',
      title: 'Sharing the CPU',
      oneLine: 'When groups compete for a busy CPU, a weight decides the share each one gets. A quota caps a slice even when the CPU has time to spare.',
      picture: {
        text: 'Think of a pizza shared at a table. Each guest\'s weight says how big a piece they get, but only while everyone is hungry. A guest left alone at the table may eat the lot, unless a house rule caps their plate.',
        limit: 'A pizza runs out once. CPU time keeps coming, so the shares are worked out again all the time, among whoever wants the CPU right then.',
      },
      figure: {
        kind: 'sideBySide',
        title: 'Share of a busy CPU for one slice, against a sibling at the default weight',
        states: [
          { label: 'Both at the default', cells: 10, lit: 5, setting: { key: 'cpu_weight', value: 100 } },
          { label: 'This slice raised', cells: 10, lit: 8, setting: { key: 'cpu_weight', value: 400 } },
          { label: 'This slice lowered', cells: 10, lit: 2, setting: { key: 'cpu_weight', value: 25 } },
        ],
        backedBy: { probe: 'systemd.cpuWeight' },
      },
      body: [
        'CPUWeight sets the cgroup file `cpu.weight`, from 1 to 10000, and the kernel default is 100[^weight]. The CPU time in a slice is split among its units by their weights[^weight]. Each group gets its weight\'s part of the sum, so a slice at 400 next to one at 100 gets four fifths[^weights].',
        'Only groups that want CPU at that moment take part in the split[^weights]. So a weight never holds a group back while the CPU has time to spare. With no weight set on either, system.slice and user.slice get equal shares[^enable].',
        'CPUQuota is a ceiling, written to `cpu.max`[^quota]. 100% is all the time of one CPU, and values above 100% allow more than one[^quota]. A group with a limit can use only up to that amount[^limits]. Unlike a weight, a quota holds the slice back even on an idle machine.',
      ],
      pins: [
        { key: 'cpu_weight', here: 'The slice\'s share of a busy CPU against its siblings. Higher wins more time when the CPU is busy, and changes nothing when it is idle. The default is 100.' },
        { key: 'cpu_quota', here: 'A hard ceiling on CPU time, where 100% is one whole CPU. Leave it unset unless a slice must never use more, such as one for batch jobs.' },
      ],
      choose: [
        {
          q: 'Do system services slow down when users run heavy jobs on the same machine?',
          check: 'systemctl show system.slice -p CPUWeight',
          hint: 'No number set means the kernel default of 100, the same weight user.slice has.',
          yes: { key: 'cpu_weight', dir: 'raise' },
        },
        {
          q: 'Must a slice never use more than a fixed number of CPUs, even when the rest sit idle?',
          check: 'grep -c ^processor /proc/cpuinfo',
          hint: 'This counts your CPUs. A quota of 200% allows the slice two of them.',
          yes: { key: 'cpu_quota', dir: 'lower' },
          no: { leave: true, why: 'Weights share a busy CPU and cost nothing when it is idle, which suits most machines.' },
        },
      ],
      symptoms: {
        low: 'The slice runs slowly whenever others are busy, or never gets past its quota.',
        high: 'The slice takes most of a busy CPU, and other groups wait their turn.',
      },
      look: {
        cmd: 'cat /sys/fs/cgroup/system.slice/cpu.max',
        for: '`max` first means no quota. Otherwise the first number is the time allowed in each period, and the second is the period, both in microseconds.',
      },
      sources: {
        weight: rc('OPTIONS', 'CPUWeight='),
        weights: cg('weights', 'Weights'),
        enable: rc('DESCRIPTION', 'enabling and disabling controllers'),
        quota: rc('OPTIONS', 'CPUQuota='),
        limits: cg('limits', 'Limits'),
      },
    },
    {
      id: 'capping-memory',
      title: 'Capping memory',
      oneLine: 'Two settings put a slice on a memory budget: a soft line where the kernel slows it, and a hard line where a process is killed. A third caps swap.',
      picture: {
        text: 'Think of a budget for one department. Past the soft line, finance makes every purchase slow and asks for things to be sold off. At the hard line, the card is declined and one project is cancelled. The rest of the company keeps working.',
        limit: 'A declined card stops spending at once. Memory use can creep past the soft line, and even past the hard line for a moment.',
      },
      figure: {
        kind: 'timeline',
        title: 'Memory used by one slice that keeps growing',
        schematic: true,
        lines: [
          { id: 'max', label: 'MemoryMax, hard limit', does: 'At it the OOM killer runs inside the unit.', value: { probe: 'systemd.memoryMax', unit: '' } },
          { id: 'high', label: 'MemoryHigh, soft limit', does: 'Above it the slice is slowed, never killed.', value: { probe: 'systemd.memoryHigh', unit: '' } },
        ],
        // Two lines sit at 2/3 (max) and 1/3 (high).
        curve: [[0, 0.1], [0.1, 0.12], [0.3, 0.33], [0.45, 0.37], [0.6, 0.45], [0.72, 0.67], [0.78, 0.67], [0.84, 0.3], [1, 0.3]],
        events: [
          { at: 0.1, label: 'Use grows', does: 'The slice starts using more memory.' },
          { at: 0.3, label: 'Past MemoryHigh', does: 'The slice is slowed and its memory reclaimed.', tone: 'fit' },
          { at: 0.72, label: 'At MemoryMax', does: 'The OOM killer ends a process in the slice.', tone: 'error' },
          { at: 0.84, label: 'Memory freed', does: 'Its memory is free again, and the rest of the machine ran on.' },
        ],
      },
      body: [
        'MemoryHigh sets `memory.high`, the throttle line[^high]. Above it the kernel slows the slice\'s processes and [[reclaims|reclaim]] their memory hard, but never runs the [[OOM killer]][^mem-high]. Under extreme pressure the use can still pass it[^mem-high]. systemd calls it the main way to control a unit\'s memory[^high].',
        'MemoryMax sets `memory.max`, the hard limit[^max]. When use cannot be kept under it, the OOM killer runs inside that unit[^max]. systemd suggests MemoryHigh as the main control, and MemoryMax as the last line of defence[^max]. A percentage counts against the installed RAM[^max].',
        'MemorySwapMax caps the [[swap]] the slice may use[^swap-max]. At that limit, the kernel stops moving the slice\'s [[program memory|anonymous-memory]] to swap[^mem-swap]. In these files `max` means no limit, the default, and 0 means none at all[^mem-files].',
      ],
      pins: [
        { key: 'memory_high', layer: 'high', here: 'The soft line. Above it the slice is slowed and its memory reclaimed, but nothing is killed. Set it a little below MemoryMax, so the slice slows down first.' },
        { key: 'memory_max', layer: 'max', here: 'The hard line. At it the OOM killer ends a process in this slice, and the rest of the machine is spared. Size it to what the slice needs, plus room to spare.' },
        { key: 'memory_swap_max', here: 'How much swap the slice may use. 0 keeps a slice whose delays matter, such as a database, out of swap. Most machines don\'t need to change this.' },
      ],
      choose: [
        {
          q: 'Does one group of services use so much memory that the rest of the machine slows down?',
          check: 'cat /sys/fs/cgroup/system.slice/memory.current',
          hint: 'The bytes the whole slice uses right now. Compare them with the total that `free -b` shows.',
          yes: { key: 'memory_high', dir: 'lower' },
        },
        {
          q: 'Were processes in the slice killed for memory while the machine had RAM free?',
          check: 'grep oom_kill /sys/fs/cgroup/system.slice/memory.events',
          hint: 'oom_kill counts the processes in this slice killed for memory. Above 0, the slice or the machine ran out.',
          yes: { key: 'memory_max', dir: 'raise' },
        },
        {
          q: 'Does a database in the slice pause while its memory comes back from swap?',
          check: 'cat /sys/fs/cgroup/system.slice/memory.swap.current',
          hint: 'The bytes of the slice\'s memory in swap right now. Above 0 means some of it was moved out.',
          yes: { key: 'memory_swap_max', dir: 'lower' },
          no: { leave: true, why: 'With no limits set, the slice shares memory with the rest of the machine, which suits most machines.' },
        },
      ],
      symptoms: {
        low: 'Services in the slice run slowly under memory pressure, or are killed while the machine has RAM free.',
        high: 'One slice can fill memory, and the rest of the machine slows down or runs out.',
      },
      look: {
        cmd: 'cat /sys/fs/cgroup/system.slice/memory.events',
        for: 'high counts the times the slice was slowed past MemoryHigh. max counts the times it was about to pass MemoryMax, and oom_kill the processes killed.',
      },
      sources: {
        high: rc('OPTIONS', 'MemoryHigh='),
        'mem-high': cg('memory-interface-files', 'memory.high'),
        max: rc('OPTIONS', 'MemoryMax='),
        'swap-max': rc('OPTIONS', 'MemorySwapMax='),
        'mem-swap': cg('memory-interface-files', 'memory.swap.max'),
        'mem-files': cg('memory-interface-files', 'Memory Interface Files'),
      },
    },
    {
      id: 'sharing-the-disk',
      title: 'Sharing the disk',
      oneLine: 'When groups compete for a busy disk, a weight decides the share of disk time each one gets. It works only where the kernel can split disk time by weight.',
      picture: {
        text: 'Think of a shop with one checkout. A queue rule lets some customers through more often than others, by weight. With no queue, nobody waits and the rule does nothing. Some shops never put the rule in place at all.',
        limit: 'A shop can always see its queue. The kernel splits disk time by weight only where a cost model or the BFQ scheduler runs for that disk.',
      },
      figure: {
        kind: 'tree',
        title: 'Who splits disk time between slices',
        root: {
          id: 'root-slice',
          label: '-.slice',
          value: { probe: 'systemd.bootDiskScheduler', unit: '', label: 'Boot disk scheduler' },
          does: 'Weights split disk time only where the io cost model (off until turned on in `io.cost.qos`) or the BFQ scheduler runs.',
          children: [
            {
              id: 'system-slice',
              label: 'system.slice',
              does: 'Its `io.weight` is its share of a busy disk against user.slice.',
              children: [{ id: 'system-service', label: 'A service', does: 'Shares the disk time of the slice with its siblings, by their own weights.' }],
            },
            {
              id: 'user-slice',
              label: 'user.slice',
              does: 'Its `io.weight` is its share of a busy disk against system.slice.',
              children: [{ id: 'user-session', label: 'A user session', does: 'Shares the disk time of the slice with the other sessions.' }],
            },
          ],
        },
        pins: [{ key: 'io_weight', node: 'system-slice' }],
      },
      body: [
        'IOWeight sets the cgroup file `io.weight`, from 1 to 10000, and its default is 100[^io-weight]. The disk bandwidth a slice gets is split among its units by their weights[^io-weight]. As with CPU, only groups using the disk at that moment share it[^weights].',
        'The split needs help on the disk\'s side. The kernel\'s io cost model provides it, and is off until it is turned on in `io.cost.qos`[^io]. The BFQ I/O scheduler provides it too, for a disk that uses BFQ[^io].',
        'Setting IOWeight turns the io controller on for the slice, its parents and its siblings[^enable]. Their `io.stat` files then list the bytes each group read and wrote on each disk[^io-stat].',
      ],
      pins: [
        { key: 'io_weight', layer: 'system-slice', here: 'The slice\'s share of a busy disk against its siblings. Higher gets more disk time when the disk is busy. It changes nothing on an idle disk, or where nothing splits by weight.' },
      ],
      choose: [
        {
          q: 'Do system services stall on the disk while a backup or a batch job runs?',
          check: 'grep . /sys/block/*/queue/scheduler',
          hint: 'The name in brackets is each disk\'s I/O scheduler. With bfq, a higher weight takes effect.',
          yes: { key: 'io_weight', dir: 'raise' },
        },
        {
          q: 'Does a batch slice of yours slow every other service down on the disk?',
          check: 'grep . /sys/block/*/queue/scheduler',
          hint: 'The name in brackets is each disk\'s I/O scheduler. With bfq, a lower weight for the batch slice takes effect.',
          yes: { key: 'io_weight', dir: 'lower' },
          no: { leave: true, why: 'The default weight treats every slice the same, which suits most machines.' },
        },
      ],
      symptoms: {
        low: 'The slice\'s reads and writes wait behind other slices whenever the disk is busy.',
        high: 'Other slices wait on the disk while this one reads and writes.',
      },
      look: {
        cmd: 'grep . /sys/block/*/queue/scheduler',
        for: 'Each disk, with its I/O scheduler in brackets. bfq splits disk time by weight; with any other, only the io cost model can.',
      },
      sources: {
        'io-weight': rc('OPTIONS', 'IOWeight='),
        weights: cg('weights', 'Weights'),
        io: cg('io', 'IO'),
        enable: rc('DESCRIPTION', 'enabling and disabling controllers'),
        'io-stat': cg('io-interface-files', 'io.stat'),
      },
    },
    {
      id: 'counting-tasks',
      title: 'Counting tasks',
      oneLine: 'Every process and every thread is a task, and the machine has room for a limited number. Two settings cap how many one service or one slice may start.',
      picture: {
        text: 'Think of a car park with a fixed number of spaces. Each tenant gets a cap on spaces, so one tenant\'s sudden crowd cannot fill the whole car park. The default cap is a share of all the spaces.',
        limit: 'Cars leave again on their own. A runaway program that keeps starting copies of itself never stops, and the cap is what keeps it from filling the rest.',
      },
      figure: {
        kind: 'compare',
        title: 'Task limits on the machine, and the tasks in one slice now',
        axis: 'tasks',
        scale: 'log',
        groups: [
          { id: 'machine', label: 'Machine limits', does: 'Caps for the whole machine, set by the kernel.' },
          { id: 'slice', label: 'One slice', does: 'What system.slice holds right now, against its caps.' },
        ],
        bars: [
          { id: 'pid-max', label: 'Process numbers', group: 'machine', value: { probe: 'systemd.pidMax', unit: '' }, does: 'The kernel hands out process numbers only below `kernel.pid_max`.' },
          { id: 'threads-max', label: 'Threads', group: 'machine', value: { probe: 'systemd.threadsMax', unit: '' }, does: 'Caps threads on the machine, sized from RAM at boot.' },
          { id: 'tasks', label: 'Tasks now', group: 'slice', tone: 'fit', value: { probe: 'systemd.pidsCurrent', unit: '' }, does: 'Counted in `pids.current`, capped by TasksMax, while each service gets DefaultTasksMax, 15% of the smallest machine limit.' },
        ],
        pins: [
          { key: 'default_tasks_max', bar: 'tasks' },
          { key: 'tasks_max', bar: 'tasks' },
        ],
      },
      body: [
        'A task is a process or a thread, and each thread counts on its own[^tasks-acct]. The kernel hands out process numbers only below kernel.pid_max[^pid-max]. It caps threads with kernel.threads-max, which it sizes from RAM at boot[^threads-max].',
        'A program that keeps starting copies of itself, a fork bomb, can use up the tasks before any memory limit stops it[^pids]. Once a cgroup is at its `pids.max`, starting a new process or thread there fails with an error[^pids].',
        'DefaultTasksMax sets TasksMax for every unit except slices[^default-tasks]. It defaults to 15% of the smallest of pid_max, threads-max and the root cgroup\'s pids.max[^default-tasks]. TasksMax on a slice caps every process of every unit in it[^slice].',
      ],
      pins: [
        { key: 'default_tasks_max', layer: 'tasks', here: 'The task cap each service gets unless it sets its own. Raise it for services with many threads, such as databases and Java programs. Lower it to hold runaway services tighter.' },
        { key: 'tasks_max', layer: 'tasks', here: 'A cap on tasks for the whole slice. Use it so logged-in users, or one runaway workload, cannot use up the machine\'s tasks and stop system services from starting new ones.' },
      ],
      choose: [
        {
          q: 'Does a busy service log "Resource temporarily unavailable" when it starts threads?',
          check: 'systemctl show -p DefaultTasksMax',
          hint: 'This is the cap each service gets. A service at its cap cannot start another thread.',
          yes: { key: 'default_tasks_max', dir: 'raise' },
        },
        {
          q: 'Do many users or containers share this machine, so one of them could start too many tasks?',
          check: 'cat /sys/fs/cgroup/user.slice/pids.max',
          hint: '`max` means the slice has no cap of its own.',
          yes: { key: 'tasks_max', dir: 'lower' },
          no: { leave: true, why: 'The default cap for each service already holds most runaway programs.' },
        },
      ],
      symptoms: {
        low: 'Services fail to start processes or threads, with "Resource temporarily unavailable", while the machine has room.',
        high: 'A runaway service can start enough tasks to slow the whole machine before a cap stops it.',
      },
      look: {
        cmd: 'cat /sys/fs/cgroup/system.slice/pids.current',
        for: 'The tasks in system.slice right now, threads included. pids.max in the same folder is its cap.',
      },
      sources: {
        'tasks-acct': rc('OPTIONS', 'TasksAccounting='),
        'pid-max': { url: 'https://docs.kernel.org/admin-guide/sysctl/kernel.html#pid-max', label: 'sysctl/kernel: pid_max' },
        'threads-max': { url: 'https://docs.kernel.org/admin-guide/sysctl/kernel.html#threads-max', label: 'sysctl/kernel: threads-max' },
        pids: cg('pid', 'PID'),
        'default-tasks': sc('RESOURCE_MANAGEMENT', 'DefaultTasksMax='),
        slice: { url: `${MAN}/man5/systemd.slice.5.html#DESCRIPTION`, label: 'systemd.slice(5): description' },
      },
    },
    {
      id: 'limits-for-each-process',
      title: 'Limits for each process',
      oneLine: 'Some limits apply to each process on its own, not to a group. systemd gives every service default limits on open files and on memory locked in RAM.',
      picture: {
        text: 'Think of a library card. It says how many books you may borrow at once, and it has a printed maximum. You may raise your own number up to that maximum, but never past it.',
        limit: 'A library card covers one person. A process hands its limits on to every process it starts, so a service with many processes gets the limit many times over.',
      },
      figure: {
        kind: 'compare',
        title: 'The kernel ceiling on open files for one process',
        axis: 'open files',
        scale: 'linear',
        bars: [
          {
            id: 'nr-open',
            label: 'fs.nr_open',
            tone: 'error',
            value: { probe: 'systemd.nrOpen', unit: 'files' },
            does: 'The most open files any process may have; the NOFILE and MEMLOCK defaults of systemd are not measured here.',
          },
        ],
        pins: [
          { key: 'default_limit_nofile_soft', bar: 'nr-open' },
          { key: 'default_limit_nofile_hard', bar: 'nr-open' },
          { key: 'default_limit_memlock', bar: 'nr-open' },
        ],
      },
      body: [
        'A [[resource limit]] has two numbers. The kernel enforces the soft one, and the hard one is the ceiling an ordinary process may raise its soft limit to[^rlimit]. A child process inherits its parent\'s limits[^rl-notes]. Each process is counted on its own, so a service can fork past a limit, which is why systemd prefers its group controls[^exec].',
        'DefaultLimitNOFILE caps the [[file descriptors|file-descriptor]] each process may hold, and defaults to 1024:524288, soft and hard[^defaults]. The soft limit stays at 1024 because `select()` cannot work with descriptors above 1023[^exec]. Programs that don\'t use it should raise their own soft limit to the hard one[^exec].',
        'The kernel adds its own cap, fs.nr_open, on the open files any one process can have[^nr-open]. DefaultLimitMEMLOCK caps the bytes a process may lock into RAM with calls such as `mlock()`[^memlock]. It defaults to 8M[^defaults].',
      ],
      pins: [
        { key: 'default_limit_nofile_soft', layer: 'nr-open', here: 'Where each process starts. Keep it at 1024 so older programs that use select() keep working. Programs that need more raise their own soft limit, up to the hard one.' },
        { key: 'default_limit_nofile_hard', layer: 'nr-open', here: 'How far a process may raise its own soft limit. Raise it for servers with many connections, such as proxies and databases. Keep it at or above the soft limit.' },
        { key: 'default_limit_memlock', layer: 'nr-open', here: 'How much memory one process may lock into RAM. Raise it for a program whose mlock() calls fail, such as some databases. Most machines don\'t need to change this.' },
      ],
      choose: [
        {
          q: 'Does a busy server log "Too many open files"?',
          check: 'systemctl show -p DefaultLimitNOFILE',
          hint: 'This is the hard limit every service gets. A server that raises its own soft limit stops there.',
          yes: { key: 'default_limit_nofile_hard', dir: 'raise' },
        },
        {
          q: 'Does an older program, one that never raises its own limit, run out of open files?',
          check: 'systemctl show -p DefaultLimitNOFILESoft',
          hint: 'This is the soft limit every service starts with.',
          yes: { key: 'default_limit_nofile_soft', dir: 'raise' },
        },
        {
          q: 'Does a program fail to lock memory, with mlock errors in its log?',
          check: 'systemctl show -p DefaultLimitMEMLOCK',
          hint: 'The bytes each service may lock into RAM. 8388608 is the 8M default.',
          yes: { key: 'default_limit_memlock', dir: 'raise' },
          no: { leave: true, why: 'The soft limit keeps older programs safe, the hard limit is already high, and that suits most machines.' },
        },
      ],
      symptoms: {
        low: 'Servers log "Too many open files", or programs fail when they try to lock memory.',
        high: 'One process can hold a very large number of files, or keep a lot of memory locked in RAM.',
      },
      look: {
        cmd: 'grep -e "open files" -e "locked memory" /proc/self/limits',
        for: 'Each line shows a limit\'s soft and hard values, here for your own shell. A service gets its limits from systemd instead.',
      },
      sources: {
        rlimit: { url: `${MAN}/man2/getrlimit.2.html#DESCRIPTION`, label: 'getrlimit(2): description' },
        'rl-notes': { url: `${MAN}/man2/getrlimit.2.html#NOTES`, label: 'getrlimit(2): notes' },
        exec: { url: `${MAN}/man5/systemd.exec.5.html#PROCESS_PROPERTIES`, label: 'systemd.exec(5): LimitNOFILE= and the other limits' },
        defaults: sc('RESOURCE_MANAGEMENT', 'DefaultLimitNOFILE= and the other limits'),
        'nr-open': { url: 'https://docs.kernel.org/admin-guide/sysctl/fs.html#nr-open', label: 'sysctl/fs: nr_open' },
        memlock: { url: `${MAN}/man2/getrlimit.2.html#DESCRIPTION`, label: 'getrlimit(2): RLIMIT_MEMLOCK' },
      },
    },
  ],
}
