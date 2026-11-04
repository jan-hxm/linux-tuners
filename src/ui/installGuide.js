/**
 * The text of the numbered install steps (save, apply, check, undo) around
 * the commands from core/output/installSteps.js. Plain JS, shared by
 * InstallSteps.vue and the static page text (src/static/), so both say the
 * same thing (Design.md §7 "Export steps").
 */

import { installSteps } from '@/core/output/installSteps.js'

/**
 * @typedef {Object} InstallGuide
 * @property {{ id: string, title: string, text: string, commands: string[] }[]} groups
 *   The numbered steps that have commands, in order
 * @property {string}   undoTitle  "If something goes wrong:"
 * @property {string}   undoText   What undoing takes, after the title
 * @property {string[]} undo       The undo commands
 */

/**
 * @param {import('@/core/output/files.js').ConfigFile[]} files
 * @param {{ combined?: boolean }} [options]  The files are shown as one text, each part after its banner
 * @returns {InstallGuide}
 */
export function installGuide(files, { combined = false } = {}) {
  const steps = installSteps(files)
  const many = files.length > 1

  let saveText = 'Save the output as this file. Open it in an editor as root, paste, and save:'
  if (many) {
    saveText = combined
      ? 'Save each part of the output, from its ===== banner to the next, as its own file. Open each in an editor as root, paste, and save:'
      : "Save each file at its path. Open each in an editor as root, paste the file's text, and save:"
  }

  const groups = [
    { id: 'save', title: many ? 'Save the files' : 'Save the file', text: saveText, commands: steps.save },
    { id: 'apply', title: many ? 'Apply them now' : 'Apply it now', text: 'Load the settings without rebooting:', commands: steps.apply },
    { id: 'check', title: 'Check a value', text: many ? 'Each command prints a value the files set:' : 'This prints a value the file sets:', commands: steps.check },
  ].filter((g) => g.commands.length)

  const what = many ? 'files' : 'file'
  const undoText = steps.reboot
    ? `delete the ${what} and reboot. The values already applied stay set until the reboot.`
    : `delete the ${what} and reload systemd.`

  return { groups, undoTitle: 'If something goes wrong:', undoText, undo: steps.undo }
}
