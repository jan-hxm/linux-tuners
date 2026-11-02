/**
 * How to install, apply, check and undo a list of generated files, for the
 * output panel's steps and the undo note at the top of each file. Every step
 * follows from a file's install path (which kind of file it is) and from names
 * read back out of its content: a sysctl key, a /sys path, a udev attribute or
 * a systemd directive. Those names come from defs, never from state, and each
 * is held to a strict pattern again here, so a command never carries a value
 * (Design.md §10).
 */

import { commentLine } from './comments.js'

const SYSCTL_KEY = /^([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+) = /m
const SYS_PATH = /^w (\/sys(?:\/[a-z0-9_]+)+) /m
const UDEV_ATTR = /ATTR\{([a-z_]+(?:\/[a-z_]+)*)\}="/
const UDEV_SUBSYSTEM = /SUBSYSTEM=="([a-z]+)"/
const INI_DIRECTIVE = /^([A-Z][A-Za-z]+)=/m
const UNIT_DIR = /^\/etc\/systemd\/system\/([a-z0-9_.@-]+\.(?:slice|service|scope))\.d\/[^/]+$/

const dirOf = (path) => path.slice(0, path.lastIndexOf('/'))

// daemon-reexec re-reads the units as daemon-reload does, so with both, the
// reload is left out.
const REEXEC = 'sudo systemctl daemon-reexec'
const RELOAD = 'sudo systemctl daemon-reload'
const withoutCovered = (list) => (list.includes(REEXEC) ? list.filter((c) => c !== RELOAD) : list)

/**
 * The kinds of file the writers produce, by install directory. `apply` loads
 * the file now; `revert` is what undoes it once the file is deleted, or null
 * when the kernel keeps the applied values until the next reboot.
 */
const KINDS = [
  {
    dir: '/etc/sysctl.d/',
    apply: () => ['sudo sysctl --system'],
    revert: null,
    check: (content) => content.match(SYSCTL_KEY)?.[1] && `sysctl ${content.match(SYSCTL_KEY)[1]}`,
  },
  {
    dir: '/etc/tmpfiles.d/',
    apply: (path) => [`sudo systemd-tmpfiles --create ${path}`],
    revert: null,
    check: (content) => content.match(SYS_PATH)?.[1] && `cat ${content.match(SYS_PATH)[1]}`,
  },
  {
    dir: '/etc/udev/rules.d/',
    apply: (path, content) => {
      const subsystem = content.match(UDEV_SUBSYSTEM)?.[1]
      return [
        'sudo udevadm control --reload',
        subsystem ? `sudo udevadm trigger --action=change --subsystem-match=${subsystem}` : 'sudo udevadm trigger --action=change',
        'sudo udevadm settle',
      ]
    },
    revert: null,
    check: (content) => {
      const subsystem = content.match(UDEV_SUBSYSTEM)?.[1]
      const attr = content.match(UDEV_ATTR)?.[1]
      return subsystem && attr && `grep . /sys/class/${subsystem}/*/${attr}`
    },
  },
  {
    dir: '/etc/systemd/system.conf.d/',
    mkdir: true,
    apply: () => [REEXEC],
    revert: () => [REEXEC],
    check: (content) => content.match(INI_DIRECTIVE)?.[1] && `systemctl show -p ${content.match(INI_DIRECTIVE)[1]}`,
  },
  {
    dir: '/etc/systemd/system/',
    mkdir: true,
    apply: () => [RELOAD],
    revert: () => [RELOAD],
    check: (content, path) => {
      const unit = path.match(UNIT_DIR)?.[1]
      const directive = content.match(INI_DIRECTIVE)?.[1]
      return unit && directive && `systemctl show ${unit} -p ${directive}`
    },
  },
]

function kindOf(path) {
  const kind = KINDS.find((k) => path.startsWith(k.dir))
  if (!kind) throw new Error(`No install steps for "${path}"`)
  return kind
}

/** Push each command once, in first-seen order. */
function addUnique(list, commands) {
  for (const c of commands) if (!list.includes(c)) list.push(c)
}

/**
 * @typedef {Object} InstallSteps
 * @property {string[]} save    Commands that open each file for pasting
 * @property {string[]} apply   Commands that load the files now
 * @property {string[]} check   One command per file that prints a value it sets
 * @property {string[]} undo    Commands that delete the files and reload
 * @property {boolean}  reboot  Whether undoing also needs a reboot
 */

/**
 * @param {import('./files.js').ConfigFile[]} files
 * @returns {InstallSteps}
 */
export function installSteps(files) {
  const steps = { save: [], apply: [], check: [], undo: [], reboot: false }
  const reverts = []
  for (const { path, content } of files) {
    const kind = kindOf(path)
    if (kind.mkdir) addUnique(steps.save, [`sudo mkdir -p ${dirOf(path)}`])
    addUnique(steps.save, [`sudo nano ${path}`])
    addUnique(steps.apply, kind.apply(path, content))
    const check = kind.check(content, path)
    if (check) addUnique(steps.check, [check])
    steps.undo.push(`sudo rm ${path}`)
    if (kind.revert) addUnique(reverts, kind.revert())
    else steps.reboot = true
  }
  addUnique(steps.undo, withoutCovered(reverts))
  steps.apply = withoutCovered(steps.apply)
  return steps
}

/**
 * The undo note for the top of a file: delete the files, then reload or
 * reboot. Built from the same steps as the output panel's; undoing depends
 * only on the paths, so a writer can call it before the content exists.
 *
 * @param {string[]} paths
 * @returns {string[]}
 */
export function undoComment(paths) {
  const { undo, reboot } = installSteps(paths.map((path) => ({ path, content: '' })))
  const what = paths.length === 1 ? 'this file' : 'these files'
  const lines = reboot
    ? [`To undo, delete ${what} and reboot. The values already applied stay`, 'set until the reboot:']
    : [`To undo, delete ${what} and reload systemd:`]
  return [...lines.map(commentLine), ...undo.map((c) => commentLine(`     ${c}`))]
}
