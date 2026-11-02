import { describe, it, expect } from 'vitest'
import { combineFiles, configFile, isSafeConfigPath } from './files.js'
import { commentLine, fileBanner, presetSummary, sectionHeader } from './comments.js'
import { sysctlConfig, sysctlLine, sysctlTryCommand } from './sysctlFile.js'
import { iniDirective, iniSection } from './iniDropIn.js'
import { sysfsTryCommand, tmpfilesConfig, tmpfilesWrite } from './tmpfilesFile.js'
import { udevAttrRule, udevConfig, udevMatch } from './udevRules.js'
import { installSteps, undoComment } from './installSteps.js'

const LS = String.fromCharCode(0x2028)

describe('config files', () => {
  it('accepts only plain paths under /etc', () => {
    expect(isSafeConfigPath('/etc/sysctl.d/99-swap-tuning.conf')).toBe(true)
    expect(isSafeConfigPath('/etc/systemd/system/user.slice.d/50-resources.conf')).toBe(true)
    for (const bad of ['/etc/../root/.bashrc', '/usr/lib/x.conf', 'etc/x.conf', '/etc/a b.conf', '/etc/X.conf', '/etc/x\n.conf', null]) {
      expect(isSafeConfigPath(bad), String(bad)).toBe(false)
    }
  })

  it('builds a file from lines, trimming trailing blank lines', () => {
    expect(configFile('/etc/a.conf', ['x', '', ''])).toEqual({ path: '/etc/a.conf', content: 'x' })
    expect(() => configFile('/tmp/a.conf', ['x'])).toThrow(/Unsafe config path/)
  })

  it('combines files with one blank line between them', () => {
    expect(combineFiles([{ path: '/etc/a', content: 'a' }, { path: '/etc/b', content: 'b' }])).toBe('a\n\nb')
    expect(combineFiles([{ path: '/etc/a', content: 'a' }])).toBe('a')
  })
})

describe('comments', () => {
  it('refuses comment text that would start a new line', () => {
    expect(commentLine('ok')).toBe('# ok')
    for (const bad of ['a\nb', 'a\rb', `a${LS}b`]) expect(() => commentLine(bad)).toThrow()
  })

  it('pads headers and banners to the full width', () => {
    expect(sectionHeader('Title')).toHaveLength(78)
    expect(fileBanner('/etc/a.conf')).toHaveLength(78)
  })

  it('summarises the preset', () => {
    expect(presetSummary(null, false)).toBe('custom')
    expect(presetSummary('Database', false)).toBe('Database')
    expect(presetSummary('Database', true)).toBe('Database (customised)')
  })
})

describe('sysctl writer', () => {
  it('writes plain space-separated tokens only', () => {
    expect(sysctlLine('vm.swappiness', '10')).toBe('vm.swappiness = 10')
    expect(sysctlLine('net.ipv4.tcp_rmem', '4096 131072 6291456')).toBe('net.ipv4.tcp_rmem = 4096 131072 6291456')
    expect(sysctlLine('kernel.perf_event_paranoid', '-1')).toBe('kernel.perf_event_paranoid = -1')
    for (const bad of ['', ' 1', '1 ', '1  2', '1\tx', '10\nkernel.modprobe = /x', '1 # x', '/bin/sh', 'a=b']) {
      expect(() => sysctlLine('vm.swappiness', bad), JSON.stringify(bad)).toThrow()
    }
  })

  it('refuses a name that is not a dotted sysctl', () => {
    for (const bad of ['swappiness', 'vm.swappiness = 1\nx', 'VM.Swappiness', 'vm.a b']) {
      expect(() => sysctlLine(bad, '1'), bad).toThrow()
    }
  })

  it("prints each value through its def's type and refuses a non-integer", () => {
    const defs = [{ key: 'a', group: 's', sysctlName: 'vm.a' }]
    const write = (a) => sysctlConfig({ defs, sections: [{ id: 's', title: 'S' }], params: { a }, comment: () => 'x' })
    expect(write(7)).toContain('vm.a = 7')
    for (const bad of [1.5, NaN, '10', null]) expect(() => write(bad), String(bad)).toThrow()
  })

  it('emits each section in order with its defs and skips excluded ones', () => {
    const defs = [
      { key: 'a', group: 's2', sysctlName: 'vm.a' },
      { key: 'b', group: 's1', sysctlName: 'vm.b' },
      { key: 'c', group: 's1', sysctlName: 'vm.c' },
    ]
    const lines = sysctlConfig({
      defs,
      sections: [{ id: 's1', title: 'One' }, { id: 's2', title: 'Two' }],
      params: { a: 1, b: 2, c: 3 },
      comment: (def, v) => `note ${v}`,
      include: (def) => def.key !== 'c',
    })
    expect(lines).toEqual([
      sectionHeader('One'),
      '# b: 2 - note 2', 'vm.b = 2', '',
      sectionHeader('Two'),
      '# a: 1 - note 1', 'vm.a = 1', '',
    ])
  })
})

describe('tmpfiles writer', () => {
  const THP = '/sys/kernel/mm/transparent_hugepage/enabled'

  it('writes a w line with mode, owner, group and age left alone', () => {
    expect(tmpfilesWrite(THP, 'madvise')).toBe(`w ${THP} - - - - madvise`)
    expect(tmpfilesWrite('/sys/kernel/mm/transparent_hugepage/defrag', 'defer+madvise')).toMatch(/ defer\+madvise$/)
  })

  it('refuses a value that could add a field, a line, a specifier or an escape', () => {
    for (const bad of ['', 'a b', 'x\nw /etc/shadow - - - - x', '%h', 'a\\nb', '1;2', '/etc/x']) {
      expect(() => tmpfilesWrite(THP, bad), JSON.stringify(bad)).toThrow()
    }
  })

  it('refuses a path outside /sys or with traversal or spaces', () => {
    for (const bad of ['/etc/shadow', '/sys/../etc/shadow', '/sys/kernel/a b', 'sys/kernel/x', '/sys/', '/sys/kernel/X']) {
      expect(() => tmpfilesWrite(bad, '1'), bad).toThrow()
    }
  })

  it('prints sections and values through the def types', () => {
    const defs = [
      { key: 'a', group: 't', sysfsPath: '/sys/kernel/mm/a', type: 'enum', options: [{ value: 'on' }] },
      { key: 'b', group: 't', sysfsPath: '/sys/kernel/mm/b' },
    ]
    const lines = tmpfilesConfig({ defs, sections: [{ id: 't', title: 'T' }], params: { a: 'on', b: 7 }, comment: () => 'n', include: (d) => d.key === 'a' })
    expect(lines).toEqual([sectionHeader('T'), '# a: on - n', 'w /sys/kernel/mm/a - - - - on', ''])
    expect(() => tmpfilesConfig({ defs, sections: [{ id: 't', title: 'T' }], params: { a: 'off', b: 7 }, comment: () => 'n' })).toThrow()
  })
})

describe('udev rules writer', () => {
  const HDD = [['ACTION', 'add|change'], ['SUBSYSTEM', 'block'], ['KERNEL', 'sd[a-z]*'], ['ENV{DEVTYPE}', 'disk'], ['ATTR{queue/rotational}', '1']]

  it('writes match clauses and one attribute assignment', () => {
    expect(udevAttrRule(HDD, 'queue/scheduler', 'bfq')).toBe(
      'ACTION=="add|change", SUBSYSTEM=="block", KERNEL=="sd[a-z]*", ENV{DEVTYPE}=="disk", ATTR{queue/rotational}=="1", ATTR{queue/scheduler}="bfq"',
    )
    expect(udevAttrRule([['KERNEL', 'nvme[0-9]*n[0-9]*']], 'queue/scheduler', 'mq-deadline')).toMatch(/="mq-deadline"$/)
  })

  it('refuses a value that could close the quote, add a clause or substitute', () => {
    for (const bad of ['', 'a b', 'x", RUN+="/bin/sh', '$kernel', '%k', 'a\\nb', 'x\nKERNEL=="sda"', '1,2']) {
      expect(() => udevAttrRule(HDD, 'queue/scheduler', bad), JSON.stringify(bad)).toThrow()
    }
  })

  it('refuses an assignment key, a substitution or a quote in the match', () => {
    for (const clause of [['RUN', 'x'], ['PROGRAM', 'x'], ['IMPORT{program}', 'x'], ['NAME', 'x'], ['KERNEL', 'sd"'], ['KERNEL', '$name'], ['KERNEL', '%k'], ['KERNEL', 'a b'], ['ATTR{../x}', '1']]) {
      expect(() => udevMatch([clause]), JSON.stringify(clause)).toThrow()
    }
    expect(() => udevMatch([])).toThrow()
  })

  it('refuses an attribute outside the device directory', () => {
    for (const bad of ['../x', '/sys/x', 'queue/', 'queue/Scheduler', 'queue scheduler']) {
      expect(() => udevAttrRule(HDD, bad, '1'), bad).toThrow()
    }
  })

  it('prints sections and values through the def types', () => {
    const defs = [
      { key: 'a', group: 't', udevAttr: 'queue/a', type: 'enum', options: [{ value: 'on' }] },
      { key: 'b', group: 't', udevAttr: 'queue/b' },
    ]
    const lines = udevConfig({ defs, sections: [{ id: 't', title: 'T' }], params: { a: 'on', b: 7 }, match: [['KERNEL', 'vd[a-z]*']], comment: () => 'n', include: (d) => d.key === 'a' })
    expect(lines).toEqual([sectionHeader('T'), '# a: on - n', 'KERNEL=="vd[a-z]*", ATTR{queue/a}="on"', ''])
    expect(() => udevConfig({ defs, sections: [{ id: 't', title: 'T' }], params: { a: 'off', b: 7 }, match: [['KERNEL', 'vd']], comment: () => 'n' })).toThrow()
  })
})

describe('ini drop-in writer', () => {
  it('writes a section and a commented directive', () => {
    expect(iniSection('Slice')).toBe('[Slice]')
    expect(iniDirective('MemoryMax', '50%', 'hard limit')).toEqual(['# MemoryMax: hard limit', 'MemoryMax=50%'])
  })

  it('refuses values, keys and sections that could add structure', () => {
    for (const bad of ['', '1\nExecStart=/bin/sh', '1 2', '$(id)', '/bin/sh', '1;x']) {
      expect(() => iniDirective('TasksMax', bad, 'x'), bad).toThrow()
    }
    for (const bad of ['Exec Start', 'x', 'A=B']) expect(() => iniDirective(bad, '1', 'x'), bad).toThrow()
    for (const bad of ['Slice]\n[Service', 'slice']) expect(() => iniSection(bad), bad).toThrow()
  })
})

describe('try-it commands', () => {
  it('sets every name a sysctl def writes, quoting a value with spaces', () => {
    expect(sysctlTryCommand({ sysctlName: 'vm.swappiness' }, '10')).toBe('sudo sysctl -w vm.swappiness=10')
    expect(sysctlTryCommand({ sysctlName: 'kernel.sem' }, '250 32000 100 128')).toBe('sudo sysctl -w kernel.sem="250 32000 100 128"')
    expect(sysctlTryCommand({ sysctlName: 'net.ipv4.conf.all.rp_filter', alsoSets: ['net.ipv4.conf.default.rp_filter'] }, '1'))
      .toBe('sudo sysctl -w net.ipv4.conf.all.rp_filter=1 net.ipv4.conf.default.rp_filter=1')
  })

  it('writes a sysfs value with tee', () => {
    expect(sysfsTryCommand({ sysfsPath: '/sys/kernel/mm/transparent_hugepage/enabled' }, 'madvise'))
      .toBe('echo madvise | sudo tee /sys/kernel/mm/transparent_hugepage/enabled')
  })

  it('refuses a value the file would refuse', () => {
    expect(() => sysctlTryCommand({ sysctlName: 'vm.swappiness' }, '1; reboot')).toThrow()
    expect(() => sysfsTryCommand({ sysfsPath: '/sys/kernel/mm/ksm/run' }, '1 && reboot')).toThrow()
  })
})

describe('installSteps', () => {
  const sysctl = { path: '/etc/sysctl.d/99-a.conf', content: '# vm.swappiness: 10 - low\nvm.swappiness = 10' }
  const manager = { path: '/etc/systemd/system.conf.d/99-a.conf', content: '[Manager]\n# DefaultCPUAccounting: left out\nDefaultTasksMax=4915' }
  const slice = { path: '/etc/systemd/system/user.slice.d/50-a.conf', content: '[Slice]\nCPUWeight=100' }

  it('saves, applies and checks a sysctl file, and undoes it with a reboot', () => {
    expect(installSteps([sysctl])).toEqual({
      save: ['sudo nano /etc/sysctl.d/99-a.conf'],
      apply: ['sudo sysctl --system'],
      check: ['sysctl vm.swappiness'],
      undo: ['sudo rm /etc/sysctl.d/99-a.conf'],
      reboot: true,
    })
  })

  it('creates the systemd drop-in folders and lets daemon-reexec cover daemon-reload', () => {
    const steps = installSteps([manager, slice])
    expect(steps.save).toEqual([
      'sudo mkdir -p /etc/systemd/system.conf.d',
      'sudo nano /etc/systemd/system.conf.d/99-a.conf',
      'sudo mkdir -p /etc/systemd/system/user.slice.d',
      'sudo nano /etc/systemd/system/user.slice.d/50-a.conf',
    ])
    expect(steps.apply).toEqual(['sudo systemctl daemon-reexec'])
    expect(steps.check).toEqual(['systemctl show -p DefaultTasksMax', 'systemctl show user.slice -p CPUWeight'])
    expect(steps.undo.at(-1)).toBe('sudo systemctl daemon-reexec')
    expect(steps.reboot).toBe(false)
    expect(installSteps([slice]).apply).toEqual(['sudo systemctl daemon-reload'])
  })

  it('applies each command once across files', () => {
    const other = { path: '/etc/sysctl.d/99-b.conf', content: 'fs.file-max = 1' }
    expect(installSteps([sysctl, other]).apply).toEqual(['sudo sysctl --system'])
  })

  it('reads only names back out of the content, never a value or a line it cannot match', () => {
    const hostile = { path: '/etc/sysctl.d/99-a.conf', content: 'vm.swappiness = 10; rm -rf /\n$(id) = 1' }
    expect(installSteps([hostile]).check).toEqual(['sysctl vm.swappiness'])
    expect(installSteps([{ path: '/etc/sysctl.d/99-a.conf', content: '# sets nothing' }]).check).toEqual([])
    const udev = { path: '/etc/udev/rules.d/99-a.rules', content: 'ACTION=="add|change", SUBSYSTEM=="block", ATTR{queue/scheduler}="none"' }
    expect(installSteps([udev]).check).toEqual(['grep . /sys/class/block/*/queue/scheduler'])
    expect(installSteps([udev]).apply).toContain('sudo udevadm trigger --action=change --subsystem-match=block')
  })

  it('refuses a path it has no steps for', () => {
    expect(() => installSteps([{ path: '/etc/fstab', content: '' }])).toThrow()
  })

  it('writes the undo note as comment lines', () => {
    expect(undoComment(['/etc/sysctl.d/99-a.conf'])).toEqual([
      '# To undo, delete this file and reboot. The values already applied stay',
      '# set until the reboot:',
      '#      sudo rm /etc/sysctl.d/99-a.conf',
    ])
    expect(undoComment([manager.path, slice.path])[0]).toBe('# To undo, delete these files and reload systemd:')
  })
})
